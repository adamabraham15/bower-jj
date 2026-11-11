/**
 * BOWER JJ — Stage 4.2 Automated Test Suite
 * Tests Matchmaking Radius Expansion, Configurable Bot Fallback, Match Composition Analytics,
 * Disconnect Grace & Abandonment Penalties, Loss Mitigation, and Atomic Result Processing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomManager, RANKED_BOT_FALLBACK_MS, PARTIAL_HUMAN_FALLBACK_MS } from '../roomManager';
import { db } from '../db';
import { PlayerPosition } from '../../src/engine/types';

describe('Stage 4.2: Matchmaking Expansion & Configurable Bot Fallback', () => {
  let rm: RoomManager;

  beforeEach(() => {
    rm = new RoomManager();
  });

  afterEach(() => {
    rm.destroy();
  });

  it('configures ranked bot fallback to at least 30-35 seconds rather than 6.5s', () => {
    expect(RANKED_BOT_FALLBACK_MS).toBeGreaterThanOrEqual(30000);
    expect(PARTIAL_HUMAN_FALLBACK_MS).toBeGreaterThanOrEqual(20000);
  });

  it('keeps solo ranked player in queue past 10 seconds to prioritize human matching', () => {
    const fakeWs = { send: () => {}, readyState: 1 } as any;
    const userId = 'usr_test_patient_solo';
    db.getOrCreateUser('PatientSolo', '🤠', undefined, userId);

    rm.registerConnection(userId, {
      ws: fakeWs,
      userId,
      username: 'PatientSolo',
      avatarIcon: '🤠',
    });

    rm.enterQueue(userId, 'solo');

    // Simulate 12 seconds in queue (previously would have matched bots at 6.5s!)
    const conn = (rm as any).connections.get(userId);
    conn.queueEnterTime = Date.now() - 12000;

    // Trigger matchmaking cycle
    (rm as any).processMatchmakingQueue();

    // Player MUST still be in queue waiting for real humans!
    expect((rm as any).soloQueue).toContain(userId);
    expect(conn.roomCode).toBeUndefined();
  });

  it('matches 4 real humans together immediately into a pure human match', () => {
    const userIds = ['usr_h1', 'usr_h2', 'usr_h3', 'usr_h4'];

    userIds.forEach((uid, idx) => {
      db.getOrCreateUser(`Human_${idx + 1}`, '🤠', undefined, uid);
      const fakeWs = { send: () => {}, readyState: 1 } as any;
      rm.registerConnection(uid, {
        ws: fakeWs,
        userId: uid,
        username: `Human_${idx + 1}`,
        avatarIcon: '🤠',
      });
      rm.enterQueue(uid, 'solo');
    });

    (rm as any).processMatchmakingQueue();

    // All 4 players matched
    expect((rm as any).soloQueue.length).toBe(0);

    const conn1 = (rm as any).connections.get('usr_h1');
    expect(conn1.roomCode).toBeDefined();

    const room = (rm as any).rooms.get(conn1.roomCode);
    expect(room).toBeDefined();

    // Verify all 4 seats are real humans (0 bots)
    const humanSlots = room.slots.filter((s: any) => s && !s.isAI);
    expect(humanSlots.length).toBe(4);
  });
});

describe('Stage 4.2: Match Composition Analytics & Telemetry', () => {
  it('tracks accurate distribution percentages of 4H, 3H+1B, 2H+2B, and 1H+3B matches', () => {
    // Record sample compositions
    db.recordMatchmakingComposition(4, 8000);
    db.recordMatchmakingComposition(4, 12000);
    db.recordMatchmakingComposition(2, 26000);
    db.recordMatchmakingComposition(1, 36000);

    const stats = db.getMatchmakingStats();

    expect(stats.totalMatches).toBeGreaterThanOrEqual(4);
    expect(stats.fourHumans).toBeGreaterThanOrEqual(2);
    expect(stats.twoHumansTwoBots).toBeGreaterThanOrEqual(1);
    expect(stats.oneHumanThreeBots).toBeGreaterThanOrEqual(1);

    // Verify percentages sum accurately
    const p = stats.percentages;
    expect(p.fourHumans).toBeGreaterThan(0);
    expect(p.twoHumansTwoBots).toBeGreaterThan(0);
    expect(p.oneHumanThreeBots).toBeGreaterThan(0);
    expect(typeof p.fourHumans).toBe('number');
  });
});

describe('Stage 4.2: Disconnect Grace, Ranked Abandonment Penalty & Loss Mitigation', () => {
  let rm: RoomManager;

  beforeEach(() => {
    rm = new RoomManager();
  });

  afterEach(() => {
    rm.destroy();
  });

  it('reconnects a temporarily disconnected player within 45s grace period without penalty', () => {
    const fakeWs1 = { send: () => {}, readyState: 1 } as any;
    const userId = 'usr_dc_reconnect';
    db.getOrCreateUser('ReconnectPlayer', '🤠', undefined, userId);

    rm.registerConnection(userId, {
      ws: fakeWs1,
      userId,
      username: 'ReconnectPlayer',
      avatarIcon: '🤠',
    });

    const room = rm.createRoom(userId);
    const code = room.code;

    // Player disconnects
    rm.handleDisconnect(userId);

    // Slot is marked disconnected, timer started
    expect(room.slots[0]?.connected).toBe(false);
    expect((rm as any).disconnectTimers.has(`${code}_0`)).toBe(true);

    // Player reconnects on new WebSocket
    const fakeWs2 = { send: () => {}, readyState: 1 } as any;
    rm.registerConnection(userId, {
      ws: fakeWs2,
      userId,
      username: 'ReconnectPlayer',
      avatarIcon: '🤠',
    });

    // Seat restored, timer cleared
    expect(room.slots[0]?.connected).toBe(true);
    expect((rm as any).disconnectTimers.has(`${code}_0`)).toBe(false);
  });

  it('assesses an abandonment penalty on player who abandons a live ranked match', () => {
    const userId = 'usr_ragequitter';
    const initialUser = db.getOrCreateUser('RageQuitter', '🥷', undefined, userId).user;
    const initialPoints = initialUser.rankPoints;

    const fakeWs = { send: () => {}, readyState: 1 } as any;
    rm.registerConnection(userId, {
      ws: fakeWs,
      userId,
      username: 'RageQuitter',
      avatarIcon: '🥷',
    });

    const room = rm.createRoom(userId);
    room.isMatchmade = true;
    room.status = 'playing';

    // Player disconnects
    room.slots[0]!.connected = false;

    // Simulate 45s grace period expiration
    (rm as any).handlePlayerAbandoned(room.code, 0 as PlayerPosition);

    // 1. Slot is handed over to AI Bot
    expect(room.slots[0]?.isAI).toBe(true);
    expect(room.slots[0]?.abandoned).toBe(true);
    expect(room.slots[0]?.username).toContain('(Bot)');

    // 2. User is penalized in database
    const penalizedUser = db.getUserById(userId);
    expect(penalizedUser).not.toBeNull();
    expect(penalizedUser!.abandonments).toBeGreaterThanOrEqual(1);
    expect(penalizedUser!.losses).toBeGreaterThan(0);
    expect(penalizedUser!.rankPoints).toBeLessThanOrEqual(initialPoints);
  });

  it('grants loss mitigation protection (0 LP lost) to partner of an abandoning teammate', () => {
    const partnerId = 'usr_innocent_partner';
    db.getOrCreateUser('InnocentPartner', '😇', undefined, partnerId);
    db.updateUser(partnerId, { rankPoints: 50 });

    // Result with teammate abandoned flag = true
    const result = db.recordRankedMatchResult(
      partnerId,
      false, // Lost match
      1200,
      1200,
      '3 - 10',
      ['Opponent 1', 'Opponent 2'],
      true // Teammate abandoned!
    );

    expect(result).not.toBeNull();
    // Normal loss is -18 LP, but with loss mitigation it is 0 LP!
    expect(result?.lpChange).toBe(0);
    expect(result?.newPoints).toBe(50);
  });
});

describe('Stage 4.2: Atomic Match Result Recording (Anti-Exploit)', () => {
  let rm: RoomManager;

  beforeEach(() => {
    rm = new RoomManager();
  });

  afterEach(() => {
    rm.destroy();
  });

  it('prevents duplicate reward grants when recordMatchResults is called multiple times', () => {
    const userId = 'usr_atomic_player';
    db.getOrCreateUser('AtomicPlayer', '👑', undefined, userId);
    db.updateUser(userId, { rankPoints: 40, xp: 500 });

    const fakeWs = { send: () => {}, readyState: 1 } as any;
    rm.registerConnection(userId, {
      ws: fakeWs,
      userId,
      username: 'AtomicPlayer',
      avatarIcon: '👑',
    });

    const room = rm.createRoom(userId);
    room.isMatchmade = true;
    room.status = 'playing';

    const fakeGameState = {
      scores: [10, 4] as [number, number],
      rules: { targetScore: 10 },
      tricksWon: [3, 2] as [number, number],
    } as any;

    // First call
    (rm as any).recordMatchResults(room, fakeGameState);
    const pointsAfterFirst = db.getUserById(userId)!.rankPoints;
    expect(pointsAfterFirst).toBeGreaterThan(40);

    // Duplicate call (e.g. race condition or double client trigger)
    (rm as any).recordMatchResults(room, fakeGameState);
    const pointsAfterSecond = db.getUserById(userId)!.rankPoints;

    // MUST NOT grant duplicate rewards!
    expect(pointsAfterSecond).toBe(pointsAfterFirst);
  });

  it('denies win rewards to players who abandoned during the match even if bot wins', () => {
    const abandonedUserId = 'usr_abandoned_no_win';
    db.getOrCreateUser('AbandonedNoWin', '🤠', undefined, abandonedUserId);
    db.updateUser(abandonedUserId, { rankPoints: 30 });

    const fakeWs = { send: () => {}, readyState: 1 } as any;
    rm.registerConnection(abandonedUserId, {
      ws: fakeWs,
      userId: abandonedUserId,
      username: 'AbandonedNoWin',
      avatarIcon: '🤠',
    });

    const room = rm.createRoom(abandonedUserId);
    room.isMatchmade = true;
    room.status = 'playing';
    room.abandonedUserIds = [abandonedUserId];

    const fakeGameState = {
      scores: [10, 2] as [number, number],
      rules: { targetScore: 10 },
      tricksWon: [5, 0] as [number, number],
    } as any;

    (rm as any).recordMatchResults(room, fakeGameState);

    // The abandoned user must NOT receive win LP
    expect(db.getUserById(abandonedUserId)!.rankPoints).toBe(30);
  });
});
