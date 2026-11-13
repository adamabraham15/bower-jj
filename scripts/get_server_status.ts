import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.')) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

function checkHealth(): Promise<any> {
  return new Promise((resolve) => {
    http.get('http://localhost:3001/health', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function findCloudflareUrl(): Promise<string | null> {
  const serverLog = path.join('C:', 'Users', 'adama', 'bower-jj', 'server.log');
  const localTunnelLog = path.join('C:', 'Users', 'adama', '.gemini', 'antigravity', 'scratch', 'bower-jj', 'tunnel.log');
  const pm2LogPath = path.join(os.homedir(), '.pm2', 'logs', 'bower-jj-tunnel-out.log');
  const pm2ErrPath = path.join(os.homedir(), '.pm2', 'logs', 'bower-jj-tunnel-error.log');

  for (const logPath of [serverLog, localTunnelLog, pm2ErrPath, pm2LogPath]) {
    if (fs.existsSync(logPath)) {
      try {
        const content = fs.readFileSync(logPath, 'utf8');
        const matches = content.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
        if (matches && matches.length > 0) {
          return matches[matches.length - 1];
        }
      } catch {}
    }
  }

  // Fallback: check Supabase server_registry
  try {
    const res = await fetch('https://luqyiarxemhreuxfuzwz.supabase.co/rest/v1/server_registry?id=eq.primary&select=public_url', {
      headers: {
        apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1cXlpYXJ4ZW1ocmV1eGZ1end6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTU0ODEsImV4cCI6MjEwNjg3MTQ4MX0.zEGNBVy4wdSBjw7SDr_6WJbQc1ifwBakgv1XzL4cst4',
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1cXlpYXJ4ZW1ocmV1eGZ1end6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTU0ODEsImV4cCI6MjEwNjg3MTQ4MX0.zEGNBVy4wdSBjw7SDr_6WJbQc1ifwBakgv1XzL4cst4',
      },
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      if (Array.isArray(data) && data[0]?.public_url) {
        return data[0].public_url;
      }
    }
  } catch {}

  return null;
}

async function main() {
  console.log('================================================================');
  console.log('         🃏 BOWER JJ — 24/7 DEDICATED SERVER DASHBOARD          ');
  console.log('================================================================\n');

  const health = await checkHealth();
  const localIp = getLocalIp();
  const cfUrl = await findCloudflareUrl();

  if (health && health.status === 'healthy') {
    console.log(' [●] SERVER STATUS      : ONLINE (PORT 3001)');
    console.log(` [●] DATABASE POOL     : CONNECTED (${health.database?.provider || 'PostgreSQL'})`);
    console.log(` [●] ACTIVE GAME ROOMS : ${health.activeRooms || 0}`);
    console.log(` [●] SERVER UPTIME     : ${Math.floor((health.uptimeSec || 0) / 60)} minutes (${health.uptimeSec || 0}s)`);
    console.log(` [●] ACTIVE SESSIONS   : ${health.activeConnections || 0}`);
  } else {
    console.log(' [○] SERVER STATUS      : OFFLINE or INITIALIZING (Port 3001)');
  }

  console.log('\n----------------------------------------------------------------');
  console.log(' CONNECTIVITY ACCESS URLS:');
  console.log(` • Local Home Wi-Fi URL : http://${localIp}:3001`);
  console.log(` • Local PC Direct URL  : http://localhost:3001`);
  if (cfUrl) {
    console.log(` • Global Internet URL  : ${cfUrl}`);
  } else {
    console.log(` • Global Internet URL  : (Checking tunnel connection...)`);
  }
  console.log(' • Vercel Web Client    : https://bower-jj.vercel.app');
  console.log('----------------------------------------------------------------\n');
}

main().catch(console.error);
