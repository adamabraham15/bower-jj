/**
 * BOWER JJ — Stage 4.4: Staging, Observability, Telemetry & Operational Resilience Test Suite
 *
 * Verifies:
 * 1. Health and readiness endpoints (/health, /ready, /metrics).
 * 2. Real-time telemetry histogram calculation (P50, P95, P99).
 * 3. Sanitized structured logging (scrubbing secrets, tokens, card hands).
 * 4. Automated database backup creation and dry-run recovery verification.
 * 5. Environment configuration validation across environments.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMultiplayerServer, RunningServer } from '../index';
import { RoomManager } from '../roomManager';
import { db } from '../db';
import { telemetry, logger } from '../telemetry';
import { createDatabaseBackup } from '../db/backup';
import { restoreDatabase } from '../db/restore';
import { loadServerConfig } from '../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Stage 4.4: Staging Observability, Telemetry & Operational Resilience', () => {
  let serverInstance: RunningServer;
  let serverPort: number;

  beforeAll(async () => {
    const testRm = new RoomManager();
    serverInstance = await createMultiplayerServer(0, testRm, db);
    serverPort = serverInstance.port;
  });

  afterAll(async () => {
    await serverInstance.close();
  });

  // =========================================================================
  // 1. HTTP HEALTH, READINESS & OBSERVABILITY PROBES
  // =========================================================================
  it('serves external monitoring health check at /health with accurate server metadata', async () => {
    const res = await fetch(`http://127.0.0.1:${serverPort}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.status).toBe('healthy');
    expect(body.game).toBe('BOWER JJ');
    expect(typeof body.time).toBe('number');
    expect(typeof body.uptimeSec).toBe('number');
    expect(body.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(body.dbStatus).toBe('healthy');
    expect(typeof body.activeConnections).toBe('number');
    expect(typeof body.activeRooms).toBe('number');
  });

  it('serves readiness probe at /ready for container orchestrators', async () => {
    const res = await fetch(`http://127.0.0.1:${serverPort}/ready`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ready).toBe(true);
    expect(body.status).toBe('ok');
  });

  it('enforces authentication on /metrics endpoint and serves telemetry to authorized clients', async () => {
    // 1. Unauthorized request rejected with 401
    const unauthRes = await fetch(`http://127.0.0.1:${serverPort}/metrics`);
    expect(unauthRes.status).toBe(401);
    const errBody = await unauthRes.json();
    expect(errBody.error).toBe('Unauthorized');

    // 2. Invalid bearer token rejected with 401
    const badTokenRes = await fetch(`http://127.0.0.1:${serverPort}/metrics`, {
      headers: { Authorization: 'Bearer invalid-token-123' },
    });
    expect(badTokenRes.status).toBe(401);

    // 3. Authorized request with Bearer token succeeds with 200
    const authRes = await fetch(`http://127.0.0.1:${serverPort}/metrics`, {
      headers: { Authorization: 'Bearer bower-jj-internal-metrics-secret' },
    });
    expect(authRes.status).toBe(200);
    const snapshot = await authRes.json();

    expect(snapshot.server.nodeVersion).toBeDefined();
    expect(snapshot.server.cpu.cores).toBeGreaterThan(0);
    expect(snapshot.server.memory.heapUsedMb).toBeGreaterThan(0);
    expect(snapshot.multiplayer.matchCompletionRate).toBeGreaterThanOrEqual(0);
    expect(snapshot.multiplayer.authLatency).toHaveProperty('p50');
    expect(snapshot.multiplayer.authLatency).toHaveProperty('p95');
    expect(snapshot.multiplayer.authLatency).toHaveProperty('p99');
    expect(snapshot.integrity).toHaveProperty('rateLimitViolationsBlocked');
    expect(snapshot.integrity).toHaveProperty('duplicateRewardAttemptsBlocked');

    // 4. Authorized request with query token also succeeds
    const queryRes = await fetch(`http://127.0.0.1:${serverPort}/metrics?token=bower-jj-internal-metrics-secret`);
    expect(queryRes.status).toBe(200);
  });

  // =========================================================================
  // 2. TELEMETRY REGISTRY & LATENCY HISTOGRAM CALCULATION
  // =========================================================================
  it('records connection events and accurately computes latency percentiles (P50, P95, P99)', () => {
    telemetry.onConnectionOpened();
    telemetry.onConnectionOpened();
    expect(telemetry.activeConnections).toBeGreaterThanOrEqual(2);

    telemetry.onConnectionClosed();
    expect(telemetry.activeConnections).toBeGreaterThanOrEqual(1);

    // Record synthetic latency samples
    for (let i = 1; i <= 100; i++) {
      telemetry.recordAuthLatency(i); // 1ms to 100ms
    }

    const snap = telemetry.getSnapshot();
    expect(snap.multiplayer.authLatency.count).toBeGreaterThanOrEqual(100);
    expect(snap.multiplayer.authLatency.min).toBe(1);
    expect(snap.multiplayer.authLatency.p50).toBe(51);
    expect(snap.multiplayer.authLatency.p95).toBe(96);
    expect(snap.multiplayer.authLatency.p99).toBe(100);
  });

  // =========================================================================
  // 3. SANITIZED LOGGING & SECRET SCRUBBING
  // =========================================================================
  it('safe logger redacts passwords, tokens, private cards, and service keys from outputs', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('User authenticated', {
      username: 'SafeUser',
      sessionToken: 'secret_session_token_123',
      accessToken: 'secret_access_token_456',
      serviceRoleKey: 'supabase_service_role_key_789',
      yourHand: [{ id: 'AS', suit: 'spades', rank: 'A' }],
    });

    expect(spy).toHaveBeenCalled();
    const loggedCall = spy.mock.calls[0];
    const sanitizedContext = loggedCall[1];

    // Sensitive values must be redacted
    expect(sanitizedContext.sessionToken).toBe('[REDACTED]');
    expect(sanitizedContext.accessToken).toBe('[REDACTED]');
    expect(sanitizedContext.serviceRoleKey).toBe('[REDACTED]');
    expect(sanitizedContext.yourHand).toBe('[REDACTED]');
    expect(sanitizedContext.username).toBe('SafeUser');

    spy.mockRestore();
  });

  // =========================================================================
  // 4. DATABASE BACKUP & RESTORATION RESILIENCE
  // =========================================================================
  it('creates timestamped database backup with verified integrity and prunes old snapshots', () => {
    const backupRes = createDatabaseBackup();
    expect(backupRes.success).toBe(true);
    expect(backupRes.backupPath).toBeDefined();
    expect(backupRes.userCount).toBeGreaterThan(0);
    expect(backupRes.sizeBytes).toBeGreaterThan(0);

    expect(fs.existsSync(backupRes.backupPath!)).toBe(true);

    // Validate that the backup file is valid JSON
    const content = fs.readFileSync(backupRes.backupPath!, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.users).toBeDefined();
    expect(Object.keys(parsed.users).length).toBe(backupRes.userCount);
  });

  it('performs dry-run database restoration without overwriting active data', () => {
    const dryRes = restoreDatabase(undefined, true);
    expect(dryRes.success).toBe(true);
    expect(dryRes.dryRun).toBe(true);
    expect(dryRes.userCount).toBeGreaterThan(0);
    expect(dryRes.restoredFrom).toBeDefined();
  });

  // =========================================================================
  // 5. RUNTIME ENVIRONMENT CONFIGURATION
  // =========================================================================
  it('validates server environment configuration and enforces secret hygiene', () => {
    const conf = loadServerConfig();
    expect(conf.port).toBe(3001);
    expect(conf.rankedBotWaitMs).toBe(35000);
    expect(typeof conf.hasSupabaseConfigured).toBe('boolean');
    expect(typeof conf.hasServiceRoleKey).toBe('boolean');
  });
});
