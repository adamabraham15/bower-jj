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
} from '../types';
import { EuchreGameState, PlayerPosition } from '../../src/engine/types';
import { POSTGRES_TABLE_DEFINITIONS } from './schema';

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
  mode: 'ranked_solo' | 'ranked_rivals' | 'unranked' | 'private';
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
  }[];
  idempotencyKey?: string;
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
      const config = typeof poolOrConfig === 'string' ? { connectionString: poolOrConfig } : poolOrConfig || {};
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
      const statements = POSTGRES_TABLE_DEFINITIONS
        .replace(/--.*$/gm, '')
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const sql of statements) {
        await client.query(sql);
      }
      await client.query(
        `
        INSERT INTO schema_migrations (version, description, applied_at)
        VALUES ('4.5.0', 'Authoritative PostgreSQL Cutover & Clustered Tables', NOW())
        ON CONFLICT (version) DO NOTHING;
        `
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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
        x.level, x.xp,
        c.equipped_hat, c.equipped_card_back, c.equipped_banner, c.equipped_title,
        bp.tier as "bpTier", bp.xp as "bpXp", bp.tier_xp_required as "bpTierReq",
        bp.is_premium as "bpIsPremium", bp.claimed_free_tiers as "bpClaimedFree",
        bp.claimed_premium_tiers as "bpClaimedPrem"
      FROM public.profiles p
      LEFT JOIN public.player_ranks r ON p.id = r.user_id
      LEFT JOIN public.player_statistics s ON p.id = s.user_id
      LEFT JOIN public.player_xp x ON p.id = x.user_id
      LEFT JOIN public.player_cosmetics c ON p.id = c.user_id
      LEFT JOIN public.player_battle_pass bp ON p.id = bp.user_id AND bp.season_id = 1
      WHERE p.id::text = $1 OR p.player_id = $1
      LIMIT 1;
      `,
      [userId]
    );

    if (res.rows.length === 0) return null;
    return this.mapRowToUserAccount(res.rows[0]);
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
        x.level, x.xp,
        c.equipped_hat, c.equipped_card_back, c.equipped_banner, c.equipped_title,
        bp.tier as "bpTier", bp.xp as "bpXp", bp.tier_xp_required as "bpTierReq",
        bp.is_premium as "bpIsPremium", bp.claimed_free_tiers as "bpClaimedFree",
        bp.claimed_premium_tiers as "bpClaimedPrem"
      FROM public.profiles p
      LEFT JOIN public.player_ranks r ON p.id = r.user_id
      LEFT JOIN public.player_statistics s ON p.id = s.user_id
      LEFT JOIN public.player_xp x ON p.id = x.user_id
      LEFT JOIN public.player_cosmetics c ON p.id = c.user_id
      LEFT JOIN public.player_battle_pass bp ON p.id = bp.user_id AND bp.season_id = 1
      WHERE LOWER(p.username) = LOWER($1)
      LIMIT 1;
      `,
      [username]
    );

    if (res.rows.length === 0) return null;
    return this.mapRowToUserAccount(res.rows[0]);
  }

  public async getOrCreateUser(
    username: string,
    avatarIcon: string,
    sessionToken?: string,
    authUserId?: string
  ): Promise<{ user: UserAccount; sessionToken: string }> {
    // 1. Session token cache hit
    if (sessionToken && this.sessionStore.has(sessionToken)) {
      const cachedUserId = this.sessionStore.get(sessionToken)!;
      const cachedUser = await this.getUserById(cachedUserId);
      if (cachedUser) {
        return { user: cachedUser, sessionToken };
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

        // Insert profile
        await client.query(
          `
          INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at, last_active)
          VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET last_active = NOW();
          `,
          [targetId, playerId, finalUsername, avatarIcon || '🤠']
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
          VALUES ($1, '🤠', 'classic_blue', 'default_navy', 'Recruit')
          ON CONFLICT (user_id) DO NOTHING;
          `,
          [targetId]
        );

        // Insert default battle pass
        const bpUuid = crypto.randomUUID();
        await client.query(
          `
          INSERT INTO public.player_battle_pass (id, user_id, season_id, tier, xp, tier_xp_required, is_premium)
          VALUES ($1, $2, 1, 1, 0, 500, false)
          ON CONFLICT (user_id, season_id) DO NOTHING;
          `,
          [bpUuid, targetId]
        );
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
        await client.query(
          `
          UPDATE public.profiles SET
            username = COALESCE($2, username),
            avatar_icon = COALESCE($3, avatar_icon),
            updated_at = NOW()
          WHERE id = $1
          `,
          [userId, updates.username, updates.avatarIcon]
        );
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
            updates.equippedCosmetics.hat,
            updates.equippedCosmetics.cardBack,
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
      newXp: number;
      newLevel: number;
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

      await client.query(
        `
        INSERT INTO public.matches (
          id, room_code, mode, human_count, bot_count, composition, winning_team, final_score, duration_seconds, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());
        `,
        [
          matchUuid,
          input.roomCode,
          input.mode,
          humanCount,
          botCount,
          input.composition,
          input.winningTeam,
          input.finalScore,
          input.durationSeconds || 0,
        ]
      );

      const playerResults: any[] = [];

      // 3. Process Each Human Player Atomically
      for (const p of input.humanPlayers) {
        const won = p.team === input.winningTeam;

        // Calculate LP change and Elo MMR
        const lpChange = won ? 24 : -16;
        const mmrChange = won ? 18 : -14;

        // Calculate Rank Tier & Points
        let newPoints = p.rankPoints + lpChange;
        let newTier = p.rankTier;
        const currentTierIdx = TIER_ORDER.indexOf(p.rankTier);

        if (newPoints >= 100) {
          if (currentTierIdx < TIER_ORDER.length - 1) {
            newTier = TIER_ORDER[currentTierIdx + 1];
            newPoints = newPoints - 100;
          } else {
            newPoints = 100;
          }
        } else if (newPoints < 0) {
          if (currentTierIdx > 0) {
            newTier = TIER_ORDER[currentTierIdx - 1];
            newPoints = 75; // Demotion soft landing
          } else {
            newPoints = 0;
          }
        }

        const newMmr = Math.max(800, p.mmr + mmrChange);

        // Update player_ranks
        await client.query(
          `
          UPDATE public.player_ranks SET
            rank_tier = $2,
            rank_points = $3,
            mmr = $4,
            placement_matches_remaining = GREATEST(0, placement_matches_remaining - 1),
            updated_at = NOW()
          WHERE user_id = $1;
          `,
          [p.userId, newTier, newPoints, newMmr]
        );

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

        // Update XP and Level
        const xpEarned = won ? 350 : 120;
        const xpRes = await client.query(
          `
          UPDATE public.player_xp SET
            xp = xp + $2,
            level = level + (CASE WHEN (xp + $2) >= next_level_xp THEN 1 ELSE 0 END)
          WHERE user_id = $1
          RETURNING xp, level;
          `,
          [p.userId, xpEarned]
        );

        const newXp = xpRes.rows[0]?.xp || 0;
        const newLevel = xpRes.rows[0]?.level || 1;

        // Update Battle Pass
        const bpXpEarned = won ? 250 : 80;
        await client.query(
          `
          UPDATE public.player_battle_pass SET
            xp = xp + $2,
            tier = LEAST(30, tier + (CASE WHEN (xp + $2) >= tier_xp_required THEN 1 ELSE 0 END)),
            updated_at = NOW()
          WHERE user_id = $1 AND season_id = 1;
          `,
          [p.userId, bpXpEarned]
        );

        // Insert Match History
        const opponentNames = input.humanPlayers.filter((o) => o.team !== p.team).map((o) => o.username);
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
          oldTier: p.rankTier,
          newTier,
          oldPoints: p.rankPoints,
          newPoints,
          lpChange,
          mmrChange,
          newMmr,
          newXp,
          newLevel,
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

  public async getFriendsSummary(userId: string, onlineUserIds: Set<string>): Promise<FriendSummary[]> {
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

    return res.rows.map((row) => {
      const isOnline = onlineUserIds.has(row.userId);
      return {
        userId: row.userId,
        username: row.username,
        avatarIcon: row.avatarIcon || '🤠',
        rankTier: row.rankTier || '9',
        rankPoints: row.rankPoints || 0,
        level: row.level || 1,
        isOnline,
        status: isOnline ? 'online' : 'offline',
      };
    });
  }

  public async sendFriendRequest(fromUserId: string, targetUsername: string): Promise<{ success: boolean; error?: string }> {
    const target = await this.getUserByUsername(targetUsername);
    if (!target) return { success: false, error: 'Player not found' };
    if (target.id === fromUserId) return { success: false, error: 'Cannot add yourself' };

    await this.queryWithRetry(
      `
      INSERT INTO public.friend_requests (from_user_id, to_user_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (from_user_id, to_user_id) DO NOTHING;
      `,
      [fromUserId, target.id]
    );
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
        `DELETE FROM public.friend_requests WHERE from_user_id = $1 AND to_user_id = $2`,
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

  // --- LEADERBOARD & STATS ---

  public async getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const res = await this.queryWithRetry(
      `
      SELECT
        p.id as "userId", p.username, p.avatar_icon as "avatarIcon",
        r.rank_tier as "rankTier", r.rank_points as "rankPoints", r.mmr,
        COALESCE(s.wins, 0) as wins, COALESCE(s.losses, 0) as losses,
        COALESCE(s.total_games, 0) as "totalGames"
      FROM public.profiles p
      LEFT JOIN public.player_ranks r ON p.id = r.user_id
      LEFT JOIN public.player_statistics s ON p.id = s.user_id
      WHERE p.is_banned = FALSE
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
        rank: idx + 1,
        userId: r.userId,
        username: r.username,
        avatarIcon: r.avatarIcon || '🤠',
        rankTier: r.rankTier || '9',
        rankPoints: r.rankPoints || 0,
        mmr: r.mmr || 1200,
        wins: r.wins,
        losses: r.losses,
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
       WHERE user_id = $1 AND from_user_id = $2`,
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

  public async claimPassReward(
    userId: string,
    tier: number,
    isPremium: boolean
  ): Promise<{ success: boolean; item?: string }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Idempotency key guard to strictly prevent duplicate reward grants across instances
      const idemKey = `bp_claim_${userId}_s1_t${tier}_${isPremium ? 'p' : 'f'}`;
      const idemRes = await client.query(
        `INSERT INTO public.idempotency_keys (key, resource_type, resource_id, created_at)
         VALUES ($1, 'battle_pass_reward', $2, NOW())
         ON CONFLICT (key) DO NOTHING`,
        [idemKey, `${userId}_t${tier}`]
      );
      if (idemRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return { success: false };
      }

      const bpRes = await client.query(
        `SELECT tier, is_premium, claimed_free_tiers, claimed_premium_tiers
         FROM player_battle_pass
         WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );
      if (bpRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false };
      }

      const bp = bpRes.rows[0];
      if (bp.tier < tier) {
        await client.query('ROLLBACK');
        return { success: false };
      }

      if (isPremium && !bp.is_premium) {
        await client.query('ROLLBACK');
        return { success: false };
      }

      let freeTiers: number[] = Array.isArray(bp.claimed_free_tiers) ? [...bp.claimed_free_tiers] : [];
      let premTiers: number[] = Array.isArray(bp.claimed_premium_tiers) ? [...bp.claimed_premium_tiers] : [];

      if (isPremium) {
        if (premTiers.includes(tier)) {
          await client.query('ROLLBACK');
          return { success: false };
        }
        premTiers.push(tier);
      } else {
        if (freeTiers.includes(tier)) {
          await client.query('ROLLBACK');
          return { success: false };
        }
        freeTiers.push(tier);
      }

      let rewardName = '';
      let cosmeticItem: { category: string; itemId: string; name: string } | null = null;
      if (tier === 3) {
        rewardName = '🎩 Top Hat';
        cosmeticItem = { category: 'hat', itemId: '🎩', name: rewardName };
      } else if (tier === 5) {
        rewardName = 'Obsidian Gold Card Back';
        cosmeticItem = { category: 'cardBack', itemId: 'obsidian_gold', name: rewardName };
      } else if (tier === 10) {
        rewardName = 'Royal Velvet Banner';
        cosmeticItem = { category: 'banner', itemId: 'royal_velvet', name: rewardName };
      } else if (tier === 15) {
        rewardName = '👑 Crown of Bowers';
        cosmeticItem = { category: 'hat', itemId: '👑', name: rewardName };
      } else if (tier === 20) {
        rewardName = 'Supreme Bower Title';
        cosmeticItem = { category: 'title', itemId: 'Supreme Bower', name: rewardName };
      }

      await client.query(
        `UPDATE player_battle_pass
         SET claimed_free_tiers = $1, claimed_premium_tiers = $2, updated_at = NOW()
         WHERE user_id = $3`,
        [freeTiers, premTiers, userId]
      );

      if (cosmeticItem) {
        await client.query(
          `INSERT INTO cosmetic_inventory (id, user_id, category, item_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [crypto.randomUUID(), userId, cosmeticItem.category, cosmeticItem.itemId]
        );
      }

      await client.query('COMMIT');
      return { success: true, item: rewardName };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async equipCosmetic(
    userId: string,
    category: 'hat' | 'cardBack' | 'banner' | 'title',
    itemId?: string
  ): Promise<boolean> {
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
      avatarIcon: targetUser.avatarIcon,
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
         SET total_games = total_games + 1, losses = losses + 1, win_streak = 0, updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
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

  private mapRowToUserAccount(row: any): UserAccount {
    return {
      id: row.id,
      username: row.username,
      avatarIcon: row.avatarIcon || '🤠',
      level: row.level || 1,
      xp: row.xp || 0,
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
      equippedCosmetics: {
        hat: row.equipped_hat || '🤠',
        cardBack: row.equipped_card_back || 'classic_blue',
        banner: row.equipped_banner || 'default_navy',
        title: row.equipped_title || 'Recruit',
      },
      battlePass: {
        tier: row.bpTier || 1,
        xp: row.bpXp || 0,
        tierXpRequired: row.bpTierReq || 500,
        isPremium: Boolean(row.bpIsPremium),
        claimedFreeTiers: row.bpClaimedFree || [],
        claimedPremiumTiers: row.bpClaimedPrem || [],
      },
      createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
      lastActive: row.lastActive ? new Date(row.lastActive).getTime() : Date.now(),
    };
  }
}
