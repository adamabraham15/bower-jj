/**
 * BOWER JJ — Authoritative PostgreSQL Database Repository Layer
 *
 * Implements high-performance connection pooling, transactional competitive progression,
 * idempotency enforcement, and shared multi-instance active match persistence.
 */

import pg from 'pg';
import crypto from 'crypto';
import {
  UserAccount,
  RankTier,
  MatchRecord,
  FriendSummary,
  LeaderboardEntry,
  MatchmakingStats,
  PublicPlayerData,
  Room,
  PlayerCollectionState,
  PackOpenResult,
  DrawnCardResult,
  OwnedCardItem,
  UnopenedPackItem,
  PackHistoryEntry,
} from '../types';
import { EuchreGameState, PlayerPosition } from '../../src/engine/types';
import { POSTGRES_TABLE_DEFINITIONS, COLLECTIBLE_SCHEMA_DEFINITIONS } from './schema';
import {
  AVATAR_CATALOG,
  CARD_BACK_CATALOG,
  CARD_COLLECTIONS,
  COLLECTIBLE_CARDS,
  DEFAULT_AVATAR_ID,
  DEFAULT_CARD_BACK_ID,
  CardIdentity,
  RarityTier,
  getAvatarDefinition,
  getCardBackDefinition,
  getEligibleMilestoneAvatars,
  resolveAvatarId,
  resolveCardBackId,
} from '../../src/config/collectiblesCatalog';
import { PROGRESSION_CONFIG, rollPackCards } from '../config/progressionConfig';

const { Pool } = pg;

export const TIER_ORDER: RankTier[] = ['9', '10', 'Q', 'K', 'A', 'BOWER_JJ'];

export interface PostgresConfig {
  connectionString?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | object;
}

export interface MatchResultRecordInput {
  matchId: string;
  roomCode: string;
  mode: 'ranked_solo' | 'ranked_rivals' | 'ranked_duo' | 'unranked' | 'private';
  composition: '4H' | '3H1B' | '2H2B' | '1H3B';
  winningTeam: number;
  finalScore: string;
  durationSeconds?: number;
  humanPlayers: {
    userId: string;
    position: PlayerPosition;
    team: number;
    username: string;
    rankTier: RankTier;
    rankPoints: number;
    mmr: number;
    tricksWon: number;
    euchres: number;
    marches: number;
    successfulLoners: number;
    opponentNames?: string[];
    teammateAbandoned?: boolean;
  }[];
  idempotencyKey?: string;
  xpEarnedOverride?: number;
}

export class PostgresDatabaseRepository {
  private pool: pg.Pool;
  private isPoolOwner: boolean = true;
  private sessionStore: Map<string, string> = new Map(); // sessionToken -> userId (in-memory cache)

  constructor(poolOrConfig?: pg.Pool | PostgresConfig | string) {
    if (poolOrConfig && typeof (poolOrConfig as any).query === 'function') {
      this.pool = poolOrConfig as pg.Pool;
      this.isPoolOwner = false;
    } else {
      const config: PostgresConfig =
        typeof poolOrConfig === 'string'
          ? { connectionString: poolOrConfig }
          : (poolOrConfig as PostgresConfig) || {};
      const connectionString = config.connectionString || process.env.DATABASE_URL;

      let ssl: any = config.ssl;
      if (ssl === undefined && connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
        ssl = { rejectUnauthorized: false };
      }

      this.pool = new Pool({
        connectionString,
        max: config.max || parseInt(process.env.PG_POOL_MAX || '35', 10),
        idleTimeoutMillis: config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: config.connectionTimeoutMillis || 10000,
        ssl,
      });

      this.pool.on('error', (err) => {
        console.error('[POSTGRES POOL ERROR] Unexpected client error:', err.message);
      });
    }
  }

  public getPool(): pg.Pool {
    return this.pool;
  }

  public async close(): Promise<void> {
    if (this.isPoolOwner) {
      await this.pool.end();
    }
  }

  public async healthCheck(): Promise<{ ok: boolean; healthy: boolean; latencyMs: number; poolStats: any; error?: string }> {
    const start = Date.now();
    try {
      await this.pool.query('SELECT 1');
      return {
        ok: true,
        healthy: true,
        latencyMs: Date.now() - start,
        poolStats: {
          totalCount: (this.pool as any).totalCount || 1,
          idleCount: (this.pool as any).idleCount || 1,
          waitingCount: (this.pool as any).waitingCount || 0,
        },
      };
    } catch (err: any) {
      return {
        ok: false,
        healthy: false,
        latencyMs: Date.now() - start,
        poolStats: {},
        error: err.message || String(err),
      };
    }
  }

  public async initSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const statements = `${POSTGRES_TABLE_DEFINITIONS}\n${COLLECTIBLE_SCHEMA_DEFINITIONS}`
        .replace(/--.*$/gm, '')
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const existingTablesRes = await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      );
      const existingTables = new Set<string>(existingTablesRes.rows.map((r) => String(r.table_name)));

      for (const sql of statements) {
        const createMatch = sql.match(/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(?:public\.)?([a-zA-Z0-9_]+)/i);
        if (createMatch && existingTables.has(createMatch[1].toLowerCase())) {
          continue;
        }
        await client.query(sql);
      }

      // Fast-path skip if schema + catalogs + 4.6.0/4.6.1 migrations are already cleanly applied
      const migRes = await client.query(
        `SELECT version FROM schema_migrations WHERE version IN ('4.5.0', '4.6.0', '4.6.1')`
      );
      const appliedVersions = new Set(migRes.rows.map((r) => String(r.version)));
      const bpStillExistsRes = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'player_battle_pass') AS exists`
      );
      const bpStillExists = Boolean(bpStillExistsRes.rows[0]?.exists);
      const catCountsRes = await client.query(
        `SELECT (SELECT COUNT(*)::int FROM public.avatar_catalog) AS avatars, (SELECT COUNT(*)::int FROM public.card_collections) AS cols, (SELECT COUNT(*)::int FROM public.collectible_cards) AS cards`
      );
      const catCounts = catCountsRes.rows[0] || {};
      const catalogsComplete =
        Number(catCounts.avatars) >= AVATAR_CATALOG.length &&
        Number(catCounts.cols) >= CARD_COLLECTIONS.length &&
        Number(catCounts.cards) >= COLLECTIBLE_CARDS.length;

      if (!catalogsComplete) {
        // Seed Avatar Catalog
        for (const av of AVATAR_CATALOG) {
          await client.query(
            `
            INSERT INTO public.avatar_catalog (id, name, theme, rarity, image_url, unlocked_by_default, unlock_hint)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              theme = EXCLUDED.theme,
              rarity = EXCLUDED.rarity,
              image_url = EXCLUDED.image_url,
              unlocked_by_default = EXCLUDED.unlocked_by_default,
              unlock_hint = EXCLUDED.unlock_hint;
            `,
            [av.id, av.name, av.theme, av.rarity, av.imageUrl, av.unlockedByDefault, av.unlockHint]
          );
        }

        // Seed Card Collections & Collectible Cards
        for (const col of CARD_COLLECTIONS) {
          await client.query(
            `
            INSERT INTO public.card_collections (id, name, theme, description, rarity, card_back_id, card_back_image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              theme = EXCLUDED.theme,
              description = EXCLUDED.description,
              rarity = EXCLUDED.rarity,
              card_back_id = EXCLUDED.card_back_id,
              card_back_image_url = EXCLUDED.card_back_image_url;
            `,
            [col.id, col.name, col.theme, col.description, col.rarity, col.cardBackId, col.cardBackImageUrl]
          );
        }

        for (const card of COLLECTIBLE_CARDS) {
          await client.query(
            `
            INSERT INTO public.collectible_cards (id, collection_id, identity, name, rarity, image_url)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
              collection_id = EXCLUDED.collection_id,
              identity = EXCLUDED.identity,
              name = EXCLUDED.name,
              rarity = EXCLUDED.rarity,
              image_url = EXCLUDED.image_url;
            `,
            [card.id, card.collectionId, card.identity, card.name, card.rarity, card.imageUrl]
          );
        }
      }

      if (!appliedVersions.has('4.5.0')) {
        await client.query(
          `
          INSERT INTO schema_migrations (version, description, applied_at)
          VALUES ('4.5.0', 'Authoritative PostgreSQL Cutover & Clustered Tables', NOW())
          ON CONFLICT (version) DO NOTHING;
          `
        );
      }

      // Run Migration 4.6.0 only when not yet applied (or if player_battle_pass still needs retirement)
      if (!appliedVersions.has('4.6.0') || bpStillExists) {
        await this.runCollectibleOverhaulMigrationTx(client);
        await client.query(
          `
          INSERT INTO schema_migrations (version, description, applied_at)
          VALUES ('4.6.0', 'Collectible Card Packs, Card Backs, Illustrated Avatars & Battle Pass Retirement', NOW())
          ON CONFLICT (version) DO NOTHING;
          `
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Migration 4.6.1 runs outside the schema TX using autocommit queries so pg-mem adapters remain unaffected
    const mig461 = await this.pool.query(`SELECT 1 FROM schema_migrations WHERE version = '4.6.1' LIMIT 1`);
    if (mig461.rows.length === 0) {
      const triggerClean = await this.repairSupabaseSignupTrigger();
      if (triggerClean) {
        await this.pool.query(
          `
          INSERT INTO schema_migrations (version, description, applied_at)
          VALUES ('4.6.1', 'Update handle_new_user trigger & column defaults for starter collectibles (no player_battle_pass)', NOW())
          ON CONFLICT (version) DO NOTHING;
          `
        );
      }
    }
  }

  private async grantAvatarTx(client: pg.PoolClient, userId: string, avatarId: string, source: string): Promise<boolean> {
    const canonical = resolveAvatarId(avatarId);
    const existsRes = await client.query(
      `SELECT 1 FROM public.player_avatars WHERE user_id = $1 AND avatar_id = $2 LIMIT 1`,
      [userId, canonical]
    );
    const isNew = existsRes.rows.length === 0;
    if (isNew) {
      await client.query(
        `
        INSERT INTO public.player_avatars (id, user_id, avatar_id, source, unlocked_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id, avatar_id) DO NOTHING;
        `,
        [crypto.randomUUID(), userId, canonical, source]
      );
    }
    await client.query(
      `
      INSERT INTO public.cosmetic_inventory (id, user_id, category, item_id, unlocked_at)
      VALUES ($1, $2, 'hat', $3, NOW())
      ON CONFLICT (user_id, category, item_id) DO NOTHING;
      `,
      [crypto.randomUUID(), userId, canonical]
    );
    return isNew;
  }

  private async grantCardBackTx(
    client: pg.PoolClient,
    userId: string,
    cardBackId: string,
    collectionId: string | null,
    source: string
  ): Promise<boolean> {
    const canonical = resolveCardBackId(cardBackId);
    const existsRes = await client.query(
      `SELECT 1 FROM public.player_card_backs WHERE user_id = $1 AND card_back_id = $2 LIMIT 1`,
      [userId, canonical]
    );
    const isNew = existsRes.rows.length === 0;
    if (isNew) {
      await client.query(
        `
        INSERT INTO public.player_card_backs (id, user_id, card_back_id, collection_id, source, unlocked_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, card_back_id) DO NOTHING;
        `,
        [crypto.randomUUID(), userId, canonical, collectionId, source]
      );
    }
    await client.query(
      `
      INSERT INTO public.cosmetic_inventory (id, user_id, category, item_id, unlocked_at)
      VALUES ($1, $2, 'cardBack', $3, NOW())
      ON CONFLICT (user_id, category, item_id) DO NOTHING;
      `,
      [crypto.randomUUID(), userId, canonical]
    );
    return isNew;
  }

  private async seedStarterProgressionTx(client: pg.PoolClient, userId: string): Promise<void> {
    for (const av of AVATAR_CATALOG) {
      if (av.unlockedByDefault) {
        await this.grantAvatarTx(client, userId, av.id, 'starter');
      }
    }
    for (const cb of CARD_BACK_CATALOG) {
      if (cb.unlockedByDefault) {
        await this.grantCardBackTx(client, userId, cb.id, cb.collectionId || null, 'starter');
      }
    }
  }

  private async evaluateMilestoneAvatarsTx(
    client: pg.PoolClient,
    userId: string,
    level: number,
    wins: number
  ): Promise<string[]> {
    const cbRes = await client.query(
      `SELECT collection_id FROM public.player_card_backs WHERE user_id = $1 AND collection_id IS NOT NULL`,
      [userId]
    );
    const completedCols = cbRes.rows.map((r) => r.collection_id as string);
    const eligible = getEligibleMilestoneAvatars({
      level,
      wins,
      unlockedCollectionIds: completedCols,
    });
    const newlyUnlocked: string[] = [];
    for (const av of eligible) {
      if (av.unlockedByDefault) continue;
      const added = await this.grantAvatarTx(client, userId, av.id, 'milestone');
      if (added) newlyUnlocked.push(av.id);
    }
    return newlyUnlocked;
  }

  private async runCollectibleOverhaulMigrationTx(client: pg.PoolClient): Promise<void> {
    // 1. Check & migrate any Battle Pass tier rewards before dropping player_battle_pass
    const bpTableCheck = await client.query(
      `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'player_battle_pass'
      ) AS exists;
      `
    );
    const bpExists = Boolean(bpTableCheck.rows[0]?.exists);
    if (bpExists) {
      const bpRows = await client.query(
        `SELECT user_id, tier, claimed_free_tiers FROM public.player_battle_pass`
      );
      for (const row of bpRows.rows) {
        const uid = row.user_id as string;
        const claimedFree: number[] = Array.isArray(row.claimed_free_tiers) ? row.claimed_free_tiers : [];
        if (claimedFree.includes(3) || (row.tier && row.tier >= 3)) {
          await this.grantAvatarTx(client, uid, 'velvet_gentleman', 'migrated_battle_pass');
        }
        if (claimedFree.includes(5)) {
          await this.grantCardBackTx(client, uid, 'dark_royalty', 'dark_royalty', 'migrated_battle_pass');
        }
        if (claimedFree.includes(15)) {
          await this.grantAvatarTx(client, uid, 'bower_king', 'migrated_battle_pass');
        }
      }
    }

    // 2. Migrate existing users' starter collectibles, legacy cosmetics, normalized avatars, and level-up packs
    const usersRes = await client.query(
      `
      SELECT
        p.id, p.avatar_icon,
        x.level, x.xp,
        s.wins,
        c.equipped_hat, c.equipped_card_back
      FROM public.profiles p
      LEFT JOIN public.player_xp x ON p.id = x.user_id
      LEFT JOIN public.player_statistics s ON p.id = s.user_id
      LEFT JOIN public.player_cosmetics c ON p.id = c.user_id
      `
    );

    for (const u of usersRes.rows) {
      const uid = u.id as string;
      await this.seedStarterProgressionTx(client, uid);

      // Migrate any previously owned cosmetic_inventory items
      const invRes = await client.query(
        `SELECT category, item_id FROM public.cosmetic_inventory WHERE user_id = $1`,
        [uid]
      );
      for (const inv of invRes.rows) {
        if (inv.category === 'hat' && inv.item_id) {
          await this.grantAvatarTx(client, uid, inv.item_id, 'migrated_legacy');
        } else if (inv.category === 'cardBack' && inv.item_id) {
          const resolvedCb = resolveCardBackId(inv.item_id);
          await this.grantCardBackTx(
            client,
            uid,
            resolvedCb,
            getCardBackDefinition(resolvedCb).collectionId || null,
            'migrated_legacy'
          );
        }
      }

      // Preserve currently equipped avatar & card back across profiles + player_cosmetics
      const rawAv =
        u.equipped_hat && u.equipped_hat !== '🤠' && (!u.avatar_icon || u.avatar_icon === '🤠')
          ? u.equipped_hat
          : u.avatar_icon || u.equipped_hat;
      const resolvedAvatar = resolveAvatarId(rawAv);
      await this.grantAvatarTx(client, uid, resolvedAvatar, 'migrated_equipped');

      const resolvedCb = resolveCardBackId(u.equipped_card_back);
      await this.grantCardBackTx(
        client,
        uid,
        resolvedCb,
        getCardBackDefinition(resolvedCb).collectionId || null,
        'migrated_equipped'
      );

      if (u.avatar_icon !== resolvedAvatar) {
        await client.query(`UPDATE public.profiles SET avatar_icon = $2 WHERE id = $1`, [uid, resolvedAvatar]);
      }
      if (u.equipped_hat !== resolvedAvatar || u.equipped_card_back !== resolvedCb) {
        await client.query(
          `UPDATE public.player_cosmetics SET equipped_hat = $2, equipped_card_back = $3 WHERE user_id = $1`,
          [uid, resolvedAvatar, resolvedCb]
        );
      }

      // Normalize XP & grant 1 unopened pack per previously achieved level (>= 2)
      const rawXp = typeof u.xp === 'number' ? u.xp : 0;
      const rawLevel = typeof u.level === 'number' ? u.level : 1;
      const normLevel = rawXp >= 1000 ? Math.floor(rawXp / 1000) + 1 : Math.max(1, rawLevel);
      const normXp = rawXp >= 1000 ? rawXp % 1000 : Math.max(0, rawXp);
      if (normLevel !== rawLevel || normXp !== rawXp) {
        await client.query(
          `UPDATE public.player_xp SET level = $2, xp = $3, next_level_xp = 1000 WHERE user_id = $1`,
          [uid, normLevel, normXp]
        );
      }

      for (let lvl = 2; lvl <= normLevel; lvl++) {
        await client.query(
          `
          INSERT INTO public.player_card_packs (id, user_id, source, source_ref, earned_level, status, earned_at)
          VALUES ($1, $2, 'level_up_backfill', $3, $4, 'unopened', NOW())
          ON CONFLICT (user_id, source_ref) DO NOTHING;
          `,
          [crypto.randomUUID(), uid, `level_${lvl}`, lvl]
        );
      }

      await this.evaluateMilestoneAvatarsTx(client, uid, normLevel, u.wins || 0);
    }

    if (bpExists) {
      await client.query(`DROP TABLE IF EXISTS public.player_battle_pass;`);
    }
  }

  /**
   * Aligns column defaults and Supabase's `public.handle_new_user()` trigger
   * with the post-Battle-Pass collectible schema (6 starter avatars, 2 starter card backs).
   * Returns true if the trigger does not exist or is already clean; false if owned by another role and still outdated.
   */
  private async repairSupabaseSignupTrigger(): Promise<boolean> {
    let hasHandleNewUser = false;
    try {
      const checkRes = await this.pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
        ) AS exists
      `);
      hasHandleNewUser = Boolean(checkRes.rows[0]?.exists);
    } catch {
      // pg-mem / lightweight adapters lack pg_proc introspection; schema.ts already sets clean defaults
      return true;
    }

    try {
      await this.pool.query(`ALTER TABLE public.profiles ALTER COLUMN avatar_icon SET DEFAULT 'the_outlaw'`);
      await this.pool.query(`ALTER TABLE public.player_cosmetics ALTER COLUMN equipped_hat SET DEFAULT 'the_outlaw'`);
    } catch {
      // Ignore if table ownership prohibits ALTER COLUMN
    }

    if (!hasHandleNewUser) {
      return true;
    }

    const procRes = await this.pool.query(`
      SELECT
        pg_get_userbyid(p.proowner) AS func_owner,
        pg_get_functiondef(p.oid) AS def,
        (SELECT r.rolsuper FROM pg_roles r WHERE r.rolname = current_user) AS is_super,
        current_user AS cur_user
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
      LIMIT 1
    `);

    if (procRes.rows.length === 0) {
      return true;
    }

    const row = procRes.rows[0];
    const funcDef = String(row.def || '');
    const stillBroken = funcDef.includes('player_battle_pass') || !funcDef.includes('player_avatars');
    if (!stillBroken) {
      return true;
    }

    const canReplace = row.is_super || row.func_owner === row.cur_user;
    if (!canReplace) {
      console.error(
        `[MIGRATION 4.6.1] ACTION REQUIRED: public.handle_new_user() is owned by '${row.func_owner}' (connected as '${row.cur_user}') and still references retired table public.player_battle_pass. Run supabase/migrations/20261115_fix_handle_new_user_signup.sql in the Supabase SQL Editor to restore new account signups.`
      );
      return false;
    }

    await this.pool.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
      DECLARE
        new_player_id TEXT;
        new_username TEXT;
        raw_avatar TEXT;
        normalized_avatar TEXT;
      BEGIN
        new_player_id := 'JJ-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 6));
        new_username := COALESCE(
          NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
          'Bower_' || (FLOOR(1000 + RANDOM() * 9000))::text
        );
        raw_avatar := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'avatar_icon', '')), '');
        normalized_avatar := CASE raw_avatar
          WHEN 'the_outlaw' THEN 'the_outlaw'
          WHEN '🤠' THEN 'the_outlaw'
          WHEN 'elven_trickster' THEN 'elven_trickster'
          WHEN '🧝' THEN 'elven_trickster'
          WHEN 'cyber_bot' THEN 'cyber_bot'
          WHEN '🤖' THEN 'cyber_bot'
          WHEN 'clever_fox' THEN 'clever_fox'
          WHEN '🦊' THEN 'clever_fox'
          WHEN 'velvet_gentleman' THEN 'velvet_gentleman'
          WHEN '🎩' THEN 'velvet_gentleman'
          WHEN 'iron_tactician' THEN 'iron_tactician'
          WHEN '🪖' THEN 'iron_tactician'
          WHEN '⚔️' THEN 'iron_tactician'
          ELSE 'the_outlaw'
        END;

        INSERT INTO public.profiles (id, player_id, username, avatar_icon)
        VALUES (NEW.id, new_player_id, new_username, normalized_avatar)
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.player_settings (user_id) VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;

        INSERT INTO public.player_ranks (user_id) VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;

        INSERT INTO public.player_xp (user_id) VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;

        INSERT INTO public.player_statistics (user_id) VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;

        INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
        VALUES (NEW.id, normalized_avatar, 'classic_blue', 'default_navy', 'Recruit')
        ON CONFLICT (user_id) DO NOTHING;

        INSERT INTO public.player_avatars (id, user_id, avatar_id, source, unlocked_at)
        VALUES
          (gen_random_uuid(), NEW.id, 'the_outlaw', 'starter', NOW()),
          (gen_random_uuid(), NEW.id, 'elven_trickster', 'starter', NOW()),
          (gen_random_uuid(), NEW.id, 'cyber_bot', 'starter', NOW()),
          (gen_random_uuid(), NEW.id, 'clever_fox', 'starter', NOW()),
          (gen_random_uuid(), NEW.id, 'velvet_gentleman', 'starter', NOW()),
          (gen_random_uuid(), NEW.id, 'iron_tactician', 'starter', NOW())
        ON CONFLICT (user_id, avatar_id) DO NOTHING;

        INSERT INTO public.player_card_backs (id, user_id, card_back_id, collection_id, source, unlocked_at)
        VALUES
          (gen_random_uuid(), NEW.id, 'classic_blue', NULL, 'starter', NOW()),
          (gen_random_uuid(), NEW.id, 'classic_red', NULL, 'starter', NOW())
        ON CONFLICT (user_id, card_back_id) DO NOTHING;

        INSERT INTO public.cosmetic_inventory (id, user_id, category, item_id, unlocked_at)
        VALUES
          (gen_random_uuid(), NEW.id, 'hat', 'the_outlaw', NOW()),
          (gen_random_uuid(), NEW.id, 'hat', 'elven_trickster', NOW()),
          (gen_random_uuid(), NEW.id, 'hat', 'cyber_bot', NOW()),
          (gen_random_uuid(), NEW.id, 'hat', 'clever_fox', NOW()),
          (gen_random_uuid(), NEW.id, 'hat', 'velvet_gentleman', NOW()),
          (gen_random_uuid(), NEW.id, 'hat', 'iron_tactician', NOW()),
          (gen_random_uuid(), NEW.id, 'cardBack', 'classic_blue', NOW()),
          (gen_random_uuid(), NEW.id, 'cardBack', 'classic_red', NOW()),
          (gen_random_uuid(), NEW.id, 'banner', 'default_navy', NOW()),
          (gen_random_uuid(), NEW.id, 'title', 'Recruit', NOW())
        ON CONFLICT (user_id, category, item_id) DO NOTHING;

        RETURN NEW;
      END;
      $fn$;
    `);
    return true;
  }

  // --- QUERY WITH RETRY FOR TRANSIENT FAILURES ---
  public async queryWithRetry<T extends pg.QueryResultRow = any>(
    text: string,
    params: any[] = [],
    retries = 2
  ): Promise<pg.QueryResult<T>> {
    let lastError: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.pool.query<T>(text, params);
      } catch (err: any) {
        lastError = err;
        const isTransient =
          err.code === 'ECONNRESET' ||
          err.code === 'ETIMEDOUT' ||
          err.code === '57P01' || // admin shutdown
          err.message?.includes('Connection terminated');

        if (!isTransient || attempt === retries) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 50 * Math.pow(2, attempt)));
      }
    }
    throw lastError;
  }

  // --- USER & IDENTITY QUERIES ---

  public async getUserById(userId: string): Promise<UserAccount | null> {
    const res = await this.queryWithRetry(
      `
      SELECT
        p.id, p.player_id as "playerId", p.username, p.avatar_icon as "avatarIcon",
        p.created_at as "createdAt", p.last_active as "lastActive",
        r.rank_tier as "rankTier", r.rank_points as "rankPoints", r.mmr,
        r.placement_matches_remaining as "placementMatchesRemaining",
        r.has_demotion_shield as "hasDemotionShield",
        s.total_games as "totalGames", s.wins, s.losses, s.tricks_won as "tricksWon",
        s.euchres, s.marches, s.successful_loners as "successfulLoners",
        s.current_streak as "winStreak", s.best_streak as "bestWinStreak",
        x.level, x.xp, x.next_level_xp as "nextLevelXp",
        c.equipped_hat, c.equipped_card_back, c.equipped_banner, c.equipped_title
      FROM public.profiles p
      LEFT JOIN public.player_ranks r ON p.id = r.user_id
      LEFT JOIN public.player_statistics s ON p.id = s.user_id
      LEFT JOIN public.player_xp x ON p.id = x.user_id
      LEFT JOIN public.player_cosmetics c ON p.id = c.user_id
      WHERE p.id::text = $1 OR p.player_id = $1
      LIMIT 1;
      `,
      [userId]
    );

    if (res.rows.length === 0) return null;
    const user = this.mapRowToUserAccount(res.rows[0]);
    await this.attachMatchHistory(user);
    await this.attachProgressionData(user);
    return user;
  }

  private async attachMatchHistory(user: UserAccount): Promise<void> {
    try {
      const histRes = await this.queryWithRetry(
        `
        SELECT id, won, mode, score, lp_change, mmr_change, opponent_names, created_at
        FROM public.player_match_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50;
        `,
        [user.id]
      );
      user.matchHistory = histRes.rows.map((h) => ({
        id: h.id,
        date: h.created_at ? new Date(h.created_at).getTime() : Date.now(),
        mode: h.mode,
        won: Boolean(h.won),
        score: h.score || '10 - 7',
        lpChange: h.lp_change ?? 0,
        mmrChange: h.mmr_change ?? 0,
        opponentNames: Array.isArray(h.opponent_names) ? h.opponent_names : ['Opponents'],
      }));
    } catch {
      user.matchHistory = user.matchHistory || [];
    }
  }

  public async getUserByUsername(username: string): Promise<UserAccount | null> {
    const res = await this.queryWithRetry(
      `
      SELECT
        p.id, p.player_id as "playerId", p.username, p.avatar_icon as "avatarIcon",
        p.created_at as "createdAt", p.last_active as "lastActive",
        r.rank_tier as "rankTier", r.rank_points as "rankPoints", r.mmr,
        r.placement_matches_remaining as "placementMatchesRemaining",
        r.has_demotion_shield as "hasDemotionShield",
        s.total_games as "totalGames", s.wins, s.losses, s.tricks_won as "tricksWon",
        s.euchres, s.marches, s.successful_loners as "successfulLoners",
        s.current_streak as "winStreak", s.best_streak as "bestWinStreak",
        x.level, x.xp, x.next_level_xp as "nextLevelXp",
        c.equipped_hat, c.equipped_card_back, c.equipped_banner, c.equipped_title
      FROM public.profiles p
      LEFT JOIN public.player_ranks r ON p.id = r.user_id
      LEFT JOIN public.player_statistics s ON p.id = s.user_id
      LEFT JOIN public.player_xp x ON p.id = x.user_id
      LEFT JOIN public.player_cosmetics c ON p.id = c.user_id
      WHERE LOWER(p.username) = LOWER($1)
      LIMIT 1;
      `,
      [username]
    );

    if (res.rows.length === 0) return null;
    const user = this.mapRowToUserAccount(res.rows[0]);
    await this.attachMatchHistory(user);
    await this.attachProgressionData(user);
    return user;
  }

  public async getOrCreateUser(
    username: string,
    avatarIcon: string,
    sessionToken?: string,
    authUserId?: string
  ): Promise<{ user: UserAccount; sessionToken: string }> {
    // 1. Session token cache hit (only if not overriding with a different verified authUserId)
    if (sessionToken && this.sessionStore.has(sessionToken)) {
      const cachedUserId = this.sessionStore.get(sessionToken)!;
      if (!authUserId || cachedUserId === authUserId) {
        const cachedUser = await this.getUserById(cachedUserId);
        if (cachedUser) {
          return { user: cachedUser, sessionToken };
        }
      }
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let targetId: string;
      const isUuid = Boolean(authUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUserId));
      if (authUserId && isUuid) {
        targetId = authUserId;
      } else {
        // Deterministic or generated UUID for guests or dev mode accounts
        const existingByName = await client.query(
          `SELECT id FROM public.profiles WHERE LOWER(username) = LOWER($1) LIMIT 1`,
          [username]
        );
        if (existingByName.rows.length > 0) {
          targetId = existingByName.rows[0].id;
        } else {
          targetId = crypto.randomUUID();
        }
      }

      // Check existing profile
      const profRes = await client.query(`SELECT id FROM public.profiles WHERE id = $1 LIMIT 1`, [targetId]);

      if (profRes.rows.length === 0) {
        // Generate unique playerId e.g. "JJ-4819"
        const playerId = `JJ-${targetId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()}`;

        // Ensure username uniqueness
        let finalUsername = username;
        const nameCollision = await client.query(
          `SELECT id FROM public.profiles WHERE LOWER(username) = LOWER($1) AND id <> $2`,
          [username, targetId]
        );
        if (nameCollision.rows.length > 0) {
          finalUsername = `${username}_${Math.floor(100 + Math.random() * 900)}`;
        }

        const requestedAvatar = resolveAvatarId(avatarIcon);
        const initialAvatar = getAvatarDefinition(requestedAvatar).unlockedByDefault
          ? requestedAvatar
          : DEFAULT_AVATAR_ID;

        // Insert profile
        await client.query(
          `
          INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at, last_active)
          VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET last_active = NOW();
          `,
          [targetId, playerId, finalUsername, initialAvatar]
        );

        // Insert default rank
        await client.query(
          `
          INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
          VALUES ($1, '9', 0, 1200, 5, false)
          ON CONFLICT (user_id) DO NOTHING;
          `,
          [targetId]
        );

        // Insert default statistics
        await client.query(
          `
          INSERT INTO public.player_statistics (user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners)
          VALUES ($1, 0, 0, 0, 0, 0, 0, 0)
          ON CONFLICT (user_id) DO NOTHING;
          `,
          [targetId]
        );

        // Insert default XP
        await client.query(
          `
          INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
          VALUES ($1, 1, 0, 1000)
          ON CONFLICT (user_id) DO NOTHING;
          `,
          [targetId]
        );

        // Insert default cosmetics
        await client.query(
          `
          INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
          VALUES ($1, $2, $3, 'default_navy', 'Recruit')
          ON CONFLICT (user_id) DO NOTHING;
          `,
          [targetId, initialAvatar, DEFAULT_CARD_BACK_ID]
        );

        // Seed starter illustrated avatars and starter card backs
        await this.seedStarterProgressionTx(client, targetId);
      } else {
        // Update last_active
        await client.query(`UPDATE public.profiles SET last_active = NOW() WHERE id = $1`, [targetId]);
      }

      await client.query('COMMIT');

      const user = (await this.getUserById(targetId))!;
      const newSessionToken = `sess_${crypto.randomBytes(16).toString('hex')}`;
      this.sessionStore.set(newSessionToken, user.id);

      return { user, sessionToken: newSessionToken };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async updateUser(userId: string, updates: Partial<UserAccount>): Promise<UserAccount | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      if (updates.username || updates.avatarIcon) {
        const resolvedAvatar = updates.avatarIcon ? resolveAvatarId(updates.avatarIcon) : undefined;
        await client.query(
          `
          UPDATE public.profiles SET
            username = COALESCE($2, username),
            avatar_icon = COALESCE($3, avatar_icon),
            updated_at = NOW()
          WHERE id = $1
          `,
          [userId, updates.username, resolvedAvatar]
        );
        if (resolvedAvatar) {
          await this.grantAvatarTx(client, userId, resolvedAvatar, 'admin_update');
          await client.query(
            `UPDATE public.player_cosmetics SET equipped_hat = $2, updated_at = NOW() WHERE user_id = $1`,
            [userId, resolvedAvatar]
          );
        }
      }

      if (updates.rankTier !== undefined || updates.rankPoints !== undefined || updates.mmr !== undefined) {
        await client.query(
          `
          UPDATE public.player_ranks SET
            rank_tier = COALESCE($2, rank_tier),
            rank_points = COALESCE($3, rank_points),
            mmr = COALESCE($4, mmr),
            has_demotion_shield = COALESCE($5, has_demotion_shield),
            updated_at = NOW()
          WHERE user_id = $1
          `,
          [userId, updates.rankTier, updates.rankPoints, updates.mmr, updates.hasDemotionShield]
        );
      }

      if (updates.level !== undefined || updates.xp !== undefined) {
        await client.query(
          `
          UPDATE public.player_xp SET
            level = COALESCE($2, level),
            xp = COALESCE($3, xp)
          WHERE user_id = $1
          `,
          [userId, updates.level, updates.xp]
        );
      }

      if (updates.equippedCosmetics) {
        const resolvedHat = updates.equippedCosmetics.hat
          ? resolveAvatarId(updates.equippedCosmetics.hat)
          : undefined;
        const resolvedCb = updates.equippedCosmetics.cardBack
          ? resolveCardBackId(updates.equippedCosmetics.cardBack)
          : undefined;
        if (resolvedCb) {
          await this.grantCardBackTx(
            client,
            userId,
            resolvedCb,
            getCardBackDefinition(resolvedCb).collectionId || null,
            'admin_update'
          );
        }
        await client.query(
          `
          UPDATE public.player_cosmetics SET
            equipped_hat = COALESCE($2, equipped_hat),
            equipped_card_back = COALESCE($3, equipped_card_back),
            equipped_banner = COALESCE($4, equipped_banner),
            equipped_title = COALESCE($5, equipped_title),
            updated_at = NOW()
          WHERE user_id = $1
          `,
          [
            userId,
            resolvedHat,
            resolvedCb,
            updates.equippedCosmetics.banner,
            updates.equippedCosmetics.title,
          ]
        );
      }

      await client.query('COMMIT');
      return await this.getUserById(userId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --- TRANSACTIONAL COMPETITIVE PROGRESSION WITH IDEMPOTENCY ---

  public async recordMatchResult(input: MatchResultRecordInput): Promise<{
    success: boolean;
    alreadyRecorded: boolean;
    matchId: string;
    playerResults: {
      userId: string;
      won: boolean;
      oldTier: RankTier;
      newTier: RankTier;
      oldPoints: number;
      newPoints: number;
      lpChange: number;
      mmrChange: number;
      newMmr: number;
      newXp: number;
      newLevel: number;
      levelsGained: number;
      packsAwarded: number;
      totalUnopenedPacks: number;
      newlyUnlockedAvatars: string[];
    }[];
  }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Idempotency Guard
      const idempotencyKey = input.idempotencyKey || `match_${input.matchId}`;
      const existingKey = await client.query(
        `SELECT key FROM public.idempotency_keys WHERE key = $1 LIMIT 1`,
        [idempotencyKey]
      );

      if (existingKey.rows.length > 0) {
        // Match was already atomically processed!
        await client.query('COMMIT');
        return {
          success: true,
          alreadyRecorded: true,
          matchId: input.matchId,
          playerResults: [],
        };
      }

      await client.query(
        `
        INSERT INTO public.idempotency_keys (key, resource_type, resource_id, created_at)
        VALUES ($1, 'match_result', $2, NOW())
        ON CONFLICT (key) DO NOTHING;
        `,
        [idempotencyKey, input.matchId]
      );

      // 2. Insert Match Record
      const humanCount = input.humanPlayers.length;
      const botCount = 4 - humanCount;
      const matchUuid = crypto.randomUUID();
      // Live DB matches_mode_check allows ('ranked_solo', 'ranked_rivals', 'unranked', 'private');
      // player_match_history retains the specific mode ('ranked_duo', etc.) for per-player breakdown.
      const matchesTableMode = input.mode === 'ranked_duo' ? 'ranked_solo' : input.mode;

      await client.query(
        `
        INSERT INTO public.matches (
          id, room_code, mode, human_count, bot_count, composition, winning_team, final_score, duration_seconds, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());
        `,
        [
          matchUuid,
          input.roomCode,
          matchesTableMode,
          humanCount,
          botCount,
          input.composition,
          input.winningTeam,
          input.finalScore,
          input.durationSeconds || 0,
        ]
      );

      const playerResults: any[] = [];
      const isRankedMode =
        input.mode === 'ranked_solo' ||
        input.mode === 'ranked_rivals' ||
        input.mode === 'ranked_duo';

      // 3. Process Each Human Player Atomically
      for (const p of input.humanPlayers) {
        const won = p.team === input.winningTeam;

        // Authoritative read of player's current rank tier, points, MMR, and demotion shield from PostgreSQL
        const rankRow = await client.query(
          `SELECT rank_tier, rank_points, mmr, has_demotion_shield FROM public.player_ranks WHERE user_id = $1 LIMIT 1`,
          [p.userId]
        );
        const currentTier = (rankRow.rows[0]?.rank_tier || p.rankTier || '9') as RankTier;
        const currentPoints = rankRow.rows[0]?.rank_points ?? p.rankPoints ?? 0;
        const currentMmr = rankRow.rows[0]?.mmr ?? p.mmr ?? 1200;
        let hasDemotionShield = Boolean(rankRow.rows[0]?.has_demotion_shield);

        // Calculate LP change and Elo MMR (strictly zero in unranked/private modes or teammate abandonment loss mitigation)
        let lpChange = 0;
        let mmrChange = 0;
        let newPoints = currentPoints;
        let newTier = currentTier;
        let newMmr = currentMmr;

        if (isRankedMode) {
          if (!won && p.teammateAbandoned) {
            lpChange = 0;
            mmrChange = 0;
          } else {
            lpChange = won ? 24 : -16;
            mmrChange = won ? 18 : -14;
          }

          newPoints = currentPoints + lpChange;
          const currentTierIdx = TIER_ORDER.indexOf(currentTier);

          if (newPoints >= 100) {
            if (currentTierIdx < TIER_ORDER.length - 1) {
              newTier = TIER_ORDER[currentTierIdx + 1];
              newPoints = newPoints - 100;
              hasDemotionShield = true;
            } else {
              // Respect DB CHECK constraint (rank_points BETWEEN 0 AND 100) at max tier BOWER_JJ
              newPoints = 100;
            }
          } else if (newPoints < 0) {
            if (hasDemotionShield) {
              newPoints = 0;
              hasDemotionShield = false;
            } else if (currentTierIdx > 0) {
              newTier = TIER_ORDER[currentTierIdx - 1];
              newPoints = 75; // Demotion soft landing
              hasDemotionShield = true;
            } else {
              newPoints = 0;
            }
          }

          newMmr = Math.max(800, currentMmr + mmrChange);

          // Update player_ranks only on ranked games
          await client.query(
            `
            UPDATE public.player_ranks SET
              rank_tier = $2,
              rank_points = $3,
              mmr = $4,
              has_demotion_shield = $5,
              placement_matches_remaining = GREATEST(0, placement_matches_remaining - 1),
              updated_at = NOW()
            WHERE user_id = $1;
            `,
            [p.userId, newTier, newPoints, newMmr, hasDemotionShield]
          );
        }

        // Update player_statistics
        await client.query(
          `
          UPDATE public.player_statistics SET
            total_games = total_games + 1,
            wins = wins + (CASE WHEN $2 THEN 1 ELSE 0 END),
            losses = losses + (CASE WHEN $2 THEN 0 ELSE 1 END),
            tricks_won = tricks_won + $3,
            euchres = euchres + $4,
            marches = marches + $5,
            successful_loners = successful_loners + $6,
            current_streak = (CASE WHEN $2 THEN current_streak + 1 ELSE 0 END),
            best_streak = GREATEST(best_streak, (CASE WHEN $2 THEN current_streak + 1 ELSE 0 END)),
            updated_at = NOW()
          WHERE user_id = $1;
          `,
          [p.userId, won, p.tricksWon, p.euchres, p.marches, p.successfulLoners]
        );

        // Update XP and Level (1,000 XP per level; wraps xp modulo 1000 on level up)
        const xpEarned = typeof input.xpEarnedOverride === 'number' ? Math.max(0, input.xpEarnedOverride) : (won ? 350 : 120);
        const xpPerLvl = PROGRESSION_CONFIG.xpPerLevel;
        const curXpRes = await client.query(
          `SELECT xp, level FROM public.player_xp WHERE user_id = $1 LIMIT 1`,
          [p.userId]
        );
        const curRawXp = curXpRes.rows[0]?.xp ?? 0;
        const curRawLevel = curXpRes.rows[0]?.level ?? 1;
        const baseLevel = curRawXp >= xpPerLvl ? Math.floor(curRawXp / xpPerLvl) + 1 : Math.max(1, curRawLevel);
        const baseXp = curRawXp >= xpPerLvl ? curRawXp % xpPerLvl : Math.max(0, curRawXp);
        const combinedXp = baseXp + xpEarned;
        const newLevel = baseLevel + Math.floor(combinedXp / xpPerLvl);
        const newXp = combinedXp % xpPerLvl;
        const levelsGained = Math.max(0, newLevel - baseLevel);

        await client.query(
          `
          UPDATE public.player_xp SET
            xp = $2,
            level = $3,
            next_level_xp = $4,
            updated_at = NOW()
          WHERE user_id = $1;
          `,
          [p.userId, newXp, newLevel, xpPerLvl]
        );

        // Grant exactly ONE unopened card pack for EVERY level gained (idempotent per level)
        const packStartLevel = Math.max(1, Math.min(curRawLevel, baseLevel));
        let packsAwarded = 0;
        for (let lvl = packStartLevel + 1; lvl <= newLevel; lvl++) {
          const existsPack = await client.query(
            `SELECT 1 FROM public.player_card_packs WHERE user_id = $1 AND source_ref = $2 LIMIT 1`,
            [p.userId, `level_${lvl}`]
          );
          if (existsPack.rows.length === 0) {
            await client.query(
              `
              INSERT INTO public.player_card_packs (id, user_id, source, source_ref, earned_level, status, earned_at)
              VALUES ($1, $2, 'level_up', $3, $4, 'unopened', NOW())
              ON CONFLICT (user_id, source_ref) DO NOTHING;
              `,
              [crypto.randomUUID(), p.userId, `level_${lvl}`, lvl]
            );
            packsAwarded++;
          }
        }

        const statsAfterRes = await client.query(
          `SELECT wins FROM public.player_statistics WHERE user_id = $1 LIMIT 1`,
          [p.userId]
        );
        const totalWinsAfter = statsAfterRes.rows[0]?.wins || 0;
        const newlyUnlockedAvatars = await this.evaluateMilestoneAvatarsTx(
          client,
          p.userId,
          newLevel,
          totalWinsAfter
        );

        const packCountRes = await client.query(
          `SELECT COUNT(*)::int AS cnt FROM public.player_card_packs WHERE user_id = $1 AND status = 'unopened'`,
          [p.userId]
        );
        const totalUnopenedPacks = packCountRes.rows[0]?.cnt ?? 0;

        // Insert Match History (preserving explicit human + AI opponent names when supplied)
        const opponentNames =
          p.opponentNames && p.opponentNames.length > 0
            ? p.opponentNames
            : input.humanPlayers.filter((o) => o.team !== p.team).map((o) => o.username);
        const historyId = crypto.randomUUID();

        await client.query(
          `
          INSERT INTO public.player_match_history (
            id, user_id, match_id, won, mode, score, lp_change, mmr_change, opponent_names, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
          );
          `,
          [historyId, p.userId, matchUuid, won, input.mode, input.finalScore, lpChange, mmrChange, opponentNames]
        );

        playerResults.push({
          userId: p.userId,
          won,
          oldTier: currentTier,
          newTier,
          oldPoints: currentPoints,
          newPoints,
          lpChange,
          mmrChange,
          newMmr,
          newXp,
          newLevel,
          levelsGained,
          packsAwarded,
          totalUnopenedPacks,
          newlyUnlockedAvatars,
        });
      }

      await client.query('COMMIT');

      return {
        success: true,
        alreadyRecorded: false,
        matchId: input.matchId,
        playerResults,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --- SHARED ACTIVE MATCH PERSISTENCE (MULTI-INSTANCE CLUSTER) ---

  public async saveActiveMatch(
    roomOrCode: Room | string,
    stateOrHost: EuchreGameState | string,
    maybeRoom?: Room,
    maybeState?: EuchreGameState
  ): Promise<void> {
    let roomCode: string;
    let hostUserId: string;
    let room: Room;
    let state: EuchreGameState;

    if (typeof roomOrCode === 'object') {
      room = roomOrCode;
      state = stateOrHost as EuchreGameState;
      roomCode = room.code;
      hostUserId = room.slots[0]?.userId || 'system';
    } else {
      roomCode = roomOrCode;
      hostUserId = stateOrHost as string;
      room = maybeRoom!;
      state = maybeState!;
    }

    await this.queryWithRetry(
      `
      INSERT INTO public.active_matches (room_code, host_user_id, room_data, game_state, last_action_at, created_at)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, NOW(), NOW())
      ON CONFLICT (room_code) DO UPDATE SET
        room_data = EXCLUDED.room_data,
        game_state = EXCLUDED.game_state,
        last_action_at = NOW();
      `,
      [roomCode, hostUserId, JSON.stringify(room), JSON.stringify(state)]
    );
  }

  public async deleteActiveMatch(roomCode: string): Promise<void> {
    await this.queryWithRetry(`DELETE FROM public.active_matches WHERE room_code = $1`, [roomCode]);
  }

  public async loadActiveMatches(maxAgeMinutes = 15): Promise<{ room: Room; state: EuchreGameState }[]> {
    const res = await this.queryWithRetry(
      `
      SELECT room_data, game_state FROM public.active_matches
      WHERE last_action_at > NOW() - ($1 || ' minutes')::interval
      ORDER BY last_action_at DESC;
      `,
      [maxAgeMinutes]
    );

    return res.rows.map((r) => ({
      room: r.room_data as Room,
      state: r.game_state as EuchreGameState,
    }));
  }

  // --- SOCIAL & FRIENDSHIPS ---

  public async getFriendsSummary(userId: string, onlineUserIds: Set<string> = new Set()): Promise<FriendSummary[]> {
    const res = await this.queryWithRetry(
      `
      SELECT
        p.id as "userId", p.username, p.avatar_icon as "avatarIcon",
        r.rank_tier as "rankTier", r.rank_points as "rankPoints",
        x.level
      FROM public.friendships f
      JOIN public.profiles p ON (f.friend_id = p.id AND f.user_id = $1) OR (f.user_id = p.id AND f.friend_id = $1)
      LEFT JOIN public.player_ranks r ON p.id = r.user_id
      LEFT JOIN public.player_xp x ON p.id = x.user_id
      WHERE p.id <> $1;
      `,
      [userId]
    );

    const seen = new Set<string>();
    const summary: FriendSummary[] = [];
    for (const row of res.rows) {
      if (seen.has(row.userId)) continue;
      seen.add(row.userId);
      const isOnline = onlineUserIds.has(row.userId);
      summary.push({
        userId: row.userId,
        username: row.username,
        avatarIcon: row.avatarIcon || '🤠',
        rankTier: row.rankTier || '9',
        rankPoints: row.rankPoints || 0,
        level: row.level || 1,
        isOnline,
        status: isOnline ? 'online' : 'offline',
      });
    }
    return summary;
  }

  public async sendFriendRequest(fromUserId: string, targetUsername: string): Promise<{ success: boolean; error?: string }> {
    const target = await this.getUserByUsername(targetUsername);
    if (!target) return { success: false, error: 'Player not found' };
    if (target.id === fromUserId) return { success: false, error: 'Cannot add yourself' };

    const alreadyFriends = await this.queryWithRetry(
      `SELECT 1 FROM public.friendships
       WHERE (user_id = $1 AND friend_id = $2)
          OR (user_id = $2 AND friend_id = $1)
       LIMIT 1`,
      [fromUserId, target.id]
    );
    if (alreadyFriends.rows.length > 0) {
      return { success: false, error: 'Already friends with this player' };
    }

    // If the target player already sent us a request, accept it mutually
    const reverseReq = await this.queryWithRetry(
      `SELECT id FROM public.friend_requests WHERE from_user_id = $1 AND to_user_id = $2 LIMIT 1`,
      [target.id, fromUserId]
    );
    if (reverseReq.rows.length > 0) {
      return await this.acceptFriendRequest(fromUserId, target.id);
    }

    const existingReq = await this.queryWithRetry(
      `SELECT 1 FROM public.friend_requests WHERE from_user_id = $1 AND to_user_id = $2 LIMIT 1`,
      [fromUserId, target.id]
    );
    if (existingReq.rows.length > 0) {
      return { success: false, error: 'Friend request already sent' };
    }

    const insertRes = await this.queryWithRetry(
      `
      INSERT INTO public.friend_requests (from_user_id, to_user_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (from_user_id, to_user_id) DO NOTHING
      RETURNING id;
      `,
      [fromUserId, target.id]
    );
    if (insertRes.rows.length === 0) {
      return { success: false, error: 'Friend request already sent' };
    }
    return { success: true };
  }

  public async acceptFriendRequest(userId: string, fromUserId: string): Promise<{ success: boolean; error?: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `
        INSERT INTO public.friendships (user_id, friend_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id, friend_id) DO NOTHING;
        `,
        [userId, fromUserId]
      );
      await client.query(
        `DELETE FROM public.friend_requests
         WHERE (from_user_id = $1 AND to_user_id = $2)
            OR (from_user_id = $2 AND to_user_id = $1)`,
        [fromUserId, userId]
      );
      await client.query('COMMIT');
      return { success: true };
    } catch (err: any) {
      await client.query('ROLLBACK');
      return { success: false, error: err.message };
    } finally {
      client.release();
    }
  }

  public async getIncomingFriendRequests(userId: string): Promise<{ fromUserId: string; fromUsername: string; fromAvatar: string; timestamp: number }[]> {
    const res = await this.queryWithRetry(
      `
      SELECT
        r.from_user_id as "fromUserId",
        p.username as "fromUsername",
        p.avatar_icon as "fromAvatar",
        EXTRACT(EPOCH FROM r.created_at) as "timestamp"
      FROM public.friend_requests r
      JOIN public.profiles p ON r.from_user_id = p.id
      WHERE r.to_user_id = $1
      ORDER BY r.created_at DESC;
      `,
      [userId]
    );

    return res.rows.map(row => ({
      fromUserId: row.fromUserId,
      fromUsername: row.fromUsername,
      fromAvatar: row.fromAvatar || '🤠',
      timestamp: Math.floor(parseFloat(row.timestamp) * 1000) || Date.now(),
    }));
  }

  // --- LEADERBOARD & STATS ---

  public async getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const res = await this.queryWithRetry(
      `
      SELECT
        p.id as "userId", p.username, p.avatar_icon as "avatarIcon",
        c.equipped_card_back as "equippedCardBack",
        r.rank_tier as "rankTier", r.rank_points as "rankPoints", r.mmr,
        COALESCE(s.wins, 0) as wins, COALESCE(s.losses, 0) as losses,
        COALESCE(s.total_games, 0) as "totalGames"
      FROM public.profiles p
      LEFT JOIN public.player_ranks r ON p.id = r.user_id
      LEFT JOIN public.player_statistics s ON p.id = s.user_id
      LEFT JOIN public.player_cosmetics c ON p.id = c.user_id
      WHERE p.is_banned = FALSE AND p.username NOT LIKE 'Bench_%'
      ORDER BY
        CASE r.rank_tier
          WHEN 'BOWER_JJ' THEN 6
          WHEN 'A' THEN 5
          WHEN 'K' THEN 4
          WHEN 'Q' THEN 3
          WHEN '10' THEN 2
          ELSE 1
        END DESC,
        r.rank_points DESC,
        r.mmr DESC
      LIMIT $1;
      `,
      [limit]
    );

    return res.rows.map((r, idx) => {
      const tg = r.totalGames || 0;
      const winRate = tg > 0 ? Math.round((r.wins / tg) * 100) : 0;
      return {
        rankPosition: idx + 1,
        userId: r.userId,
        username: r.username,
        avatarIcon: resolveAvatarId(r.avatarIcon),
        equippedCardBack: resolveCardBackId(r.equippedCardBack),
        rankTier: r.rankTier || '9',
        rankPoints: r.rankPoints || 0,
        mmr: r.mmr || 1200,
        wins: r.wins,
        losses: r.losses,
        totalGames: tg,
        winRate,
      };
    });
  }

  public async getMatchmakingStats(): Promise<MatchmakingStats> {
    const res = await this.queryWithRetry(`
      SELECT
        COUNT(*)::int as total,
        COUNT(CASE WHEN composition = '4H' THEN 1 END)::int as c_4h,
        COUNT(CASE WHEN composition = '3H1B' THEN 1 END)::int as c_3h1b,
        COUNT(CASE WHEN composition = '2H2B' THEN 1 END)::int as c_2h2b,
        COUNT(CASE WHEN composition = '1H3B' THEN 1 END)::int as c_1h3b
      FROM public.matches;
    `);

    const row = res.rows[0] || { total: 0, c_4h: 0, c_3h1b: 0, c_2h2b: 0, c_1h3b: 0 };
    const total = row.total || 0;

    return {
      totalMatches: total,
      fourHumans: row.c_4h,
      threeHumansOneBot: row.c_3h1b,
      twoHumansTwoBots: row.c_2h2b,
      oneHumanThreeBots: row.c_1h3b,
      totalWaitTimeMs: 0,
      averageWaitTimeMs: 0,
      percentages: {
        fourHumans: total > 0 ? Math.round((row.c_4h / total) * 100) : 0,
        threeHumansOneBot: total > 0 ? Math.round((row.c_3h1b / total) * 100) : 0,
        twoHumansTwoBots: total > 0 ? Math.round((row.c_2h2b / total) * 100) : 0,
        oneHumanThreeBots: total > 0 ? Math.round((row.c_1h3b / total) * 100) : 0,
      },
    };
  }

  public async declineFriendRequest(userId: string, fromUserId: string): Promise<boolean> {
    const res = await this.queryWithRetry(
      `DELETE FROM friend_requests
       WHERE to_user_id = $1 AND from_user_id = $2`,
      [userId, fromUserId]
    );
    return (res.rowCount || 0) > 0;
  }

  public async removeFriend(userId: string, friendUserId: string): Promise<boolean> {
    const res = await this.queryWithRetry(
      `DELETE FROM friendships
       WHERE (user_id = $1 AND friend_id = $2)
          OR (user_id = $2 AND friend_id = $1)`,
      [userId, friendUserId]
    );
    return (res.rowCount || 0) > 0;
  }

  // --- COLLECTIBLE CARD PACKS, CARD BACKS & AVATARS ---

  public async getCollectionState(userId: string): Promise<PlayerCollectionState> {
    const [packsRes, invRes, cbRes, avRes, dropsRes] = await Promise.all([
      this.queryWithRetry(
        `
        SELECT id, source, source_ref, earned_level, earned_at
        FROM public.player_card_packs
        WHERE user_id = $1 AND status = 'unopened'
        ORDER BY earned_at ASC;
        `,
        [userId]
      ),
      this.queryWithRetry(
        `
        SELECT card_id, collection_id, identity, rarity, quantity, first_acquired_at, last_acquired_at
        FROM public.player_card_inventory
        WHERE user_id = $1;
        `,
        [userId]
      ),
      this.queryWithRetry(
        `SELECT card_back_id FROM public.player_card_backs WHERE user_id = $1;`,
        [userId]
      ),
      this.queryWithRetry(
        `SELECT avatar_id FROM public.player_avatars WHERE user_id = $1;`,
        [userId]
      ),
      this.queryWithRetry(
        `
        SELECT
          d.pack_id, d.card_id, d.collection_id, d.identity, d.rarity, d.slot_index, d.was_duplicate, d.dropped_at,
          p.source as pack_source, p.earned_level, p.opened_at
        FROM public.card_drop_history d
        LEFT JOIN public.player_card_packs p ON d.pack_id = p.id
        WHERE d.user_id = $1
        ORDER BY d.dropped_at DESC, d.slot_index ASC
        LIMIT 50;
        `,
        [userId]
      ),
    ]);

    const starterAvatars = AVATAR_CATALOG.filter((a) => a.unlockedByDefault).map((a) => a.id);
    const starterCardBacks = CARD_BACK_CATALOG.filter((b) => b.unlockedByDefault).map((b) => b.id);

    const unlockedAvatars = Array.from(
      new Set([
        ...starterAvatars,
        ...avRes.rows.map((r) => resolveAvatarId(r.avatar_id)),
      ])
    );

    const unlockedCardBacks = Array.from(
      new Set([
        ...starterCardBacks,
        ...cbRes.rows.map((r) => resolveCardBackId(r.card_back_id)),
      ])
    );

    const unopenedPacks: UnopenedPackItem[] = packsRes.rows.map((r) => ({
      id: r.id,
      source: r.source,
      sourceRef: r.source_ref,
      earnedLevel: r.earned_level ?? undefined,
      earnedAt: r.earned_at ? new Date(r.earned_at).getTime() : Date.now(),
    }));

    const cards: OwnedCardItem[] = invRes.rows.map((r) => ({
      cardId: r.card_id,
      collectionId: r.collection_id,
      identity: r.identity as CardIdentity,
      rarity: r.rarity as RarityTier,
      quantity: r.quantity || 1,
      firstAcquiredAt: r.first_acquired_at ? new Date(r.first_acquired_at).getTime() : Date.now(),
      lastAcquiredAt: r.last_acquired_at ? new Date(r.last_acquired_at).getTime() : Date.now(),
    }));

    // Group drop history rows into PackHistoryEntry objects
    const packHistoryMap = new Map<string, PackHistoryEntry>();
    for (const row of dropsRes.rows) {
      let entry = packHistoryMap.get(row.pack_id);
      if (!entry) {
        entry = {
          packId: row.pack_id,
          openedAt: row.opened_at
            ? new Date(row.opened_at).getTime()
            : row.dropped_at
              ? new Date(row.dropped_at).getTime()
              : Date.now(),
          source: row.pack_source || 'level_up',
          earnedLevel: row.earned_level ?? undefined,
          cards: [],
        };
        packHistoryMap.set(row.pack_id, entry);
      }
      if (entry.cards.length < 5) {
        entry.cards.push({
          cardId: row.card_id,
          collectionId: row.collection_id,
          identity: row.identity as CardIdentity,
          rarity: row.rarity as RarityTier,
          wasDuplicate: Boolean(row.was_duplicate),
        });
      }
    }

    return {
      unopenedPacksCount: unopenedPacks.length,
      unopenedPacks,
      cards,
      unlockedCardBacks,
      unlockedAvatars,
      recentDrops: Array.from(packHistoryMap.values()).slice(0, 10),
      dropRates: { ...PROGRESSION_CONFIG.rarityDropRates },
    };
  }

  public async openCardPack(
    userId: string,
    packId?: string,
    rng: () => number = Math.random
  ): Promise<{ success: boolean; error?: string; result?: PackOpenResult }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const packQuery = packId
        ? `
          SELECT id, source, earned_level
          FROM public.player_card_packs
          WHERE user_id = $1 AND id::text = $2 AND status = 'unopened'
          LIMIT 1
          FOR UPDATE;
          `
        : `
          SELECT id, source, earned_level
          FROM public.player_card_packs
          WHERE user_id = $1 AND status = 'unopened'
          ORDER BY earned_at ASC
          LIMIT 1
          FOR UPDATE;
          `;
      const packRes = await client.query(packQuery, packId ? [userId, packId] : [userId]);

      if (packRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'No unopened card packs available.' };
      }

      const targetPackId = packRes.rows[0].id as string;

      // Atomically flip pack from unopened -> opened
      const updRes = await client.query(
        `
        UPDATE public.player_card_packs
        SET status = 'opened', opened_at = NOW()
        WHERE id = $1 AND status = 'unopened'
        RETURNING opened_at;
        `,
        [targetPackId]
      );
      if (updRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Pack was already opened.' };
      }

      const openedAtMs = updRes.rows[0].opened_at
        ? new Date(updRes.rows[0].opened_at).getTime()
        : Date.now();

      // Roll 5 cards strictly server-side using configurable drop rates
      const drawnDefs = rollPackCards(PROGRESSION_CONFIG, rng);
      const drawnResults: DrawnCardResult[] = [];
      const affectedCollections = new Set<string>();

      // Track pre-existing card ownership before and across all 5 slots
      const existingInvRes = await client.query(
        `SELECT card_id, quantity FROM public.player_card_inventory WHERE user_id = $1`,
        [userId]
      );
      const qtyMap = new Map<string, number>();
      for (const r of existingInvRes.rows) {
        qtyMap.set(r.card_id, r.quantity || 0);
      }

      for (let slotIndex = 0; slotIndex < drawnDefs.length; slotIndex++) {
        const card = drawnDefs[slotIndex];
        affectedCollections.add(card.collectionId);
        const prevQty = qtyMap.get(card.id) || 0;
        const wasDuplicate = prevQty > 0;
        const newQuantity = prevQty + 1;
        qtyMap.set(card.id, newQuantity);

        if (prevQty === 0) {
          await client.query(
            `
            INSERT INTO public.player_card_inventory (
              id, user_id, card_id, collection_id, identity, rarity, quantity, first_acquired_at, last_acquired_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, 1, NOW(), NOW()
            )
            ON CONFLICT (user_id, card_id) DO UPDATE SET
              quantity = public.player_card_inventory.quantity + 1,
              last_acquired_at = NOW();
            `,
            [crypto.randomUUID(), userId, card.id, card.collectionId, card.identity, card.rarity]
          );
        } else {
          await client.query(
            `
            UPDATE public.player_card_inventory
            SET quantity = quantity + 1, last_acquired_at = NOW()
            WHERE user_id = $1 AND card_id = $2;
            `,
            [userId, card.id]
          );
        }

        drawnResults.push({
          cardId: card.id,
          collectionId: card.collectionId,
          collectionName: card.collectionName,
          identity: card.identity,
          name: card.name,
          rarity: card.rarity,
          imageUrl: card.imageUrl,
          wasDuplicate,
          newQuantity,
        });
      }

      // Evaluate server-side collection completion (all 5 unique identities: 10, J, Q, K, A)
      const newlyUnlockedCardBacks: string[] = [];
      const unlockedByCol = new Map<string, string>();
      for (const colId of affectedCollections) {
        const uniqRes = await client.query(
          `
          SELECT DISTINCT identity
          FROM public.player_card_inventory
          WHERE user_id = $1 AND collection_id = $2 AND quantity > 0;
          `,
          [userId, colId]
        );
        const ownedIdentities = new Set(uniqRes.rows.map((r) => r.identity as string));
        if (ownedIdentities.size >= 5) {
          const addedCb = await this.grantCardBackTx(client, userId, colId, colId, 'collection');
          if (addedCb) {
            newlyUnlockedCardBacks.push(colId);
            unlockedByCol.set(colId, colId);
          }
        }
      }

      // Check milestone avatars (in case completing a collection unlocked an avatar!)
      const xpStatsRes = await client.query(
        `
        SELECT COALESCE(x.level, 1) AS level, COALESCE(s.wins, 0) AS wins
        FROM public.profiles p
        LEFT JOIN public.player_xp x ON p.id = x.user_id
        LEFT JOIN public.player_statistics s ON p.id = s.user_id
        WHERE p.id = $1 LIMIT 1;
        `,
        [userId]
      );
      const curLevel = xpStatsRes.rows[0]?.level || 1;
      const curWins = xpStatsRes.rows[0]?.wins || 0;
      const newlyUnlockedAvatars = await this.evaluateMilestoneAvatarsTx(client, userId, curLevel, curWins);

      // Write authoritative audit log entries for all 5 card drops
      for (let slotIndex = 0; slotIndex < drawnResults.length; slotIndex++) {
        const dr = drawnResults[slotIndex];
        await client.query(
          `
          INSERT INTO public.card_drop_history (
            id, pack_id, user_id, card_id, collection_id, identity, rarity, slot_index, was_duplicate, unlocked_card_back_id, dropped_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
          );
          `,
          [
            crypto.randomUUID(),
            targetPackId,
            userId,
            dr.cardId,
            dr.collectionId,
            dr.identity,
            dr.rarity,
            slotIndex,
            dr.wasDuplicate,
            unlockedByCol.get(dr.collectionId) || null,
          ]
        );
      }

      await client.query('COMMIT');

      const collectionState = await this.getCollectionState(userId);

      return {
        success: true,
        result: {
          packId: targetPackId,
          openedAt: openedAtMs,
          cards: drawnResults,
          newlyUnlockedCardBacks,
          newlyUnlockedAvatars,
          remainingUnopenedPacks: collectionState.unopenedPacksCount,
          collectionState,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async equipAvatar(
    userId: string,
    avatarId: string
  ): Promise<{ success: boolean; error?: string; avatarId?: string }> {
    const canonical = resolveAvatarId(avatarId);
    const def = getAvatarDefinition(canonical);

    if (!def.unlockedByDefault) {
      const ownRes = await this.queryWithRetry(
        `SELECT 1 FROM public.player_avatars WHERE user_id = $1 AND avatar_id = $2 LIMIT 1`,
        [userId, canonical]
      );
      if (ownRes.rows.length === 0) {
        return { success: false, error: 'Avatar is locked. Unlock it to equip.' };
      }
    }

    await this.queryWithRetry(
      `UPDATE public.profiles SET avatar_icon = $1, updated_at = NOW() WHERE id = $2`,
      [canonical, userId]
    );
    await this.queryWithRetry(
      `UPDATE public.player_cosmetics SET equipped_hat = $1, updated_at = NOW() WHERE user_id = $2`,
      [canonical, userId]
    );
    return { success: true, avatarId: canonical };
  }

  public async equipCardBack(
    userId: string,
    cardBackId: string
  ): Promise<{ success: boolean; error?: string; cardBackId?: string }> {
    const canonical = resolveCardBackId(cardBackId);
    const def = getCardBackDefinition(canonical);

    if (!def.unlockedByDefault) {
      const ownRes = await this.queryWithRetry(
        `SELECT 1 FROM public.player_card_backs WHERE user_id = $1 AND card_back_id = $2 LIMIT 1`,
        [userId, canonical]
      );
      if (ownRes.rows.length === 0) {
        return { success: false, error: 'Complete this collection to unlock its card back.' };
      }
    }

    await this.queryWithRetry(
      `UPDATE public.player_cosmetics SET equipped_card_back = $1, updated_at = NOW() WHERE user_id = $2`,
      [canonical, userId]
    );
    return { success: true, cardBackId: canonical };
  }

  public async equipCosmetic(
    userId: string,
    category: 'hat' | 'cardBack' | 'banner' | 'title',
    itemId?: string
  ): Promise<boolean> {
    if (category === 'hat' && itemId) {
      const res = await this.equipAvatar(userId, itemId);
      return res.success;
    }
    if (category === 'cardBack' && itemId) {
      const res = await this.equipCardBack(userId, itemId);
      return res.success;
    }

    const colMap: Record<string, string> = {
      hat: 'equipped_hat',
      cardBack: 'equipped_card_back',
      banner: 'equipped_banner',
      title: 'equipped_title',
    };
    const col = colMap[category];
    if (!col) return false;

    const res = await this.queryWithRetry(
      `UPDATE player_cosmetics
       SET ${col} = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [itemId || null, userId]
    );
    return (res.rowCount || 0) > 0;
  }

  public async getUserProfile(
    targetUserId?: string,
    targetUsername?: string,
    requestingUserId?: string
  ): Promise<PublicPlayerData | null> {
    let targetUser: UserAccount | null = null;
    if (targetUserId) {
      targetUser = await this.getUserById(targetUserId);
    }
    if (!targetUser && targetUsername) {
      targetUser = await this.getUserByUsername(targetUsername);
    }
    if (!targetUser) return null;

    let isFriend = false;
    if (requestingUserId && requestingUserId !== targetUser.id) {
      const frRes = await this.queryWithRetry(
        `SELECT 1 FROM friendships
         WHERE (user_id = $1 AND friend_id = $2)
            OR (user_id = $2 AND friend_id = $1)
         LIMIT 1`,
        [requestingUserId, targetUser.id]
      );
      isFriend = (frRes.rows.length > 0);
    }

    const isOnline = this.sessionStore.size > 0 && Array.from(this.sessionStore.values()).includes(targetUser.id);

    return {
      id: targetUser.id,
      username: targetUser.username,
      avatarIcon: resolveAvatarId(targetUser.avatarIcon),
      equippedCardBack: resolveCardBackId(targetUser.equippedCosmetics?.cardBack),
      level: targetUser.level,
      rankTier: targetUser.rankTier,
      rankPoints: targetUser.rankPoints,
      totalGames: targetUser.totalGames,
      wins: targetUser.wins,
      losses: targetUser.losses,
      bestStreak: targetUser.bestWinStreak,
      isFriend,
      isOnline,
      equippedCosmetics: targetUser.equippedCosmetics,
    };
  }

  public async recordReport(
    reportingUserId: string,
    target: string,
    reason: string
  ): Promise<void> {
    console.log(`[REPORT AUDIT] User ${reportingUserId} reported ${target} for: "${reason}" at ${new Date().toISOString()}`);
  }

  public async recordAbandonment(
    userId: string,
    opponentNames: string[] = ['Opponent 1', 'Opponent 2']
  ): Promise<{
    oldTier: RankTier;
    newTier: RankTier;
    oldPoints: number;
    newPoints: number;
    lpChange: number;
  } | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const rRes = await client.query(
        `SELECT rank_tier, rank_points, mmr, has_demotion_shield
         FROM player_ranks WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );
      if (rRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const r = rRes.rows[0];
      const oldTier: RankTier = r.rank_tier;
      const oldPoints: number = r.rank_points;
      const lpChange = -20; // Fixed strict abandonment penalty

      let currentTierIdx = TIER_ORDER.indexOf(oldTier);
      let targetPoints = oldPoints + lpChange;
      let newTier = oldTier;
      let newPoints = targetPoints;
      let newShield = r.has_demotion_shield;

      if (targetPoints < 0) {
        if (newShield) {
          newPoints = 0;
          newShield = false;
        } else if (currentTierIdx > 0) {
          newTier = TIER_ORDER[currentTierIdx - 1];
          newPoints = 75;
        } else {
          newPoints = 0;
        }
      }

      const newMmr = Math.max(600, r.mmr - 30);

      await client.query(
        `UPDATE player_ranks
         SET rank_tier = $1, rank_points = $2, mmr = $3, has_demotion_shield = $4, updated_at = NOW()
         WHERE user_id = $5`,
        [newTier, newPoints, newMmr, newShield, userId]
      );

      await client.query(
        `UPDATE player_statistics
         SET total_games = total_games + 1, losses = losses + 1, current_streak = 0, updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      const forfeitMatchId = crypto.randomUUID();
      await client.query(
        `INSERT INTO public.matches (
           id, room_code, mode, human_count, bot_count, composition, winning_team, final_score, duration_seconds, created_at
         ) VALUES ($1, $2, 'ranked_solo', 1, 3, '1H3B', 1, 'Forfeit', 0, NOW())`,
        [forfeitMatchId, `FF_${forfeitMatchId.slice(0, 6).toUpperCase()}`]
      );

      await client.query(
        `INSERT INTO public.player_match_history (
           id, user_id, match_id, won, mode, score, lp_change, mmr_change, opponent_names, created_at
         ) VALUES ($1, $2, $3, FALSE, 'ranked_solo', 'Forfeit', $4, -30, $5, NOW())`,
        [crypto.randomUUID(), userId, forfeitMatchId, lpChange, opponentNames]
      );

      await client.query('COMMIT');
      return { oldTier, newTier, oldPoints, newPoints, lpChange };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public flushToDisk(): void {
    // No-op for PostgreSQL; ACID durability is guaranteed via database WAL & transactions
  }

  private async attachProgressionData(user: UserAccount): Promise<void> {
    try {
      const collectionState = await this.getCollectionState(user.id);
      user.collectionState = collectionState;
      user.unopenedPacksCount = collectionState.unopenedPacksCount;
      user.unlockedAvatars = collectionState.unlockedAvatars;
      user.unlockedCardBacks = collectionState.unlockedCardBacks;
      user.unlockedCosmetics = {
        ...user.unlockedCosmetics,
        hats: collectionState.unlockedAvatars,
        cardBacks: collectionState.unlockedCardBacks,
      };
    } catch {
      const starterAvs = AVATAR_CATALOG.filter((a) => a.unlockedByDefault).map((a) => a.id);
      const starterCbs = CARD_BACK_CATALOG.filter((b) => b.unlockedByDefault).map((b) => b.id);
      user.unopenedPacksCount = user.unopenedPacksCount ?? 0;
      user.unlockedAvatars = user.unlockedAvatars ?? starterAvs;
      user.unlockedCardBacks = user.unlockedCardBacks ?? starterCbs;
    }
  }

  private mapRowToUserAccount(row: any): UserAccount {
    const rawXp = typeof row.xp === 'number' ? row.xp : 0;
    const rawLevel = typeof row.level === 'number' ? row.level : 1;
    const normalizedLevel = rawXp >= 1000 ? Math.floor(rawXp / 1000) + 1 : Math.max(1, rawLevel);
    const normalizedXp = rawXp >= 1000 ? rawXp % 1000 : Math.max(0, rawXp);
    const rawAvatar =
      row.equipped_hat && row.equipped_hat !== '🤠' && (!row.avatarIcon || row.avatarIcon === '🤠')
        ? row.equipped_hat
        : row.avatarIcon || row.equipped_hat;
    const resolvedAvatar = resolveAvatarId(rawAvatar);
    const resolvedCardBack = resolveCardBackId(row.equipped_card_back);

    const starterAvs = AVATAR_CATALOG.filter((a) => a.unlockedByDefault).map((a) => a.id);
    const starterCbs = CARD_BACK_CATALOG.filter((b) => b.unlockedByDefault).map((b) => b.id);

    return {
      id: row.id,
      username: row.username,
      avatarIcon: resolvedAvatar,
      level: normalizedLevel,
      xp: normalizedXp,
      nextLevelXp: 1000,
      rankTier: (row.rankTier as RankTier) || '9',
      rankPoints: row.rankPoints ?? 0,
      mmr: row.mmr ?? 1200,
      placementMatchesRemaining: row.placementMatchesRemaining ?? 0,
      hasDemotionShield: Boolean(row.hasDemotionShield),
      totalGames: row.totalGames || 0,
      wins: row.wins || 0,
      losses: row.losses || 0,
      tricksWon: row.tricksWon || 0,
      euchres: row.euchres || 0,
      marches: row.marches || 0,
      successfulLoners: row.successfulLoners || 0,
      winStreak: row.winStreak || 0,
      bestWinStreak: row.bestWinStreak || 0,
      friends: [],
      friendRequests: [],
      recentPlayers: [],
      unopenedPacksCount: 0,
      unlockedAvatars: starterAvs,
      unlockedCardBacks: starterCbs,
      unlockedCosmetics: {
        hats: starterAvs,
        cardBacks: starterCbs,
        banners: ['default_navy'],
        titles: ['Recruit'],
      },
      matchHistory: [],
      equippedCosmetics: {
        hat: resolvedAvatar,
        cardBack: resolvedCardBack,
        banner: row.equipped_banner || 'default_navy',
        title: row.equipped_title || 'Recruit',
      },
      createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
      lastActive: row.lastActive ? new Date(row.lastActive).getTime() : Date.now(),
    };
  }
}
