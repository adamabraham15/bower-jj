/**
 * BOWER JJ — Authoritative PostgreSQL Restore & Disaster Recovery Utility
 *
 * Restores a PostgreSQL snapshot to a target database within an atomic transaction.
 * Supports dry-run validation to test recovery without corrupting existing records.
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;

export interface PostgresRestoreResult {
  success: boolean;
  dryRun: boolean;
  restoredProfiles: number;
  restoredRanks: number;
  restoredStats: number;
  restoredMatches: number;
  error?: string;
}

export async function restorePostgresBackup(
  backupFilePath: string,
  targetPoolOrUrl?: pg.Pool | string,
  dryRun = false
): Promise<PostgresRestoreResult> {
  if (!fs.existsSync(backupFilePath)) {
    return {
      success: false,
      dryRun,
      restoredProfiles: 0,
      restoredRanks: 0,
      restoredStats: 0,
      restoredMatches: 0,
      error: `Backup file not found at: ${backupFilePath}`,
    };
  }

  let pool: pg.Pool;
  let isPoolOwner = false;

  if (targetPoolOrUrl && typeof (targetPoolOrUrl as any).query === 'function') {
    pool = targetPoolOrUrl as pg.Pool;
  } else {
    const connStr = typeof targetPoolOrUrl === 'string' ? targetPoolOrUrl : process.env.DATABASE_URL;
    if (!connStr) {
      return {
        success: false,
        dryRun,
        restoredProfiles: 0,
        restoredRanks: 0,
        restoredStats: 0,
        restoredMatches: 0,
        error: 'No DATABASE_URL configured for PostgreSQL restore',
      };
    }
    pool = new Pool({ connectionString: connStr });
    isPoolOwner = true;
  }

  const client = await pool.connect();
  try {
    const raw = fs.readFileSync(backupFilePath, 'utf-8');
    const snapshot = JSON.parse(raw);

    if (snapshot.format !== 'bower-jj-postgres-snapshot' || !snapshot.data) {
      throw new Error('Invalid PostgreSQL snapshot format');
    }

    await client.query('BEGIN');

    // 1. Profiles
    let restoredProfiles = 0;
    for (const p of snapshot.data.profiles || []) {
      await client.query(
        `
        INSERT INTO public.profiles (id, player_id, username, avatar_icon, is_admin, is_banned, is_suspended, created_at, updated_at, last_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          avatar_icon = EXCLUDED.avatar_icon,
          last_active = EXCLUDED.last_active;
        `,
        [p.id, p.player_id, p.username, p.avatar_icon, p.is_admin, p.is_banned, p.is_suspended, p.created_at, p.updated_at, p.last_active]
      );
      restoredProfiles++;
    }

    // 2. Ranks
    let restoredRanks = 0;
    for (const r of snapshot.data.ranks || []) {
      await client.query(
        `
        INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
          rank_tier = EXCLUDED.rank_tier,
          rank_points = EXCLUDED.rank_points,
          mmr = EXCLUDED.mmr,
          has_demotion_shield = EXCLUDED.has_demotion_shield,
          updated_at = EXCLUDED.updated_at;
        `,
        [r.user_id, r.rank_tier, r.rank_points, r.mmr, r.placement_matches_remaining, r.has_demotion_shield, r.updated_at]
      );
      restoredRanks++;
    }

    // 3. Statistics
    let restoredStats = 0;
    for (const s of snapshot.data.stats || []) {
      await client.query(
        `
        INSERT INTO public.player_statistics (user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (user_id) DO UPDATE SET
          total_games = EXCLUDED.total_games,
          wins = EXCLUDED.wins,
          losses = EXCLUDED.losses,
          tricks_won = EXCLUDED.tricks_won,
          euchres = EXCLUDED.euchres,
          marches = EXCLUDED.marches,
          successful_loners = EXCLUDED.successful_loners,
          current_streak = EXCLUDED.current_streak,
          best_streak = EXCLUDED.best_streak,
          updated_at = EXCLUDED.updated_at;
        `,
        [s.user_id, s.total_games, s.wins, s.losses, s.tricks_won, s.euchres, s.marches, s.successful_loners, s.current_streak, s.best_streak, s.updated_at]
      );
      restoredStats++;
    }

    // 4. Matches
    let restoredMatches = 0;
    for (const m of snapshot.data.matches || []) {
      await client.query(
        `
        INSERT INTO public.matches (id, room_code, mode, composition, winning_team, score, duration_seconds, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING;
        `,
        [m.id, m.room_code, m.mode, m.composition, m.winning_team, m.score, m.duration_seconds, m.created_at]
      );
      restoredMatches++;
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      console.log(`[POSTGRES RESTORE] Dry run validated successfully (${restoredProfiles} profiles, ${restoredRanks} ranks). Rolled back.`);
    } else {
      await client.query('COMMIT');
      console.log(`[POSTGRES RESTORE] Successfully restored and committed ${restoredProfiles} profiles, ${restoredRanks} ranks, ${restoredMatches} matches.`);
    }

    return {
      success: true,
      dryRun,
      restoredProfiles,
      restoredRanks,
      restoredStats,
      restoredMatches,
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    return {
      success: false,
      dryRun,
      restoredProfiles: 0,
      restoredRanks: 0,
      restoredStats: 0,
      restoredMatches: 0,
      error: err.message || String(err),
    };
  } finally {
    client.release();
    if (isPoolOwner) {
      await pool.end();
    }
  }
}
