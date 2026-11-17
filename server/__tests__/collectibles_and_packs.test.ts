/**
 * BOWER JJ — Collectibles, Illustrated Avatars & Level-Up Card Pack Test Suite
 *
 * Verifies:
 * 1. Starter inventory provisioning (4 default avatars, 2 starter card backs, 0 packs).
 * 2. Level-up card pack rewards (1 per qualifying level, multi-level jump uniqueness).
 * 3. Legacy Battle Pass removal, reward preservation, and retroactive level pack backfill.
 * 4. Transactional 5-card booster pack opening, duplicate tracking, and 5/5 collection completion.
 * 5. Server-side equip validation (rejects locked avatars/card backs, permits unlocked ones).
 * 6. Live RoomManager synchronization of equipped avatars and card backs into sanitized game states.
 */

import { describe, it, expect } from 'vitest';
import { newDb } from 'pg-mem';
import crypto from 'crypto';
import { PostgresDatabaseRepository } from '../db/postgres';
import { PROGRESSION_CONFIG } from '../config/progressionConfig';
import {
  AVATAR_CATALOG,
  CARD_BACK_CATALOG,
  CARD_COLLECTIONS,
  COLLECTIBLE_CARDS,
  RarityTier,
} from '../../src/config/collectiblesCatalog';
import { RoomManager } from '../roomManager';
import { createMultiplayerServer } from '../index';
import { WebSocket } from 'ws';

function createTestPostgresPool() {
  const mem = newDb();
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });
  const pg = mem.adapters.createPg();
  return new pg.Pool();
}

function buildDeterministicCardRng(targetCardId: string, repeatOtherCards = 0.05): () => number {
  const target = COLLECTIBLE_CARDS.find((c) => c.id === targetCardId);
  if (!target) {
    throw new Error(`Card ${targetCardId} not found in catalog`);
  }
  const order: RarityTier[] = ['common', 'rare', 'epic', 'legendary'];
  const rates = PROGRESSION_CONFIG.rarityDropRates;
  const totalWeight = order.reduce((sum, r) => sum + rates[r], 0);
  let cumulativeBefore = 0;
  for (const tier of order) {
    if (tier === target.rarity) break;
    cumulativeBefore += rates[tier];
  }
  const rRarity = (cumulativeBefore + rates[target.rarity] * 0.5) / totalWeight;
  const pool = COLLECTIBLE_CARDS.filter((c) => c.rarity === target.rarity);
  const idx = pool.findIndex((c) => c.id === target.id);
  const rCard = (idx + 0.5) / pool.length;

  const seq = [rRarity, rCard];
  let cursor = 0;
  return () => {
    if (cursor < seq.length) return seq[cursor++];
    return repeatOtherCards;
  };
}

describe('Collectibles, Card Packs & Server Validation', () => {
  it('provisions default starters on user creation and enforces catalog counts', async () => {
    const pool = createTestPostgresPool();
    const repo = new PostgresDatabaseRepository(pool);
    await repo.initSchema();

    expect(AVATAR_CATALOG.length).toBe(16);
    expect(CARD_COLLECTIONS.length).toBe(10);
    expect(COLLECTIBLE_CARDS.length).toBe(50);
    expect(CARD_BACK_CATALOG.length).toBe(15);

    const { user } = await repo.getOrCreateUser('FreshCollector', '🤠');
    expect(user.avatarIcon).toBe('the_outlaw');
    expect(user.unopenedPacksCount).toBe(0);

    const colState = await repo.getCollectionState(user.id);
    expect(colState.unopenedPacksCount).toBe(0);
    expect(colState.unlockedAvatars).toEqual(
      expect.arrayContaining(['the_outlaw', 'elven_trickster', 'cyber_bot', 'clever_fox'])
    );
    expect(colState.unlockedCardBacks).toEqual(
      expect.arrayContaining(['classic_blue', 'classic_red'])
    );
    expect(colState.unlockedCardBacks.length).toBe(2);
    expect(colState.cards.length).toBe(0);

    await repo.close();
  });

  it('awards exactly 1 card pack per level-up including multi-level jumps without duplicates', async () => {
    const pool = createTestPostgresPool();
    const repo = new PostgresDatabaseRepository(pool);
    await repo.initSchema();

    const { user } = await repo.getOrCreateUser('LevelJumper', '🤠');

    // Match 1 grants 350 XP -> still Level 1, 0 packs
    const res1 = await repo.recordMatchResult({
      matchId: 'm_lvl_1',
      roomCode: 'LVL001',
      mode: 'ranked_solo',
      composition: '4H',
      winningTeam: 0,
      finalScore: '10 - 5',
      humanPlayers: [
        {
          userId: user.id,
          position: 0,
          team: 0,
          username: user.username,
          avatarIcon: user.avatarIcon,
          won: true,
          tricksWon: 4,
          euchres: 0,
          marches: 0,
          successfulLoners: 0,
        },
      ],
      idempotencyKey: 'k_lvl_1',
    });
    expect(res1.playerResults[0].newLevel).toBe(1);
    expect(res1.playerResults[0].packsAwarded).toBe(0);

    // Jump user close to multiple level-ups: 2900 XP on level 1 (next win pushes past 3000 -> Level 4, earning levels 2, 3, 4 = 3 packs)
    await repo.updateUser(user.id, { level: 1, xp: 2900 });
    const res2 = await repo.recordMatchResult({
      matchId: 'm_lvl_2',
      roomCode: 'LVL002',
      mode: 'ranked_solo',
      composition: '4H',
      winningTeam: 0,
      finalScore: '10 - 2',
      humanPlayers: [
        {
          userId: user.id,
          position: 0,
          team: 0,
          username: user.username,
          avatarIcon: user.avatarIcon,
          won: true,
          tricksWon: 5,
          euchres: 1,
          marches: 1,
          successfulLoners: 0,
        },
      ],
      idempotencyKey: 'k_lvl_2',
    });

    expect(res2.playerResults[0].newLevel).toBe(4);
    expect(res2.playerResults[0].packsAwarded).toBe(3);
    expect(res2.playerResults[0].totalUnopenedPacks).toBe(3);

    // Running idempotent backfill / schema re-init must not duplicate level_2..level_4 packs
    await repo.initSchema();
    const afterReinit = await repo.getCollectionState(user.id);
    expect(afterReinit.unopenedPacksCount).toBe(3);

    await repo.close();
  });

  it('drops legacy player_battle_pass cleanly while preserving legacy rewards & granting level-up backfill packs', async () => {
    const pool = createTestPostgresPool();

    // Simulate pre-overhaul schema with player_battle_pass before initSchema() runs
    await pool.query(`
      CREATE TABLE public.profiles (
        id UUID PRIMARY KEY,
        player_id TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        avatar_icon TEXT NOT NULL DEFAULT '🤠',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      CREATE TABLE public.player_xp (
        user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
        level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        next_level_xp INTEGER NOT NULL DEFAULT 1000,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      CREATE TABLE public.player_cosmetics (
        user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
        equipped_hat TEXT,
        equipped_card_back TEXT DEFAULT 'classic_blue',
        equipped_banner TEXT DEFAULT 'default_navy',
        equipped_title TEXT DEFAULT 'Recruit',
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
      CREATE TABLE public.player_battle_pass (
        user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
        tier INTEGER NOT NULL DEFAULT 1,
        is_premium BOOLEAN NOT NULL DEFAULT FALSE,
        claimed_free_tiers INTEGER[] NOT NULL DEFAULT '{}',
        claimed_premium_tiers INTEGER[] NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    const legacyUid = crypto.randomUUID();
    await pool.query(
      `INSERT INTO public.profiles (id, player_id, username, avatar_icon) VALUES ($1, 'JJ-LEG1', 'LegacyVet', '🎩')`,
      [legacyUid]
    );
    await pool.query(`INSERT INTO public.player_xp (user_id, level, xp) VALUES ($1, 4, 250)`, [legacyUid]);
    await pool.query(
      `INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back) VALUES ($1, '🎩', 'crimson_royal')`,
      [legacyUid]
    );
    await pool.query(
      `INSERT INTO public.player_battle_pass (user_id, tier, is_premium, claimed_free_tiers, claimed_premium_tiers)
       VALUES ($1, 6, true, '{3,5}', '{1,5}')`,
      [legacyUid]
    );

    const repo = new PostgresDatabaseRepository(pool);
    await repo.initSchema();

    // Verify obsolete player_battle_pass table is dropped
    const bpTableCheck = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'player_battle_pass'`
    );
    expect(bpTableCheck.rows.length).toBe(0);

    // Verify user preserved rewards, canonicalized emoji IDs, and received level 4 -> 3 packs
    const migratedUser = await repo.getUserById(legacyUid);
    expect(migratedUser).not.toBeNull();
    expect(migratedUser!.avatarIcon).toBe('velvet_gentleman');
    expect(migratedUser!.equippedCosmetics.cardBack).toBe('inferno');
    expect(migratedUser!.unopenedPacksCount).toBe(3);

    const col = await repo.getCollectionState(legacyUid);
    expect(col.unlockedAvatars).toContain('velvet_gentleman');
    expect(col.unlockedCardBacks).toContain('dark_royalty');
    expect(col.unlockedCardBacks).toContain('inferno');

    await repo.close();
  });

  it('tracks duplicate cards without false completion and unlocks card back on 5/5 unique identities', async () => {
    const pool = createTestPostgresPool();
    const repo = new PostgresDatabaseRepository(pool);
    await repo.initSchema();

    const { user } = await repo.getOrCreateUser('CollectorFive', '🤠');

    // Grant 2 unopened packs
    await pool.query(
      `INSERT INTO public.player_card_packs (id, user_id, source, source_ref, earned_level, status, earned_at)
       VALUES ($1, $2, 'level_up', 'level_2', 2, 'unopened', NOW()),
              ($3, $2, 'level_up', 'level_3', 3, 'unopened', NOW())`,
      [crypto.randomUUID(), user.id, crypto.randomUUID()]
    );

    // Seed 4 of 5 unique Wild West identities (10, J, Q, K) + a duplicate 10 (qty=2)
    for (const identity of ['10', 'J', 'Q', 'K'] as const) {
      const cardId = `wild_west_${identity}`;
      const def = COLLECTIBLE_CARDS.find((c) => c.id === cardId)!;
      await pool.query(
        `INSERT INTO public.player_card_inventory
         (id, user_id, card_id, collection_id, identity, rarity, quantity, first_acquired_at, last_acquired_at)
         VALUES ($1, $2, $3, 'wild_west', $4, $5, $6, NOW(), NOW())`,
        [crypto.randomUUID(), user.id, cardId, identity, def.rarity, identity === '10' ? 2 : 1]
      );
    }

    // Confirm duplicate quantity did NOT prematurely unlock Wild West card back
    const beforeFifth = await repo.getCollectionState(user.id);
    const wwOwned = new Set(
      beforeFifth.cards.filter((c) => c.collectionId === 'wild_west' && c.quantity > 0).map((c) => c.identity)
    );
    expect(wwOwned.size).toBe(4);
    expect(beforeFifth.unlockedCardBacks).not.toContain('wild_west');

    // Open Pack 1 with deterministic RNG pulling wild_west_A in slot 0 -> completes 5/5!
    const rngHitAce = buildDeterministicCardRng('wild_west_A');
    const open1 = await repo.openCardPack(user.id, undefined, rngHitAce);
    expect(open1.success).toBe(true);
    expect(open1.result!.cards.length).toBe(5);
    expect(open1.result!.cards[0].cardId).toBe('wild_west_A');
    expect(open1.result!.cards[0].wasDuplicate).toBe(false);
    expect(open1.result!.newlyUnlockedCardBacks).toContain('wild_west');
    expect(open1.result!.remainingUnopenedPacks).toBe(1);

    // Pulling wild_west_A again on Pack 2 marks it duplicate and does not re-unlock
    const rngHitAceAgain = buildDeterministicCardRng('wild_west_A');
    const open2 = await repo.openCardPack(user.id, undefined, rngHitAceAgain);
    expect(open2.success).toBe(true);
    expect(open2.result!.cards[0].cardId).toBe('wild_west_A');
    expect(open2.result!.cards[0].wasDuplicate).toBe(true);
    expect(open2.result!.cards[0].newQuantity).toBe(2);
    expect(open2.result!.newlyUnlockedCardBacks).not.toContain('wild_west');
    expect(open2.result!.collectionState.unlockedCardBacks).toContain('wild_west');

    await repo.close();
  });

  it('rejects locked avatar/cardBack equips server-side and syncs unlocked equips over WebSocket & Rooms', async () => {
    const pool = createTestPostgresPool();
    const repo = new PostgresDatabaseRepository(pool);
    await repo.initSchema();

    const { user } = await repo.getOrCreateUser('SyncChecker', '🤠');

    // Attempt to equip locked Legendary avatar & Celestial card back -> must fail
    const badAvatar = await repo.equipAvatar(user.id, 'bower_king');
    expect(badAvatar.success).toBe(false);
    const badBack = await repo.equipCardBack(user.id, 'celestial');
    expect(badBack.success).toBe(false);

    // Unlock thunder_knight and wild_west card back, then equip
    await pool.query(
      `INSERT INTO public.player_avatars (id, user_id, avatar_id, source) VALUES ($1, $2, 'thunder_knight', 'test')`,
      [crypto.randomUUID(), user.id]
    );
    await pool.query(
      `INSERT INTO public.player_card_backs (id, user_id, card_back_id, collection_id, source)
       VALUES ($1, $2, 'wild_west', 'wild_west', 'collection')`,
      [crypto.randomUUID(), user.id]
    );

    const goodAvatar = await repo.equipAvatar(user.id, 'thunder_knight');
    const goodBack = await repo.equipCardBack(user.id, 'wild_west');
    expect(goodAvatar.success).toBe(true);
    expect(goodBack.success).toBe(true);

    // Verify RoomManager and WS server reflect updated avatar & equippedCardBack in live game state
    const srv = await createMultiplayerServer(0, undefined, undefined, repo);
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);
      const msgs: any[] = [];
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'AUTH', username: user.username, avatarIcon: '🤠' }));
        });
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          msgs.push(msg);
          if (msg.type === 'AUTH_SUCCESS') {
            ws.send(JSON.stringify({ type: 'GET_COLLECTION_STATE' }));
          } else if (msg.type === 'COLLECTION_STATE') {
            ws.send(JSON.stringify({ type: 'ROOM_CREATE', queueMode: 'custom' }));
          } else if (msg.type === 'ROOM_UPDATE') {
            resolve();
          }
        });
        ws.on('error', reject);
      });

      const roomMsg = msgs.find((m) => m.type === 'ROOM_UPDATE');
      expect(roomMsg.room.slots[0].avatarIcon).toBe('thunder_knight');
      expect(roomMsg.room.slots[0].equippedCardBack).toBe('wild_west');
      ws.close();
    } finally {
      await srv.close();
    }

    // RoomManager directly preserves equippedCardBack in sanitized game state broadcast
    const rm = new RoomManager();
    const sentMessages: any[] = [];
    rm.registerConnection(user.id, {
      ws: {
        readyState: 1,
        send: (payload: string) => sentMessages.push(JSON.parse(payload)),
      } as any,
      userId: user.id,
      username: user.username,
      avatarIcon: 'thunder_knight',
      equippedCardBack: 'wild_west',
    });
    const room = rm.createRoom(user.id);
    rm.fillWithAI(user.id, 'hard');
    rm.startGame(user.id);
    const syncMsg = [...sentMessages].reverse().find((m) => m.type === 'GAME_SYNC');
    expect(syncMsg).toBeDefined();
    expect(syncMsg.state.slots[0]?.equippedCardBack).toBe('wild_west');
    expect(syncMsg.state.slots[1]?.equippedCardBack).toBeTruthy();
    rm.cleanup();
  });

  it('allows unlimited pack opening for testing accounts (Brojo / Turkeysub)', async () => {
    const pool = createTestPostgresPool();
    const repo = new PostgresDatabaseRepository(pool);
    await repo.initSchema();

    const { user: brojo } = await repo.getOrCreateUser('Brojo', '🤠');
    expect(brojo.unopenedPacksCount).toBe(0);

    // Opening pack should succeed on the fly for Brojo
    const openRes = await repo.openCardPack(brojo.id);
    expect(openRes.success).toBe(true);
    expect(openRes.result?.cards.length).toBe(5);

    // Non-test account with 0 packs must fail
    const { user: regular } = await repo.getOrCreateUser('RegularPlayer', '🤠');
    expect(regular.unopenedPacksCount).toBe(0);
    const failRes = await repo.openCardPack(regular.id);
    expect(failRes.success).toBe(false);
    expect(failRes.error).toBe('No unopened card packs available.');

    await repo.close();
  });
});
