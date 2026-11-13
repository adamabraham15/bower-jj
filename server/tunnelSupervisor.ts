/**
 * BOWER JJ — Self-Healing Edge Tunnel Supervisor
 *
 * Automatically manages cloudflared.exe, monitors health over public WAN,
 * auto-restarts on expiration, and syncs live public URL into Supabase server_registry.
 */

import { spawn, execSync, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { logger } from './telemetry';
import { PostgresDatabaseRepository } from './db/postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TunnelSupervisor {
  private child: ChildProcess | null = null;
  private currentUrl: string | null = null;
  private isRestarting: boolean = false;
  private consecutiveFailures: number = 0;
  private healthInterval: NodeJS.Timeout | null = null;
  private pgRepo: PostgresDatabaseRepository | null = null;

  constructor(pgRepo?: PostgresDatabaseRepository) {
    if (pgRepo) this.pgRepo = pgRepo;
  }

  public setPostgresRepository(repo: PostgresDatabaseRepository) {
    this.pgRepo = repo;
    if (this.currentUrl) {
      this.syncUrlToDatabase(this.currentUrl).catch(() => {});
    }
  }

  public async start(): Promise<void> {
    this.killExistingCloudflared();
    this.spawnTunnel();

    // Start 30-second WAN heartbeat to verify public connectivity
    if (this.healthInterval) clearInterval(this.healthInterval);
    this.healthInterval = setInterval(() => {
      this.verifyTunnelHealth();
    }, 30000);
  }

  private killExistingCloudflared(): void {
    try {
      execSync('taskkill /F /IM cloudflared.exe >nul 2>&1');
    } catch {}
  }

  private spawnTunnel(): void {
    if (this.isRestarting) return;
    this.isRestarting = true;

    // Locate cloudflared.exe
    const possiblePaths = [
      path.resolve(process.cwd(), 'cloudflared.exe'),
      path.resolve(__dirname, '..', 'cloudflared.exe'),
      path.resolve(process.cwd(), '..', 'cloudflared.exe'),
      'C:\\Users\\adama\\.gemini\\antigravity\\scratch\\cloudflared.exe',
    ];

    let binPath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        binPath = p;
        break;
      }
    }

    if (!binPath) {
      try {
        const dest = path.resolve(process.cwd(), 'cloudflared.exe');
        logger.info('[TUNNEL SUPERVISOR] cloudflared.exe not found. Auto-downloading latest official Windows binary...');
        execSync(
          `curl.exe -s -L -o "${dest}" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe`,
          { timeout: 30000 }
        );
        if (fs.existsSync(dest)) {
          binPath = dest;
          logger.info('[TUNNEL SUPERVISOR] Successfully downloaded cloudflared.exe.');
        }
      } catch (dlErr: any) {
        logger.warn(`[TUNNEL SUPERVISOR] Could not auto-download cloudflared: ${dlErr.message}`);
      }
    }

    if (!binPath) {
      logger.warn('[TUNNEL SUPERVISOR] cloudflared.exe not found. Running in local-only mode.');
      this.isRestarting = false;
      return;
    }

    logger.info(`[TUNNEL SUPERVISOR] Spawning fresh cloudflared tunnel using ${binPath}...`);

    try {
      this.child = spawn(binPath, ['tunnel', '--ha-connections', '4', '--url', 'http://localhost:3001'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const handleOutput = (data: Buffer) => {
        const text = data.toString();

        // Detect new tunnel URL
        const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (match && match[0]) {
          const newUrl = match[0].trim();
          if (newUrl !== this.currentUrl) {
            this.currentUrl = newUrl;
            this.consecutiveFailures = 0;
            logger.info(`[TUNNEL SUPERVISOR] New live edge tunnel established: ${newUrl}`);
            this.syncUrlToDatabase(newUrl).catch(err => {
              logger.warn(`[TUNNEL SUPERVISOR] Failed to sync URL to Supabase: ${err.message}`);
            });
          }
        }

        // Detect expired / dead tunnel
        if (text.includes('Unauthorized: Tunnel not found') || text.includes('failed to connect to tunnel')) {
          logger.warn('[TUNNEL SUPERVISOR] Edge tunnel expired or lost session. Scheduling fresh restart...');
          this.restartTunnel();
        }
      };

      if (this.child.stdout) this.child.stdout.on('data', handleOutput);
      if (this.child.stderr) this.child.stderr.on('data', handleOutput);

      this.child.on('exit', (code) => {
        logger.warn(`[TUNNEL SUPERVISOR] cloudflared exited with code ${code}.`);
        this.restartTunnel();
      });

      this.child.on('error', (err) => {
        logger.error('[TUNNEL SUPERVISOR] Failed to spawn cloudflared process:', err);
        this.restartTunnel();
      });
    } catch (err: any) {
      logger.error('[TUNNEL SUPERVISOR] Exception spawning tunnel:', err);
      this.restartTunnel();
    } finally {
      setTimeout(() => {
        this.isRestarting = false;
      }, 5000);
    }
  }

  private restartTunnel(): void {
    if (this.isRestarting) return;
    this.isRestarting = true;
    logger.info('[TUNNEL SUPERVISOR] Recycling cloudflared instance...');

    try {
      if (this.child) {
        this.child.kill();
        this.child = null;
      }
    } catch {}

    this.killExistingCloudflared();

    setTimeout(() => {
      this.isRestarting = false;
      this.spawnTunnel();
    }, 3000);
  }

  private async verifyTunnelHealth(): Promise<void> {
    if (!this.currentUrl) return;

    const testUrl = `${this.currentUrl}/health`;
    const client = testUrl.startsWith('https') ? https : http;

    const req = client.get(testUrl, { timeout: 15000 }, (res) => {
      res.resume(); // Free up socket
      if (res.statusCode === 200) {
        this.consecutiveFailures = 0;
        // Periodically refresh Supabase registry timestamp
        this.syncUrlToDatabase(this.currentUrl!).catch(() => {});
      } else {
        this.consecutiveFailures++;
        logger.warn(`[TUNNEL SUPERVISOR] Public health check returned HTTP ${res.statusCode} (Failures: ${this.consecutiveFailures}/5)`);
        if (this.consecutiveFailures >= 5) {
          this.restartTunnel();
        }
      }
    });

    req.on('error', (err) => {
      this.consecutiveFailures++;
      logger.warn(`[TUNNEL SUPERVISOR] Public WAN ping failed: ${err.message} (Failures: ${this.consecutiveFailures}/5)`);
      if (this.consecutiveFailures >= 5) {
        this.restartTunnel();
      }
    });

    req.on('timeout', () => {
      req.destroy();
      this.consecutiveFailures++;
      logger.warn(`[TUNNEL SUPERVISOR] Public WAN ping timed out (Failures: ${this.consecutiveFailures}/2)`);
      if (this.consecutiveFailures >= 2) {
        this.restartTunnel();
      }
    });
  }

  public async syncUrlToDatabase(url: string): Promise<void> {
    if (this.pgRepo) {
      try {
        await (this.pgRepo as any).pool.query(
          `INSERT INTO public.server_registry (id, public_url, updated_at)
           VALUES ('primary', $1, NOW())
           ON CONFLICT (id) DO UPDATE SET public_url = EXCLUDED.public_url, updated_at = NOW()`,
          [url]
        );
        logger.info(`[TUNNEL SUPERVISOR] Successfully registered ${url} into Supabase server_registry (PostgreSQL).`);
        return;
      } catch (err: any) {
        logger.warn(`[TUNNEL SUPERVISOR] Database registration error: ${err.message}`);
      }
    }

    // Direct REST API sync fallback for server_registry
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://luqyiarxemhreuxfuzwz.supabase.co';
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1cXlpYXJ4ZW1ocmV1eGZ1end6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTU0ODEsImV4cCI6MjEwNjg3MTQ4MX0.zEGNBVy4wdSBjw7SDr_6WJbQc1ifwBakgv1XzL4cst4';
      const res = await fetch(`${supabaseUrl}/rest/v1/server_registry?id=eq.primary`, {
        method: 'PATCH',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          public_url: url,
          updated_at: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        logger.info(`[TUNNEL SUPERVISOR] Successfully registered ${url} into Supabase server_registry (REST).`);
      } else {
        logger.warn(`[TUNNEL SUPERVISOR] REST server_registry sync failed with status ${res.status}`);
      }
    } catch (restErr: any) {
      logger.warn(`[TUNNEL SUPERVISOR] REST server_registry sync error: ${restErr.message}`);
    }
  }

  public stop(): void {
    if (this.healthInterval) clearInterval(this.healthInterval);
    if (this.child) {
      try {
        this.child.kill();
      } catch {}
      this.child = null;
    }
  }
}
