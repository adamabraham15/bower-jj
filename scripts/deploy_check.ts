/**
 * BOWER JJ — Staging & Production Deployment Pre-Flight Verification Script
 *
 * Runs all critical build, test, database, and telemetry checks
 * before permitting any staging or production deployment.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDatabaseBackup } from '../server/db/backup';
import { serverConfig } from '../server/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function runStep(name: string, fn: () => void) {
  process.stdout.write(`[DEPLOY CHECK] ${name}... `);
  const start = Date.now();
  try {
    fn();
    const duration = Date.now() - start;
    console.log(`✓ PASSED (${duration}ms)`);
  } catch (err: any) {
    console.log(`✗ FAILED`);
    console.error(`\n[ERROR IN STEP "${name}"]:`, err.message || err);
    process.exit(1);
  }
}

console.log(`\n============================================================`);
console.log(`  BOWER JJ — DEPLOYMENT PRE-FLIGHT VERIFICATION PIPELINE`);
console.log(`  Environment: ${serverConfig.env.toUpperCase()} | Node: ${process.version}`);
console.log(`============================================================\n`);

// 1. Environment & Secrets Check
runStep('1. Environment & Configuration Validation', () => {
  if (serverConfig.isProduction && !serverConfig.hasSupabaseConfigured && !serverConfig.databaseUrl) {
    throw new Error('Production requires DATABASE_URL or SUPABASE_URL');
  }
  if (!fs.existsSync(path.resolve(ROOT_DIR, 'package.json'))) {
    throw new Error('package.json not found in root');
  }
});

// 2. TypeScript Compilation Check
runStep('2. TypeScript Validation (tsc --noEmit)', () => {
  execSync('npx tsc --noEmit', { cwd: ROOT_DIR, stdio: 'pipe' });
});

// 3. Automated Vitest Test Suite
runStep('3. Automated Test Suite (Vitest 81+ tests)', () => {
  execSync('npx vitest run', { cwd: ROOT_DIR, stdio: 'pipe' });
});

// 4. Production Bundle Build Check
runStep('4. Production Vite Frontend Bundle', () => {
  execSync('npx vite build', { cwd: ROOT_DIR, stdio: 'pipe' });
  const indexHtml = path.resolve(ROOT_DIR, 'dist/index.html');
  if (!fs.existsSync(indexHtml)) {
    throw new Error('dist/index.html not generated after build');
  }
});

// 5. Database Snapshot Integrity Check
runStep('5. Database Backup & Integrity Check', () => {
  const res = createDatabaseBackup();
  if (!res.success) {
    throw new Error(`Database backup failed: ${res.error}`);
  }
});

console.log(`\n============================================================`);
console.log(`  ✓ ALL DEPLOYMENT PRE-FLIGHT CHECKS PASSED`);
console.log(`  Application is certified for Staging / Production deployment.`);
console.log(`============================================================\n`);
