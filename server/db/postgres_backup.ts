/**
 * BOWER JJ — Authoritative PostgreSQL Backup & Snapshot Utility
 *
 * Extracts all relational player profiles, competitive ranks, statistics,
 * cosmetics, battle pass progression, friendships, and match history
 * into validated, timestamped JSON snapshots with automated retention pruning.
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.resolve(__dirname, '../../server/data/backups');
const MAX_BACKUPS = 10;

export interface PostgresBackupResult {
  success: boolean;
  backupPath?: string;
  timestamp: string;
  profilesCount: number;
  ranksCount: number;
  statsCount: number;
  matchesCount: number;
  sizeBytes: number;
  error?: string;
}

export async function createPostgresBackup(targetPoolOrUrl?: pg.Pool | string): Promise<PostgresBackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `pg_backup_${timestamp}.json`);

  let pool: pg.Pool;
  let isPoolOwner = false;

  if (targetPoolOrUrl && typeof (targetPoolOrUrl as any).query === 'function') {
    pool = targetPoolOrUrl as pg.Pool;
  } else {
    const connStr = typeof targetPoolOrUrl === 'string' ? targetPoolOrUrl : process.env.DATABASE_URL;
    if (!connStr) {
      return {
        success: false,
        timestamp,
        profilesCount: 0,
        ranksCount: 0,
        statsCount: 0,
        matchesCount: 0,
        sizeBytes: 0,
        error: 'No DATABASE_URL configured for PostgreSQL backup',
      };
    }
    pool = new Pool({ connectionString: connStr });
    isPoolOwner = true;
  }

  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const [profiles, ranks, stats, xp, cosmetics, inventory, battlePass, friendships, matches, matchHistory] = await Promise.all([
      pool.query(`SELECT * FROM public.profiles ORDER BY created_at ASC`),
      pool.query(`SELECT * FROM public.player_ranks`),
      pool.query(`SELECT * FROM public.player_statistics`),
      pool.query(`SELECT * FROM public.player_xp`),
      pool.query(`SELECT * FROM public.player_cosmetics`),
      pool.query(`SELECT * FROM public.cosmetic_inventory`),
      pool.query(`SELECT * FROM public.player_battle_pass`),
      pool.query(`SELECT * FROM public.friendships`),
      pool.query(`SELECT * FROM public.matches ORDER BY created_at ASC`),
      pool.query(`SELECT * FROM public.player_match_history ORDER BY created_at ASC`),
    ]);

    const backupPayload = {
      version: 1,
      format: 'bower-jj-postgres-snapshot',
      createdAt: new Date().toISOString(),
      counts: {
        profiles: profiles.rows.length,
        ranks: ranks.rows.length,
        stats: stats.rows.length,
        matches: matches.rows.length,
      },
      data: {
        profiles: profiles.rows,
        ranks: ranks.rows,
        stats: stats.rows,
        xp: xp.rows,
        cosmetics: cosmetics.rows,
        inventory: inventory.rows,
        battlePass: battlePass.rows,
        friendships: friendships.rows,
        matches: matches.rows,
        matchHistory: matchHistory.rows,
      },
    };

    const serialized = JSON.stringify(backupPayload, null, 2);
    fs.writeFileSync(backupFile, serialized, 'utf-8');
    const sizeBytes = fs.statSync(backupFile).size;

    // Prune old backups
    try {
      const allFiles = fs.readdirSync(BACKUP_DIR)
        .filter((f) => f.startsWith('pg_backup_') && f.endsWith('.json'))
        .map((f) => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);

      if (allFiles.length > MAX_BACKUPS) {
        allFiles.slice(MAX_BACKUPS).forEach((oldFile) => {
          try {
            fs.unlinkSync(path.join(BACKUP_DIR, oldFile.name));
          } catch {}
        });
      }
    } catch {}

    return {
      success: true,
      backupPath: backupFile,
      timestamp,
      profilesCount: profiles.rows.length,
      ranksCount: ranks.rows.length,
      statsCount: stats.rows.length,
      matchesCount: matches.rows.length,
      sizeBytes,
    };
  } catch (err: any) {
    return {
      success: false,
      timestamp,
      profilesCount: 0,
      ranksCount: 0,
      statsCount: 0,
      matchesCount: 0,
      sizeBytes: 0,
      error: err.message || String(err),
    };
  } finally {
    if (isPoolOwner) {
      await pool.end();
    }
  }
}

// Standalone execution
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createPostgresBackup().then((res) => {
    if (res.success) {
      console.log(`[POSTGRES BACKUP] ✓ Snapshot created at: ${res.backupPath}`);
      console.log(`[POSTGRES BACKUP] Profiles: ${res.profilesCount} | Ranks: ${res.ranksCount} | Matches: ${res.matchesCount} (${res.sizeBytes} bytes)`);
    } else {
      console.error(`[POSTGRES BACKUP] ✗ Backup failed:`, res.error);
      process.exit(1);
    }
  });
}
