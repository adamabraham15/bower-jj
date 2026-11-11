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
});
