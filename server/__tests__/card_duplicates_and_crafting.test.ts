import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { PostgresRepository } from '../db/postgres';
import { COLLECTIBLE_CARDS, WAX_SEALS_CONFIG, getCraftCost } from '../../src/config/collectiblesCatalog';
import crypto from 'crypto';

describe('Card Duplicates Dust Conversion & Hearthstone-Style Crafting Suite', () => {
  describe('In-Memory Fallback Engine (db.ts)', () => {
    it('initializes users with default 150 Wax Seals (Dust)', () => {
      const { user } = db.getOrCreateUser(`CraftTester_${Date.now()}`, 'avatar_1');
      const colState = db.getCollectionState(user.id);
      expect(colState.waxSeals).toBe(150);
      expect(user.waxSeals).toBe(150);
    });

    it('awards dust for duplicates according to rarity and increases waxSeals balance', () => {
      const { user } = db.getOrCreateUser(`DupeTester_${Date.now()}`, 'avatar_1');
      const colState = db.getCollectionState(user.id);

      // Add a known card to user inventory so next time it is drawn, it is a duplicate
      const testCard = COLLECTIBLE_CARDS[0]; // e.g. classic_navy_10 (common)
      colState.cards.push({
        cardId: testCard.id,
        collectionId: testCard.collectionId,
        identity: testCard.identity,
        rarity: testCard.rarity,
        quantity: 1,
        firstAcquiredAt: Date.now(),
        lastAcquiredAt: Date.now(),
      });

      // Grant a pack
      colState.unopenedPacks.push({
        id: crypto.randomUUID(),
        source: 'level_up',
        sourceRef: `test_pack_${Date.now()}`,
        earnedLevel: 2,
        earnedAt: Date.now(),
      });

      const initialSeals = user.waxSeals ?? 150;

      // Mock rollPackCards to return testCard in slot 0 (guaranteed duplicate)
      const openRes = db.openCardPack(user.id, undefined, () => 0.01);
      expect(openRes.success).toBe(true);
      expect(openRes.result).toBeDefined();

      const dupeCards = openRes.result!.cards.filter((c) => c.wasDuplicate);
      expect(dupeCards.length).toBeGreaterThan(0);

      const expectedDust = dupeCards.reduce(
        (sum, c) => sum + (WAX_SEALS_CONFIG.duplicateSeals[c.rarity] || 10),
        0
      );
      expect(openRes.result!.waxSealsAwarded).toBe(expectedDust);
      expect(openRes.result!.totalWaxSeals).toBe(initialSeals + expectedDust);
      expect(user.waxSeals).toBe(initialSeals + expectedDust);
      expect(openRes.result!.collectionState.waxSeals).toBe(initialSeals + expectedDust);

      // Verify slot has dustAwarded populated
      dupeCards.forEach((c) => {
        expect(c.dustAwarded).toBe(WAX_SEALS_CONFIG.duplicateSeals[c.rarity]);
      });
    });

    it('rejects crafting when user has insufficient Wax Seals (Dust)', () => {
      const { user } = db.getOrCreateUser(`PoorCrafter_${Date.now()}`, 'avatar_1');
      user.waxSeals = 10; // Insufficient for even a Common card (cost: 40)
      const colState = db.getCollectionState(user.id);
      colState.waxSeals = 10;

      const commonCard = COLLECTIBLE_CARDS.find((c) => c.rarity === 'common')!;
      const craftRes = db.craftCard(user.id, commonCard.id);

      expect(craftRes.success).toBe(false);
      expect(craftRes.error).toContain('Insufficient Wax Seals (Dust)');
      expect(user.waxSeals).toBe(10);
    });

    it('crafts a card authoritatively: deducts dust, adds card to inventory, and unlocks card back on set completion', () => {
      const { user } = db.getOrCreateUser(`GrandCrafter_${Date.now()}`, 'avatar_1');
      user.waxSeals = 500;
      const colState = db.getCollectionState(user.id);
      colState.waxSeals = 500;

      const targetColId = 'wild_west';
      const colCards = COLLECTIBLE_CARDS.filter((c) => c.collectionId === targetColId);
      expect(colCards.length).toBe(5);

      // Pre-own 4 of 5 cards (10, J, Q, K)
      for (let i = 0; i < 4; i++) {
        colState.cards.push({
          cardId: colCards[i].id,
          collectionId: targetColId,
          identity: colCards[i].identity,
          rarity: colCards[i].rarity,
          quantity: 1,
          firstAcquiredAt: Date.now(),
          lastAcquiredAt: Date.now(),
        });
      }
      expect(colState.unlockedCardBacks).not.toContain(targetColId);

      // Craft the 5th card (Ace - rare, cost 100)
      const missingCard = colCards[4];
      const cost = getCraftCost(missingCard.rarity);
      const craftRes = db.craftCard(user.id, missingCard.id);

      expect(craftRes.success).toBe(true);
      expect(craftRes.cardId).toBe(missingCard.id);
      expect(craftRes.waxSeals).toBe(500 - cost);
      expect(user.waxSeals).toBe(500 - cost);
      expect(craftRes.collectionState?.waxSeals).toBe(500 - cost);

      // Verify card was added to inventory
      const owned = craftRes.collectionState?.cards.find((c) => c.cardId === missingCard.id);
      expect(owned).toBeDefined();
      expect(owned?.quantity).toBe(1);

      // Verify set completion unlocked the card back!
      expect(craftRes.newlyUnlockedCardBacks).toContain(targetColId);
      expect(craftRes.collectionState?.unlockedCardBacks).toContain(targetColId);
    });
  });

  describe('PostgreSQL Authoritative Repository', () => {
    it('persists dust from duplicates and supports authoritative crafting in postgres', async () => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) return;

      const repo = new PostgresRepository({
        connectionString: databaseUrl,
        maxPoolSize: 5,
      });

      try {
        const testUserId = crypto.randomUUID();
        const username = `PgDustTest_${Date.now().toString(36)}`;

        await repo.createOrUpdateProfile({
          id: testUserId,
          username,
          avatarUrl: 'avatar_1',
          selectedCardBack: 'classic_navy',
          selectedFelt: 'felt_midnight_navy',
          tableStickers: [],
          unlockedAvatars: ['avatar_1'],
        });

        // Verify initial state has 150 wax seals
        const state1 = await repo.getCollectionState(testUserId);
        expect(state1.waxSeals).toBe(150);

        // Pre-insert a card into inventory to guarantee duplicate on pack open
        const cardToDupe = COLLECTIBLE_CARDS[0]; // classic_navy_10
        const client = await (repo as any).pool.connect();
        try {
          await client.query(
            `
            INSERT INTO public.player_card_inventory (
              id, user_id, card_id, collection_id, identity, rarity, quantity, first_acquired_at, last_acquired_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW())
            `,
            [crypto.randomUUID(), testUserId, cardToDupe.id, cardToDupe.collectionId, cardToDupe.identity, cardToDupe.rarity]
          );
          // Grant 1 pack
          await client.query(
            `
            INSERT INTO public.player_card_packs (
              id, user_id, source, source_ref, earned_level, status, earned_at
            ) VALUES ($1, $2, 'test', 'ref_1', 1, 'unopened', NOW())
            `,
            [crypto.randomUUID(), testUserId]
          );
        } finally {
          client.release();
        }

        // Open pack (mock rng to draw cardToDupe)
        const packRes = await repo.openCardPack(testUserId, undefined, () => 0.01);
        expect(packRes.success).toBe(true);
        expect(packRes.result).toBeDefined();

        const dupes = packRes.result!.cards.filter((c) => c.wasDuplicate);
        expect(dupes.length).toBeGreaterThan(0);
        expect(packRes.result!.waxSealsAwarded).toBeGreaterThan(0);
        expect(packRes.result!.totalWaxSeals).toBe(150 + packRes.result!.waxSealsAwarded!);

        // Verify state after pack open reflects new wax seals
        const state2 = await repo.getCollectionState(testUserId);
        expect(state2.waxSeals).toBe(packRes.result!.totalWaxSeals);

        // Now craft a Common card (cost: 40)
        const cardToCraft = COLLECTIBLE_CARDS.find((c) => c.rarity === 'common' && c.id !== cardToDupe.id)!;
        const craftRes = await repo.craftCard(testUserId, cardToCraft.id);

        expect(craftRes.success).toBe(true);
        expect(craftRes.cardId).toBe(cardToCraft.id);
        expect(craftRes.waxSeals).toBe(state2.waxSeals! - 40);

        // Verify card is now in inventory
        const state3 = await repo.getCollectionState(testUserId);
        expect(state3.waxSeals).toBe(state2.waxSeals! - 40);
        expect(state3.cards.some((c) => c.cardId === cardToCraft.id)).toBe(true);
      } finally {
        await repo.close();
      }
    });
  });
});
