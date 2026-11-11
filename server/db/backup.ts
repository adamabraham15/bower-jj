/**
 * BOWER JJ — Automated Database Backup & Snapshot Utility
 *
 * Creates validated, timestamped backups of all player accounts, competitive
 * ranks, MMR, LP, XP, cosmetics, friends, and match history.
 * Automatically prunes old backups, keeping the last 10 snapshots.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../server/data');
const BACKUP_DIR = path.resolve(DATA_DIR, 'backups');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');
const MAX_BACKUPS_TO_RETAIN = 10;

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  timestamp: string;
  userCount: number;
  matchCount: number;
  sizeBytes: number;
  error?: string;
}

export function createDatabaseBackup(): BackupResult {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  try {
    if (!fs.existsSync(DB_FILE)) {
      throw new Error(`Primary database file not found at: ${DB_FILE}`);
    }

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const rawData = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(rawData);

    // Verify snapshot integrity
    if (!parsed.users || typeof parsed.users !== 'object') {
      throw new Error('Database integrity check failed: missing "users" table');
    }

    const userCount = Object.keys(parsed.users).length;
    const matchCount = Array.isArray(parsed.matches) ? parsed.matches.length : 0;
    const backupFileName = `db_snapshot_${timestamp}.json`;
    const backupPath = path.resolve(BACKUP_DIR, backupFileName);

    // Write snapshot
    fs.writeFileSync(backupPath, rawData, 'utf-8');
    const stat = fs.statSync(backupPath);

    // Prune older backups exceeding retention limit
    pruneOldBackups();

    return {
      success: true,
      backupPath,
      timestamp,
      userCount,
      matchCount,
      sizeBytes: stat.size,
    };
  } catch (err: any) {
    return {
      success: false,
      timestamp,
      userCount: 0,
      matchCount: 0,
      sizeBytes: 0,
      error: err.message || 'Unknown backup error',
    };
  }
}

function pruneOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('db_snapshot_') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        fullPath: path.resolve(BACKUP_DIR, f),
        time: fs.statSync(path.resolve(BACKUP_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_BACKUPS_TO_RETAIN) {
      const toDelete = files.slice(MAX_BACKUPS_TO_RETAIN);
      for (const item of toDelete) {
        try { fs.unlinkSync(item.fullPath); } catch {}
      }
    }
  } catch {
    // Non-fatal
  }
}

// Allow direct CLI invocation: npx tsx server/db/backup.ts
const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('server/db/backup.ts');
if (isMain) {
  console.log('[BACKUP] Initiating database snapshot...');
  const res = createDatabaseBackup();
  if (res.success) {
    console.log(`[BACKUP SUCCESS] Saved to: ${res.backupPath}`);
    console.log(`[BACKUP STATS] Accounts: ${res.userCount} | Matches: ${res.matchCount} | Size: ${(res.sizeBytes / 1024).toFixed(1)} KB`);
  } else {
    console.error(`[BACKUP FAILED] ${res.error}`);
    process.exit(1);
  }
}
