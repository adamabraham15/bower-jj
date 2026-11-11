/**
 * BOWER JJ — Stage 4.3: End-to-End Multi-Player Concurrency Verification & Load Testing
 *
 * Verifies:
 * 1. 4-player live WebSocket match lifecycle with anti-cheat hand privacy & trick resolution.
 * 2. Automated matchmaking queue concurrency (4 humans paired into live match).
 * 3. Multi-room isolation & zero cross-talk across concurrent rooms.
 * 4. Mid-match disconnect resilience, 45s grace period, and seamless reconnection.
 * 5. Sliding-window rate limiting defense against spam / denial-of-service.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { createMultiplayerServer, RunningServer } from '../index';
import { RoomManager } from '../roomManager';
import { db } from '../db';
import { ClientMessage, ServerMessage, SanitizedGameState, UserAccount } from '../types';
import { Card, Suit, PlayerPosition } from '../../src/engine/types';
import { getLegalPlays } from '../../src/engine/cards';

interface ClientHandle {
  ws: WebSocket;
  userId: string;
  username: string;
  messages: ServerMessage[];
  waitFor: <T extends ServerMessage>(predicate: (m: ServerMessage) => boolean, timeoutMs?: number) => Promise<T>;
  waitForNew: <T extends ServerMessage>(predicate: (m: ServerMessage) => boolean, timeoutMs?: number) => Promise<T>;
  send: (msg: ClientMessage) => void;
  close: () => Promise<void>;
  clearMessages: () => void;
}

function getLatestGameSync(client: ClientHandle): SanitizedGameState | null {
  for (let i = client.messages.length - 1; i >= 0; i--) {
    const m = client.messages[i];
    if (m.type === 'GAME_SYNC') return m.state;
  }
  return null;
}

function createClient(port: number): Promise<ClientHandle> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const messages: ServerMessage[] = [];
    const listeners: Array<(msg: ServerMessage) => void> = [];

    ws.on('message', (data) => {
      try {
        const msg: ServerMessage = JSON.parse(data.toString());
        messages.push(msg);
        for (const listener of [...listeners]) {
          listener(msg);
        }
      } catch {
        // ignore non-json
      }
    });

    ws.on('open', () => {
      const handle: ClientHandle = {
        ws,
        userId: '',
        username: '',
        messages,
        clearMessages: () => {
          messages.length = 0;
        },
        send: (msg: ClientMessage) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
          }
        },
        waitFor: <T extends ServerMessage>(predicate: (m: ServerMessage) => boolean, timeoutMs = 6000): Promise<T> => {
          // Check already buffered messages first
          const existing = messages.find(predicate);
          if (existing) {
            return Promise.resolve(existing as T);
          }
          return new Promise<T>((res, rej) => {
            const timer = setTimeout(() => {
              const idx = listeners.indexOf(onMsg);
              if (idx !== -1) listeners.splice(idx, 1);
              rej(new Error(`Timed out waiting for message after ${timeoutMs}ms. Messages received: ${messages.map(m => m.type).join(', ')}`));
            }, timeoutMs);

            function onMsg(m: ServerMessage) {
              if (predicate(m)) {
                clearTimeout(timer);
                const idx = listeners.indexOf(onMsg);
                if (idx !== -1) listeners.splice(idx, 1);
                res(m as T);
              }
            }
            listeners.push(onMsg);
          });
        },
        waitForNew: <T extends ServerMessage>(predicate: (m: ServerMessage) => boolean, timeoutMs = 6000): Promise<T> => {
          return new Promise<T>((res, rej) => {
            const timer = setTimeout(() => {
              const idx = listeners.indexOf(onMsg);
              if (idx !== -1) listeners.splice(idx, 1);
              rej(new Error(`Timed out waiting for new message after ${timeoutMs}ms. Messages: ${messages.map(m => m.type).join(', ')}`));
            }, timeoutMs);

            function onMsg(m: ServerMessage) {
              if (predicate(m)) {
                clearTimeout(timer);
                const idx = listeners.indexOf(onMsg);
                if (idx !== -1) listeners.splice(idx, 1);
                res(m as T);
              }
            }
            listeners.push(onMsg);
          });
        },
        close: () => {
          return new Promise<void>((res) => {
            if (ws.readyState === WebSocket.CLOSED) {
              res();
            } else {
              ws.once('close', () => res());
              ws.terminate();
            }
          });
        },
      };
      resolve(handle);
    });

    ws.on('error', reject);
  });
}

async function authenticateClient(
  handle: ClientHandle,
  username: string,
  avatar: string = '🤠'
): Promise<UserAccount> {
  handle.send({ type: 'AUTH', username, avatarIcon: avatar });
  const authMsg = await handle.waitFor<Extract<ServerMessage, { type: 'AUTH_SUCCESS' }>>(
    m => m.type === 'AUTH_SUCCESS' && (m as any).user?.username === username
  );
  handle.userId = authMsg.user.id;
  handle.username = authMsg.user.username;
  return authMsg.user;
}

describe('Stage 4.3: End-to-End Multi-Player Concurrency Verification & Load Testing', () => {
  let serverInstance: RunningServer;
  let testRm: RoomManager;
  let serverPort: number;

  beforeAll(async () => {
    testRm = new RoomManager();
    // Use fast trick resolution for deterministic, swift tests
    testRm.trickResolutionDelayMs = 40;
    testRm.aiTurnDelayMs = 40;

    serverInstance = await createMultiplayerServer(0, testRm, db);
    serverPort = serverInstance.port;
  });

  afterAll(async () => {
    testRm.destroy();
    await serverInstance.close();
  });

  // =========================================================================
  // 1. LIVE 4-PLAYER MATCH LIFECYCLE & HAND PRIVACY (ANTI-CHEAT)
  // =========================================================================
  it('runs a live 4-player match over WebSockets with strict hand privacy and trick resolution', async () => {
    const clients: ClientHandle[] = [];
    for (let i = 0; i < 4; i++) {
      const c = await createClient(serverPort);
      await authenticateClient(c, `E2E_Player_${i + 1}`, '👑');
      clients.push(c);
    }

    try {
      // Player 0 creates room
      clients[0].send({ type: 'ROOM_CREATE' });
      const created = await clients[0].waitFor<Extract<ServerMessage, { type: 'ROOM_UPDATE' }>>(
        m => m.type === 'ROOM_UPDATE'
      );
      const roomCode = created.room.code;
      expect(roomCode).toHaveLength(6);

      // Players 1, 2, 3 join the room
      for (let i = 1; i < 4; i++) {
        clients[i].send({ type: 'ROOM_JOIN', roomCode });
        await clients[i].waitFor<Extract<ServerMessage, { type: 'ROOM_UPDATE' }>>(
          m => m.type === 'ROOM_UPDATE' && m.yourPosition === i
        );
      }

      // Host starts the game
      clients[0].send({ type: 'ROOM_START' });

      // All 4 players receive initial GAME_SYNC
      const syncMessages: Array<Extract<ServerMessage, { type: 'GAME_SYNC' }>> = [];
      for (let i = 0; i < 4; i++) {
        const sync = await clients[i].waitFor<Extract<ServerMessage, { type: 'GAME_SYNC' }>>(
          m => m.type === 'GAME_SYNC'
        );
        syncMessages.push(sync);
      }

      // ---------------------------------------------------------
      // ANTI-CHEAT INTEGRITY CHECK
      // ---------------------------------------------------------
      for (let i = 0; i < 4; i++) {
        const state = syncMessages[i].state;
        expect(state.yourPosition).toBe(i);
        expect(state.yourHand).toHaveLength(5);
        expect(state.handCounts[i as PlayerPosition]).toBe(5);

        // Scrubbed checks: opponent hand cards must NOT be leaked
        expect((state as any).deck).toBeUndefined();
        expect((state as any).kitty).toBeUndefined();
        expect((state as any).hands).toBeUndefined();

        // Hand uniqueness: Player i's cards must NOT overlap with Player j's cards
        for (let j = 0; j < 4; j++) {
          if (i === j) continue;
          const otherHandIds = new Set(syncMessages[j].state.yourHand.map(c => c.id));
          for (const card of state.yourHand) {
            expect(otherHandIds.has(card.id)).toBe(false);
          }
        }
      }

      // ---------------------------------------------------------
      // BIDDING EXECUTION
      // ---------------------------------------------------------
      let latestSync = syncMessages[0].state;
      expect(latestSync.phase).toBe('bidding_round_1');
      const bidderPos = latestSync.currentTurn;
      const bidderClient = clients[bidderPos];

      // Bidder orders up trump!
      bidderClient.send({
        type: 'GAME_BID',
        bidType: 'order_up',
        alone: false,
      });

      // Dealer receives upCard and needs to discard
      const dealerPos = latestSync.dealer;
      const dealerClient = clients[dealerPos];
      const discardSync = await dealerClient.waitFor<Extract<ServerMessage, { type: 'GAME_SYNC' }>>(
        m => m.type === 'GAME_SYNC' && m.state.phase === 'dealer_discard'
      );

      expect(discardSync.state.phase).toBe('dealer_discard');
      expect(discardSync.state.trumpSuit).toBe(latestSync.upCard?.suit);
      expect(discardSync.state.yourHand.length).toBe(6); // 5 original + upCard

      // Dealer discards 1 card
      const discardCard = discardSync.state.yourHand[0];
      dealerClient.send({
        type: 'GAME_DISCARD',
        cardId: discardCard.id,
      });

      // Phase transitions to 'playing'
      const playSync = await clients[0].waitFor<Extract<ServerMessage, { type: 'GAME_SYNC' }>>(
        m => m.type === 'GAME_SYNC' && m.state.phase === 'playing'
      );
      expect(playSync.state.phase).toBe('playing');
      expect(playSync.state.completedTricksCount).toBe(0);

      // ---------------------------------------------------------
      // TRICK 1 CARD PLAY (All 4 players play 1 legal card each)
      // ---------------------------------------------------------
      let currentGameState = playSync.state;

      for (let step = 0; step < 4; step++) {
        const turnPos = currentGameState.currentTurn;
        const turnClient = clients[turnPos];

        // Get the latest hand for this turn's player
        const mySync = getLatestGameSync(turnClient);
        const myHand = mySync?.yourHand || [];
        expect(myHand.length).toBeGreaterThan(0);

        // Find a legal card to play
        const trump = currentGameState.trumpSuit!;
        const legalCards = getLegalPlays(myHand, currentGameState.currentTrick, trump);
        expect(legalCards.length).toBeGreaterThan(0);

        const cardToPlay = legalCards[0];

        // Prepare promise for next sync on clients[0] BEFORE sending card play
        const nextSyncPromise = step < 3
          ? clients[0].waitForNew<Extract<ServerMessage, { type: 'GAME_SYNC' }>>(
              m => m.type === 'GAME_SYNC' && m.state.currentTrick.cards.length === step + 1
            )
          : clients[0].waitForNew<Extract<ServerMessage, { type: 'GAME_SYNC' }>>(
              m => m.type === 'GAME_SYNC' && m.state.completedTricksCount === 1,
              4000
            );

        // Send card play
        turnClient.send({
          type: 'GAME_PLAY_CARD',
          cardId: cardToPlay.id,
        });

        // Wait for server to process and broadcast
        const nextSync = await nextSyncPromise;
        currentGameState = nextSync.state;
      }

      expect(currentGameState.completedTricksCount).toBe(1);
      const [team1Tricks, team2Tricks] = currentGameState.tricksWon;
      expect(team1Tricks + team2Tricks).toBe(1);
    } finally {
      await Promise.all(clients.map(c => c.close()));
    }
  }, 15000);

  // =========================================================================
  // 2. CONCURRENT MATCHMAKING QUEUE (4 HUMANS PAIRED AUTOMATICALLY)
  // =========================================================================
  it('pairs 4 concurrent queueing humans into a matchmade game and tracks composition stats', async () => {
    const queueClients: ClientHandle[] = [];
    for (let i = 0; i < 4; i++) {
      const c = await createClient(serverPort);
      await authenticateClient(c, `Queue_Human_${i + 1}_${Date.now()}`, '🤖');
      queueClients.push(c);
    }

    try {
      const statsBefore = db.getMatchmakingStats();

      // All 4 enter the queue
      for (const c of queueClients) {
        c.send({ type: 'QUEUE_ENTER', mode: 'casual' });
      }

      // RoomManager matchmaking loop will group all 4
      const gameSyncs = await Promise.all(
        queueClients.map(c =>
          c.waitFor<Extract<ServerMessage, { type: 'GAME_SYNC' }>>(
            m => m.type === 'GAME_SYNC',
            4000
          )
        )
      );

      // Verify all 4 players got seated and started
      for (let i = 0; i < 4; i++) {
        expect(gameSyncs[i].state.yourHand).toHaveLength(5);
      }

      // Verify match composition recorded 4-human match
      const statsAfter = db.getMatchmakingStats();
      expect(statsAfter.fourHumans).toBeGreaterThanOrEqual(statsBefore.fourHumans + 1);
    } finally {
      await Promise.all(queueClients.map(c => c.close()));
    }
  });

  // =========================================================================
  // 3. MULTI-ROOM ISOLATION & ZERO EVENT LEAKAGE
  // =========================================================================
  it('runs multiple rooms concurrently with 100% channel isolation and zero cross-talk', async () => {
    const roomAClients: ClientHandle[] = [];
    const roomBClients: ClientHandle[] = [];

    for (let i = 0; i < 4; i++) {
      const ca = await createClient(serverPort);
      await authenticateClient(ca, `Alpha_P${i + 1}`, '⚡');
      roomAClients.push(ca);

      const cb = await createClient(serverPort);
      await authenticateClient(cb, `Beta_P${i + 1}`, '🐉');
      roomBClients.push(cb);
    }

    try {
      // Room A Setup
      roomAClients[0].send({ type: 'ROOM_CREATE' });
      const roomAData = await roomAClients[0].waitFor<Extract<ServerMessage, { type: 'ROOM_UPDATE' }>>(
        m => m.type === 'ROOM_UPDATE'
      );
      const codeA = roomAData.room.code;

      for (let i = 1; i < 4; i++) {
        roomAClients[i].send({ type: 'ROOM_JOIN', roomCode: codeA });
        await roomAClients[i].waitFor(m => m.type === 'ROOM_UPDATE' && (m as any).yourPosition === i);
      }

      // Room B Setup
      roomBClients[0].send({ type: 'ROOM_CREATE' });
      const roomBData = await roomBClients[0].waitFor<Extract<ServerMessage, { type: 'ROOM_UPDATE' }>>(
        m => m.type === 'ROOM_UPDATE'
      );
      const codeB = roomBData.room.code;
      expect(codeA).not.toBe(codeB);

      for (let i = 1; i < 4; i++) {
        roomBClients[i].send({ type: 'ROOM_JOIN', roomCode: codeB });
        await roomBClients[i].waitFor(m => m.type === 'ROOM_UPDATE' && (m as any).yourPosition === i);
      }

      // Start both rooms
      roomAClients[0].send({ type: 'ROOM_START' });
      roomBClients[0].send({ type: 'ROOM_START' });

      await Promise.all([
        ...roomAClients.map(c => c.waitFor(m => m.type === 'GAME_SYNC')),
        ...roomBClients.map(c => c.waitFor(m => m.type === 'GAME_SYNC')),
      ]);

      // Clear all incoming messages
      roomAClients.forEach(c => c.clearMessages());
      roomBClients.forEach(c => c.clearMessages());

      // Room A Player 0 sends an Emote
      const emoteText = `ALPHA_EXCLUSIVE_${Date.now()}`;
      roomAClients[0].send({
        type: 'SEND_EMOTE',
        text: emoteText,
        emoji: '🔥',
      });

      // Verify all Room A players receive EMOTE_BROADCAST
      const roomAEmotes = await Promise.all(
        roomAClients.map(c =>
          c.waitFor<Extract<ServerMessage, { type: 'EMOTE_BROADCAST' }>>(
            m => m.type === 'EMOTE_BROADCAST' && m.text === emoteText,
            2000
          )
        )
      );
      expect(roomAEmotes).toHaveLength(4);

      // Verify ZERO Room B players received this broadcast (Channel Isolation)
      for (const bClient of roomBClients) {
        const leaked = bClient.messages.find(
          m => m.type === 'EMOTE_BROADCAST' && (m as any).text === emoteText
        );
        expect(leaked).toBeUndefined();
      }
    } finally {
      await Promise.all([
        ...roomAClients.map(c => c.close()),
        ...roomBClients.map(c => c.close()),
      ]);
    }
  });

  // =========================================================================
  // 4. MID-MATCH DISCONNECT RESILIENCE & SEAMLESS RECONNECTION
  // =========================================================================
  it('handles mid-game client disconnection, alerts remaining players, and restores hand on reconnection', async () => {
    const clients: ClientHandle[] = [];
    for (let i = 0; i < 4; i++) {
      const c = await createClient(serverPort);
      await authenticateClient(c, `Recon_Player_${i + 1}`, '🎩');
      clients.push(c);
    }

    try {
      clients[0].send({ type: 'ROOM_CREATE' });
      const created = await clients[0].waitFor<Extract<ServerMessage, { type: 'ROOM_UPDATE' }>>(
        m => m.type === 'ROOM_UPDATE'
      );
      const code = created.room.code;

      for (let i = 1; i < 4; i++) {
        clients[i].send({ type: 'ROOM_JOIN', roomCode: code });
        await clients[i].waitFor(m => m.type === 'ROOM_UPDATE' && (m as any).yourPosition === i);
      }

      clients[0].send({ type: 'ROOM_START' });

      // Wait for game start and record Player 2's cards
      const p2Sync = await clients[1].waitFor<Extract<ServerMessage, { type: 'GAME_SYNC' }>>(
        m => m.type === 'GAME_SYNC'
      );
      const originalP2HandIds = p2Sync.state.yourHand.map(c => c.id);
      expect(originalP2HandIds).toHaveLength(5);

      // Clear previous messages
      clients[0].clearMessages();
      clients[2].clearMessages();
      clients[3].clearMessages();

      // SIMULATE DISCONNECT: Player 2 (index 1) drops connection suddenly
      await clients[1].close();

      // Remaining players (0, 2, 3) receive DISCONNECT_ALERT
      const alert = await clients[0].waitFor<Extract<ServerMessage, { type: 'DISCONNECT_ALERT' }>>(
        m => m.type === 'DISCONNECT_ALERT' && m.position === 1,
        3000
      );
      expect(alert.graceRemainingSec).toBe(45);
      expect(alert.username).toBe('Recon_Player_2');

      // SIMULATE RECONNECTION: Player 2 reconnects on fresh socket
      const reconnectedP2 = await createClient(serverPort);
      await authenticateClient(reconnectedP2, 'Recon_Player_2', '🎩');

      // Player 2 receives restored GAME_SYNC with their identical hand!
      const restoredSync = await reconnectedP2.waitFor<Extract<ServerMessage, { type: 'GAME_SYNC' }>>(
        m => m.type === 'GAME_SYNC' && m.state.yourPosition === 1,
        3000
      );

      expect(restoredSync.state.yourPosition).toBe(1);
      const restoredHandIds = restoredSync.state.yourHand.map(c => c.id);
      expect(restoredHandIds).toEqual(originalP2HandIds);

      await reconnectedP2.close();
    } finally {
      await Promise.all(clients.map(c => c.close()));
    }
  }, 15000);

  // =========================================================================
  // 5. SLIDING-WINDOW RATE LIMITING & DOS DEFENSE
  // =========================================================================
  it('throttles rapid-fire client bursts exceeding 40 messages per 2 seconds', async () => {
    const spammer = await createClient(serverPort);
    await authenticateClient(spammer, 'SpamTester', '👾');

    try {
      // Rapidly burst 50 messages
      for (let i = 0; i < 50; i++) {
        spammer.send({ type: 'SEND_EMOTE', text: `spam_${i}` });
      }

      // Server must reply with rate limit error
      const rateLimitError = await spammer.waitFor<Extract<ServerMessage, { type: 'ERROR' }>>(
        m => m.type === 'ERROR' && m.message.includes('Rate limit exceeded'),
        2000
      );
      expect(rateLimitError.message).toContain('Rate limit exceeded');

      // Concurrently, a legitimate client can connect and operate normally
      const legit = await createClient(serverPort);
      await authenticateClient(legit, 'LegitUser', '👑');
      legit.send({ type: 'GET_FRIENDS' });
      const friendsMsg = await legit.waitFor(m => m.type === 'FRIENDS_LIST', 2000);
      expect(friendsMsg.type).toBe('FRIENDS_LIST');

      await legit.close();
    } finally {
      await spammer.close();
    }
  });
});
