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

function findCloudflareUrl(): string | null {
  const localTunnelLog = path.join('C:', 'Users', 'adama', '.gemini', 'antigravity', 'scratch', 'bower-jj', 'tunnel.log');
  const pm2LogPath = path.join(os.homedir(), '.pm2', 'logs', 'bower-jj-tunnel-out.log');
  const pm2ErrPath = path.join(os.homedir(), '.pm2', 'logs', 'bower-jj-tunnel-error.log');

  for (const logPath of [localTunnelLog, pm2ErrPath, pm2LogPath]) {
    if (fs.existsSync(logPath)) {
      const content = fs.readFileSync(logPath, 'utf8');
      const matches = content.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
      if (matches && matches.length > 0) {
        return matches[matches.length - 1];
      }
    }
  }
  return null;
}

async function main() {
  console.log('================================================================');
  console.log('         🃏 BOWER JJ — 24/7 DEDICATED SERVER DASHBOARD          ');
  console.log('================================================================\n');

  const health = await checkHealth();
  const localIp = getLocalIp();
  const cfUrl = findCloudflareUrl();

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
