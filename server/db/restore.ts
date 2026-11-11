/**
 * BOWER JJ — Database Recovery & Restoration Utility
 *
 * Safely restores the database from a verified snapshot with:
 * - Pre-flight integrity validation
 * - Automatic pre-restore safety backup of current data
 * - Dry-run validation mode (--dry-run)
 * - Safe atomic disk replacement
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../server/data');
const BACKUP_DIR = path.resolve(DATA_DIR, 'backups');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

export interface RestoreResult {
  success: boolean;
  restoredFrom: string;
  safetyBackupPath?: string;
  userCount: number;
  matchCount: number;
  dryRun: boolean;
  error?: string;
}

export function restoreDatabase(targetBackupPath?: string, dryRun = false): RestoreResult {
  try {
    let sourcePath = targetBackupPath;

    // If no path specified, select most recent backup
    if (!sourcePath) {
      if (!fs.existsSync(BACKUP_DIR)) {
        throw new Error('No backups directory found');
      }
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('db_snapshot_') && f.endsWith('.json'))
        .map(f => ({
          path: path.resolve(BACKUP_DIR, f),
          time: fs.statSync(path.resolve(BACKUP_DIR, f)).mtimeMs,
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length === 0) {
        throw new Error('No database snapshots available to restore from');
      }
      sourcePath = files[0].path;
    }

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Specified backup file not found: ${sourcePath}`);
    }

    const raw = fs.readFileSync(sourcePath, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!parsed.users || typeof parsed.users !== 'object') {
      throw new Error('Corrupt snapshot: missing valid "users" table');
    }

    const userCount = Object.keys(parsed.users).length;
    const matchCount = Array.isArray(parsed.matches) ? parsed.matches.length : 0;

    if (dryRun) {
      return {
        success: true,
        restoredFrom: sourcePath,
        userCount,
        matchCount,
        dryRun: true,
      };
    }

    // Create safety backup of existing db.json before replacing
    let safetyBackupPath: string | undefined;
    if (fs.existsSync(DB_FILE)) {
      safetyBackupPath = `${DB_FILE}.pre-restore-${Date.now()}.bak`;
      fs.copyFileSync(DB_FILE, safetyBackupPath);
    }

    // Write restored data
    const tmp = `${DB_FILE}.restore.tmp`;
    fs.writeFileSync(tmp, raw, 'utf-8');
    fs.renameSync(tmp, DB_FILE);

    return {
      success: true,
      restoredFrom: sourcePath,
      safetyBackupPath,
      userCount,
      matchCount,
      dryRun: false,
    };
  } catch (err: any) {
    return {
      success: false,
      restoredFrom: targetBackupPath || 'auto-detect',
      userCount: 0,
      matchCount: 0,
      dryRun,
      error: err.message || 'Restoration error',
    };
  }
}

// Allow direct CLI invocation: npx tsx server/db/restore.ts [--dry-run] [backupPath]
const isMainRestore = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('server/db/restore.ts');
if (isMainRestore) {
  const isDryRun = process.argv.includes('--dry-run');
  const customPath = process.argv.find(arg => arg.endsWith('.json'));

  console.log(`[RESTORE] Initiating database recovery (dry-run=${isDryRun})...`);
  const res = restoreDatabase(customPath, isDryRun);
  if (res.success) {
    console.log(`[RESTORE SUCCESS] Source: ${res.restoredFrom}`);
    console.log(`[RESTORE STATS] Accounts: ${res.userCount} | Matches: ${res.matchCount}`);
    if (res.safetyBackupPath) {
      console.log(`[SAFETY BACKUP] Previous DB preserved at: ${res.safetyBackupPath}`);
    }
  } else {
    console.error(`[RESTORE FAILED] ${res.error}`);
    process.exit(1);
  }
}
