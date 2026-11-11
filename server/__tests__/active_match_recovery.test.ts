/**
 * BOWER JJ — Stage 4.4.1 Active Match Recovery & Server Restart Resilience Test
 *
 * Verifies that a sudden server restart during an active 4-player match
 * correctly restores full match state from disk and enforces hand privacy upon player reconnect.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RoomManager, ACTIVE_MATCHES_DIR, ClientConnection } from '../roomManager';
import { PlayerPosition, Card } from '../../src/engine/types';
import { getLegalPlays } from '../../src/engine/cards';

function createMockSocket(): any {
  return {
    readyState: 1, // OPEN
    send: () => {},
    on: () => {},
    close: () => {},
  };
}

describe('Stage 4.4.1: Active Match Crash Recovery & Reconnection Suite', () => {
  let rm: RoomManager;
  const testRoomCode = 'RECOV1';

  beforeEach(() => {
    // Clean test snapshots directory
    if (fs.existsSync(ACTIVE_MATCHES_DIR)) {
      const files = fs.readdirSync(ACTIVE_MATCHES_DIR);
      for (const f of files) {
        try { fs.unlinkSync(path.join(ACTIVE_MATCHES_DIR, f)); } catch {}
      }
    }
    rm = new RoomManager();
  });

  afterEach(() => {
    rm.destroy();
    if (fs.existsSync(ACTIVE_MATCHES_DIR)) {
      const files = fs.readdirSync(ACTIVE_MATCHES_DIR);
      for (const f of files) {
        try { fs.unlinkSync(path.join(ACTIVE_MATCHES_DIR, f)); } catch {}
      }
    }
  });

  it('restores all 10 critical match parameters after server restart and protects hand privacy', () => {
    // 1. Setup 4 human players
    const p0Conn: ClientConnection = {
      ws: createMockSocket(),
      userId: 'usr_recov_0',
      username: 'PlayerNorth',
      avatarIcon: '👑',
    };
    const p1Conn: ClientConnection = {
      ws: createMockSocket(),
      userId: 'usr_recov_1',
      username: 'PlayerEast',
      avatarIcon: '🥷',
    };
    const p2Conn: ClientConnection = {
      ws: createMockSocket(),
      userId: 'usr_recov_2',
      username: 'PlayerSouth',
      avatarIcon: '⚡',
    };
    const p3Conn: ClientConnection = {
      ws: createMockSocket(),
      userId: 'usr_recov_3',
      username: 'PlayerWest',
      avatarIcon: '🤠',
    };

    rm.registerConnection(p0Conn.userId, p0Conn);
    rm.registerConnection(p1Conn.userId, p1Conn);
    rm.registerConnection(p2Conn.userId, p2Conn);
    rm.registerConnection(p3Conn.userId, p3Conn);

    const room = rm.createRoom(p0Conn.userId);
    const code = room.code;

    rm.joinRoom(p1Conn.userId, code);
    rm.joinRoom(p2Conn.userId, code);
    rm.joinRoom(p3Conn.userId, code);

    // 2. Start game
    rm.startGame(p0Conn.userId);
    let state = rm.getGameState(code)!;
    expect(state).toBeDefined();

    // 3. Fast-forward through bidding into active playing phase
    // Dealer is state.dealer. The player to dealer's left is (dealer + 1) % 4
    const firstBidder = ((state.dealer + 1) % 4) as PlayerPosition;
    const upCard = state.upCard!;
    expect(upCard).toBeDefined();

    // First bidder orders up the dealer
    const firstBidderConn = [p0Conn, p1Conn, p2Conn, p3Conn][firstBidder];
    rm.handleClientBid(firstBidderConn.userId, 'order_up', upCard.suit, false);

    state = rm.getGameState(code)!;
    expect(state.phase).toBe('dealer_discard');

    // Dealer discards lowest non-trump card
    const dealerConn = [p0Conn, p1Conn, p2Conn, p3Conn][state.dealer];
    const discardCard = state.hands[state.dealer][0];
    rm.handleClientDiscard(dealerConn.userId, discardCard.id);

    state = rm.getGameState(code)!;
    expect(state.phase).toBe('playing');
    expect(state.trumpSuit).toBe(upCard.suit);

    // 4. Lead player plays the first card
    const leadPlayerPos = state.currentTurn;
    const leadConn = [p0Conn, p1Conn, p2Conn, p3Conn][leadPlayerPos];
    const leadLegalPlays = getLegalPlays(state.hands[leadPlayerPos], state.currentTrick, state.trumpSuit!);
    const playedCard = leadLegalPlays[0];

    rm.handleClientPlayCard(leadConn.userId, playedCard.id);

    // Snapshot state in memory before simulating crash
    const statePreRestart = rm.getGameState(code)!;
    const roomPreRestart = rm.getRoom(code)!;

    expect(statePreRestart.currentTrick.cards.length).toBe(1);
    expect(statePreRestart.hands[leadPlayerPos].length).toBe(4);

    // Verify snapshot file exists on disk
    const snapshotFile = path.join(ACTIVE_MATCHES_DIR, `${code}.json`);
    expect(fs.existsSync(snapshotFile)).toBe(true);

    // 5. SIMULATE SUDDEN SERVER CRASH & RESTART
    // Terminate old server instance
    rm.destroy();

    // New server spins up and recovers state
    const restartedServer = new RoomManager();
    const restoredRoom = restartedServer.getRoom(code);
    const restoredState = restartedServer.getGameState(code);

    expect(restoredRoom).toBeDefined();
    expect(restoredState).toBeDefined();

    // 6. VERIFY ALL 10 RESTORATION REQUIREMENTS:
    // 1. Player identities and seats
    expect(restoredRoom!.slots[0]!.username).toBe('PlayerNorth');
    expect(restoredRoom!.slots[1]!.username).toBe('PlayerEast');
    expect(restoredRoom!.slots[2]!.username).toBe('PlayerSouth');
    expect(restoredRoom!.slots[3]!.username).toBe('PlayerWest');
    expect(restoredRoom!.slots[0]!.position).toBe(0);
    expect(restoredRoom!.slots[1]!.position).toBe(1);
    expect(restoredRoom!.slots[2]!.position).toBe(2);
    expect(restoredRoom!.slots[3]!.position).toBe(3);

    // 2. Current dealer
    expect(restoredState!.dealer).toBe(statePreRestart.dealer);

    // 3. Trump suit
    expect(restoredState!.trumpSuit).toBe(statePreRestart.trumpSuit);

    // 4. Bidding state
    expect(restoredState!.callingPlayer).toBe(statePreRestart.callingPlayer);
    expect(restoredState!.callingTeam).toBe(statePreRestart.callingTeam);
    expect(restoredState!.isAlone).toBe(statePreRestart.isAlone);

    // 5. Current trick
    expect(restoredState!.currentTrick.cards.length).toBe(1);
    expect(restoredState!.currentTrick.cards[0].card.id).toBe(playedCard.id);
    expect(restoredState!.currentTrick.cards[0].player).toBe(leadPlayerPos);

    // 6. Previously played cards
    expect(restoredState!.completedTricks.length).toBe(statePreRestart.completedTricks.length);

    // 7. Remaining private hands
    expect(restoredState!.hands[leadPlayerPos].length).toBe(4);
    const nonLead = ((leadPlayerPos + 1) % 4) as PlayerPosition;
    expect(restoredState!.hands[nonLead].length).toBe(5);

    // 8. Scores
    expect(restoredState!.scores).toEqual(statePreRestart.scores);

    // 9. Current turn
    expect(restoredState!.currentTurn).toBe(statePreRestart.currentTurn);

    // 10. Match status
    expect(restoredRoom!.status).toBe('playing');
    expect(restoredState!.phase).toBe('playing');

    // 7. RECONNECTION & HAND PRIVACY TEST
    const p0Messages: any[] = [];
    const p1Messages: any[] = [];

    const p0Reconnected: ClientConnection = {
      ws: {
        readyState: 1,
        send: (msg: string) => p0Messages.push(JSON.parse(msg)),
        on: () => {},
        close: () => {},
      } as any,
      userId: p0Conn.userId,
      username: p0Conn.username,
      avatarIcon: p0Conn.avatarIcon,
    };

    const p1Reconnected: ClientConnection = {
      ws: {
        readyState: 1,
        send: (msg: string) => p1Messages.push(JSON.parse(msg)),
        on: () => {},
        close: () => {},
      } as any,
      userId: p1Conn.userId,
      username: p1Conn.username,
      avatarIcon: p1Conn.avatarIcon,
    };

    const p2Reconnected: ClientConnection = {
      ws: {
        readyState: 1,
        send: () => {},
        on: () => {},
        close: () => {},
      } as any,
      userId: p2Conn.userId,
      username: p2Conn.username,
      avatarIcon: p2Conn.avatarIcon,
    };

    const p3Reconnected: ClientConnection = {
      ws: {
        readyState: 1,
        send: () => {},
        on: () => {},
        close: () => {},
      } as any,
      userId: p3Conn.userId,
      username: p3Conn.username,
      avatarIcon: p3Conn.avatarIcon,
    };

    const reconnectedConns = [p0Reconnected, p1Reconnected, p2Reconnected, p3Reconnected];
    reconnectedConns.forEach((c) => restartedServer.registerConnection(c.userId, c));

    // Check GAME_SYNC sent to P0
    const p0Sync = p0Messages.find(m => m.type === 'GAME_SYNC');
    expect(p0Sync).toBeDefined();
    expect(p0Sync.state.yourPosition).toBe(0);
    // P0 receives only their own 5 or 4 cards
    expect(p0Sync.state.yourHand).toBeDefined();
    expect(p0Sync.state.yourHand.length).toBe(restoredState!.hands[0].length);
    // P0 receives only hand counts for opponents, NOT opponents' cards!
    expect(p0Sync.state.handCounts[1]).toBe(restoredState!.hands[1].length);
    expect(p0Sync.state.handCounts[2]).toBe(restoredState!.hands[2].length);
    expect(p0Sync.state.handCounts[3]).toBe(restoredState!.hands[3].length);
    expect((p0Sync.state as any).hands).toBeUndefined(); // Strict anti-cheat check

    // Check GAME_SYNC sent to P1
    const p1Sync = p1Messages.find(m => m.type === 'GAME_SYNC');
    expect(p1Sync).toBeDefined();
    expect(p1Sync.state.yourPosition).toBe(1);
    expect(p1Sync.state.yourHand.length).toBe(restoredState!.hands[1].length);
    expect((p1Sync.state as any).hands).toBeUndefined(); // Strict anti-cheat check

    // 8. Verify game play continues seamlessly on the restarted server!
    const turnPos = restoredState!.currentTurn;
    const turnConn = reconnectedConns[turnPos];
    const legalPlays = getLegalPlays(restoredState!.hands[turnPos], restoredState!.currentTrick, restoredState!.trumpSuit!);

    expect(() => {
      restartedServer.handleClientPlayCard(turnConn.userId, legalPlays[0].id);
    }).not.toThrow();

    const postPlayState = restartedServer.getGameState(code)!;
    expect(postPlayState.currentTrick.cards.length).toBe(2);

    restartedServer.destroy();
  });
});
