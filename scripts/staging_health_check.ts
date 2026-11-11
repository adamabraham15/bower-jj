/**
 * BOWER JJ — Hosted Staging & Remote Environment Health Verifier
 *
 * Usage:
 *   npx tsx scripts/staging_health_check.ts <httpBaseUrl> [wsBaseUrl] [metricsSecret]
 *
 * Example:
 *   npx tsx scripts/staging_health_check.ts https://staging-api.bowerjj.com wss://staging-api.bowerjj.com/ws my-secret
 */

import { WebSocket } from 'ws';

async function verifyStaging() {
  const args = process.argv.slice(2);
  const httpUrl = args[0] || 'http://127.0.0.1:3001';
  const defaultWs = httpUrl.replace(/^http/, 'ws') + '/ws';
  const wsUrl = args[1] || defaultWs;
  const metricsSecret = args[2] || process.env.METRICS_SECRET || 'bower-jj-internal-metrics-secret';

  console.log(`\n============================================================`);
  console.log(`  BOWER JJ — REMOTE STAGING HEALTH VERIFICATION`);
  console.log(`  HTTP Target: ${httpUrl}`);
  console.log(`  WebSocket Target: ${wsUrl}`);
  console.log(`============================================================\n`);

  // 1. Health Probe
  process.stdout.write('[PROBE 1/5] Testing HTTP /health probe... ');
  try {
    const start = Date.now();
    const res = await fetch(`${httpUrl}/health`);
    const duration = Date.now() - start;
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = (await res.json()) as any;
    console.log(`✓ OK (${duration}ms)`);
    console.log(`            • Status: ${data.status} | DB: ${data.database?.provider || data.dbStatus} (Authoritative: ${data.database?.authoritative})`);
    console.log(`            • Uptime: ${data.uptimeSec}s | Connections: ${data.activeConnections} | Rooms: ${data.activeRooms}`);
  } catch (err: any) {
    console.log(`✗ FAILED (${err.message})`);
  }

  // 2. Readiness Probe
  process.stdout.write('[PROBE 2/5] Testing HTTP /ready probe... ');
  try {
    const start = Date.now();
    const res = await fetch(`${httpUrl}/ready`);
    const duration = Date.now() - start;
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    console.log(`✓ OK (${duration}ms) — Database connection verified`);
  } catch (err: any) {
    console.log(`✗ FAILED (${err.message})`);
  }

  // 3. Unauthorized Metrics Protection
  process.stdout.write('[PROBE 3/5] Testing /metrics authorization gate... ');
  try {
    const res = await fetch(`${httpUrl}/metrics`);
    if (res.status === 401) {
      console.log(`✓ OK (401 Unauthorized enforced without secret)`);
    } else {
      console.log(`✗ FAILED (Expected 401 Unauthorized, received ${res.status})`);
    }
  } catch (err: any) {
    console.log(`✗ FAILED (${err.message})`);
  }

  // 4. Authorized Telemetry Metrics
  process.stdout.write('[PROBE 4/5] Testing authorized telemetry metrics retrieval... ');
  try {
    const res = await fetch(`${httpUrl}/metrics?token=${metricsSecret}`);
    if (res.ok) {
      const metrics = (await res.json()) as any;
      console.log(`✓ OK`);
      console.log(`            • CPU Cores: ${metrics.server?.cpu?.cores} | Heap: ${metrics.server?.memory?.heapUsedMb} MB`);
      console.log(`            • Total Matches: ${metrics.multiplayer?.totalMatchesStarted}`);
    } else {
      console.log(`✗ FAILED (Status ${res.status})`);
    }
  } catch (err: any) {
    console.log(`✗ FAILED (${err.message})`);
  }

  // 5. WebSocket Connection & Handshake
  process.stdout.write('[PROBE 5/5] Testing secure WebSocket handshake & authentication... ');
  try {
    const wsStart = Date.now();
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('WebSocket connection timed out after 5000ms'));
      }, 5000);

      ws.on('open', () => {
        const handshakeTime = Date.now() - wsStart;
        ws.send(JSON.stringify({
          type: 'AUTH',
          username: 'StagingProbeUser',
          avatarIcon: '🛰️',
        }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'AUTH_SUCCESS') {
          clearTimeout(timer);
          ws.close();
          console.log(`✓ OK (${Date.now() - wsStart}ms round-trip)`);
          console.log(`            • Authenticated User: ${msg.user?.username} (${msg.user?.id})`);
          resolve();
        } else if (msg.type === 'ERROR') {
          clearTimeout(timer);
          ws.close();
          reject(new Error(msg.message));
        }
      });

      ws.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  } catch (err: any) {
    console.log(`✗ FAILED (${err.message})`);
  }

  console.log(`\n============================================================`);
  console.log(`  VERIFICATION FINISHED`);
  console.log(`============================================================\n`);
}

verifyStaging();
