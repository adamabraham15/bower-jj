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
  initializeGame,
  handleBid,
  handleDealerDiscard,
  playCard,
  completeTrick,
  startNextHand,
} from '../src/engine/game';
import {
  decideRound1Bid,
  decideRound2Bid,
  decideDealerDiscard,
  decideCardPlay,
} from '../src/engine/ai';
import { db, TIER_ORDER } from './db';
import { PostgresDatabaseRepository } from './db/postgres';

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
  roomCode?: string;
  inQueue?: 'solo' | 'rivals' | 'duo' | 'casual';
  queueEnterTime?: number;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private gameStates: Map<string, EuchreGameState> = new Map();
  private connections: Map<string, ClientConnection> = new Map(); // userId -> ClientConnection
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map(); // `${roomCode}_${position}` -> timer
  private soloQueue: string[] = []; // Array of userIds waiting in queue
  private matchTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  public trickResolutionDelayMs: number = 1800;
  public aiTurnDelayMs: number = 750;
  public pgRepo?: PostgresDatabaseRepository;

  public setPostgresRepository(repo: PostgresDatabaseRepository): void {
    this.pgRepo = repo;
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
      const records = await this.pgRepo.loadActiveMatches(15);
      for (const rec of records) {
        if (!rec.room || !rec.state) continue;
        const room: Room = rec.room;
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

    // Reconnection check
    for (const [code, room] of this.rooms.entries()) {
      const slotIdx = room.slots.findIndex(s => s && s.userId === userId);
      if (slotIdx !== -1) {
        const slot = room.slots[slotIdx]!;
        slot.connected = true;
        conn.roomCode = code;

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
  }

  public handleDisconnect(userId: string) {
    const conn = this.connections.get(userId);
    if (!conn) return;

    this.leaveQueue(userId);

    const roomCode = conn.roomCode;
    if (roomCode) {
      const room = this.rooms.get(roomCode);
      if (room) {
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
      if (room.status === 'playing' && (room.isMatchmade || room.queueMode === 'solo' || room.queueMode === 'rivals' || room.queueMode === 'duo')) {
        const oppPos1 = ((pos + 1) % 4) as PlayerPosition;
        const oppPos2 = ((pos + 3) % 4) as PlayerPosition;
        const oppNames = [room.slots[oppPos1]?.username || 'Opponent 1', room.slots[oppPos2]?.username || 'Opponent 2'];
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

  public createRoom(userId: string, rules?: Partial<EuchreHouseRules>): Room {
    const conn = this.connections.get(userId);
    if (!conn) throw new Error('Not connected');

    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const userAcc = db.getUserById(userId);

    const hostSlot: PlayerSlot = {
      position: 0,
      isAI: false,
      userId,
      username: conn.username,
      avatarIcon: conn.avatarIcon,
      rankTier: userAcc?.rankTier || '9',
      connected: true,
      isReady: true,
    };

    const room: Room = {
      code,
      hostUserId: userId,
      status: 'lobby',
      rules: { ...DEFAULT_RULES, ...rules },
      slots: [hostSlot, null, null, null],
      isMatchmade: false,
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
    const room = this.createRoom(userId, rules);
    room.queueMode = 'rivals';
    return room;
  }

  public joinRoom(userId: string, code: string): Room {
    const conn = this.connections.get(userId);
    if (!conn) throw new Error('Not connected');

    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error(`Room ${code} not found`);

    if (room.status !== 'lobby') {
      throw new Error('Game is already in progress');
    }

    const existing = room.slots.findIndex(s => s && s.userId === userId);
    if (existing !== -1) {
      conn.roomCode = room.code;
      return room;
    }

    // In Rivals mode, ensure Friend 2 is placed at Seat 1 (Team 1, Opposing team from Host at Seat 0, Team 0)
    let emptyIdx: number;
    if (room.queueMode === 'rivals' && room.slots[1] === null) {
      emptyIdx = 1;
    } else {
      emptyIdx = room.slots.findIndex(s => s === null);
    }

    if (emptyIdx === -1) {
      throw new Error('Room is full');
    }

    const userAcc = db.getUserById(userId);

    const slot: PlayerSlot = {
      position: emptyIdx as PlayerPosition,
      isAI: false,
      userId,
      username: conn.username,
      avatarIcon: conn.avatarIcon,
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
    const hostAcc = db.getUserById(userId);
    if (hostAcc) {
      targetTier = overrideTier || hostAcc.rankTier;
    }

    const botConfig = this.getBotConfigForTier(targetTier);
    const difficulty = overrideDifficulty || botConfig.difficulty;
    const displayTier = botConfig.displayTier;

    const aiAvatars = ['🤖', '🧝', '👽', '🦊'];
    const aiNames = ['West (Bot)', 'Partner (Bot)', 'East (Bot)'];

    for (let i = 0; i < 4; i++) {
      if (room.slots[i] === null) {
        room.slots[i] = {
          position: i as PlayerPosition,
          isAI: true,
          aiDifficulty: difficulty,
          username: aiNames[i - 1] || `Bot ${i}`,
          avatarIcon: aiAvatars[i % aiAvatars.length],
          rankTier: displayTier,
          connected: true,
          isReady: true,
        };
      }
    }

    this.broadcastRoom(room.code, {
      type: 'ROOM_UPDATE',
      room,
    });

    return room;
  }

  public startGame(userId: string): Room {
    const conn = this.connections.get(userId);
    if (!conn || !conn.roomCode) throw new Error('Not in a room');

    const room = this.rooms.get(conn.roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostUserId !== userId && !room.isMatchmade) throw new Error('Only host can start the game');

    const occupiedCount = room.slots.filter(s => s !== null).length;
    if (occupiedCount !== 4) {
      throw new Error('Game requires exactly 4 players. Fill empty seats with AI or invite friends.');
    }

    const players: Player[] = room.slots.map((s, idx) => ({
      id: s!.userId || `ai_${idx}`,
      name: s!.username,
      position: idx as PlayerPosition,
      isAI: s!.isAI,
      aiDifficulty: s!.aiDifficulty,
      avatarId: s!.avatarIcon,
      rankTier: s!.rankTier,
    }));

    const initialState = initializeGame(players, room.rules, 0);
    this.gameStates.set(room.code, initialState);
    room.status = 'playing';
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

  public kickPlayer(hostUserId: string, targetPosition: PlayerPosition): Room {
    const conn = this.connections.get(hostUserId);
    if (!conn || !conn.roomCode) throw new Error('Not in a room');

    const room = this.rooms.get(conn.roomCode);
    if (!room) throw new Error('Room not found');
    if (room.hostUserId !== hostUserId) throw new Error('Only the room host can remove players');
    if (targetPosition === 0) throw new Error('Host cannot kick themselves');

    const targetSlot = room.slots[targetPosition];
    if (targetSlot && targetSlot.userId) {
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

  // --- MATCHMAKING QUEUE (REAL PLAYERS FIRST, TIER-COMPENSATED BOTS SECOND) ---

  public enterQueue(userId: string, mode: 'solo' | 'rivals' | 'duo' | 'casual' = 'solo') {
    const conn = this.connections.get(userId);
    if (!conn) return;

    if (!this.soloQueue.includes(userId)) {
      this.soloQueue.push(userId);
    }
    conn.inQueue = mode;
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
    const user = db.getUserById(userId);
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

        const room = this.createRoom(hostId, DEFAULT_RULES);
        room.isMatchmade = true;
        room.queueMode = 'solo';

        for (let i = 1; i < 4; i++) {
          const uid = matchedUserIds[i];
          const conn = this.connections.get(uid);
          if (conn) {
            const userAcc = db.getUserById(uid);
            room.slots[i] = {
              position: i as PlayerPosition,
              isAI: false,
              userId: uid,
              username: conn.username,
              avatarIcon: conn.avatarIcon,
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
      const hostAcc = db.getUserById(hostId);
      const targetTier = hostAcc?.rankTier || '9';

      const avgWait = matchedUserIds.reduce((sum, uid) => {
        const c = this.connections.get(uid);
        return sum + (now - (c?.queueEnterTime || now));
      }, 0) / humanCount;

      db.recordMatchmakingComposition(humanCount, avgWait);

      const room = this.createRoom(hostId, DEFAULT_RULES);
      room.isMatchmade = true;
      room.queueMode = 'solo';

      // Distribute humans across opposing teams (Seat 0 Team Blue, Seat 1 Team Red)
      for (let i = 1; i < humanCount; i++) {
        const uid = matchedUserIds[i];
        const conn = this.connections.get(uid);
        if (conn) {
          const userAcc = db.getUserById(uid);
          room.slots[i] = {
            position: i as PlayerPosition,
            isAI: false,
            userId: uid,
            username: conn.username,
            avatarIcon: conn.avatarIcon,
            rankTier: userAcc?.rankTier || targetTier,
            connected: true,
            isReady: true,
          };
          conn.roomCode = room.code;
          conn.inQueue = undefined;
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
      const hostAcc = db.getUserById(hostId);
      const targetTier = hostAcc?.rankTier || '9';
      const conn = this.connections.get(hostId);
      const wait = now - (conn?.queueEnterTime || now);

      db.recordMatchmakingComposition(1, wait);

      const room = this.createRoom(hostId, DEFAULT_RULES);
      room.isMatchmade = true;
      room.queueMode = conn?.inQueue || 'solo';

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

    const nextState = startNextHand(state);
    this.gameStates.set(room.code, nextState);
    this.persistActiveMatch(room.code);
    this.broadcastGameSync(room.code);

    this.triggerAITurn(room.code);
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
      // Auto-advance hand after 8 seconds if no client requests nextHand
      const autoTimer = setTimeout(() => {
        const cur = this.gameStates.get(roomCode);
        if (cur && cur.phase === 'hand_scored') {
          const advanced = startNextHand(cur);
          this.gameStates.set(roomCode, advanced);
          this.persistActiveMatch(roomCode);
          this.broadcastGameSync(roomCode);
          this.triggerAITurn(roomCode);
        }
      }, 8000);
      if (typeof autoTimer.unref === 'function') autoTimer.unref();
    }
  }

  private recordMatchResults(room: Room, state: EuchreGameState) {
    if (room.resultsRecorded) return; // Prevent duplicate execution
    room.resultsRecorded = true;
    room.status = 'finished';
    this.clearActiveMatchSnapshot(room.code);

    const winningTeam = state.scores[0] >= state.rules.targetScore ? 0 : 1;
    const finalScore = `${state.scores[0]} - ${state.scores[1]}`;

    // Calculate MMR averages
    const team0Mmr = (this.getPlayerMmr(room.slots[0]) + this.getPlayerMmr(room.slots[2])) / 2;
    const team1Mmr = (this.getPlayerMmr(room.slots[1]) + this.getPlayerMmr(room.slots[3])) / 2;

    const team0Names = [room.slots[0]?.username || 'Player 1', room.slots[2]?.username || 'Player 3'];
    const team1Names = [room.slots[1]?.username || 'Player 2', room.slots[3]?.username || 'Player 4'];

    room.slots.forEach(slot => {
      if (slot && slot.userId && !slot.isAI) {
        // If this player previously abandoned the match, skip awarding rewards
        if (room.abandonedUserIds?.includes(slot.userId)) {
          return;
        }

        const playerTeam = getPlayerTeam(slot.position);
        const isWin = playerTeam === winningTeam;
        const tricks = state.tricksWon[playerTeam];
        const myTeamMmr = playerTeam === 0 ? team0Mmr : team1Mmr;
        const oppTeamMmr = playerTeam === 0 ? team1Mmr : team0Mmr;
        const oppNames = playerTeam === 0 ? team1Names : team0Names;

        // Check if partner abandoned for Loss Mitigation
        const partnerPos = ((slot.position + 2) % 4) as PlayerPosition;
        const partnerSlot = room.slots[partnerPos];
        const isTeammateAbandoned = Boolean(partnerSlot && partnerSlot.abandoned);

        // Authoritative XP, Battle Pass, and Challenge Updates
        const updatedUser = db.recordMatchCompletion(
          slot.userId,
          isWin,
          tricks,
          state.scores[playerTeam] >= 2 ? 1 : 0,
          state.scores[playerTeam] >= 2 ? 1 : 0,
          state.scores[playerTeam] >= 4 ? 1 : 0
        );

        if (updatedUser) {
          this.sendToUser(slot.userId, {
            type: 'BATTLE_PASS_UPDATE',
            battlePass: updatedUser.battlePass,
            challenges: updatedUser.challenges,
          });
        }

        // Authoritative Elo MMR & LP Calculation (if ranked match)
        if (room.isMatchmade || room.queueMode === 'solo' || room.queueMode === 'rivals' || room.queueMode === 'duo') {
          const rankResult = db.recordRankedMatchResult(
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
            });
          }
        }
      }
    });

    // If PostgreSQL repository is connected, record transactional match result with idempotency key
    if (this.pgRepo) {
      const humanSlots = room.slots.filter(s => s && !s.isAI && s.userId);
      const composition = room.composition || (humanSlots.length === 4 ? '4H' : humanSlots.length === 3 ? '3H1B' : humanSlots.length === 2 ? '2H2B' : '1H3B');
      const humanPlayers = humanSlots.map(s => {
        const pTeam = getPlayerTeam(s.position);
        const userAcc = db.getUserById(s.userId!);
        return {
          userId: s.userId!,
          position: s.position,
          team: pTeam,
          username: s.username,
          rankTier: s.rankTier || userAcc?.rankTier || '9',
          rankPoints: userAcc?.rankPoints || 0,
          mmr: userAcc?.eloMmr || 1200,
          tricksWon: state.tricksWon[pTeam] || 0,
          euchres: state.scores[pTeam] >= 2 ? 1 : 0,
          marches: state.scores[pTeam] >= 2 ? 1 : 0,
          successfulLoners: state.scores[pTeam] >= 4 ? 1 : 0,
        };
      });

      this.pgRepo.recordMatchResult({
        matchId: room.id,
        roomCode: room.code,
        mode: (room.queueMode === 'rivals' ? 'ranked_rivals' : room.isMatchmade ? 'ranked_solo' : 'unranked') as any,
        composition: composition as any,
        winningTeam,
        finalScore,
        humanPlayers,
        idempotencyKey: `match_${room.id}`,
      }).then(res => {
        if (res && res.playerResults) {
          for (const pr of res.playerResults) {
            this.sendToUser(pr.userId, {
              type: 'RANK_UPDATE',
              oldTier: pr.oldTier,
              newTier: pr.newTier,
              oldPoints: pr.oldPoints,
              newPoints: pr.newPoints,
              lpChange: pr.lpChange,
              didRankUp: pr.oldTier !== pr.newTier,
            });
          }
        }
      }).catch(err => {
        console.error(`[MATCH RECORD PG] Failed recording match result for room ${room.code}:`, err);
      });
    }
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
    const u = db.getUserById(slot.userId || '');
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
    yourPos: PlayerPosition
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
      lastHandResult: state.lastHandResult,
      history: state.history,
      slots: slots.map((s, idx) => s || {
        position: idx as PlayerPosition,
        isAI: false,
        username: `Seat ${idx}`,
        avatarIcon: '👤',
        connected: false,
        isReady: false,
      }),
    };
  }

  public broadcastGameSync(roomCode: string) {
    const state = this.gameStates.get(roomCode);
    const room = this.rooms.get(roomCode);
    if (!state || !room) return;

    room.slots.forEach(slot => {
      if (slot && slot.userId && !slot.isAI) {
        const sanitized = this.getSanitizedStateForPlayer(state, room.slots, slot.position);
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
      const sanitized = this.getSanitizedStateForPlayer(state, room.slots, pos);
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

  public sendFriendListUpdate(userId: string) {
    const friends = db.getFriendsSummary(userId, this.connections);
    const user = db.getUserById(userId);
    if (!user) return;

    this.sendToUser(userId, {
      type: 'FRIENDS_LIST',
      friends,
      incomingRequests: user.friendRequests,
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

  public sendBattlePass(userId: string) {
    const user = db.getUserById(userId);
    if (!user) return;
    this.sendToUser(userId, {
      type: 'BATTLE_PASS_UPDATE',
      battlePass: user.battlePass,
      challenges: user.challenges,
    });
  }

  public inviteFriendToParty(userId: string, friendUserId: string, mode: 'rivals' | 'duo' = 'rivals') {
    let conn = this.connections.get(userId);
    if (!conn) return;

    let room: Room;
    if (!conn.roomCode) {
      room = mode === 'rivals' ? this.createRivalsRoom(userId) : this.createRoom(userId);
    } else {
      room = this.rooms.get(conn.roomCode)!;
      room.queueMode = mode;
    }

    const friendConn = this.connections.get(friendUserId);
    if (!friendConn) {
      this.sendToUser(userId, { type: 'ERROR', message: 'Friend is currently offline' });
      return;
    }

    this.sendToUser(friendUserId, {
      type: 'PARTY_INVITE_RECEIVED',
      fromUsername: conn.username,
      fromAvatar: conn.avatarIcon,
      roomCode: room.code,
    });

    this.sendToUser(userId, {
      type: 'NOTICE',
      message: `Challenged ${friendConn.username} to Friendly Rivalry match!`,
    });
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
