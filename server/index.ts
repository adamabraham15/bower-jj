/**
 * BOWER JJ — Authoritative Multiplayer Server
 * WebSockets + HTTP on Port 3001
 * Production Hardened with Observability, Telemetry & Graceful Shutdown
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from './db';
import { PostgresDatabaseRepository } from './db/postgres';
import { roomManager, ClientConnection, RoomManager } from './roomManager';
import { ClientMessage, ServerMessage } from './types';
import { tokenVerifier, supabaseAdmin } from './auth';
import { telemetry, logger } from './telemetry';
import { serverConfig } from './config';
import { TunnelSupervisor } from './tunnelSupervisor';

export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const DIST_DIR = path.resolve(process.cwd(), 'dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export interface RunningServer {
  server: http.Server;
  wss: WebSocketServer;
  port: number;
  roomManager: RoomManager;
  pgRepo?: PostgresDatabaseRepository;
  close: () => Promise<void>;
}

export function sendError(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    const errorMsg: ServerMessage = { type: 'ERROR', message };
    ws.send(JSON.stringify(errorMsg));
  }
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (!fs.existsSync(DIST_DIR)) return false;

  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  let pathname = parsedUrl.pathname;
  if (pathname === '/') pathname = '/index.html';

  let filePath = path.join(DIST_DIR, pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}

export async function createMultiplayerServer(
  listenPort: number = PORT,
  customRm?: RoomManager,
  customDb?: typeof db,
  customPgRepo?: PostgresDatabaseRepository
): Promise<RunningServer> {
  const activeRm = customRm || roomManager;
  let activePgRepo: PostgresDatabaseRepository | null = customPgRepo || null;
  let activeDb: any = customDb || null;

  if (activePgRepo) {
    activeDb = activePgRepo;
    activeRm.setPostgresRepository(activePgRepo);
  } else if (!customDb && process.env.DATABASE_URL) {
    try {
      const repo = new PostgresDatabaseRepository(process.env.DATABASE_URL);
      const health = await repo.healthCheck();
      if (!health.healthy) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`[FATAL] Production database connection failed: ${health.error}. Startup aborted.`);
        } else {
          logger.warn(`[DATABASE] PostgreSQL connection failed (${health.error}). Falling back to local JSON database.`);
          activeDb = db;
        }
      } else {
        await repo.initSchema();
        activePgRepo = repo;
        activeDb = repo;
        activeRm.setPostgresRepository(repo);
        logger.info(`[DATABASE] Authoritative PostgreSQL database connected. Latency: ${health.latencyMs}ms, Pool: ${JSON.stringify(health.poolStats)}`);
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`[FATAL] Production database failure: ${err.message}. Startup aborted.`);
      } else {
        logger.warn(`[DATABASE] PostgreSQL error: ${err.message}. Falling back to local JSON database.`);
        activeDb = db;
      }
    }
  } else if (!customDb) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[FATAL] Production environment requires authoritative PostgreSQL database connection via DATABASE_URL. Silent fallback to db.json is strictly forbidden in production.');
    } else {
      activeDb = db;
    }
  }

  // Create HTTP Server
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', serverConfig.corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.url === '/health') {
      telemetry.activeRooms = activeRm.getActiveRoomCount();
      const snapshot = telemetry.getSnapshot();
      let dbStatus = 'healthy';
      let dbProvider = activePgRepo ? 'postgresql' : 'json_fallback';
      if (activePgRepo) {
        try {
          const pgHealth = await activePgRepo.healthCheck();
          if (!pgHealth.healthy) dbStatus = 'unhealthy';
        } catch {
          dbStatus = 'unhealthy';
        }
      }
      res.writeHead(dbStatus === 'healthy' ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: snapshot.server.status,
          game: 'BOWER JJ',
          time: snapshot.timestamp,
          uptimeSec: snapshot.server.uptimeSec,
          activeConnections: snapshot.multiplayer.activeConnections,
          activeRooms: snapshot.multiplayer.activeRooms,
          dbStatus,
          database: {
            provider: dbProvider,
            authoritative: Boolean(activePgRepo),
            status: dbStatus,
          },
        })
      );
      return;
    }

    if (req.url === '/ready') {
      if (activePgRepo) {
        try {
          const pgHealth = await activePgRepo.healthCheck();
          if (!pgHealth.healthy) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ready: false, status: 'database_unavailable', error: pgHealth.error }));
            return;
          }
        } catch (e: any) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ready: false, status: 'database_error', error: e.message }));
          return;
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready: true, status: 'ok' }));
      return;
    }

    if (req.url?.startsWith('/metrics')) {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const authHeader = req.headers['authorization'];
      const queryToken = parsedUrl.searchParams.get('token');
      const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const expectedSecret = process.env.METRICS_SECRET || (serverConfig.isProduction ? '' : 'bower-jj-internal-metrics-secret');

      const providedToken = bearerToken || queryToken;
      if (!providedToken || !expectedSecret || providedToken !== expectedSecret) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'Unauthorized',
            message: 'Valid metrics authorization token required to access server telemetry.',
          })
        );
        return;
      }

      telemetry.activeRooms = activeRm.getActiveRoomCount();
      const snapshot = telemetry.getSnapshot();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(snapshot, null, 2));
      return;
    }

    if (req.url === '/leaderboard') {
      try {
        const entries = await activeDb.getLeaderboard(50);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ leaderboard: entries }));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to retrieve leaderboard', details: err.message }));
      }
      return;
    }

    if (req.url === '/matchmaking/stats') {
      try {
        const stats = await activeDb.getMatchmakingStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to retrieve matchmaking stats', details: err.message }));
      }
      return;
    }

    // Static frontend serving fallback (single-container staging/production hosting)
    if (serveStatic(req, res)) {
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  // Create WebSocket Server with Origin Security Verification (CSWSH Protection)
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    verifyClient: (info, callback) => {
      // In development or test, allow all origins
      if (serverConfig.isDevelopment || serverConfig.isTest) {
        return callback(true);
      }

      const origin = info.origin || (info.req.headers['origin'] as string);
      // Non-browser client tools (e.g. load test scripts, health monitors) send no Origin header
      if (!origin) {
        return callback(true);
      }

      // If wildcard is explicitly configured
      if (serverConfig.corsOrigin === '*') {
        return callback(true);
      }

      const allowedList = serverConfig.corsOrigin.split(',').map((o) => o.trim().toLowerCase());
      const normalizedOrigin = origin.toLowerCase().trim();

      // Check if origin matches or ends with allowed domain (e.g., https://bowerjj.com or https://*.vercel.app)
      const isAllowed = allowedList.some((allowed) => {
        if (allowed === '*' || normalizedOrigin === allowed) return true;
        const cleanAllowed = allowed.replace(/^https?:\/\//, '').replace(/^\*\./, '');
        const cleanOrigin = normalizedOrigin.replace(/^https?:\/\//, '');
        return cleanOrigin === cleanAllowed || cleanOrigin.endsWith(`.${cleanAllowed}`);
      });

      if (!isAllowed) {
        logger.warn(`[SECURITY] Blocked WebSocket connection from unauthorized origin: ${origin}`);
        return callback(false, 403, 'Forbidden: Origin Not Allowed');
      }

      return callback(true);
    },
  });

  // WebSocket Heartbeat Monitor (30-second interval to detect dead sockets)
  const HEARTBEAT_INTERVAL_MS = 30000;
  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((client: any) => {
      if (client.isAlive === false) {
        logger.info('[HEARTBEAT] Terminating unresponsive connection');
        return client.terminate();
      }
      client.isAlive = false;
      client.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);
  if (heartbeatTimer && typeof heartbeatTimer.unref === 'function') heartbeatTimer.unref();

  wss.on('close', () => {
    clearInterval(heartbeatTimer);
  });

  wss.on('connection', (ws: WebSocket) => {
    telemetry.onConnectionOpened();
    let authenticatedUserId: string | null = null;
    let isAuthenticating = false;
    const preAuthQueue: ClientMessage[] = [];
    (ws as any).isAlive = true;

    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    // Sliding window rate limiter (max 40 messages per 2-second window)
    const messageTimestamps: number[] = [];
    const RATE_LIMIT_WINDOW_MS = 2000;
    const MAX_MESSAGES_PER_WINDOW = 40;

    ws.on('message', async (data: string) => {
      const msgStart = Date.now();
      try {
        const now = Date.now();
        messageTimestamps.push(now);
        while (messageTimestamps.length > 0 && messageTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
          messageTimestamps.shift();
        }

        if (messageTimestamps.length > MAX_MESSAGES_PER_WINDOW) {
          telemetry.rateLimitViolationsBlocked++;
          sendError(ws, 'Rate limit exceeded: You are sending requests too quickly. Please wait.');
          return;
        }

        const msg: ClientMessage = JSON.parse(data.toString());

        // 1. Authoritative Token Verification & Authentication
        if (msg.type === 'AUTH') {
          isAuthenticating = true;
          const authStart = Date.now();
          const token = msg.accessToken || msg.sessionToken;
          const identity = await tokenVerifier.verifyToken(token, msg.username, msg.avatarIcon);

          if (!identity) {
            isAuthenticating = false;
            telemetry.authFailuresBlocked++;
            sendError(ws, 'Authentication rejected: Invalid, expired, or missing credentials.');
            return;
          }

          const { user, sessionToken } = await activeDb.getOrCreateUser(
            identity.username,
            identity.avatarIcon,
            msg.sessionToken,
            identity.userId
          );

          // Synchronize authoritative lifetime stats & rank from Supabase when running in fallback mode
          if (!activePgRepo && !identity.isGuest && supabaseAdmin) {
            try {
              const [rankRes, statsRes, xpRes] = await Promise.all([
                supabaseAdmin.from('player_ranks').select('*').eq('user_id', identity.userId).maybeSingle(),
                supabaseAdmin.from('player_statistics').select('*').eq('user_id', identity.userId).maybeSingle(),
                supabaseAdmin.from('player_xp').select('*').eq('user_id', identity.userId).maybeSingle(),
              ]);

              const updates: Partial<typeof user> = {};
              if (rankRes?.data) {
                if (rankRes.data.rank_tier) updates.rankTier = rankRes.data.rank_tier;
                if (typeof rankRes.data.rank_points === 'number') updates.rankPoints = rankRes.data.rank_points;
                if (typeof rankRes.data.mmr === 'number') updates.mmr = rankRes.data.mmr;
              }
              if (statsRes?.data) {
                if (typeof statsRes.data.wins === 'number') updates.wins = statsRes.data.wins;
                if (typeof statsRes.data.losses === 'number') updates.losses = statsRes.data.losses;
                if (typeof statsRes.data.total_games === 'number') updates.totalGames = statsRes.data.total_games;
                if (typeof statsRes.data.tricks_won === 'number') updates.tricksWon = statsRes.data.tricks_won;
                if (typeof statsRes.data.euchres === 'number') updates.euchres = statsRes.data.euchres;
                if (typeof statsRes.data.marches === 'number') updates.marches = statsRes.data.marches;
                if (typeof statsRes.data.successful_loners === 'number') updates.successfulLoners = statsRes.data.successful_loners;
                if (typeof statsRes.data.current_streak === 'number') updates.winStreak = statsRes.data.current_streak;
                if (typeof statsRes.data.best_streak === 'number') updates.bestWinStreak = statsRes.data.best_streak;
              }
              if (xpRes?.data) {
                if (typeof xpRes.data.level === 'number') updates.level = xpRes.data.level;
                if (typeof xpRes.data.xp === 'number') updates.xp = xpRes.data.xp;
              }

              if (Object.keys(updates).length > 0) {
                await activeDb.updateUser(user.id, updates);
                Object.assign(user, updates);
              }
            } catch (syncErr) {
              logger.warn(`[AUTH] Could not fetch authoritative stats from Supabase: ${syncErr}`);
            }
          }

          if (authenticatedUserId && authenticatedUserId !== user.id) {
            activeRm.leaveRoom(authenticatedUserId);
            activeRm.handleDisconnect(authenticatedUserId, ws);
          }

          authenticatedUserId = user.id;
          isAuthenticating = false;

          const conn: ClientConnection = {
            ws,
            userId: user.id,
            username: user.username,
            avatarIcon: user.avatarIcon,
          };

          activeRm.setCachedUser(user);
          activeRm.registerConnection(user.id, conn);

          const response: ServerMessage = {
            type: 'AUTH_SUCCESS',
            sessionToken,
            user,
          };
          ws.send(JSON.stringify(response));

          telemetry.recordAuthLatency(Date.now() - authStart);

          // Send initial social and battle pass data
          await activeRm.sendFriendListUpdate(user.id);
          await activeRm.sendBattlePass(user.id);

          // Drain any messages pipelined while AUTH was in flight
          while (preAuthQueue.length > 0) {
            const queuedMsg = preAuthQueue.shift()!;
            ws.emit('message', JSON.stringify(queuedMsg));
          }
          return;
        }

        // Must be authenticated for subsequent actions
        if (!authenticatedUserId) {
          if (isAuthenticating) {
            preAuthQueue.push(msg);
            return;
          }
          sendError(ws, 'Not authenticated. Send AUTH message first.');
          return;
        }

        const uid = authenticatedUserId;

        switch (msg.type) {
          case 'ROOM_CREATE': {
            const room = msg.queueMode === 'rivals'
              ? activeRm.createRivalsRoom(uid, msg.rules)
              : activeRm.createRoom(uid, msg.rules, msg.queueMode);
            const response: ServerMessage = {
              type: 'ROOM_UPDATE',
              room,
              yourPosition: 0,
            };
            ws.send(JSON.stringify(response));
            break;
          }

          case 'ROOM_JOIN': {
            const room = activeRm.joinRoom(uid, msg.roomCode);
            const pos = room.slots.findIndex(s => s && s.userId === uid);
            const response: ServerMessage = {
              type: 'ROOM_UPDATE',
              room,
              yourPosition: pos !== -1 ? (pos as any) : undefined,
            };
            ws.send(JSON.stringify(response));
            break;
          }

          case 'ROOM_LEAVE': {
            activeRm.leaveRoom(uid);
            break;
          }

          case 'ROOM_SWITCH_SEAT': {
            const room = activeRm.switchSeat(uid, msg.targetPosition);
            const pos = room.slots.findIndex(s => s && s.userId === uid);
            const response: ServerMessage = {
              type: 'ROOM_UPDATE',
              room,
              yourPosition: pos !== -1 ? (pos as any) : undefined,
            };
            ws.send(JSON.stringify(response));
            break;
          }

          case 'ROOM_FILL_AI': {
            activeRm.fillWithAI(uid, msg.difficulty);
            break;
          }

          case 'ROOM_START': {
            activeRm.startGame(uid);
            telemetry.totalMatchesStarted++;
            break;
          }

          case 'ROOM_UPDATE_RULES': {
            activeRm.updateRoomRules(uid, msg.rules);
            break;
          }

          case 'ROOM_UPDATE_MODE': {
            activeRm.updateRoomMode(uid, msg.mode);
            break;
          }

          case 'ROOM_KICK': {
            activeRm.kickPlayer(uid, msg.position);
            break;
          }

          case 'QUEUE_ENTER': {
            activeRm.enterQueue(uid, msg.mode);
            break;
          }

          case 'QUEUE_LEAVE': {
            activeRm.leaveQueue(uid);
            break;
          }

          case 'GAME_BID': {
            activeRm.handleClientBid(uid, msg.bidType, msg.suit, msg.alone);
            break;
          }

          case 'GAME_DISCARD': {
            activeRm.handleClientDiscard(uid, msg.cardId);
            break;
          }

          case 'GAME_PLAY_CARD': {
            activeRm.handleClientPlayCard(uid, msg.cardId);
            break;
          }

          case 'GAME_NEXT_HAND': {
            activeRm.handleClientNextHand(uid);
            break;
          }

          case 'SEND_EMOTE': {
            activeRm.broadcastEmote(uid, msg.text, msg.emoji);
            break;
          }

          // Social / Friends
          case 'FRIEND_REQUEST_SEND': {
            const res = (activeDb as any).sendFriendRequestAsync
              ? await (activeDb as any).sendFriendRequestAsync(uid, msg.targetUsername)
              : await activeDb.sendFriendRequest(uid, msg.targetUsername);
            if (!res.success) {
              sendError(ws, res.error || 'Failed to send friend request');
            } else {
              ws.send(JSON.stringify({ type: 'NOTICE', message: `Friend request sent to ${msg.targetUsername}!` }));
              await activeRm.sendFriendListUpdate(uid);
              const target = await ((activeDb as any).getUserByUsernameAsync
                ? (activeDb as any).getUserByUsernameAsync(msg.targetUsername)
                : activeDb.getUserByUsername(msg.targetUsername));
              if (target) {
                await activeRm.sendFriendListUpdate(target.id);
                // Real-time banner to recipient
                const sender = await activeDb.getUserById(uid);
                activeRm.sendToUser(target.id, {
                  type: 'NOTICE',
                  title: 'Friend Request',
                  message: `${sender?.username || 'A player'} sent you a friend request!`,
                });
              }
            }
            break;
          }

          case 'FRIEND_REQUEST_ACCEPT': {
            const res = await activeDb.acceptFriendRequest(uid, msg.fromUserId);
            if (res.success) {
              await activeRm.sendFriendListUpdate(uid);
              await activeRm.sendFriendListUpdate(msg.fromUserId);
              ws.send(JSON.stringify({ type: 'NOTICE', message: 'Friend added!' }));
            } else {
              sendError(ws, res.error || 'Failed to accept friend request');
            }
            break;
          }

          case 'FRIEND_REQUEST_DECLINE': {
            await activeDb.declineFriendRequest(uid, msg.fromUserId);
            await activeRm.sendFriendListUpdate(uid);
            break;
          }

          case 'FRIEND_REMOVE': {
            await activeDb.removeFriend(uid, msg.friendUserId);
            await activeRm.sendFriendListUpdate(uid);
            await activeRm.sendFriendListUpdate(msg.friendUserId);
            break;
          }

          case 'GET_FRIENDS': {
            await activeRm.sendFriendListUpdate(uid);
            break;
          }

          case 'GET_LEADERBOARD': {
            await activeRm.sendLeaderboard(uid);
            break;
          }

          case 'CLAIM_PASS_REWARD': {
            const claimRes = await activeDb.claimPassReward(uid, msg.tier, msg.isPremium);
            if (claimRes.success) {
              await activeRm.sendBattlePass(uid);
              ws.send(JSON.stringify({
                type: 'NOTICE',
                message: `Claimed: ${claimRes.item || `Tier ${msg.tier} reward`}!`,
                title: 'Reward Unlocked!',
              }));
            } else {
              telemetry.duplicateRewardAttemptsBlocked++;
              sendError(ws, 'Unable to claim reward');
            }
            break;
          }

          case 'EQUIP_COSMETIC': {
            await activeDb.equipCosmetic(uid, msg.category, msg.itemId);
            const u = await activeDb.getUserById(uid);
            if (u) {
              activeRm.setCachedUser(u);
              ws.send(JSON.stringify({ type: 'USER_SYNC', user: u }));
            }
            break;
          }

          case 'PARTY_INVITE_SEND': {
            let targetUserId = msg.friendUserId;
            if (!targetUserId && msg.friendUsername) {
              const username = msg.friendUsername.trim();
              targetUserId = activeRm.findOnlineUserIdByUsername(username);
              if (!targetUserId) {
                const targetUser = await (activeDb && (activeDb as any).getUserByUsernameAsync
                  ? (activeDb as any).getUserByUsernameAsync(username)
                  : activeDb.getUserByUsername(username));
                if (targetUser) {
                  targetUserId = targetUser.id;
                } else {
                  ws.send(JSON.stringify({ type: 'ERROR', message: `Player "${username}" not found or offline` }));
                  break;
                }
              }
            }
            if (targetUserId) {
              activeRm.inviteFriendToParty(uid, targetUserId, msg.mode);
            }
            break;
          }

          case 'PARTY_INVITE_ACCEPT': {
            const room = activeRm.joinRoom(uid, msg.partyRoomCode);
            const pos = room.slots.findIndex(s => s && s.userId === uid);
            const response: ServerMessage = {
              type: 'ROOM_UPDATE',
              room,
              yourPosition: pos !== -1 ? (pos as any) : undefined,
            };
            ws.send(JSON.stringify(response));
            break;
          }

          case 'GET_PROFILE': {
            const profile = await activeDb.getUserProfile(msg.targetUserId, msg.targetUsername, uid);
            if (profile) {
              ws.send(JSON.stringify({ type: 'PROFILE_DATA', profile }));
            } else {
              // Synthesize bot profile for AI opponents
              const botName = msg.targetUsername || 'BowerBot';
              ws.send(JSON.stringify({
                type: 'PROFILE_DATA',
                profile: {
                  id: msg.targetUserId || `bot_${botName.toLowerCase().replace(/\s+/g, '_')}`,
                  username: botName,
                  avatarIcon: '🤖',
                  level: 8,
                  rankTier: '10',
                  rankPoints: 60,
                  totalGames: 184,
                  wins: 102,
                  losses: 82,
                  bestStreak: 6,
                  isFriend: false,
                  isOnline: true,
                  equippedCosmetics: {
                    hat: '🤖',
                    cardBack: 'classic_blue',
                    banner: 'default_navy',
                    title: 'Tactical AI',
                  },
                },
              }));
            }
            break;
          }

          case 'REPORT_PLAYER': {
            await activeDb.recordReport(uid, msg.targetUserId || msg.targetUsername || 'Unknown', msg.reason);
            ws.send(JSON.stringify({
              type: 'NOTICE',
              message: 'Report received. Our moderation team reviews all reports for competitive integrity.',
              title: 'Report Submitted',
            }));
            break;
          }

          case 'GET_MATCHMAKING_STATS': {
            const stats = await activeDb.getMatchmakingStats();
            ws.send(JSON.stringify({
              type: 'MATCHMAKING_STATS',
              stats,
            }));
            break;
          }

          default:
            sendError(ws, `Unknown message type: ${(msg as any).type}`);
        }
      } catch (err: any) {
        telemetry.invalidGameplayActionsBlocked++;
        logger.error('Socket message processing error', err);
        sendError(ws, err.message || 'Server error');
      } finally {
        telemetry.recordMessageLatency(Date.now() - msgStart);
      }
    });

    ws.on('close', () => {
      telemetry.onConnectionClosed();
      if (authenticatedUserId) {
        activeRm.handleDisconnect(authenticatedUserId, ws);
      }
    });

    ws.on('error', err => {
      logger.error('WebSocket connection error', err);
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(listenPort, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : listenPort;
      resolve({
        server,
        wss,
        port: actualPort,
        roomManager: activeRm,
        close: () => {
          return new Promise<void>((resClose) => {
            clearInterval(heartbeatTimer);
            wss.clients.forEach(c => {
              try { c.terminate(); } catch {}
            });
            wss.close(() => {
              server.close(async () => {
                try {
                  if (activePgRepo) {
                    await activePgRepo.close();
                  } else if (activeDb && typeof activeDb.flushToDisk === 'function') {
                    activeDb.flushToDisk();
                  }
                } catch {}
                resClose();
              });
            });
          });
        },
        pgRepo: activePgRepo,
      });
    });
    server.on('error', reject);
  });
}

const isMainModule = () => {
  if (typeof process === 'undefined' || !process.argv[1]) return false;
  try {
    const current = fileURLToPath(import.meta.url).toLowerCase();
    const entry = process.argv[1].toLowerCase();
    return current.endsWith(entry) || entry.endsWith('index.ts') || entry.endsWith('index.js');
  } catch {
    return false;
  }
};

// Automatically start standalone server on PORT ONLY when run directly (e.g. npx tsx server/index.ts)
if (isMainModule() && !process.env.VITEST) {
  createMultiplayerServer(PORT).then(({ port, roomManager, pgRepo, close }) => {
    logger.info(`[BOWER JJ] Authoritative Multiplayer Server running on http://localhost:${port}`);
    logger.info(`[BOWER JJ] WebSocket endpoint: ws://localhost:${port}/ws`);
    logger.info(`[BOWER JJ] Health & Metrics: http://localhost:${port}/health | http://localhost:${port}/metrics`);

    // Start Self-Healing Edge Tunnel Supervisor (Auto-restarts on session loss, WAN health check, Supabase sync)
    const tunnelSupervisor = new TunnelSupervisor(pgRepo);
    tunnelSupervisor.start();

    // Graceful Shutdown Handling (SIGTERM, SIGINT)
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Initiating graceful server shutdown...`);
      tunnelSupervisor.stop();
      roomManager.broadcastMaintenanceNotice('Server is restarting for scheduled maintenance. Match state and LP are protected.');
      close().then(() => {
        logger.info('Graceful shutdown completed successfully. Database flushed.');
        process.exit(0);
      }).catch(err => {
        logger.error('Error during graceful shutdown', err);
        process.exit(1);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }).catch(err => {
    logger.error('Failed to start multiplayer server', err);
  });
}
