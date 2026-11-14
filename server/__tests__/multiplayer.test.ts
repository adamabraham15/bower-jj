/**
 * BOWER JJ — Multiplayer Authoritative Server Tests
 */

import { describe, it, expect } from 'vitest';
import { RoomManager } from '../roomManager';
import { db } from '../db';
import { DEFAULT_RULES, Player } from '../../src/engine/types';
import { initializeGame } from '../../src/engine/game';

describe('Multiplayer Server & Anti-Cheat Architecture', () => {
  it('strictly sanitizes game state so opponents hands cannot be snooped over the network', () => {
    const roomMgr = new RoomManager();

    const players: Player[] = [
      { id: 'usr_0', name: 'Alice', position: 0, isAI: false, avatarId: '🤠' },
      { id: 'usr_1', name: 'Bob', position: 1, isAI: false, avatarId: '🤖' },
      { id: 'usr_2', name: 'Charlie', position: 2, isAI: false, avatarId: '🧝' },
      { id: 'usr_3', name: 'Dave', position: 3, isAI: false, avatarId: '👽' },
    ];

    const state = initializeGame(players, DEFAULT_RULES, 0);

    const slots = players.map(p => ({
      position: p.position,
      isAI: false,
      userId: p.id,
      username: p.name,
      avatarIcon: p.avatarId,
      connected: true,
      isReady: true,
    }));

    // Generate sanitized state specifically for Alice (Position 0)
    const aliceState = roomMgr.getSanitizedStateForPlayer(state, slots, 0);

    // 1. Alice receives her own cards
    expect(aliceState.yourPosition).toBe(0);
    expect(aliceState.yourHand.length).toBe(5);
    expect(aliceState.yourHand[0].rank).toBeDefined();

    // 2. Opponents' hands do NOT exist on aliceState! Only counts
    expect((aliceState as any).hands).toBeUndefined(); // True secret hands object stripped!
    expect(aliceState.handCounts[0]).toBe(5);
    expect(aliceState.handCounts[1]).toBe(5);
    expect(aliceState.handCounts[2]).toBe(5);
    expect(aliceState.handCounts[3]).toBe(5);

    // 3. Deck and secret kitty are stripped
    expect((aliceState as any).deck).toBeUndefined();
    expect((aliceState as any).kitty).toBeUndefined();
    expect(aliceState.upCard).toBeDefined(); // Only public turned up card is revealed

    roomMgr.cleanup();
  });

  it('correctly creates user accounts and awards server-authoritative XP and level ups', () => {
    const testUsername = `TestPlayer_${Math.random().toString(36).substring(7)}`;
    const { user, sessionToken } = db.getOrCreateUser(testUsername, '👑');
    expect(user.username).toBe(testUsername);
    expect(user.level).toBe(1);
    expect(user.xp).toBe(0);
    expect(sessionToken).toBeDefined();

    // Award a match victory: 2 tricks, 0 march (base 250 + win 150 + 2*25 = 450 XP)
    const updated = db.recordMatchCompletion(user.id, true, 2, 0, 0, 0);
    expect(updated).not.toBeNull();
    expect(updated!.wins).toBe(1);
    expect(updated!.totalGames).toBe(1);
    expect(updated!.tricksWon).toBe(2);
    expect(updated!.xp).toBe(450);

    // Second match victory: 600 match XP + 600 Challenge 4 ("Win 2 matches") = 1650 XP total
    // 1650 - 1000 = 650 XP into Level 2!
    const secondWin = db.recordMatchCompletion(user.id, true, 8, 0, 0, 0);
    expect(secondWin!.level).toBe(2);
    expect(secondWin!.xp).toBe(650);
  });

  it('allows players to join custom rooms and switch seats between Blue and Red teams', () => {
    const roomMgr = new RoomManager();
    const mockWs1: any = { readyState: 1, send: () => {} };
    const mockWs2: any = { readyState: 1, send: () => {} };

    // Register connections for Host (Alice) and Guest (Bob)
    roomMgr.registerConnection('user_alice', { ws: mockWs1, userId: 'user_alice', username: 'Alice', avatarIcon: '🤠' });
    roomMgr.registerConnection('user_bob', { ws: mockWs2, userId: 'user_bob', username: 'Bob', avatarIcon: '🤖' });

    // Alice creates a custom room
    const room = roomMgr.createRoom('user_alice');
    expect(room.slots[0]?.username).toBe('Alice');
    expect(room.slots[0]?.position).toBe(0); // Blue Team (South)

    // Bob joins Alice's room
    const joinedRoom = roomMgr.joinRoom('user_bob', room.code);
    expect(joinedRoom.slots[1]?.username).toBe('Bob');
    expect(joinedRoom.slots[1]?.position).toBe(1); // Red Team (West)

    // Bob switches seats to empty Seat 2 (Partner on Blue Team with Alice)
    const switchedRoom = roomMgr.switchSeat('user_bob', 2);
    expect(switchedRoom.slots[1]).toBeNull();
    expect(switchedRoom.slots[2]?.username).toBe('Bob');
    expect(switchedRoom.slots[2]?.position).toBe(2); // Blue Team (North)

    // Alice swaps seats with Bob (Alice moves to Seat 2, Bob moves to Seat 0)
    const swappedRoom = roomMgr.switchSeat('user_alice', 2);
    expect(swappedRoom.slots[0]?.username).toBe('Bob');
    expect(swappedRoom.slots[0]?.position).toBe(0);
    expect(swappedRoom.slots[2]?.username).toBe('Alice');
    expect(swappedRoom.slots[2]?.position).toBe(2);

    // Bob switches from Blue Team (Seat 0) to Red Team (Seat 3)
    const redRoom = roomMgr.switchSeat('user_bob', 3);
    expect(redRoom.slots[0]).toBeNull();
    expect(redRoom.slots[3]?.username).toBe('Bob');
    expect(redRoom.slots[3]?.position).toBe(3); // Red Team (East)

    roomMgr.cleanup();
  });

  it('correctly handles Friendly Rivalry room seating and side swapping', () => {
    const roomMgr = new RoomManager();
    const mockWs1: any = { readyState: 1, send: () => {} };
    const mockWs2: any = { readyState: 1, send: () => {} };

    roomMgr.registerConnection('user_host', { ws: mockWs1, userId: 'user_host', username: 'HostRival', avatarIcon: '👑' });
    roomMgr.registerConnection('user_guest', { ws: mockWs2, userId: 'user_guest', username: 'GuestRival', avatarIcon: '⚔️' });

    // Host creates rivals room
    const room = roomMgr.createRivalsRoom('user_host');
    expect(room.queueMode).toBe('rivals');
    expect(room.slots[0]?.username).toBe('HostRival'); // Team Blue

    // Guest joins rivals room -> must be assigned Seat 1 (Team Red)
    const joinedRoom = roomMgr.joinRoom('user_guest', room.code);
    expect(joinedRoom.slots[1]?.username).toBe('GuestRival'); // Team Red

    // Guest swaps sides with Host (Seat 1 <-> Seat 0)
    const swapped = roomMgr.switchSeat('user_guest', 0);
    expect(swapped.slots[0]?.username).toBe('GuestRival'); // Now Blue
    expect(swapped.slots[1]?.username).toBe('HostRival');  // Now Red

    // Host updates room mode from 'rivals' to 'custom' right inside the lobby
    const updatedModeRoom = roomMgr.updateRoomMode('user_host', 'custom');
    expect(updatedModeRoom.queueMode).toBe('custom');

    // Host switches mode back to 'rivals'
    const backToRivals = roomMgr.updateRoomMode('user_host', 'rivals');
    expect(backToRivals.queueMode).toBe('rivals');

    roomMgr.cleanup();
  });

  it('randomizes starting dealer across new multiplayer games and allows benched dealer discard', () => {
    const roomMgr = new RoomManager();
    const mockWs: any = { readyState: 1, send: () => {} };
    const users = ['u0', 'u1', 'u2', 'u3'];
    users.forEach((uid, idx) => {
      roomMgr.registerConnection(uid, { ws: mockWs, userId: uid, username: `Player${idx}`, avatarIcon: '🤠' });
    });

    const dealersSeen = new Set<number>();
    for (let trial = 0; trial < 32; trial++) {
      const room = roomMgr.createRoom('u0', 'custom');
      roomMgr.joinRoom('u1', room.code);
      roomMgr.joinRoom('u2', room.code);
      roomMgr.joinRoom('u3', room.code);
      roomMgr.startGame('u0');
      const state = roomMgr.getGameState(room.code)!;
      dealersSeen.add(state.dealer);
      expect(state.currentTurn).toBe((state.dealer + 1) % 4);
      users.forEach(uid => roomMgr.leaveRoom(uid));
      roomMgr.clearActiveMatchSnapshot(room.code);
    }
    expect(dealersSeen.size).toBeGreaterThan(1);

    // Verify partner ordering up dealer alone allows dealer discard to proceed without stalling
    const room = roomMgr.createRoom('u0', 'custom');
    roomMgr.joinRoom('u1', room.code);
    roomMgr.joinRoom('u2', room.code);
    roomMgr.joinRoom('u3', room.code);
    roomMgr.startGame('u0', 0); // Deterministic dealer seat 0 for Canadian Loner flow test

    roomMgr.handleClientBid('u1', 'pass');
    roomMgr.handleClientBid('u2', 'order_up', undefined, true); // Partner orders up Seat 0 alone

    const discardState = roomMgr.getGameState(room.code)!;
    expect(discardState.phase).toBe('dealer_discard');
    expect(discardState.benchedPlayer).toBe(0);
    expect(discardState.currentTurn).toBe(0);
    expect(discardState.hands[0]).toHaveLength(6);

    roomMgr.handleClientDiscard('u0', discardState.hands[0][0].id);

    const playingState = roomMgr.getGameState(room.code)!;
    expect(playingState.phase).toBe('playing');
    expect(playingState.hands[0]).toHaveLength(5);
    expect(playingState.currentTurn).toBe(1);

    roomMgr.clearActiveMatchSnapshot(room.code);
    roomMgr.cleanup();
  });
});
