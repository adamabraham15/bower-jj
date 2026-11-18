/**
 * BOWER JJ — Authoritative Room & Multiplayer Match Manager
 * Handles hand privacy sanitization, anti-cheat friendly rivalry,
 * rank-compensated bot matchmaking, and reconnection grace.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { WebSocket } from 'ws';
import {
  Room,
  PlayerSlot,
  SanitizedGameState,
  UserAccount,
  ServerMessage,
  RankTier,
  FriendSummary,
  LeaderboardEntry,
} from './types';
import {
  PlayerPosition,
  Player,
  EuchreGameState,
  EuchreHouseRules,
  DEFAULT_RULES,
  Card,
  Suit,
  AIDifficulty,
  getPlayerTeam,
} from '../src/engine/types';
import {
  BOT_AVATAR_BY_DIFFICULTY,
  BOT_CARD_BACK_BY_DIFFICULTY,
  DEFAULT_CARD_BACK_ID,
  pickRandomBotNames,
  resolveAvatarId,
  resolveCardBackId,
  resolveTableFeltId,
} from '../src/config/collectiblesCatalog';
import {
  initializeGame,
  pickRandomDealer,
  handleBid,
  handleDealerDiscard,
  playCard,
  completeTrick,
  startNextHand,
  getWinningTeam,
} from '../src/engine/game';
import {
  decideRound1Bid,
  decideRound2Bid,
  decideDealerDiscard,
  decideCardPlay,
} from '../src/engine/ai';
import { db, TIER_ORDER } from './db';
import { PostgresDatabaseRepository } from './db/postgres';
import { logger } from './telemetry';
import { supabaseAdmin } from './auth';

export const RANKED_BOT_FALLBACK_MS = process.env.RANKED_BOT_WAIT_MS
  ? parseInt(process.env.RANKED_BOT_WAIT_MS, 10)
  : 35000; // 35 seconds default for competitive ranked play
export const CASUAL_BOT_FALLBACK_MS = 15000; // 15 seconds for unranked casual
export const PARTIAL_HUMAN_FALLBACK_MS = 25000; // 25 seconds before pairing 2-3 humans with bots
export const ACTIVE_MATCHES_DIR = process.env.ACTIVE_MATCHES_DIR || path.resolve(process.cwd(), 'server', 'data', 'active_matches');

export interface ClientConnection {
  ws: WebSocket;
  userId: string;
  username: string;
  avatarIcon: string;
  equippedCardBack?: string;
  equippedTableFelt?: string;
  roomCode?: string;
  inQueue?: 'solo' | 'rivals' | 'duo' | 'casual';
  duoPreference?: 'teammates' | 'opponents' | 'random';
  queueEnterTime?: number;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private gameStates: Map<string, EuchreGameState> = new Map();
  private connections: Map<string, ClientConnection> = new Map(); // userId -> ClientConnection
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map(); // `${roomCode}_${position}` -> timer
  private inviteTimers: Map<string, NodeJS.Timeout> = new Map(); // `${roomCode}_${invitedUserId}` -> timer
  private soloQueue: string[] = []; // Array of userIds waiting in queue
  private matchTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  public trickResolutionDelayMs: number = 1800;
  public aiTurnDelayMs: number = 750;
  public inviteExpiryMs: number = 30000;
  public pgRepo?: PostgresDatabaseRepository;
  private userCache: Map<string, UserAccount> = new Map();
  private nextHandReady: Map<string, Set<string>> = new Map();
  private handScoredTimers: Map<string, NodeJS.Timeout> = new Map();

  public setPostgresRepository(repo: PostgresDatabaseRepository): void {
    this.pgRepo = repo;
  }

  public setCachedUser(user: UserAccount): void {
    if (user?.id) {
      this.userCache.set(user.id, user);
    }
  }

  private getCachedUser(userId: string): UserAccount | null {
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }
    return this.pgRepo ? null : db.getUserById(userId);
  }

  constructor() {
    // Restore any active match in progress before server restart
    this.restoreActiveMatches();

    // Matchmaking tick every 1.5 seconds
    this.matchTimer = setInterval(() => this.processMatchmakingQueue(), 1500);
    // Stale room & memory garbage collection every 5 minutes
    this.cleanupTimer = setInterval(() => this.cleanupStaleRooms(), 5 * 60 * 1000);
    if (this.matchTimer && typeof this.matchTimer.unref === 'function') this.matchTimer.unref();
    if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') this.cleanupTimer.unref();
  }

  public destroy() {
    if (this.matchTimer) clearInterval(this.matchTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    for (const t of this.disconnectTimers.values()) {
      clearTimeout(t);
    }
    this.disconnectTimers.clear();
    for (const t of this.inviteTimers.values()) {
      clearTimeout(t);
    }
    this.inviteTimers.clear();
  }

  private clearPendingInvite(roomCode: string, invitedUserId: string): boolean {
    const timerKey = `${roomCode}_${invitedUserId}`;
    const timer = this.inviteTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.inviteTimers.delete(timerKey);
    }
    const room = this.rooms.get(roomCode);
    if (room?.pendingInvites && room.pendingInvites[invitedUserId] !== undefined) {
      delete room.pendingInvites[invitedUserId];
      return true;
    }
    return false;
  }

  private clearAllRoomPendingInvites(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room?.pendingInvites) {
      for (const uid of Object.keys(room.pendingInvites)) {
        const timerKey = `${roomCode}_${uid}`;
        const timer = this.inviteTimers.get(timerKey);
        if (timer) {
          clearTimeout(timer);
          this.inviteTimers.delete(timerKey);
        }
      }
      room.pendingInvites = {};
    }
  }

  public getActiveRoomCount(): number {
    return this.rooms.size;
  }

  public getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  public getGameState(code: string): EuchreGameState | undefined {
    return this.gameStates.get(code);
  }

  public startDisconnectTimer(roomCode: string, pos: PlayerPosition, graceMs: number = 45000) {
    const timerKey = `${roomCode}_${pos}`;
    const existing = this.disconnectTimers.get(timerKey);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.handlePlayerAbandoned(roomCode, pos);
    }, graceMs);
    if (timer && typeof timer.unref === 'function') timer.unref();
    this.disconnectTimers.set(timerKey, timer);
  }

  public persistActiveMatch(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    const state = this.gameStates.get(roomCode);
    if (!room || !state || room.status !== 'playing') return;

    // Persist to clustered PostgreSQL active_matches table for multi-instance horizontal scaling
    if (this.pgRepo) {
      this.pgRepo.saveActiveMatch(room, state).catch(err => {
        console.warn(`[ACTIVE MATCH PG] Failed persisting active match ${roomCode} to PostgreSQL:`, err);
      });
    }

    try {
      if (!fs.existsSync(ACTIVE_MATCHES_DIR)) {
        fs.mkdirSync(ACTIVE_MATCHES_DIR, { recursive: true });
      }

      const payload = JSON.stringify(
        {
          roomCode,
          savedAt: Date.now(),
          room,
          state,
        },
        null,
        2
      );

      const targetPath = path.join(ACTIVE_MATCHES_DIR, `${roomCode}.json`);
      const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, payload, 'utf-8');
      try {
        fs.renameSync(tmpPath, targetPath);
      } catch {
        fs.copyFileSync(tmpPath, targetPath);
        try {
          fs.unlinkSync(tmpPath);
        } catch {}
      }
    } catch (err) {
      console.warn(`[ACTIVE MATCH] Failed persisting active match ${roomCode}:`, err);
    }
  }

  public clearActiveMatchSnapshot(roomCode: string): void {
    if (this.pgRepo) {
      this.pgRepo.deleteActiveMatch(roomCode).catch(err => {
        console.warn(`[ACTIVE MATCH PG] Failed clearing active match ${roomCode} from PostgreSQL:`, err);
      });
    }

    try {
      const targetPath = path.join(ACTIVE_MATCHES_DIR, `${roomCode}.json`);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    } catch (err) {
      console.warn(`[ACTIVE MATCH] Failed clearing snapshot for ${roomCode}:`, err);
    }
  }

  public restoreActiveMatches(): number {
    let restoredCount = 0;
    try {
      if (!fs.existsSync(ACTIVE_MATCHES_DIR)) return 0;
      const files = fs.readdirSync(ACTIVE_MATCHES_DIR).filter((f) => f.endsWith('.json'));
      const now = Date.now();
      const MAX_AGE_MS = 15 * 60 * 1000; // 15-minute active match retention TTL

      for (const file of files) {
        const filePath = path.join(ACTIVE_MATCHES_DIR, file);
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(raw);
          if (data && data.room && data.state && now - (data.savedAt || 0) < MAX_AGE_MS) {
            const room: Room = data.room;
            const state: EuchreGameState = data.state;

            // Human slots must reconnect to re-establish WebSockets
            room.slots = room.slots.map((s) => {
              if (!s) return null;
              return { ...s, connected: s.isAI ? true : false };
            });

            this.rooms.set(room.code, room);
            this.gameStates.set(room.code, state);
            restoredCount++;

            // Start reconnection grace period for human players
            room.slots.forEach((s, idx) => {
              if (s && !s.isAI && !s.abandoned) {
                this.startDisconnectTimer(room.code, idx as PlayerPosition);
              }
            });

            // If current turn belongs to an AI, schedule next AI step
            if (
              state.phase === 'playing' ||
              state.phase === 'bidding_round_1' ||
              state.phase === 'bidding_round_2' ||
              state.phase === 'dealer_discard'
            ) {
              const currentSlot = room.slots[state.currentTurn];
              if (currentSlot && currentSlot.isAI) {
                setTimeout(() => this.triggerAITurn(room.code), 1000);
              }
            }

            console.log(
              `[ACTIVE MATCH RECOVERY] Successfully restored match ${room.code} (Phase: ${state.phase}, Scores: ${state.scores.join('-')})`
            );
          } else {
            // Stale or invalid snapshot
            try {
              fs.unlinkSync(filePath);
            } catch {}
          }
        } catch (e) {
          console.warn(`[ACTIVE MATCH RECOVERY] Could not parse snapshot ${file}:`, e);
        }
      }
    } catch (err) {
      console.error('[ACTIVE MATCH RECOVERY] Failed to restore active matches from disk:', err);
    }
    return restoredCount;
  }

  public async restoreActiveMatchesFromPostgres(): Promise<number> {
    if (!this.pgRepo) return 0;
    let restoredCount = 0;
    try {
      const records = await this.pgRepo.loadActiveMatches(30);
      for (const rec of records) {
        if (!rec.room || !rec.state || rec.room.status !== 'playing') continue;
        const room: Room = rec.room;
        if (!room.id) room.id = crypto.randomUUID();
        const state: EuchreGameState = rec.state;

        // Human slots must reconnect to re-establish WebSockets
        room.slots = room.slots.map((s) => {
          if (!s) return null;
          return { ...s, connected: s.isAI ? true : false };
        });

        this.rooms.set(room.code, room);
        this.gameStates.set(room.code, state);
        restoredCount++;

        // Start reconnection grace period for human players
        room.slots.forEach((s, idx) => {
          if (s && !s.isAI && s.userId) {
            this.startDisconnectTimer(room.code, idx as PlayerPosition, 45000);
          }
        });

        // If current turn belongs to an AI, schedule next AI step
        if (
          state.phase === 'playing' ||
          state.phase === 'bidding_round_1' ||
          state.phase === 'bidding_round_2' ||
          state.phase === 'dealer_discard'
        ) {
          const currentSlot = room.slots[state.currentTurn];
          if (currentSlot && currentSlot.isAI) {
            setTimeout(() => this.triggerAITurn(room.code), 1000);
          }
        }

        console.log(
          `[ACTIVE MATCH PG] Successfully restored clustered match ${room.code} (Phase: ${state.phase}, Scores: ${state.scores.join('-')})`
        );
      }
      return restoredCount;
    } catch (err) {
      console.warn('[ACTIVE MATCH PG] Failed restoring active matches from PostgreSQL:', err);
      return 0;
    }
  }

  public async rehydrateRoom(roomCode: string): Promise<boolean> {
    if (!this.pgRepo) return false;
    try {
      const active = await this.pgRepo.getActiveMatchByCode(roomCode);
      if (active && active.room && active.state && active.room.status === 'playing') {
        const code = active.room.code;
        this.rooms.set(code, active.room);
        this.gameStates.set(code, active.state);
        logger.info(`[ROOM REHYDRATION] Successfully rehydrated room ${code} from PostgreSQL`);
        return true;
      }
    } catch (err) {
      logger.warn(`[ROOM REHYDRATION] Failed to rehydrate room ${roomCode}: ${err}`);
    }
    return false;
  }

  public async rehydrateUserActiveMatch(userId: string, conn: ClientConnection): Promise<boolean> {
    if (!this.pgRepo) return false;
    try {
      const active = await this.pgRepo.getActiveMatchForUser(userId);
      if (active && active.room && active.state && active.room.status === 'playing') {
        if (active.room.abandonedUserIds?.includes(userId)) return false;
        const code = active.room.code;
        const slotIdx = active.room.slots.findIndex(s => s && s.userId === userId);
        if (slotIdx !== -1) {
          const slot = active.room.slots[slotIdx]!;
          if (slot.abandoned) return false;
          this.rooms.set(code, active.room);
          this.gameStates.set(code, active.state);

          slot.isAI = false;
          slot.abandoned = false;
          slot.connected = true;
          if (slot.username && slot.username.endsWith(' (Bot)')) {
            slot.username = conn.username;
          }
          conn.roomCode = code;

          const timerKey = `${code}_${slotIdx}`;
          const existingTimer = this.disconnectTimers.get(timerKey);
          if (existingTimer) {
            clearTimeout(existingTimer);
            this.disconnectTimers.delete(timerKey);
          }

          this.broadcastRoom(code, {
            type: 'ROOM_UPDATE',
            room: active.room,
          });

          this.sendStateToPlayer(code, slotIdx as PlayerPosition);
          logger.info(`[USER REHYDRATION] Restored active match ${code} for user ${userId} (${conn.username})`);
          return true;
        }
      }
    } catch (err) {
      logger.warn(`[USER REHYDRATION] Error querying Postgres for active match for ${userId}: ${err}`);
    }
    return false;
  }

  public async ensureRoomLoaded(userId: string): Promise<void> {
    const conn = this.connections.get(userId);
    if (!conn) return;

    if (conn.roomCode && !this.rooms.has(conn.roomCode)) {
      await this.rehydrateRoom(conn.roomCode);
    } else if (!conn.roomCode) {
      await this.rehydrateUserActiveMatch(userId, conn);
    }
  }

  public broadcastMaintenanceNotice(message: string) {
    for (const conn of this.connections.values()) {
      if (conn.ws && conn.ws.readyState === 1 /* OPEN */) {
        try {
          conn.ws.send(
            JSON.stringify({
              type: 'NOTICE',
              title: 'Server Maintenance',
              message,
            })
          );
        } catch {}
      }
    }
  }

  /**
   * Automatically reclaims memory by purging finished or abandoned rooms older than 15 minutes
   */
  public cleanupStaleRooms() {
    const now = Date.now();
    const STALE_THRESHOLD_MS = 15 * 60 * 1000;

    for (const [code, room] of this.rooms.entries()) {
      const isFinished = room.status === 'finished';
      const isAllDisconnected = room.slots.every((s) => !s || !s.connected);
      const isInactive = now - (room.lastActionAt || room.createdAt) > STALE_THRESHOLD_MS;

      if ((isFinished && isInactive) || (isAllDisconnected && isInactive)) {
        for (let i = 0; i < 4; i++) {
          const key = `${code}_${i}`;
          const t = this.disconnectTimers.get(key);
          if (t) {
            clearTimeout(t);
            this.disconnectTimers.delete(key);
          }
        }
        this.clearActiveMatchSnapshot(code);
        this.gameStates.delete(code);
        this.rooms.delete(code);
      }
    }
  }

  public registerConnection(userId: string, conn: ClientConnection) {
    this.connections.set(userId, conn);

    let reconnected = false;

    // 1. Reconnection check against in-memory active rooms
    for (const [code, room] of this.rooms.entries()) {
      if (room.status === 'finished') continue;
      if (room.abandonedUserIds?.includes(userId)) continue;
      const slotIdx = room.slots.findIndex(s => s && s.userId === userId);
      if (slotIdx !== -1) {
        const slot = room.slots[slotIdx]!;
        if (slot.abandoned) continue;
        slot.connected = true;
        slot.isAI = false;
        slot.abandoned = false;
        if (slot.username && slot.username.endsWith(' (Bot)')) {
          slot.username = conn.username;
        }
        conn.roomCode = code;
        reconnected = true;

        const timerKey = `${code}_${slotIdx}`;
        const existingTimer = this.disconnectTimers.get(timerKey);
        if (existingTimer) {
          clearTimeout(existingTimer);
          this.disconnectTimers.delete(timerKey);
        }

        this.broadcastRoom(code, {
          type: 'ROOM_UPDATE',
          room,
        });

        if (room.status === 'playing') {
          this.sendStateToPlayer(code, slotIdx as PlayerPosition);
        }
        break;
      }
    }

    // 2. If not found in memory, asynchronously check PostgreSQL for any active match in progress
    if (!reconnected && this.pgRepo) {
      this.rehydrateUserActiveMatch(userId, conn).catch(err => {
        logger.warn(`[RECONNECT PG] Failed checking active match for ${userId}:`, err);
      });
    }
  }

  public handleDisconnect(userId: string, ws?: WebSocket) {
    const conn = this.connections.get(userId);
    if (!conn) return;
    // Do not remove a newer live connection when an older socket closes later
    if (ws && conn.ws !== ws) return;

    this.leaveQueue(userId);

    const roomCode = conn.roomCode;
    if (roomCode) {
      const room = this.rooms.get(roomCode);
      if (room) {
        if (room.status === 'finished') {
          conn.roomCode = undefined;
        } else {
          const slotIdx = room.slots.findIndex(s => s && s.userId === userId);
          if (slotIdx !== -1) {
            const slot = room.slots[slotIdx]!;
            slot.connected = false;

            // Start 45-second reconnect grace period
            this.startDisconnectTimer(roomCode, slotIdx as PlayerPosition, 45000);
            this.persistActiveMatch(roomCode);

            this.broadcastRoom(roomCode, {
              type: 'DISCONNECT_ALERT',
              position: slotIdx as PlayerPosition,
              username: slot.username,
              graceRemainingSec: 45,
            });
          }
        }
      }
    }

    this.connections.delete(userId);
  }

  private handlePlayerAbandoned(roomCode: string, pos: PlayerPosition) {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const slot = room.slots[pos];
    if (!slot || slot.connected) return;

    const abandoningUserId = slot.userId;
    const abandoningUsername = slot.username;

    slot.isAI = true;
    slot.abandoned = true;
    const botCfg = this.getBotConfigForTier(slot.rankTier);
    slot.aiDifficulty = botCfg.difficulty;
    slot.username = `${abandoningUsername} (Bot)`;

    if (abandoningUserId) {
      if (!room.abandonedUserIds) room.abandonedUserIds = [];
      room.abandonedUserIds.push(abandoningUserId);

      // If this was an active ranked match, assess the abandonment penalty immediately
      if (room.status === 'playing' && room.isMatchmade && room.queueMode !== 'casual') {
        const oppPos1 = ((pos + 1) % 4) as PlayerPosition;
        const oppPos2 = ((pos + 3) % 4) as PlayerPosition;
        const oppNames = [room.slots[oppPos1]?.username || 'Opponent 1', room.slots[oppPos2]?.username || 'Opponent 2'];
        if (this.pgRepo) {
          this.pgRepo.recordAbandonment(abandoningUserId, oppNames).then(async (penaltyResult) => {
            if (penaltyResult) {
              this.sendToUser(abandoningUserId, {
                type: 'RANK_UPDATE',
                oldTier: penaltyResult.oldTier,
                newTier: penaltyResult.newTier,
                oldPoints: penaltyResult.oldPoints,
                newPoints: penaltyResult.newPoints,
                lpChange: penaltyResult.lpChange,
                didRankUp: false,
              });
              const updated = await this.pgRepo?.getUserById(abandoningUserId);
              if (updated) {
                this.setCachedUser(updated);
                this.sendToUser(abandoningUserId, { type: 'USER_SYNC', user: updated });
              }
            }
          }).catch(err => {
            logger.warn(`[ABANDON PG] Failed to record abandonment for ${abandoningUserId}: ${err}`);
          });
        } else {
          const penaltyResult = db.recordAbandonment(abandoningUserId, oppNames);
          if (penaltyResult) {
            this.sendToUser(abandoningUserId, {
              type: 'RANK_UPDATE',
              oldTier: penaltyResult.oldTier,
              newTier: penaltyResult.newTier,
              oldPoints: penaltyResult.oldPoints,
              newPoints: penaltyResult.newPoints,
              lpChange: penaltyResult.lpChange,
              didRankUp: false,
            });
          }
        }
      }
    }

    this.broadcastRoom(roomCode, {
      type: 'ROOM_UPDATE',
      room,
    });

    this.broadcastRoom(roomCode, {
      type: 'NOTICE',
      title: 'Player Abandoned',
      message: `${abandoningUsername} disconnected and exceeded the grace period. An AI bot has taken their seat. Teammate loss protection is enabled.`,
    });

    const state = this.gameStates.get(roomCode);
    if (state && state.currentTurn === pos && room.status === 'playing') {
      this.triggerAITurn(roomCode);
    }
  }

  // --- BOT RANK COMPENSATION ENGINE ---

  /**
   * Dynamically compensates bot difficulty and displayed badge based on the player's competitive tier:
   * - 9 Rank: Easy AI (makes occasional beginner errors, conservative calling)
   * - 10 Rank / Q Rank: Medium AI (understands Bowers, singleton void creation)
   * - K Rank / A Rank / BOWER JJ: Hard AI (card counting, next-suit theory, loner thresholding)
   */
  public getBotConfigForTier(tier: RankTier = '9'): { difficulty: AIDifficulty; displayTier: RankTier } {
    switch (tier) {
      case '9':
        return { difficulty: 'easy', displayTier: '9' };
      case '10':
        return { difficulty: 'medium', displayTier: '10' };
      case 'Q':
        return { difficulty: 'medium', displayTier: 'Q' };
      case 'K':
        return { difficulty: 'hard', displayTier: 'K' };
      case 'A':
        return { difficulty: 'hard', displayTier: 'A' };
      case 'BOWER_JJ':
        return { difficulty: 'hard', displayTier: 'BOWER_JJ' };
      default:
        return { difficulty: 'medium', displayTier: '10' };
    }
  }

  // --- ROOM MANAGEMENT ---

  public createRoom(
    userId: string,
    rules?: Partial<EuchreHouseRules>,
    queueMode: 'rivals' | 'solo' | 'casual' | 'custom' | 'duo' = 'custom'
  ): Room {
    const conn = this.connections.get(userId);
    if (!conn) throw new Error('Not connected');

    if (conn.roomCode) {
      this.leaveRoom(userId);
    }

    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const userAcc = this.getCachedUser(userId);

    const hostSlot: PlayerSlot = {
      position: 0,
      isAI: false,
      userId,
      username: conn.username,
      avatarIcon: conn.avatarIcon,
      equippedCardBack: resolveCardBackId(userAcc?.equippedCosmetics?.cardBack || conn.equippedCardBack),
      rankTier: userAcc?.rankTier || '9',
      connected: true,
      isReady: true,
    };

    const effectiveRules: EuchreHouseRules = {
      ...DEFAULT_RULES,
      ...rules,
      turnTimeLimitSeconds:
        queueMode === 'solo' || queueMode === 'duo'
          ? 15
          : (rules?.turnTimeLimitSeconds ?? 0),
    };

    const room: Room = {
      id: crypto.randomUUID(),
      code,
      hostUserId: userId,
      status: 'lobby',
      rules: effectiveRules,
      slots: [hostSlot, null, null, null],
      pendingInvites: {},
      isMatchmade: false,
      queueMode,
      createdAt: Date.now(),
      lastActionAt: Date.now(),
    };

    this.rooms.set(code, room);
    conn.roomCode = code;

    return room;
  }

  /**
   * Creates a Friendly Rivalry Room:
   * Host is Team Blue (Seat 0), Rival Friend is Team Red (Seat 1).
   * Prevents partnership collusion by pitting friends against each other!
   */
  public createRivalsRoom(userId: string, rules?: Partial<EuchreHouseRules>): Room {
    return this.createRoom(userId, rules, 'rivals');
  }

  public returnRoomToLobby(userId: string, fallbackMode: 'rivals' | 'custom' = 'custom'): Room {
    const conn = this.connections.get(userId);
    if (!conn) throw new Error('Not connected');

    const roomCode = conn.roomCode;
    const room = roomCode ? this.rooms.get(roomCode) : undefined;

    if (room && !room.isMatchmade && (room.queueMode === 'custom' || room.queueMode === 'rivals' || !room.queueMode)) {
      room.status = 'lobby';
      room.resultsRecorded = false;
      room.id = crypto.randomUUID();
      room.abandonedUserIds = [];
      room.lastActionAt = Date.now();
      this.gameStates.delete(room.code);
      this.clearActiveMatchSnapshot(room.code);

      for (let i = 0; i < 4; i++) {
        const slot = room.slots[i];
        if (!slot) continue;
        if (!slot.isAI && slot.userId) {
          const slotConn = this.connections.get(slot.userId);
          const slotUser = this.getCachedUser(slot.userId);
          if (!slotConn || slotConn.roomCode !== room.code) {
            room.slots[i] = null;
          } else {
            slot.abandoned = false;
            slot.connected = true;
            slot.avatarIcon = slotUser?.avatarIcon || slotConn.avatarIcon || slot.avatarIcon;
            slot.equippedCardBack = resolveCardBackId(
              slotUser?.equippedCosmetics?.cardBack || slotConn.equippedCardBack || slot.equippedCardBack
            );
            slot.rankTier = slotUser?.rankTier || slot.rankTier;
          }
        }
      }

      const hostSeated = room.slots.some(s => s && !s.isAI && s.userId === room.hostUserId);
      if (!hostSeated) {
        room.hostUserId = userId;
      }

      this.broadcastRoom(room.code, {
        type: 'ROOM_UPDATE',
        room,
      });

      return room;
    }

    return fallbackMode === 'rivals'
      ? this.createRivalsRoom(userId)
      : this.createRoom(userId, undefined, 'custom');
  }

  public updateUserAvatar(userId: string, avatarIcon: string): void {
    const resolved = resolveAvatarId(avatarIcon);
    const conn = this.connections.get(userId);
    if (conn) {
      conn.avatarIcon = resolved;
      if (conn.roomCode) {
        const room = this.rooms.get(conn.roomCode);
        if (room) {
          let updated = false;
          for (const slot of room.slots) {
            if (slot && !slot.isAI && slot.userId === userId) {
              slot.avatarIcon = resolved;
              updated = true;
            }
          }
          if (updated) {
            this.broadcastRoom(room.code, {
              type: 'ROOM_UPDATE',
              room,
            });
            if (room.status === 'playing') {
              this.broadcastGameSync(room.code);
            }
          }
        }
      }
    }
  }

  public updateUserCardBack(userId: string, cardBackId: string): void {
    const resolved = resolveCardBackId(cardBackId);
    const conn = this.connections.get(userId);
    if (conn) {
      conn.equippedCardBack = resolved;
      if (conn.roomCode) {
        const room = this.rooms.get(conn.roomCode);
        if (room) {
          let updated = false;
          for (const slot of room.slots) {
            if (slot && !slot.isAI && slot.userId === userId) {
              slot.equippedCardBack = resolved;
              updated = true;
            }
          }
          if (updated) {
            this.broadcastRoom(room.code, {
              type: 'ROOM_UPDATE',
              room,
            });
            if (room.status === 'playing') {
              this.broadcastGameSync(room.code);
            }
          }
        }
      }
    }
  }

  public updateUserTableFelt(userId: string, feltId: string): void {
    const resolved = resolveTableFeltId(feltId);
    const conn = this.connections.get(userId);
    if (conn) {
      conn.equippedTableFelt = resolved;
      const user = this.userCache.get(userId);
      if (user) {
        if (!user.equippedCosmetics) {
          user.equippedCosmetics = { hat: 'the_outlaw', cardBack: 'classic_blue' };
        }
        user.equippedCosmetics.tableFelt = resolved;
      }
      if (conn.roomCode) {
        const room = this.rooms.get(conn.roomCode);
        if (room && room.status === 'playing') {
          this.broadcastGameSync(room.code);
        }
      }
    }
  }

  public joinRoom(userId: string, code: string): Room {
    const conn = this.connections.get(userId);
    if (!conn) throw new Error('Not connected');

    const targetCode = code.toUpperCase();

    // If player is seated in a different room, leave it first
    if (conn.roomCode && conn.roomCode !== targetCode) {
      this.leaveRoom(userId);
    }

    const room = this.rooms.get(targetCode);
    if (!room) throw new Error(`Room ${code} not found`);

    // If player is already seated in this room, reconnect / reclaim seat immediately
    const existing = room.slots.findIndex(s => s && s.userId === userId);
    if (existing !== -1) {
      this.clearPendingInvite(room.code, userId);
      conn.roomCode = room.code;
      const slot = room.slots[existing]!;
      slot.connected = true;
      slot.isAI = false;
      slot.abandoned = false;
      if (slot.username && slot.username.endsWith(' (Bot)')) {
        slot.username = conn.username;
      }
      this.broadcastRoom(room.code, {
        type: 'ROOM_UPDATE',
        room,
      });
      if (room.status === 'playing') {
        this.sendStateToPlayer(room.code, existing as PlayerPosition);
      }
      return room;
    }

    if (room.status !== 'lobby') {
      throw new Error('Game is already in progress');
    }

    // In Rivals mode, ensure Friend 2 is placed at Seat 1 (Team 1, Opposing team from Host at Seat 0, Team 0)
    let emptyIdx: number;
    if (room.queueMode === 'rivals' && (room.slots[1] === null || room.slots[1]?.isAI)) {
      emptyIdx = 1;
    } else {
      emptyIdx = room.slots.findIndex(s => s === null);
      if (emptyIdx === -1) {
        // Allow human invitee to replace a lobby AI placeholder seat
        emptyIdx = room.slots.findIndex(s => s !== null && s.isAI);
      }
    }

    if (emptyIdx === -1) {
      throw new Error('Room is full');
    }

    this.clearPendingInvite(room.code, userId);
    const userAcc = this.getCachedUser(userId);

    const slot: PlayerSlot = {
      position: emptyIdx as PlayerPosition,
      isAI: false,
      userId,
      username: conn.username,
      avatarIcon: conn.avatarIcon,
      equippedCardBack: resolveCardBackId(userAcc?.equippedCosmetics?.cardBack || conn.equippedCardBack),
      rankTier: userAcc?.rankTier || '9',
      connected: true,
      isReady: true,
    };

    room.slots[emptyIdx] = slot;
    conn.roomCode = room.code;

    this.broadcastRoom(room.code, {
      type: 'ROOM_UPDATE',
      room,
    });

    return room;
  }

  public fillWithAI(
    userId: string,
    overrideDifficulty?: AIDifficulty,
    overrideTier?: RankTier
  ): Room {
    const conn = this.connections.get(userId);
    if (!conn || !conn.roomCode) throw new Error('Not in a room');

    const room = this.rooms.get(conn.roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostUserId !== userId && !room.isMatchmade) {
      throw new Error('Only the host can fill empty seats with AI');
    }

    // Determine target tier & AI difficulty from host or players in room
    let targetTier: RankTier = overrideTier || '9';
    const hostAcc = this.getCachedUser(userId);
    if (hostAcc) {
      targetTier = overrideTier || hostAcc.rankTier;
    }

    const botConfig = this.getBotConfigForTier(targetTier);
    const difficulty = overrideDifficulty || botConfig.difficulty;
    const displayTier = botConfig.displayTier;

    const aiAvatars = BOT_AVATAR_BY_DIFFICULTY[difficulty] || BOT_AVATAR_BY_DIFFICULTY.medium;
    const aiCardBack = BOT_CARD_BACK_BY_DIFFICULTY[difficulty] || DEFAULT_CARD_BACK_ID;
    const existingNames = room.slots.filter((s): s is PlayerSlot => s !== null).map((s) => s.username);
    const emptySeatIndices: number[] = [];
    for (let i = 0; i < 4; i++) {
      if (room.slots[i] === null) {
        emptySeatIndices.push(i);
      }
    }
    const randomBotNames = pickRandomBotNames(emptySeatIndices.length, existingNames);

    emptySeatIndices.forEach((seatIdx, idx) => {
      room.slots[seatIdx] = {
        position: seatIdx as PlayerPosition,
        isAI: true,
        aiDifficulty: difficulty,
        username: randomBotNames[idx] || `BowerShark${seatIdx}`,
        avatarIcon: aiAvatars[seatIdx % aiAvatars.length],
        equippedCardBack: aiCardBack,
        rankTier: displayTier,
        connected: true,
        isReady: true,
      };
    });

    this.broadcastRoom(room.code, {
      type: 'ROOM_UPDATE',
      room,
    });

    return room;
  }

  public switchSeat(userId: string, targetPosition: PlayerPosition): Room {
    const conn = this.connections.get(userId);
    if (!conn || !conn.roomCode) throw new Error('Not connected to a room');

    const room = this.rooms.get(conn.roomCode);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'lobby') throw new Error('Cannot change seats once the match has started');

    const currentPos = room.slots.findIndex(s => s && s.userId === userId);
    if (currentPos === -1) throw new Error('Player not seated in this room');
    if (currentPos === targetPosition) return room;

    if (targetPosition < 0 || targetPosition > 3) throw new Error('Invalid seat position');

    const currentSlot = room.slots[currentPos]!;
    const targetSlot = room.slots[targetPosition];

    if (!targetSlot) {
      // Target seat is empty: move directly into it
      room.slots[targetPosition] = {
        ...currentSlot,
        position: targetPosition as PlayerPosition,
      };
      room.slots[currentPos] = null;
    } else {
      // Target seat is occupied: swap seats (supports swapping with bots or other players)
      room.slots[targetPosition] = {
        ...currentSlot,
        position: targetPosition as PlayerPosition,
      };
      room.slots[currentPos] = {
        ...targetSlot,
        position: currentPos as PlayerPosition,
      };
    }

    this.broadcastRoom(room.code, {
      type: 'ROOM_UPDATE',
      room,
    });

    return room;
  }

  public startGame(userId: string, initialDealer?: PlayerPosition): Room {
    const conn = this.connections.get(userId);
    if (!conn || !conn.roomCode) throw new Error('Not in a room');

    const room = this.rooms.get(conn.roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostUserId !== userId && !room.isMatchmade) throw new Error('Only host can start the game');

    let occupiedCount = room.slots.filter(s => s !== null).length;
    if (occupiedCount !== 4) {
      if (room.queueMode === 'rivals' || room.queueMode === 'custom' || room.queueMode === 'duo') {
        this.fillWithAI(userId);
        occupiedCount = room.slots.filter(s => s !== null).length;
      }
      if (occupiedCount !== 4) {
        throw new Error('Game requires exactly 4 players. Fill empty seats with AI or invite friends.');
      }
    }

    const players: Player[] = room.slots.map((s, idx) => ({
      id: s!.userId || `ai_${idx}`,
      name: s!.username,
      position: idx as PlayerPosition,
      isAI: s!.isAI,
      aiDifficulty: s!.aiDifficulty,
      avatarId: s!.avatarIcon,
      cardBack: s!.equippedCardBack || DEFAULT_CARD_BACK_ID,
      rankTier: s!.rankTier,
    }));

    if (!room.id || room.resultsRecorded) {
      room.id = crypto.randomUUID();
    }
    room.resultsRecorded = false;
    const firstDealer = initialDealer ?? pickRandomDealer();
    const initialState = initializeGame(players, room.rules, firstDealer);
    this.gameStates.set(room.code, initialState);
    room.status = 'playing';
    this.clearAllRoomPendingInvites(room.code);
    this.persistActiveMatch(room.code);

    this.broadcastRoom(room.code, {
      type: 'ROOM_UPDATE',
      room,
    });

    this.broadcastGameSync(room.code);

    if (players[initialState.currentTurn].isAI) {
      this.triggerAITurn(room.code);
    }

    return room;
  }

  public updateRoomRules(userId: string, rules: Partial<EuchreHouseRules>): Room {
    const conn = this.connections.get(userId);
    if (!conn || !conn.roomCode) throw new Error('Not in a room');

    const room = this.rooms.get(conn.roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostUserId !== userId) throw new Error('Only the room host can update house rules');
    if (room.status !== 'lobby') throw new Error('Rules cannot be changed once game has started');

    room.rules = { ...room.rules, ...rules };

    this.broadcastRoom(room.code, {
      type: 'ROOM_UPDATE',
      room,
    });

    return room;
  }

  public updateRoomMode(userId: string, mode: 'rivals' | 'custom' | 'solo' | 'duo' | 'casual'): Room {
    const conn = this.connections.get(userId);
    if (!conn || !conn.roomCode) throw new Error('Not in a room');

    const room = this.rooms.get(conn.roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostUserId !== userId) throw new Error('Only the room host can update game mode');
    if (room.status !== 'lobby') throw new Error('Mode cannot be changed once game has started');

    room.queueMode = mode;

    this.broadcastRoom(room.code, {
      type: 'ROOM_UPDATE',
      room,
    });

    return room;
  }

  public kickPlayer(hostUserId: string, targetPosition: PlayerPosition): Room {
    const conn = this.connections.get(hostUserId);
    if (!conn || !conn.roomCode) throw new Error('Not in a room');

    const room = this.rooms.get(conn.roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostUserId !== hostUserId) throw new Error('Only the room host can remove players');

    const targetSlot = room.slots[targetPosition];
    if (targetPosition === 0 && (!targetSlot || targetSlot.userId === hostUserId)) {
      throw new Error('Host cannot kick themselves');
    }
    if (targetSlot && targetSlot.userId === hostUserId) {
      throw new Error('Host cannot kick themselves');
    }

    if (targetSlot && targetSlot.userId) {
      this.clearPendingInvite(room.code, targetSlot.userId);
      const kickedConn = this.connections.get(targetSlot.userId);
      if (kickedConn) {
        kickedConn.roomCode = undefined;
        try {
          kickedConn.ws.send(JSON.stringify({
            type: 'NOTICE',
            message: 'You have been removed from the room lobby by the host.',
            title: 'Lobby Notice',
          }));
        } catch {}
      }
    }

    room.slots[targetPosition] = null;

    this.broadcastRoom(room.code, {
      type: 'ROOM_UPDATE',
      room,
    });

    return room;
  }

  public leaveRoom(userId: string): void {
    const conn = this.connections.get(userId);
    if (!conn || !conn.roomCode) return;

    const roomCode = conn.roomCode;
    conn.roomCode = undefined;

    const room = this.rooms.get(roomCode);
    if (!room) return;

    this.clearPendingInvite(roomCode, userId);

    const slotIdx = room.slots.findIndex(s => s && s.userId === userId);
    if (slotIdx === -1) return;

    if (room.status === 'lobby') {
      room.slots[slotIdx] = null;

      // If the leaving player was the room host, pass host to the next seated human
      if (room.hostUserId === userId) {
        const nextHuman = room.slots.find(s => s && !s.isAI && s.userId);
        if (nextHuman && nextHuman.userId) {
          room.hostUserId = nextHuman.userId;
        } else {
          // No human players remain in the lobby: clean up the empty room
          this.clearAllRoomPendingInvites(roomCode);
          this.clearActiveMatchSnapshot(roomCode);
          this.gameStates.delete(roomCode);
          this.rooms.delete(roomCode);
          return;
        }
      }

      this.broadcastRoom(roomCode, {
        type: 'ROOM_UPDATE',
        room,
      });
    } else if (room.status === 'playing') {
      this.handleForfeit(userId);
    }
  }

  public handleForfeit(userId: string): void {
    const conn = this.connections.get(userId);
    let roomCode = conn?.roomCode;

    if (!roomCode) {
      for (const [code, r] of this.rooms.entries()) {
        if (r.status === 'playing' && r.slots.some(s => s && s.userId === userId)) {
          roomCode = code;
          break;
        }
      }
    }

    if (conn) {
      conn.roomCode = undefined;
    }

    if (!roomCode) {
      if (this.pgRepo) {
        this.pgRepo.getActiveMatchForUser(userId).then(active => {
          if (active?.room?.code) {
            const otherHumans = active.room.slots.filter(
              s => s && !s.isAI && s.userId && s.userId !== userId && !s.abandoned
            );
            if (otherHumans.length === 0) {
              this.clearActiveMatchSnapshot(active.room.code);
            }
          }
        }).catch(() => {});
      }
      return;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.clearActiveMatchSnapshot(roomCode);
      return;
    }

    const slotIdx = room.slots.findIndex(s => s && s.userId === userId);
    if (slotIdx === -1) return;

    const slot = room.slots[slotIdx]!;
    slot.abandoned = true;
    slot.connected = false;
    slot.isAI = true;

    if (!room.abandonedUserIds) room.abandonedUserIds = [];
    if (!room.abandonedUserIds.includes(userId)) {
      room.abandonedUserIds.push(userId);
    }

    // Clear disconnect timer for this player
    const timerKey = `${roomCode}_${slotIdx}`;
    const existingTimer = this.disconnectTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.disconnectTimers.delete(timerKey);
    }

    // Check if other human players are still present in this match
    const remainingHumans = room.slots.filter(
      s => s && !s.isAI && s.userId && s.userId !== userId && !s.abandoned && !room.abandonedUserIds?.includes(s.userId)
    );

    if (remainingHumans.length === 0) {
      // Single human vs bots, or all humans forfeited: delete match instance permanently!
      room.status = 'finished';
      for (let i = 0; i < 4; i++) {
        const k = `${roomCode}_${i}`;
        const dt = this.disconnectTimers.get(k);
        if (dt) {
          clearTimeout(dt);
          this.disconnectTimers.delete(k);
        }
      }
      const handTimer = this.handScoredTimers.get(roomCode);
      if (handTimer) {
        clearTimeout(handTimer);
        this.handScoredTimers.delete(roomCode);
      }
      this.clearActiveMatchSnapshot(roomCode);
      this.gameStates.delete(roomCode);
      this.rooms.delete(roomCode);
      logger.info(`[FORFEIT] Match ${roomCode} deleted permanently (no human players remaining)`);
    } else {
      // Multiplayer match with remaining humans: assess abandonment and replace seat with AI bot
      this.handlePlayerAbandoned(roomCode, slotIdx as PlayerPosition);
      this.persistActiveMatch(roomCode);
      logger.info(`[FORFEIT] User ${userId} abandoned active match ${roomCode}. AI bot replaced their seat.`);
    }

    this.sendToUser(userId, {
      type: 'ROOM_UPDATE',
      room: { ...room, status: 'finished' },
    });
  }

  // --- MATCHMAKING QUEUE (REAL PLAYERS FIRST, TIER-COMPENSATED BOTS SECOND) ---

  public enterQueue(
    userId: string,
    mode: 'solo' | 'rivals' | 'duo' | 'casual' = 'solo',
    duoPreference?: 'teammates' | 'opponents' | 'random'
  ) {
    const conn = this.connections.get(userId);
    if (!conn) return;

    if (!this.soloQueue.includes(userId)) {
      this.soloQueue.push(userId);
    }
    conn.inQueue = mode;
    conn.duoPreference = duoPreference;
    conn.queueEnterTime = Date.now();

    this.sendToUser(userId, {
      type: 'QUEUE_UPDATE',
      inQueue: true,
      mode,
      playersFound: this.soloQueue.length,
      elapsedSeconds: 0,
    });
  }

  public leaveQueue(userId: string) {
    const conn = this.connections.get(userId);
    if (conn) {
      conn.inQueue = undefined;
      conn.duoPreference = undefined;
      conn.queueEnterTime = undefined;
    }
    this.soloQueue = this.soloQueue.filter(id => id !== userId);

    this.sendToUser(userId, {
      type: 'QUEUE_UPDATE',
      inQueue: false,
      playersFound: 0,
      elapsedSeconds: 0,
    });
  }

  private getUserTierIndex(userId: string): number {
    const user = this.getCachedUser(userId);
    const tier = user?.rankTier || '9';
    const idx = TIER_ORDER.indexOf(tier);
    return idx !== -1 ? idx : 0;
  }

  private processMatchmakingQueue() {
    if (this.soloQueue.length === 0) return;

    const now = Date.now();

    // Helper to get allowed tier distance based on wait duration
    const getMaxTierDiff = (waitMs: number): number => {
      if (waitMs < 15000) return 1; // Strict: +-1 tier
      if (waitMs < 30000) return 2; // Expanded: +-2 tiers
      return 5; // Wide: any tier
    };

    // PRIORITY 1: 4 Humans in Queue -> Search for compatible 4-human cluster
    if (this.soloQueue.length >= 4) {
      // Find 4 players whose mutual tier distance matches their allowed expansion
      let candidateIndices: number[] | null = null;

      for (let i = 0; i <= this.soloQueue.length - 4; i++) {
        const u1 = this.soloQueue[i];
        const conn1 = this.connections.get(u1);
        const wait1 = now - (conn1?.queueEnterTime || now);
        const maxDiff1 = getMaxTierDiff(wait1);
        const tier1 = this.getUserTierIndex(u1);

        const group: number[] = [i];
        for (let j = 0; j < this.soloQueue.length && group.length < 4; j++) {
          if (j === i) continue;
          const u2 = this.soloQueue[j];
          const conn2 = this.connections.get(u2);
          const wait2 = now - (conn2?.queueEnterTime || now);
          const maxDiff2 = getMaxTierDiff(wait2);
          const allowedDiff = Math.max(maxDiff1, maxDiff2);
          const tier2 = this.getUserTierIndex(u2);

          if (Math.abs(tier1 - tier2) <= allowedDiff) {
            group.push(j);
          }
        }

        if (group.length === 4) {
          candidateIndices = group;
          break;
        }
      }

      if (candidateIndices) {
        // Extract matched users in reverse index order
        const matchedUserIds = candidateIndices
          .sort((a, b) => b - a)
          .map(idx => this.soloQueue.splice(idx, 1)[0])
          .reverse();

        const hostId = matchedUserIds[0];
        const avgWait = matchedUserIds.reduce((sum, uid) => {
          const c = this.connections.get(uid);
          return sum + (now - (c?.queueEnterTime || now));
        }, 0) / 4;

        db.recordMatchmakingComposition(4, avgWait);

        const isAllCasual = matchedUserIds.every(uid => this.connections.get(uid)?.inQueue === 'casual');
        const qMode = isAllCasual ? 'casual' : 'solo';
        const room = this.createRoom(hostId, DEFAULT_RULES, qMode);
        room.isMatchmade = true;
        room.queueMode = qMode;

        for (let i = 1; i < 4; i++) {
          const uid = matchedUserIds[i];
          const conn = this.connections.get(uid);
          if (conn) {
            const userAcc = this.getCachedUser(uid);
            room.slots[i] = {
              position: i as PlayerPosition,
              isAI: false,
              userId: uid,
              username: conn.username,
              avatarIcon: conn.avatarIcon,
              equippedCardBack: resolveCardBackId(userAcc?.equippedCosmetics?.cardBack || conn.equippedCardBack),
              rankTier: userAcc?.rankTier || '9',
              connected: true,
              isReady: true,
            };
            conn.roomCode = room.code;
            conn.inQueue = undefined;
          }
        }

        this.startGame(hostId);
        return;
      }
    }

    // PRIORITY 2: 2 or 3 Humans Waiting (>= PARTIAL_HUMAN_FALLBACK_MS, 25s) -> Pair humans against each other and fill with bots
    const hasLongWaitingHuman = this.soloQueue.some(uid => {
      const conn = this.connections.get(uid);
      const isCasual = conn?.inQueue === 'casual';
      const threshold = isCasual ? CASUAL_BOT_FALLBACK_MS : PARTIAL_HUMAN_FALLBACK_MS;
      return conn && conn.queueEnterTime && (now - conn.queueEnterTime >= threshold);
    });

    if (this.soloQueue.length >= 2 && hasLongWaitingHuman) {
      const humanCount = Math.min(this.soloQueue.length, 3);
      const matchedUserIds = this.soloQueue.splice(0, humanCount);
      const hostId = matchedUserIds[0];
      const hostAcc = this.getCachedUser(hostId);
      const targetTier = hostAcc?.rankTier || '9';

      const avgWait = matchedUserIds.reduce((sum, uid) => {
        const c = this.connections.get(uid);
        return sum + (now - (c?.queueEnterTime || now));
      }, 0) / humanCount;

      db.recordMatchmakingComposition(humanCount, avgWait);

      const isAllCasual = matchedUserIds.every(uid => this.connections.get(uid)?.inQueue === 'casual');
      const qMode = isAllCasual ? 'casual' : 'solo';
      const room = this.createRoom(hostId, DEFAULT_RULES, qMode);
      room.isMatchmade = true;
      room.queueMode = qMode;

      const hostConn = this.connections.get(hostId);
      if (hostConn) {
        hostConn.inQueue = undefined;
      }

      if (humanCount === 2) {
        const secondId = matchedUserIds[1];
        const secondConn = this.connections.get(secondId);

        const hostPref = hostConn?.duoPreference;
        const secondPref = secondConn?.duoPreference;

        // When exactly 2 humans match in queue:
        // By default (or if either explicitly requests 'teammates'), seat them together as partners
        // on Team Blue (Seat 0 & Seat 2) against 2 Bots on Team Red (Seat 1 & Seat 3).
        // If both explicitly chose 'opponents', seat them as Rivals on opposing teams (Seat 0 & Seat 1).
        // If 'random' or conflicting explicit choices, 50/50 coin flip.
        let asTeammates = true;
        if (hostPref === 'opponents' && secondPref === 'opponents') {
          asTeammates = false;
        } else if (
          (hostPref === 'opponents' && secondPref === 'teammates') ||
          (hostPref === 'teammates' && secondPref === 'opponents')
        ) {
          asTeammates = Math.random() < 0.5;
        } else if (hostPref === 'random' || secondPref === 'random') {
          asTeammates = Math.random() < 0.5;
        }

        const secondSeat: PlayerPosition = asTeammates ? 2 : 1;
        if (secondConn) {
          const userAcc = this.getCachedUser(secondId);
          room.slots[secondSeat] = {
            position: secondSeat,
            isAI: false,
            userId: secondId,
            username: secondConn.username,
            avatarIcon: secondConn.avatarIcon,
            equippedCardBack: resolveCardBackId(userAcc?.equippedCosmetics?.cardBack || secondConn.equippedCardBack),
            rankTier: userAcc?.rankTier || targetTier,
            connected: true,
            isReady: true,
          };
          secondConn.roomCode = room.code;
          secondConn.inQueue = undefined;
        }
      } else {
        // 3 humans: Distribute across opposing teams (Seat 0 Team Blue, Seat 1 Team Red, Seat 2 Team Blue)
        for (let i = 1; i < humanCount; i++) {
          const uid = matchedUserIds[i];
          const conn = this.connections.get(uid);
          if (conn) {
            const userAcc = this.getCachedUser(uid);
            room.slots[i] = {
              position: i as PlayerPosition,
              isAI: false,
              userId: uid,
              username: conn.username,
              avatarIcon: conn.avatarIcon,
              equippedCardBack: resolveCardBackId(userAcc?.equippedCosmetics?.cardBack || conn.equippedCardBack),
              rankTier: userAcc?.rankTier || targetTier,
              connected: true,
              isReady: true,
            };
            conn.roomCode = room.code;
            conn.inQueue = undefined;
          }
        }
      }

      this.fillWithAI(hostId, undefined, targetTier);
      this.startGame(hostId);
      return;
    }

    // PRIORITY 3: Solo human waited past bot fallback threshold (35s for ranked, 15s for casual)
    const readySolo = this.soloQueue.filter(uid => {
      const conn = this.connections.get(uid);
      if (!conn || !conn.queueEnterTime) return false;
      const isCasual = conn.inQueue === 'casual';
      const threshold = isCasual ? CASUAL_BOT_FALLBACK_MS : RANKED_BOT_FALLBACK_MS;
      return (now - conn.queueEnterTime >= threshold);
    });

    if (readySolo.length > 0) {
      const hostId = readySolo[0];
      this.soloQueue = this.soloQueue.filter(id => id !== hostId);
      const hostAcc = this.getCachedUser(hostId);
      const targetTier = hostAcc?.rankTier || '9';
      const conn = this.connections.get(hostId);
      const wait = now - (conn?.queueEnterTime || now);

      db.recordMatchmakingComposition(1, wait);

      const qMode = conn?.inQueue === 'casual' ? 'casual' : 'solo';
      const room = this.createRoom(hostId, DEFAULT_RULES, qMode);
      room.isMatchmade = true;
      room.queueMode = qMode;

      this.fillWithAI(hostId, undefined, targetTier);
      this.startGame(hostId);
      return;
    }

    // Broadcast queue status & time elapsed
    this.soloQueue.forEach(userId => {
      const conn = this.connections.get(userId);
      if (conn && conn.queueEnterTime) {
        const elapsed = Math.floor((now - conn.queueEnterTime) / 1000);
        this.sendToUser(userId, {
          type: 'QUEUE_UPDATE',
          inQueue: true,
          mode: conn.inQueue,
          playersFound: this.soloQueue.length,
          elapsedSeconds: elapsed,
        });
      }
    });
  }

  // --- GAME ACTIONS ---

  public handleClientBid(
    userId: string,
    bidType: 'pass' | 'order_up' | 'pick_up' | 'call_trump',
    suit?: Suit,
    alone: boolean = false
  ) {
    const { room, state, pos } = this.validateActionContext(userId);

    const bid = {
      player: pos,
      type: bidType,
      suit,
      alone,
    };

    const nextState = handleBid(state, bid);
    this.gameStates.set(room.code, nextState);
    this.persistActiveMatch(room.code);
    this.broadcastGameSync(room.code);

    this.triggerAITurn(room.code);
  }

  public handleClientDiscard(userId: string, cardId: string) {
    const { room, state, pos } = this.validateActionContext(userId);

    if (state.phase !== 'dealer_discard' || state.dealer !== pos) {
      throw new Error('Not your turn to discard');
    }

    const card = state.hands[pos].find(c => c.id === cardId);
    if (!card) throw new Error('Card not in hand');

    const nextState = handleDealerDiscard(state, card);
    this.gameStates.set(room.code, nextState);
    this.persistActiveMatch(room.code);
    this.broadcastGameSync(room.code);

    this.triggerAITurn(room.code);
  }

  public handleClientPlayCard(userId: string, cardId: string) {
    const { room, state, pos } = this.validateActionContext(userId);

    if (state.phase !== 'playing') {
      throw new Error('Not in playing phase');
    }

    const card = state.hands[pos].find(c => c.id === cardId);
    if (!card) throw new Error('Card not in hand');

    const nextState = playCard(state, pos, card);
    this.gameStates.set(room.code, nextState);
    this.persistActiveMatch(room.code);
    this.broadcastGameSync(room.code);

    if (nextState.phase === 'trick_resolving') {
      setTimeout(() => {
        this.resolveCompletedTrick(room.code);
      }, this.trickResolutionDelayMs);
    } else {
      this.triggerAITurn(room.code);
    }
  }

  public handleClientNextHand(userId: string) {
    const conn = this.connections.get(userId);
    if (!conn || !conn.roomCode) return;

    const room = this.rooms.get(conn.roomCode);
    const state = this.gameStates.get(conn.roomCode);
    if (!room || !state || state.phase !== 'hand_scored') return;

    let readySet = this.nextHandReady.get(room.code);
    if (!readySet) {
      readySet = new Set<string>();
      this.nextHandReady.set(room.code, readySet);
    }
    readySet.add(userId);
    if (conn.username) readySet.add(conn.username);

    // Require all seated human players to click Deal Next Hand before next deal
    const humanSlots = room.slots.filter((s): s is PlayerSlot => Boolean(s && !s.isAI && (s.userId || s.username)));
    const allHumansReady = humanSlots.every(s => (s.userId && readySet!.has(s.userId)) || (s.username && readySet!.has(s.username)));

    if (allHumansReady) {
      const timer = this.handScoredTimers.get(room.code);
      if (timer) {
        clearTimeout(timer);
        this.handScoredTimers.delete(room.code);
      }
      this.nextHandReady.delete(room.code);

      const nextState = startNextHand(state);
      this.gameStates.set(room.code, nextState);
      this.persistActiveMatch(room.code);
      this.broadcastGameSync(room.code);
      this.triggerAITurn(room.code);
    } else {
      // Sync readiness count to all clients
      this.broadcastGameSync(room.code);
    }
  }

  private resolveCompletedTrick(roomCode: string) {
    const state = this.gameStates.get(roomCode);
    const room = this.rooms.get(roomCode);
    if (!state || !room || state.phase !== 'trick_resolving') return;

    const nextState = completeTrick(state);
    this.gameStates.set(roomCode, nextState);

    if (nextState.phase === 'game_over') {
      this.clearActiveMatchSnapshot(roomCode);
      this.recordMatchResults(room, nextState);
    } else {
      this.persistActiveMatch(roomCode);
    }

    this.broadcastGameSync(roomCode);

    if (nextState.phase === 'playing') {
      this.triggerAITurn(roomCode);
    } else if (nextState.phase === 'hand_scored') {
      // Mark AI bot slots as automatically ready for the next deal
      const readySet = new Set<string>();
      for (const slot of room.slots) {
        if (slot && slot.isAI) {
          readySet.add(slot.username);
        }
      }
      this.nextHandReady.set(roomCode, readySet);

      // Failsafe 60s timeout in case a player completely disconnects / goes AFK
      const autoTimer = setTimeout(() => {
        const cur = this.gameStates.get(roomCode);
        if (cur && cur.phase === 'hand_scored') {
          this.nextHandReady.delete(roomCode);
          const advanced = startNextHand(cur);
          this.gameStates.set(roomCode, advanced);
          this.persistActiveMatch(roomCode);
          this.broadcastGameSync(roomCode);
          this.triggerAITurn(roomCode);
        }
      }, 60000);
      if (typeof autoTimer.unref === 'function') autoTimer.unref();
      this.handScoredTimers.set(roomCode, autoTimer);
    }
  }

  private recordMatchResults(room: Room, state: EuchreGameState) {
    if (room.resultsRecorded) return; // Prevent duplicate execution
    room.resultsRecorded = true;
    room.status = 'finished';
    if (!room.id) room.id = crypto.randomUUID();
    this.clearActiveMatchSnapshot(room.code);

    const winningTeam = getWinningTeam(state.scores, state.rules.targetScore);
    const finalScore = `${state.scores[0]} - ${state.scores[1]}`;
    const isRanked =
      Boolean(room.isMatchmade) &&
      room.queueMode !== 'casual';
    const pgMode: 'ranked_solo' | 'ranked_rivals' | 'ranked_duo' | 'unranked' =
      isRanked
        ? (room.queueMode === 'duo' ? 'ranked_duo' : 'ranked_solo')
        : 'unranked';

    // Calculate MMR averages
    const team0Mmr = Math.round((this.getPlayerMmr(room.slots[0]) + this.getPlayerMmr(room.slots[2])) / 2);
    const team1Mmr = Math.round((this.getPlayerMmr(room.slots[1]) + this.getPlayerMmr(room.slots[3])) / 2);
    const lobbyMmr = Math.round((team0Mmr + team1Mmr) / 2);

    const team0Names = [room.slots[0]?.username || 'Player 1', room.slots[2]?.username || 'Player 3'];
    const team1Names = [room.slots[1]?.username || 'Player 2', room.slots[3]?.username || 'Player 4'];

    // If PostgreSQL repository is connected, use it as the SINGLE authoritative persistence & notification source
    if (this.pgRepo) {
      const humanSlots = room.slots.filter(
        (s): s is PlayerSlot => Boolean(s && !s.isAI && s.userId && !room.abandonedUserIds?.includes(s.userId))
      );
      if (humanSlots.length === 0) return;

      const composition =
        room.composition ||
        (humanSlots.length === 4 ? '4H' : humanSlots.length === 3 ? '3H1B' : humanSlots.length === 2 ? '2H2B' : '1H3B');

      const humanPlayers = humanSlots.map((s) => {
        const pTeam = getPlayerTeam(s.position);
        const userAcc = this.getCachedUser(s.userId!);
        const oppNames = pTeam === 0 ? team1Names : team0Names;
        const partnerPos = ((s.position + 2) % 4) as PlayerPosition;
        const partnerSlot = room.slots[partnerPos];
        const teammateAbandoned = Boolean(partnerSlot && partnerSlot.abandoned);
        const myTeamMmr = pTeam === 0 ? team0Mmr : team1Mmr;
        const oppTeamMmr = pTeam === 0 ? team1Mmr : team0Mmr;
        return {
          userId: s.userId!,
          position: s.position,
          team: pTeam,
          username: s.username,
          rankTier: s.rankTier || userAcc?.rankTier || '9',
          rankPoints: userAcc?.rankPoints || 0,
          mmr: userAcc?.mmr || 1200,
          teamMmr: myTeamMmr,
          opponentMmr: oppTeamMmr,
          lobbyMmr,
          tricksWon: state.matchStats?.teamTricksWon?.[pTeam] ?? state.tricksWon[pTeam] ?? 0,
          euchres: state.matchStats?.teamEuchres?.[pTeam] ?? 0,
          marches: state.matchStats?.teamMarches?.[pTeam] ?? 0,
          successfulLoners: state.matchStats?.playerLoners?.[s.position] ?? 0,
          opponentNames: oppNames,
          teammateAbandoned,
        };
      });

      this.pgRepo
        .recordMatchResult({
          matchId: room.id,
          roomCode: room.code,
          mode: pgMode,
          composition: composition as any,
          winningTeam,
          finalScore,
          durationSeconds: Math.max(0, Math.round((Date.now() - room.createdAt) / 1000)),
          humanPlayers,
          lobbyMmr,
          teamMmrs: [team0Mmr, team1Mmr],
          idempotencyKey: `match_${room.id}`,
        })
        .then(async (res) => {
          if (res && res.playerResults) {
            for (const pr of res.playerResults) {
              if (isRanked) {
                const didRankUp = TIER_ORDER.indexOf(pr.newTier) > TIER_ORDER.indexOf(pr.oldTier);
                this.sendToUser(pr.userId, {
                  type: 'RANK_UPDATE',
                  oldTier: pr.oldTier,
                  newTier: pr.newTier,
                  oldPoints: pr.oldPoints,
                  newPoints: pr.newPoints,
                  lpChange: pr.lpChange,
                  didRankUp,
                  didDivisionUp: pr.didDivisionUp,
                  oldDivision: pr.oldDivision,
                  newDivision: pr.newDivision,
                  promotionSealsAwarded: pr.promotionSealsAwarded,
                  mmrChange: pr.mmrChange,
                  newMmr: pr.newMmr,
                  lobbyMmr: pr.lobbyMmr || lobbyMmr,
                });
              }

              const freshUser = await this.pgRepo?.getUserById(pr.userId);
              if (freshUser) {
                this.setCachedUser(freshUser);
                this.sendToUser(pr.userId, {
                  type: 'USER_SYNC',
                  user: freshUser,
                });
                if (freshUser.collectionState) {
                  this.sendToUser(pr.userId, {
                    type: 'COLLECTION_STATE',
                    collection: freshUser.collectionState,
                  });
                }
                if (pr.packsAwarded > 0) {
                  this.sendToUser(pr.userId, {
                    type: 'PACK_EARNED',
                    count: pr.packsAwarded,
                    totalUnopened: pr.totalUnopenedPacks,
                    reason: pr.packsAwarded > 1
                      ? `Leveled Up +${pr.levelsGained} times! Earned ${pr.packsAwarded} Card Packs!`
                      : `Level ${pr.newLevel} Reached! Earned a Collectible Card Pack!`,
                    level: pr.newLevel,
                    unlockedAvatars: pr.newlyUnlockedAvatars,
                  });
                }
              }
            }
          }
        })
        .catch((err) => {
          console.error(`[MATCH RECORD PG] Failed recording match result for room ${room.code}:`, err);
        });
      return;
    }

    // Local JSON fallback path (unit tests / dev offline DB)
    room.slots.forEach(slot => {
      if (slot && slot.userId && !slot.isAI) {
        if (room.abandonedUserIds?.includes(slot.userId)) {
          return;
        }

        const playerTeam = getPlayerTeam(slot.position);
        const isWin = playerTeam === winningTeam;
        const tricks = state.matchStats?.teamTricksWon?.[playerTeam] ?? state.tricksWon[playerTeam];
        const euchresCount = state.matchStats?.teamEuchres?.[playerTeam] ?? 0;
        const marchesCount = state.matchStats?.teamMarches?.[playerTeam] ?? 0;
        const lonersCount = state.matchStats?.playerLoners?.[slot.position] ?? 0;
        const myTeamMmr = playerTeam === 0 ? team0Mmr : team1Mmr;
        const oppTeamMmr = playerTeam === 0 ? team1Mmr : team0Mmr;
        const oppNames = playerTeam === 0 ? team1Names : team0Names;

        const partnerPos = ((slot.position + 2) % 4) as PlayerPosition;
        const partnerSlot = room.slots[partnerPos];
        const isTeammateAbandoned = Boolean(partnerSlot && partnerSlot.abandoned);

        const preLevel = db.getUserById(slot.userId)?.level ?? 1;
        const updatedUser = db.recordMatchCompletion(
          slot.userId,
          isWin,
          tricks,
          marchesCount,
          euchresCount,
          lonersCount
        );

        if (updatedUser) {
          if (updatedUser.collectionState) {
            this.sendToUser(slot.userId, {
              type: 'COLLECTION_STATE',
              collection: updatedUser.collectionState,
            });
          }
          const gained = Math.max(0, updatedUser.level - preLevel);
          if (gained > 0) {
            this.sendToUser(slot.userId, {
              type: 'PACK_EARNED',
              count: gained,
              totalUnopened: updatedUser.unopenedPacksCount || gained,
              reason: gained > 1
                ? `Leveled Up +${gained} times! Earned ${gained} Card Packs!`
                : `Level ${updatedUser.level} Reached! Earned a Collectible Card Pack!`,
              level: updatedUser.level,
            });
          }
        }

        let rankResult: ReturnType<typeof db.recordRankedMatchResult> = null;
        if (isRanked) {
          rankResult = db.recordRankedMatchResult(
            slot.userId,
            isWin,
            myTeamMmr,
            oppTeamMmr,
            finalScore,
            oppNames,
            isTeammateAbandoned
          );

          if (rankResult) {
            this.sendToUser(slot.userId, {
              type: 'RANK_UPDATE',
              oldTier: rankResult.oldTier,
              newTier: rankResult.newTier,
              oldPoints: rankResult.oldPoints,
              newPoints: rankResult.newPoints,
              lpChange: rankResult.lpChange,
              didRankUp: rankResult.didRankUp,
              didDivisionUp: rankResult.didDivisionUp,
              oldDivision: rankResult.oldDivision,
              newDivision: rankResult.newDivision,
              promotionSealsAwarded: rankResult.promotionSealsAwarded,
              mmrChange: rankResult.mmrChange,
              newMmr: rankResult.newMmr,
              lobbyMmr: rankResult.lobbyMmr,
            });
          }
        }
      }
    });
  }

  private getPlayerMmr(slot: PlayerSlot | null): number {
    if (!slot) return 1200;
    if (slot.isAI) {
      switch (slot.aiDifficulty) {
        case 'easy':
          return 1150;
        case 'medium':
          return 1400;
        case 'hard':
          return 1750;
        default:
          return 1300;
      }
    }
    const u = this.getCachedUser(slot.userId || '');
    return u?.mmr || 1200;
  }

  // --- AUTOMATED SERVER AI LOOP ---

  private triggerAITurn(roomCode: string) {
    const state = this.gameStates.get(roomCode);
    const room = this.rooms.get(roomCode);
    if (!state || !room || room.status !== 'playing') return;

    if (state.phase === 'game_over' || state.phase === 'hand_scored' || state.phase === 'trick_resolving') {
      return;
    }

    const currentTurn = state.currentTurn;
    const currentSlot = room.slots[currentTurn];
    if (!currentSlot || !currentSlot.isAI) return;

    setTimeout(() => {
      try {
        const currentState = this.gameStates.get(roomCode);
        if (!currentState || currentState.currentTurn !== currentTurn) return;

        const diff = currentSlot.aiDifficulty || 'medium';

        if (currentState.phase === 'bidding_round_1') {
          const bid = decideRound1Bid(currentState, currentTurn, diff);
          const next = handleBid(currentState, bid);
          this.gameStates.set(roomCode, next);
          this.persistActiveMatch(roomCode);
          this.broadcastGameSync(roomCode);
          this.triggerAITurn(roomCode);
        } else if (currentState.phase === 'bidding_round_2') {
          const bid = decideRound2Bid(currentState, currentTurn, diff);
          const next = handleBid(currentState, bid);
          this.gameStates.set(roomCode, next);
          this.persistActiveMatch(roomCode);
          this.broadcastGameSync(roomCode);
          this.triggerAITurn(roomCode);
        } else if (currentState.phase === 'dealer_discard' && currentState.dealer === currentTurn) {
          const discard = decideDealerDiscard(currentState.hands[currentTurn], currentState.trumpSuit!, diff);
          const next = handleDealerDiscard(currentState, discard);
          this.gameStates.set(roomCode, next);
          this.persistActiveMatch(roomCode);
          this.broadcastGameSync(roomCode);
          this.triggerAITurn(roomCode);
        } else if (currentState.phase === 'playing') {
          const card = decideCardPlay(currentState, currentTurn, diff);
          const next = playCard(currentState, currentTurn, card);
          this.gameStates.set(roomCode, next);
          this.persistActiveMatch(roomCode);
          this.broadcastGameSync(roomCode);

          if (next.phase === 'trick_resolving') {
            setTimeout(() => {
              this.resolveCompletedTrick(roomCode);
            }, this.trickResolutionDelayMs);
          } else {
            this.triggerAITurn(roomCode);
          }
        }
      } catch (err) {
        console.error('Server AI turn error:', err);
      }
    }, this.aiTurnDelayMs);
  }

  // --- HAND PRIVACY & SANITIZATION (ANTI-CHEAT) ---

  public getSanitizedStateForPlayer(
    state: EuchreGameState,
    slots: (PlayerSlot | null)[],
    yourPos: PlayerPosition,
    room?: Room
  ): SanitizedGameState {
    const handCounts: Record<PlayerPosition, number> = {
      0: state.hands[0]?.length || 0,
      1: state.hands[1]?.length || 0,
      2: state.hands[2]?.length || 0,
      3: state.hands[3]?.length || 0,
    };

    return {
      phase: state.phase,
      dealer: state.dealer,
      currentTurn: state.currentTurn,
      upCard: state.upCard,
      trumpSuit: state.trumpSuit,
      callingPlayer: state.callingPlayer,
      callingTeam: state.callingTeam,
      isAlone: state.isAlone,
      alonePlayer: state.alonePlayer,
      benchedPlayer: state.benchedPlayer,
      yourPosition: yourPos,
      yourHand: state.hands[yourPos] || [],
      handCounts,
      currentTrick: state.currentTrick,
      completedTricksCount: state.completedTricks ? state.completedTricks.length : 0,
      tricksWon: state.tricksWon,
      scores: state.scores,
      matchStats: state.matchStats,
      lastHandResult: state.lastHandResult,
      history: state.history,
      slots: slots.map((s, idx) => {
        if (!s) {
          return {
            position: idx as PlayerPosition,
            isAI: false,
            username: `Seat ${idx}`,
            avatarIcon: 'shadow_assassin',
            equippedCardBack: DEFAULT_CARD_BACK_ID,
            connected: false,
            isReady: false,
          };
        }
        const authoritativeUser = s.userId && !s.isAI ? this.getCachedUser(s.userId) : undefined;
        const conn = s.userId && !s.isAI ? this.connections.get(s.userId) : undefined;
        return {
          ...s,
          avatarIcon: resolveAvatarId(authoritativeUser?.avatarIcon || conn?.avatarIcon || s.avatarIcon),
          equippedCardBack: s.isAI
            ? resolveCardBackId(
                s.equippedCardBack || BOT_CARD_BACK_BY_DIFFICULTY[s.aiDifficulty || 'medium']
              )
            : resolveCardBackId(
                authoritativeUser?.equippedCosmetics?.cardBack ||
                  conn?.equippedCardBack ||
                  s.equippedCardBack
              ),
        };
      }),
      roomId: room?.id,
      roomCode: room?.code,
      isMatchmade: Boolean(room?.isMatchmade),
      queueMode: room?.queueMode,
      rules: state.rules,
      winningTeam: state.phase === 'game_over' ? getWinningTeam(state.scores, state.rules.targetScore) : undefined,
      readyForNextHand: room ? Array.from(this.nextHandReady.get(room.code) || []) : undefined,
    };
  }

  public broadcastGameSync(roomCode: string) {
    const state = this.gameStates.get(roomCode);
    const room = this.rooms.get(roomCode);
    if (!state || !room) return;

    room.slots.forEach(slot => {
      if (slot && slot.userId && !slot.isAI) {
        const sanitized = this.getSanitizedStateForPlayer(state, room.slots, slot.position, room);
        this.sendToUser(slot.userId, {
          type: 'GAME_SYNC',
          state: sanitized,
        });
      }
    });
  }

  public sendStateToPlayer(roomCode: string, pos: PlayerPosition) {
    const state = this.gameStates.get(roomCode);
    const room = this.rooms.get(roomCode);
    if (!state || !room) return;

    const slot = room.slots[pos];
    if (slot && slot.userId && !slot.isAI) {
      const sanitized = this.getSanitizedStateForPlayer(state, room.slots, pos, room);
      this.sendToUser(slot.userId, {
        type: 'GAME_SYNC',
        state: sanitized,
      });
    }
  }

  public broadcastEmote(userId: string, text?: string, emoji?: string) {
    const conn = this.connections.get(userId);
    if (!conn || !conn.roomCode) return;

    const room = this.rooms.get(conn.roomCode);
    if (!room) return;

    const slotIdx = room.slots.findIndex(s => s && s.userId === userId);
    if (slotIdx === -1) return;

    this.broadcastRoom(conn.roomCode, {
      type: 'EMOTE_BROADCAST',
      fromPosition: slotIdx as PlayerPosition,
      text,
      emoji,
    });
  }

  public async sendFriendListUpdate(userId: string) {
    let friends: FriendSummary[] = [];
    let incomingRequests: UserAccount['friendRequests'] = [];

    if (this.pgRepo) {
      try {
        const onlineIds = new Set<string>();
        for (const [, conn] of this.connections) {
          if (conn.userId) onlineIds.add(conn.userId);
        }
        const pgFriends = await this.pgRepo.getFriendsSummary(userId, onlineIds);
        friends = pgFriends.map((f) => {
          const conn = this.connections.get(f.userId);
          return {
            ...f,
            status: conn?.roomCode ? 'in_game' : f.isOnline ? 'online' : 'offline',
            roomCode: conn?.roomCode,
          };
        });
        incomingRequests = await this.pgRepo.getIncomingFriendRequests(userId);
      } catch (err) {
        logger.warn(`[FRIENDS] Error querying friends from PostgreSQL: ${err}`);
      }
    } else {
      friends = db.getFriendsSummary(userId, this.connections);
      const user = db.getUserById(userId);
      if (user) incomingRequests = user.friendRequests || [];
    }

    this.sendToUser(userId, {
      type: 'FRIENDS_LIST',
      friends,
      incomingRequests,
    });
  }

  public async sendLeaderboard(userId: string) {
    let entries: LeaderboardEntry[] = [];
    if (this.pgRepo) {
      try {
        entries = await this.pgRepo.getLeaderboard(50);
      } catch (err) {
        entries = db.getLeaderboard(50);
      }
    } else {
      entries = db.getLeaderboard(50);
    }
    const conn = this.connections.get(userId);
    const connUsername = conn?.username?.toLowerCase();
    const yourIdx = entries.findIndex(
      e => e.userId === userId || (connUsername && e.username.toLowerCase() === connUsername)
    );
    this.sendToUser(userId, {
      type: 'LEADERBOARD_DATA',
      entries,
      yourRank: yourIdx !== -1 ? yourIdx + 1 : undefined,
    });
  }

  public async sendCollectionState(userId: string) {
    const user = this.pgRepo
      ? await this.pgRepo.getUserById(userId)
      : db.getUserById(userId);
    if (!user) return;
    this.setCachedUser(user);
    const collection = this.pgRepo
      ? await this.pgRepo.getCollectionState(userId)
      : db.getCollectionState(userId);
    this.sendToUser(userId, {
      type: 'COLLECTION_STATE',
      collection,
    });
  }

  public findOnlineUserIdByUsername(username: string): string | undefined {
    const needle = username.trim().toLowerCase();
    if (!needle) return undefined;
    for (const [uid, conn] of this.connections.entries()) {
      if (conn.username.trim().toLowerCase() === needle && conn.ws.readyState === WebSocket.OPEN) {
        return uid;
      }
    }
    return undefined;
  }

  public inviteFriendToParty(userId: string, friendUserId: string, mode: 'rivals' | 'custom' | 'duo' = 'rivals') {
    const conn = this.connections.get(userId);
    if (!conn) return;

    const existingRoom = conn.roomCode ? this.rooms.get(conn.roomCode) : undefined;
    let room: Room;
    let isNewRoom = false;
    if (!existingRoom || existingRoom.status !== 'lobby') {
      if (conn.roomCode) {
        this.leaveRoom(userId);
      }
      room = mode === 'rivals'
        ? this.createRivalsRoom(userId)
        : this.createRoom(userId, undefined, mode);
      isNewRoom = true;
    } else {
      room = existingRoom;
      if (mode && room.hostUserId === userId) {
        room.queueMode = mode;
      }
    }

    const hostPos = room.slots.findIndex(s => s && s.userId === userId);

    const friendConn = this.connections.get(friendUserId);
    if (!friendConn || friendConn.ws.readyState !== WebSocket.OPEN) {
      this.clearPendingInvite(room.code, friendUserId);
      this.sendToUser(userId, {
        type: 'ROOM_UPDATE',
        room,
        yourPosition: hostPos !== -1 ? (hostPos as PlayerPosition) : 0,
      });
      this.sendToUser(userId, { type: 'ERROR', message: 'Friend is currently offline' });
      return;
    }

    if (room.slots.some(s => s && !s.isAI && s.userId === friendUserId)) {
      this.clearPendingInvite(room.code, friendUserId);
      this.broadcastRoom(room.code, {
        type: 'ROOM_UPDATE',
        room,
      });
      this.sendToUser(userId, {
        type: 'NOTICE',
        message: `${friendConn.username} is already in the lobby!`,
      });
      return;
    }

    const humanCount = room.slots.filter(s => s && !s.isAI).length;
    if (humanCount >= 4) {
      this.sendToUser(userId, { type: 'ERROR', message: 'Lobby is full (4/4 players seated)' });
      return;
    }

    const now = Date.now();
    if (!room.pendingInvites) {
      room.pendingInvites = {};
    }
    for (const [k, exp] of Object.entries(room.pendingInvites)) {
      if (exp <= now) {
        this.clearPendingInvite(room.code, k);
      }
    }

    const expiresAt = now + this.inviteExpiryMs;
    this.clearPendingInvite(room.code, friendUserId);
    room.pendingInvites[friendUserId] = expiresAt;

    const timerKey = `${room.code}_${friendUserId}`;
    const expTimer = setTimeout(() => {
      this.inviteTimers.delete(timerKey);
      const activeRoom = this.rooms.get(room.code);
      if (
        activeRoom &&
        activeRoom.status === 'lobby' &&
        activeRoom.pendingInvites &&
        activeRoom.pendingInvites[friendUserId] !== undefined
      ) {
        delete activeRoom.pendingInvites[friendUserId];
        this.broadcastRoom(activeRoom.code, {
          type: 'ROOM_UPDATE',
          room: activeRoom,
        });
        this.sendToUser(userId, {
          type: 'NOTICE',
          title: 'Invite Expired',
          message: `Invitation to ${friendConn.username} expired.`,
        });
      }
    }, this.inviteExpiryMs);
    if (typeof expTimer.unref === 'function') expTimer.unref();
    this.inviteTimers.set(timerKey, expTimer);

    // Immediately provide authoritative room state (with pendingInvites) to the inviter & room
    this.sendToUser(userId, {
      type: 'ROOM_UPDATE',
      room,
      yourPosition: hostPos !== -1 ? (hostPos as PlayerPosition) : 0,
    });

    if (!isNewRoom) {
      this.broadcastRoom(room.code, {
        type: 'ROOM_UPDATE',
        room,
      });
    }

    this.sendToUser(friendUserId, {
      type: 'PARTY_INVITE_RECEIVED',
      fromUsername: conn.username,
      fromAvatar: conn.avatarIcon,
      roomCode: room.code,
      mode: room.queueMode,
      expiresAt,
    });

    this.sendToUser(userId, {
      type: 'NOTICE',
      message: `Challenged ${friendConn.username} to ${room.queueMode === 'rivals' ? 'Friendly Rivalry' : 'Custom Lobby'} match!`,
    });
  }

  public declinePartyInvite(userId: string, roomCode: string): void {
    const conn = this.connections.get(userId);
    const targetCode = roomCode.trim().toUpperCase();
    const room = this.rooms.get(targetCode);
    if (!room) return;

    this.clearPendingInvite(room.code, userId);

    this.broadcastRoom(room.code, {
      type: 'ROOM_UPDATE',
      room,
    });

    if (room.hostUserId) {
      this.sendToUser(room.hostUserId, {
        type: 'NOTICE',
        title: 'Invite Declined',
        message: `${conn?.username || 'Player'} declined the lobby invitation.`,
      });
    }
  }

  private validateActionContext(
    userId: string,
    checkTurn: boolean = true
  ): { room: Room; state: EuchreGameState; pos: PlayerPosition } {
    const conn = this.connections.get(userId);
    if (!conn || !conn.roomCode) throw new Error('Not in a game room');

    const room = this.rooms.get(conn.roomCode);
    const state = this.gameStates.get(conn.roomCode);
    if (!room || !state || room.status !== 'playing') {
      throw new Error('No active game in progress');
    }

    const pos = room.slots.findIndex(s => s && s.userId === userId);
    if (pos === -1) throw new Error('Not seated in this room');

    if (checkTurn && state.currentTurn !== pos) {
      throw new Error(`It is not your turn (Current turn: Seat ${state.currentTurn})`);
    }

    return { room, state, pos: pos as PlayerPosition };
  }

  public broadcastRoom(roomCode: string, msg: ServerMessage) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.slots.forEach(slot => {
      if (slot && slot.userId && !slot.isAI) {
        this.sendToUser(slot.userId, msg);
      }
    });
  }

  public sendToUser(userId: string, msg: ServerMessage) {
    const conn = this.connections.get(userId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;

    try {
      conn.ws.send(JSON.stringify(msg));
    } catch (err) {
      console.error(`Failed to send message to user ${userId}:`, err);
    }
  }

  public cleanup() {
    if (this.matchTimer) clearInterval(this.matchTimer);
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
  }
}

export const roomManager = new RoomManager();
