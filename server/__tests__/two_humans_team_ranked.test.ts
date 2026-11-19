/**
 * BOWER JJ — Ranked 2-Player Team Matchmaking Test Suite
 * Tests that when only 2 people are queuing in ranked, they can be matched
 * as a cooperative team on Team Blue (Seat 0 & Seat 2) against 2 AI Bots on Team Red (Seat 1 & Seat 3),
 * or as Rivals (Seat 0 & Seat 1) based on user preference, with full LP/MMR progression.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomManager, PARTIAL_HUMAN_FALLBACK_MS } from '../roomManager';
import { db } from '../db';
import { PlayerPosition, getPlayerTeam } from '../../src/engine/types';

describe('Ranked 2-Player Queue: Cooperative Team vs Bots', () => {
  let rm: RoomManager;

  beforeEach(() => {
    rm = new RoomManager();
  });

  afterEach(() => {
    rm.destroy();
  });

  it('pairs 2 queued ranked players as teammates on Team Blue (Seats 0 & 2) by default against 2 Bots (Seats 1 & 3)', () => {
    const user1 = 'usr_duo_human_1';
    const user2 = 'usr_duo_human_2';

    db.getOrCreateUser('AliceRanked', '👑', undefined, user1);
    db.getOrCreateUser('BobRanked', '🤠', undefined, user2);

    const fakeWs1 = { send: () => {}, readyState: 1 } as any;
    const fakeWs2 = { send: () => {}, readyState: 1 } as any;

    rm.registerConnection(user1, {
      ws: fakeWs1,
      userId: user1,
      username: 'AliceRanked',
      avatarIcon: '👑',
    });

    rm.registerConnection(user2, {
      ws: fakeWs2,
      userId: user2,
      username: 'BobRanked',
      avatarIcon: '🤠',
    });

    // Both players enter solo ranked queue (defaulting to teammates)
    rm.enterQueue(user1, 'solo', 'teammates');
    rm.enterQueue(user2, 'solo', 'teammates');

    // Simulate waiting past partial human fallback (>= 25 seconds)
    const conn1 = (rm as any).connections.get(user1);
    const conn2 = (rm as any).connections.get(user2);
    conn1.queueEnterTime = Date.now() - (PARTIAL_HUMAN_FALLBACK_MS + 2000);
    conn2.queueEnterTime = Date.now() - (PARTIAL_HUMAN_FALLBACK_MS + 1000);

    // Process matchmaking queue
    (rm as any).processMatchmakingQueue();

    // Verify both matched out of queue
    expect((rm as any).soloQueue).not.toContain(user1);
    expect((rm as any).soloQueue).not.toContain(user2);
    expect(conn1.roomCode).toBeDefined();
    expect(conn2.roomCode).toBe(conn1.roomCode);

    const room = (rm as any).rooms.get(conn1.roomCode);
    expect(room).toBeDefined();

    // Verify Team Blue (Seats 0 and 2) are the two real humans!
    expect(room.slots[0].userId).toBe(user1);
    expect(room.slots[0].isAI).toBe(false);
    expect(getPlayerTeam(0 as PlayerPosition)).toBe(0);

    expect(room.slots[2].userId).toBe(user2);
    expect(room.slots[2].isAI).toBe(false);
    expect(getPlayerTeam(2 as PlayerPosition)).toBe(0);

    // Verify Team Red (Seats 1 and 3) are the AI Bots!
    expect(room.slots[1].isAI).toBe(true);
    expect(getPlayerTeam(1 as PlayerPosition)).toBe(1);

    expect(room.slots[3].isAI).toBe(true);
    expect(getPlayerTeam(3 as PlayerPosition)).toBe(1);

    // Verify match is actively playing and marked as matchmade ranked
    expect(room.status).toBe('playing');
    expect(room.isMatchmade).toBe(true);
    expect(room.queueMode).toBe('solo');
  });

  it('pairs 2 queued ranked players as opponents (Seats 0 & 1) when both select opponents preference', () => {
    const userA = 'usr_rival_a';
    const userB = 'usr_rival_b';

    db.getOrCreateUser('RivalA', '🥷', undefined, userA);
    db.getOrCreateUser('RivalB', '🧙', undefined, userB);

    const fakeWsA = { send: () => {}, readyState: 1 } as any;
    const fakeWsB = { send: () => {}, readyState: 1 } as any;

    rm.registerConnection(userA, {
      ws: fakeWsA,
      userId: userA,
      username: 'RivalA',
      avatarIcon: '🥷',
    });

    rm.registerConnection(userB, {
      ws: fakeWsB,
      userId: userB,
      username: 'RivalB',
      avatarIcon: '🧙',
    });

    // Both enter queue requesting opponents
    rm.enterQueue(userA, 'solo', 'opponents');
    rm.enterQueue(userB, 'solo', 'opponents');

    const connA = (rm as any).connections.get(userA);
    const connB = (rm as any).connections.get(userB);
    connA.queueEnterTime = Date.now() - (PARTIAL_HUMAN_FALLBACK_MS + 2000);
    connB.queueEnterTime = Date.now() - (PARTIAL_HUMAN_FALLBACK_MS + 1000);

    (rm as any).processMatchmakingQueue();

    const room = (rm as any).rooms.get(connA.roomCode);
    expect(room).toBeDefined();

    // Verify seated on opposing teams: Seat 0 vs Seat 1
    expect(room.slots[0].userId).toBe(userA);
    expect(getPlayerTeam(0 as PlayerPosition)).toBe(0);

    expect(room.slots[1].userId).toBe(userB);
    expect(getPlayerTeam(1 as PlayerPosition)).toBe(1);

    // Bots fill Seat 2 and Seat 3 as partners
    expect(room.slots[2].isAI).toBe(true);
    expect(room.slots[3].isAI).toBe(true);
  });

  it('records authoritative ranked match win and awards LP/MMR to both human teammates against bots', () => {
    const p1Id = 'usr_coop_win_1';
    const p2Id = 'usr_coop_win_2';

    const p1 = db.getOrCreateUser('CoopWinner1', '🚀', undefined, p1Id).user;
    const p2 = db.getOrCreateUser('CoopWinner2', '💎', undefined, p2Id).user;

    const initialLp1 = p1.rankPoints;
    const initialLp2 = p2.rankPoints;
    const initialMmr1 = p1.mmr;
    const initialMmr2 = p2.mmr;

    // Both humans win as Team 0 against Team 1 Bots (10 - 4)
    const res1 = db.recordRankedMatchResult(
      p1Id,
      true, // isWin
      1300, // teamAvgMmr
      1300, // oppAvgMmr (bots)
      '10 - 4',
      ['BowerBot Alpha', 'BowerBot Beta']
    );

    const res2 = db.recordRankedMatchResult(
      p2Id,
      true, // isWin
      1300,
      1300,
      '10 - 4',
      ['BowerBot Alpha', 'BowerBot Beta']
    );

    expect(res1).not.toBeNull();
    expect(res2).not.toBeNull();

    // Both humans gain LP and MMR together!
    expect(res1!.lpChange).toBeGreaterThan(0);
    expect(res2!.lpChange).toBeGreaterThan(0);
    expect(res1!.user.mmr).toBeGreaterThan(initialMmr1);
    expect(res2!.user.mmr).toBeGreaterThan(initialMmr2);
  });
});
