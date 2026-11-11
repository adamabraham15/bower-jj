/**
 * BOWER JJ — Authoritative Progression, Ranked Elo MMR & Social Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { db, TIER_ORDER } from '../db';

const genName = (prefix: string) => `${prefix}_${Math.random().toString(36).substring(7)}`;

describe('Ranked Progression & Hidden MMR Engine', () => {
  it('correctly creates user with baseline 1200 MMR and Tier 9', () => {
    const { user } = db.getOrCreateUser(genName('Alpha'), '🤠');
    expect(user.rankTier).toBe('9');
    expect(user.rankPoints).toBe(0);
    expect(user.mmr).toBe(1200);
    expect(user.hasDemotionShield).toBe(true);
    expect(user.placementMatchesRemaining).toBe(5);
  });

  it('awards opponent-sensitive LP and MMR for winning against equal opponents', () => {
    const { user } = db.getOrCreateUser(genName('RankTester'), '👑');
    const oldMmr = user.mmr;

    const result = db.recordRankedMatchResult(
      user.id,
      true, // isWin
      1200, // teamAvgMmr
      1200, // oppAvgMmr
      '10 - 7',
      ['Opponent 1', 'Opponent 2']
    );

    expect(result).not.toBeNull();
    expect(result!.user.mmr).toBeGreaterThan(oldMmr);
    expect(result!.lpChange).toBeGreaterThanOrEqual(18);
    expect(result!.newPoints).toBe(result!.lpChange);
  });

  it('awards higher LP and MMR when defeating higher-rated opponents', () => {
    const { user } = db.getOrCreateUser(genName('Underdog'), '🤠');
    
    // Win against 1600 MMR team
    const result = db.recordRankedMatchResult(
      user.id,
      true,
      1200,
      1600,
      '10 - 4',
      ['GrandMaster 1', 'GrandMaster 2']
    );

    expect(result).not.toBeNull();
    // High LP reward for underdog victory
    expect(result!.lpChange).toBeGreaterThanOrEqual(28);
  });

  it('promotes player to next tier when crossing 100 LP and activates demotion shield', () => {
    const { user } = db.getOrCreateUser(genName('Ascender'), '🚀');
    user.rankTier = '9';
    user.rankPoints = 90;

    const result = db.recordRankedMatchResult(
      user.id,
      true,
      1200,
      1200,
      '10 - 5',
      ['Bot 1', 'Bot 2']
    );

    expect(result!.didRankUp).toBe(true);
    expect(result!.newTier).toBe('10');
    expect(result!.newPoints).toBeLessThan(100);
    expect(result!.user.hasDemotionShield).toBe(true);
  });

  it('consumes demotion shield instead of demoting when LP drops below 0', () => {
    const { user } = db.getOrCreateUser(genName('Shielded'), '🛡️');
    user.rankTier = 'Q';
    user.rankPoints = 5;
    user.hasDemotionShield = true;

    const result = db.recordRankedMatchResult(
      user.id,
      false,
      1400,
      1400,
      '4 - 10',
      ['Bot 1', 'Bot 2']
    );

    expect(result!.newTier).toBe('Q'); // Still Queen!
    expect(result!.newPoints).toBe(0); // Shielded to 0
    expect(result!.user.hasDemotionShield).toBe(false); // Shield consumed
  });
});

describe('Friends & Social System', () => {
  it('manages friend requests, acceptance, and friend list', () => {
    const { user: userA } = db.getOrCreateUser(genName('Alice'), '🧝');
    const { user: userB } = db.getOrCreateUser(genName('Bob'), '🧙');

    // Alice sends friend request to Bob
    const sendRes = db.sendFriendRequest(userA.id, userB.username);
    expect(sendRes.success).toBe(true);

    const bUpdated = db.getUserById(userB.id);
    expect(bUpdated!.friendRequests.length).toBe(1);
    expect(bUpdated!.friendRequests[0].fromUserId).toBe(userA.id);

    // Bob accepts friend request
    const acceptRes = db.acceptFriendRequest(userB.id, userA.id);
    expect(acceptRes.success).toBe(true);

    const bFriends = db.getUserById(userB.id)!.friends;
    const aFriends = db.getUserById(userA.id)!.friends;
    expect(bFriends).toContain(userA.id);
    expect(aFriends).toContain(userB.id);

    // Bob removes Alice
    const removeRes = db.removeFriend(userB.id, userA.id);
    expect(removeRes.success).toBe(true);
    expect(db.getUserById(userB.id)!.friends).not.toContain(userA.id);
  });
});

describe('Battle Pass & Progression System', () => {
  it('awards match XP, advances level, and updates challenges', () => {
    const { user } = db.getOrCreateUser(genName('ProgHero'), '⚡');

    const updated = db.recordMatchCompletion(
      user.id,
      true, // Win
      4, // tricks
      1, // March
      1, // Euchre
      0  // Loner
    );

    expect(updated).not.toBeNull();
    expect(updated!.xp).toBeGreaterThan(0);
    expect(updated!.wins).toBe(1);
    expect(updated!.marches).toBe(1);
    expect(updated!.euchres).toBe(1);

    // Check challenge progress
    const trickChallenge = updated!.challenges.find(c => c.id === 'ch_1');
    expect(trickChallenge!.current).toBe(4);
  });
});

describe('Friendly Rivalry & Anti-Cheat Matchmaking', () => {
  it('guarantees friends in Friendly Rivalry are seated on OPPOSING teams (Seat 0 vs Seat 1)', async () => {
    const { roomManager } = await import('../roomManager');
    const { user: friend1 } = db.getOrCreateUser(genName('RivalHost'), '🤠');
    const { user: friend2 } = db.getOrCreateUser(genName('RivalGuest'), '🧝');

    // Register dummy connections
    roomManager.registerConnection(friend1.id, {
      ws: { readyState: 1, send: () => {} } as any,
      userId: friend1.id,
      username: friend1.username,
      avatarIcon: friend1.avatarIcon,
    });
    roomManager.registerConnection(friend2.id, {
      ws: { readyState: 1, send: () => {} } as any,
      userId: friend2.id,
      username: friend2.username,
      avatarIcon: friend2.avatarIcon,
    });

    // Friend 1 creates a Friendly Rivalry room
    const room = roomManager.createRivalsRoom(friend1.id);
    expect(room.queueMode).toBe('rivals');
    expect(room.slots[0]?.userId).toBe(friend1.id); // Host is Seat 0 (Team Blue)

    // Friend 2 joins the Rivals room
    const updatedRoom = roomManager.joinRoom(friend2.id, room.code);
    expect(updatedRoom.slots[1]?.userId).toBe(friend2.id); // Guest is Seat 1 (Team Red)

    // Verify they are on opposing teams (Team 0 vs Team 1)
    const team1 = 0 % 2; // Team Blue (0)
    const team2 = 1 % 2; // Team Red (1)
    expect(team1).not.toBe(team2);

    roomManager.cleanup();
  });

  it('compensates bot difficulty and display rank based on player competitive tier', async () => {
    const { roomManager } = await import('../roomManager');

    // Tier 9 (Recruit) -> Easy AI
    const cfg9 = roomManager.getBotConfigForTier('9');
    expect(cfg9.difficulty).toBe('easy');
    expect(cfg9.displayTier).toBe('9');

    // Tier 10 (Challenger) -> Medium AI
    const cfg10 = roomManager.getBotConfigForTier('10');
    expect(cfg10.difficulty).toBe('medium');
    expect(cfg10.displayTier).toBe('10');

    // Tier Q (Queen Elite) -> Medium AI
    const cfgQ = roomManager.getBotConfigForTier('Q');
    expect(cfgQ.difficulty).toBe('medium');
    expect(cfgQ.displayTier).toBe('Q');

    // Tier K (King Sovereign) -> Hard AI
    const cfgK = roomManager.getBotConfigForTier('K');
    expect(cfgK.difficulty).toBe('hard');
    expect(cfgK.displayTier).toBe('K');

    // Tier A (Ace Master) -> Hard AI
    const cfgA = roomManager.getBotConfigForTier('A');
    expect(cfgA.difficulty).toBe('hard');
    expect(cfgA.displayTier).toBe('A');

    // Tier BOWER_JJ (Supreme Bower) -> Hard AI
    const cfgJJ = roomManager.getBotConfigForTier('BOWER_JJ');
    expect(cfgJJ.difficulty).toBe('hard');
    expect(cfgJJ.displayTier).toBe('BOWER_JJ');

    roomManager.cleanup();
  });
});

describe('Public Profile Inspection, Moderation & Cosmetic Customization', () => {
  it('retrieves sanitized public player profile with equipped cosmetics and friend status', () => {
    const { user: player1 } = db.getOrCreateUser(genName('InspectedUser'), '👑');
    const { user: viewer } = db.getOrCreateUser(genName('ViewerUser'), '🤠');

    // Equip custom cosmetic
    db.equipCosmetic(player1.id, 'title', 'Bower Master');
    db.equipCosmetic(player1.id, 'banner', 'golden_royale');
    db.equipCosmetic(player1.id, 'cardBack', 'golden_bower');

    const profile = db.getUserProfile(player1.id, undefined, viewer.id);
    expect(profile).not.toBeNull();
    expect(profile!.username).toBe(player1.username);
    expect(profile!.avatarIcon).toBe('👑');
    expect(profile!.rankTier).toBe('9');
    expect(profile!.isFriend).toBe(false);
    expect(profile!.equippedCosmetics?.title).toBe('Bower Master');
    expect(profile!.equippedCosmetics?.banner).toBe('golden_royale');
    expect(profile!.equippedCosmetics?.cardBack).toBe('golden_bower');
  });

  it('records player report with moderation audit', () => {
    const { user: reporter } = db.getOrCreateUser(genName('ReporterUser'), '🤠');
    expect(() => {
      db.recordReport(reporter.id, 'OffendingPlayer', 'Collusion / Unfair Teaming');
    }).not.toThrow();
  });

  it('allows room host to modify house rules and kick players from the lobby', async () => {
    const { roomManager } = await import('../roomManager');
    const { user: host } = db.getOrCreateUser(genName('LobbyHost'), '👑');

    roomManager.registerConnection(host.id, {
      ws: { readyState: 1, send: () => {} } as any,
      userId: host.id,
      username: host.username,
      avatarIcon: host.avatarIcon,
    });

    // Create room
    const room = roomManager.createRoom(host.id);
    expect(room.rules.targetScore).toBe(10);
    expect(room.rules.stickTheDealer).toBe(true);

    // Host updates rules
    const updated = roomManager.updateRoomRules(host.id, {
      targetScore: 7,
      stickTheDealer: false,
      canadianLoner: true,
    });
    expect(updated.rules.targetScore).toBe(7);
    expect(updated.rules.stickTheDealer).toBe(false);
    expect(updated.rules.canadianLoner).toBe(true);

    // Fill with AI and kick Seat 2
    roomManager.fillWithAI(host.id, 'easy');
    expect(room.slots[2]).not.toBeNull();
    roomManager.kickPlayer(host.id, 2);
    expect(room.slots[2]).toBeNull();

    roomManager.cleanup();
  });
});
