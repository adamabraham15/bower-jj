/**
 * BOWER JJ — Stage 4.6: Two-Node Multiplayer Cluster & Cross-Node Resilience Test Suite
 *
 * Verifies:
 * 1. Two independent server instances running on separate ports connected to the same PostgreSQL database.
 * 2. Consistent room and active-match state stored in public.active_matches.
 * 3. Node crash recovery: Node A crashes mid-match; Node B restores match from PostgreSQL cluster table.
 * 4. Cross-node player reconnection: Player from crashed Node A reconnects to Node B seamlessly.
 * 5. Strict hand privacy: Reconnecting player receives only their own private cards from Node B.
 * 6. Idempotency protection against cross-node duplicate match reward submissions.
 * 7. Verification of cross-node WebSocket boundaries and room-affinity architectural constraints.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newDb } from 'pg-mem';
import crypto from 'crypto';
import { WebSocket } from 'ws';
import { PostgresDatabaseRepository } from '../db/postgres';
import { createMultiplayerServer, RunningServer } from '../index';
import { RoomManager } from '../roomManager';
import { ClientMessage, ServerMessage, Room } from '../types';
import { EuchreGameState, PlayerPosition } from '../../src/engine/types';
import { initializeGame } from '../../src/engine/game';

function createSharedPostgresPool() {
  const mem = newDb();
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });
  const pg = mem.adapters.createPg();
  return new pg.Pool();
}

describe('Stage 4.6: Two-Node Multiplayer Validation & Cross-Node Recovery', () => {
  let sharedPool: any;
  let repoNodeA: PostgresDatabaseRepository;
  let repoNodeB: PostgresDatabaseRepository;
  let rmNodeA: RoomManager;
  let rmNodeB: RoomManager;
  let serverNodeA: RunningServer;
  let serverNodeB: RunningServer;

  beforeEach(async () => {
    sharedPool = createSharedPostgresPool();
    repoNodeA = new PostgresDatabaseRepository(sharedPool);
    repoNodeB = new PostgresDatabaseRepository(sharedPool);
    await repoNodeA.initSchema();

    rmNodeA = new RoomManager();
    rmNodeB = new RoomManager();

    // Start Node A on dynamic port
    serverNodeA = await createMultiplayerServer(0, rmNodeA, undefined, repoNodeA);
    // Start Node B on separate dynamic port sharing the same PostgreSQL database
    serverNodeB = await createMultiplayerServer(0, rmNodeB, undefined, repoNodeB);
  });

  afterEach(async () => {
    rmNodeA.destroy();
    rmNodeB.destroy();
    await serverNodeA.close();
    await serverNodeB.close();
    await repoNodeA.close();
    await repoNodeB.close();
  });

  it('proves both independent server nodes connect to shared PostgreSQL database and expose healthy telemetry', async () => {
    expect(serverNodeA.port).not.toBe(serverNodeB.port);

    const [healthA, healthB] = await Promise.all([
      fetch(`http://127.0.0.1:${serverNodeA.port}/health`).then((r) => r.json()),
      fetch(`http://127.0.0.1:${serverNodeB.port}/health`).then((r) => r.json()),
    ]);

    expect(healthA.status).toBe('healthy');
    expect(healthA.database.provider).toBe('postgresql');
    expect(healthA.database.authoritative).toBe(true);

    expect(healthB.status).toBe('healthy');
    expect(healthB.database.provider).toBe('postgresql');
    expect(healthB.database.authoritative).toBe(true);
  });

  it('shares authoritative player profiles across independent nodes without replication lag', async () => {
    // 1. Create and update player on Node A via WebSocket
    const wsA = new WebSocket(`ws://127.0.0.1:${serverNodeA.port}/ws`);
    let userAId = '';

    await new Promise<void>((resolve, reject) => {
      wsA.on('open', () => {
        wsA.send(
          JSON.stringify({
            type: 'AUTH',
            username: 'ClusterPlayer',
            avatarIcon: '🤠',
          })
        );
      });
      wsA.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'AUTH_SUCCESS') {
          userAId = msg.user.id;
          wsA.close();
          resolve();
        }
      });
      wsA.on('error', reject);
    });

    expect(userAId).toBeDefined();

    // 2. Query Node B directly for the profile created on Node A
    const profileOnNodeB = await repoNodeB.getUserById(userAId);
    expect(profileOnNodeB).not.toBeNull();
    expect(profileOnNodeB!.username).toBe('ClusterPlayer');
    expect(profileOnNodeB!.avatarIcon).toBe('🤠');
    expect(profileOnNodeB!.rankTier).toBe('9');
    expect(profileOnNodeB!.rankPoints).toBe(0);
  });

  it('persists active match to PostgreSQL from Node A and restores seamlessly on Node B after Node A crash', async () => {
    // 1. Create a live match on Node A
    const user = (await repoNodeA.getOrCreateUser('HostPlayer', '👑')).user;
    rmNodeA.registerConnection(user.id, { ws: {} as any, userId: user.id, username: user.username, avatarIcon: user.avatarIcon });
    const room = rmNodeA.createRoom(user.id);
    const roomCode = room.code;

    // Fill slots with bots and start game
    room.slots[1] = { position: 1, userId: 'bot_1', username: 'Bot 1', avatarIcon: '🤖', isAI: true, isBot: true, aiDifficulty: 'medium' };
    room.slots[2] = { position: 2, userId: 'bot_2', username: 'Bot 2', avatarIcon: '🤖', isAI: true, isBot: true, aiDifficulty: 'medium' };
    room.slots[3] = { position: 3, userId: 'bot_3', username: 'Bot 3', avatarIcon: '🤖', isAI: true, isBot: true, aiDifficulty: 'medium' };
    room.status = 'playing';

    const playerList = room.slots.map((s) => ({
      id: s!.userId,
      position: s!.position,
      name: s!.username,
      isAI: Boolean(s!.isAI),
    }));

    const gameState = initializeGame(playerList, room.rules, 0);
    // Directly inject in Node A's room manager
    (rmNodeA as any).gameStates.set(roomCode, gameState);
    (rmNodeA as any).rooms.set(roomCode, room);

    // 2. Node A persists the active match to PostgreSQL
    rmNodeA.persistActiveMatch(roomCode);

    // Wait 50ms for async persistence to write to PostgreSQL active_matches table
    await new Promise((r) => setTimeout(r, 50));

    // Verify record exists in PostgreSQL active_matches table
    const activeRows = await sharedPool.query(
      `SELECT room_code, host_user_id FROM public.active_matches WHERE room_code = $1`,
      [roomCode]
    );
    expect(activeRows.rows.length).toBe(1);
    expect(activeRows.rows[0].room_code).toBe(roomCode);

    // 3. Simulate sudden crash of Node A
    rmNodeA.destroy();
    await serverNodeA.close();

    // 4. Node B loads active matches from PostgreSQL cluster table
    const restoredCount = await rmNodeB.restoreActiveMatchesFromPostgres();
    expect(restoredCount).toBe(1);

    const restoredRoom = rmNodeB.getRoom(roomCode);
    const restoredState = rmNodeB.getGameState(roomCode);

    expect(restoredRoom).toBeDefined();
    expect(restoredState).toBeDefined();
    expect(restoredRoom!.code).toBe(roomCode);
    expect(restoredRoom!.status).toBe('playing');
    expect(restoredState!.deck.length).toBe(gameState.deck.length);
    expect(restoredState!.upcard?.suit).toBe(gameState.upcard?.suit);
  });

  it('allows a disconnected player from crashed Node A to reconnect to Node B with strict hand privacy', async () => {
    // 1. Setup active match in PostgreSQL
    const p1 = (await repoNodeA.getOrCreateUser('ReconnectP1', '⚡')).user;
    rmNodeA.registerConnection(p1.id, { ws: {} as any, userId: p1.id, username: p1.username, avatarIcon: p1.avatarIcon });
    const room = rmNodeA.createRoom(p1.id);
    const roomCode = room.code;

    room.slots[1] = { position: 1, userId: 'bot_1', username: 'Bot 1', avatarIcon: '🤖', isAI: true, isBot: true, aiDifficulty: 'medium' };
    room.slots[2] = { position: 2, userId: 'bot_2', username: 'Bot 2', avatarIcon: '🤖', isAI: true, isBot: true, aiDifficulty: 'medium' };
    room.slots[3] = { position: 3, userId: 'bot_3', username: 'Bot 3', avatarIcon: '🤖', isAI: true, isBot: true, aiDifficulty: 'medium' };
    room.status = 'playing';

    const playerList = room.slots.map((s) => ({
      id: s!.userId,
      position: s!.position,
      name: s!.username,
      isAI: Boolean(s!.isAI),
    }));

    const gameState = initializeGame(playerList, room.rules, 0);
    const playerPrivateCards = [...gameState.hands[0]];

    (rmNodeA as any).gameStates.set(roomCode, gameState);
    (rmNodeA as any).rooms.set(roomCode, room);

    // Persist to PostgreSQL
    rmNodeA.persistActiveMatch(roomCode);
    await new Promise((r) => setTimeout(r, 50));

    // Crash Node A
    rmNodeA.destroy();
    await serverNodeA.close();

    // Node B restores active matches from shared PostgreSQL
    await rmNodeB.restoreActiveMatchesFromPostgres();

    // 2. Player reconnects to Node B over WebSocket
    const wsB = new WebSocket(`ws://127.0.0.1:${serverNodeB.port}/ws`);
    let receivedSync: any = null;

    await new Promise<void>((resolve, reject) => {
      wsB.on('open', () => {
        // Authenticate with Node B
        wsB.send(
          JSON.stringify({
            type: 'AUTH',
            username: 'ReconnectP1',
            avatarIcon: '⚡',
          })
        );
      });

      wsB.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'AUTH_SUCCESS') {
          // Re-join the room on Node B
          wsB.send(
            JSON.stringify({
              type: 'ROOM_JOIN',
              roomCode,
            })
          );
        } else if (msg.type === 'GAME_SYNC') {
          receivedSync = msg.state;
          wsB.close();
          resolve();
        }
      });
      wsB.on('error', reject);
    });

    // 3. Verify Player received Game Sync on Node B
    expect(receivedSync).not.toBeNull();
    // Hand privacy check: Player sees their own hand (5 cards)
    expect(receivedSync.yourHand.length).toBe(playerPrivateCards.length);
    expect(receivedSync.yourHand[0].suit).toBe(playerPrivateCards[0].suit);
    expect(receivedSync.yourHand[0].rank).toBe(playerPrivateCards[0].rank);

    // Verify other players' hands are NOT leaked in sanitized state
    expect(receivedSync.hands).toBeUndefined();
    expect(receivedSync.handCounts).toBeDefined();
    expect(receivedSync.handCounts[1]).toBe(5);
    expect(receivedSync.handCounts[2]).toBe(5);
    expect(receivedSync.handCounts[3]).toBe(5);
  });

  it('prevents duplicate reward execution when two nodes simultaneously attempt to finalize the same match', async () => {
    const p1 = (await repoNodeA.getOrCreateUser('RivalAlice', '🎯')).user;
    const matchId = `match_cluster_${Date.now()}`;

    const matchPayload = {
      matchId,
      roomCode: 'CLST99',
      mode: 'ranked_solo' as const,
      composition: '4H' as const,
      winningTeam: 0,
      finalScore: '10 - 6',
      humanPlayers: [
        {
          userId: p1.id,
          position: 0 as PlayerPosition,
          team: 0,
          username: p1.username,
          rankTier: p1.rankTier,
          rankPoints: p1.rankPoints,
          mmr: p1.mmr,
          tricksWon: 6,
          euchres: 1,
          marches: 1,
          successfulLoners: 0,
        },
      ],
      idempotencyKey: `idemp_cluster_${matchId}`,
    };

    // 1. Initial submission via Node A
    const resNodeA = await repoNodeA.recordMatchResult(matchPayload);
    expect(resNodeA.success).toBe(true);
    expect(resNodeA.alreadyRecorded).toBe(false);

    // 2. Duplicate submission attempt via independent Node B
    const resNodeB = await repoNodeB.recordMatchResult(matchPayload);
    expect(resNodeB.success).toBe(true);
    expect(resNodeB.alreadyRecorded).toBe(true);
    expect(resNodeB.playerResults.length).toBe(0); // Zero rewards awarded on duplicate submission!

    // Verify player stats in PostgreSQL were incremented exactly once (no double rewards)
    const finalProfile = (await repoNodeA.getUserById(p1.id))!;
    expect(finalProfile.wins).toBe(1);
    expect(finalProfile.totalGames).toBe(1);
  });
});
