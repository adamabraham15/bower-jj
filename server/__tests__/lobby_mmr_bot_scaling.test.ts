import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomManager } from '../roomManager';
import { db } from '../db';
import crypto from 'crypto';

function genName(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(3).toString('hex')}`;
}

describe('Dynamic Lobby MMR Bot Difficulty Scaling', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  afterEach(() => {
    roomManager.cleanup();
  });

  it('correctly maps lobby MMR to 5 distinct competitive AI tiers (Easy, Medium, Hard, Expert, Master)', () => {
    // 1. Beginner / Copper Squire (< 1250 MMR)
    const cfgLow = roomManager.getBotConfigForMmr(1100);
    expect(cfgLow.difficulty).toBe('easy');
    expect(cfgLow.displayTier).toBe('9');
    expect(cfgLow.botMmr).toBeLessThan(1250);

    // 2. Intermediate / Silver Baron (1250 - 1499 MMR)
    const cfgMid = roomManager.getBotConfigForMmr(1350);
    expect(cfgMid.difficulty).toBe('medium');
    expect(cfgMid.displayTier).toBe('10');
    expect(cfgMid.botMmr).toBe(1350);

    // 3. Advanced / Golden King (1500 - 1749 MMR)
    const cfgHigh = roomManager.getBotConfigForMmr(1620);
    expect(cfgHigh.difficulty).toBe('hard');
    expect(cfgHigh.displayTier).toBe('K');
    expect(cfgHigh.botMmr).toBe(1620);

    // 4. Tournament Caliber / Astral Ace (1750 - 1999 MMR)
    const cfgExpert = roomManager.getBotConfigForMmr(1850);
    expect(cfgExpert.difficulty).toBe('expert');
    expect(cfgExpert.displayTier).toBe('A');
    expect(cfgExpert.botMmr).toBe(1850);

    // 5. Apex Challenger / Supreme Bower (2000+ MMR)
    const cfgMaster = roomManager.getBotConfigForMmr(2250);
    expect(cfgMaster.difficulty).toBe('master');
    expect(cfgMaster.displayTier).toBe('BOWER_JJ');
    expect(cfgMaster.botMmr).toBe(2250);
  });

  it('calculates true lobby MMR from multiple humans in room and equips bots accordingly', () => {
    const { user: human1 } = db.getOrCreateUser(genName('MasterHuman1'), '👑');
    human1.mmr = 2100;
    human1.rankTier = 'BOWER_JJ';

    const { user: human2 } = db.getOrCreateUser(genName('MasterHuman2'), '🤠');
    human2.mmr = 1900;
    human2.rankTier = 'A';

    // Register connections
    roomManager.registerConnection(human1.id, {
      ws: { readyState: 1, send: () => {} } as any,
      userId: human1.id,
      username: human1.username,
      avatarIcon: '👑',
    });
    roomManager.registerConnection(human2.id, {
      ws: { readyState: 1, send: () => {} } as any,
      userId: human2.id,
      username: human2.username,
      avatarIcon: '🤠',
    });

    const room = roomManager.createRoom(human1.id, undefined, 'custom');
    roomManager.joinRoom(human2.id, room.code);

    // Human average MMR is (2100 + 1900) / 2 = 2000 MMR
    const avgMmr = roomManager.calculateRoomHumanMmr(room);
    expect(avgMmr).toBe(2000);

    // Fill remaining 2 seats with bots
    roomManager.fillWithAI(human1.id);

    // Empty seats 2 & 3 should be Master AI scaled to 2000 MMR
    const bot1 = room.slots[2];
    const bot2 = room.slots[3];

    expect(bot1?.isAI).toBe(true);
    expect(bot1?.aiDifficulty).toBe('master');
    expect(bot1?.rankTier).toBe('BOWER_JJ');
    expect(bot1?.botMmr).toBe(2000);

    expect(bot2?.isAI).toBe(true);
    expect(bot2?.aiDifficulty).toBe('master');
    expect(bot2?.rankTier).toBe('BOWER_JJ');
    expect(bot2?.botMmr).toBe(2000);
  });

  it('scales bots to Expert AI (Astral Ace) for 1800 MMR lobby', () => {
    const { user: expertHuman } = db.getOrCreateUser(genName('AcePlayer'), '⚡');
    expertHuman.mmr = 1820;
    expertHuman.rankTier = 'A';

    roomManager.registerConnection(expertHuman.id, {
      ws: { readyState: 1, send: () => {} } as any,
      userId: expertHuman.id,
      username: expertHuman.username,
      avatarIcon: '⚡',
    });

    const room = roomManager.createRoom(expertHuman.id, undefined, 'solo');
    roomManager.fillWithAI(expertHuman.id);

    // Bots in seats 1, 2, 3 should be Expert AI scaled to ~1820 MMR
    for (let i = 1; i <= 3; i++) {
      const slot = room.slots[i];
      expect(slot?.isAI).toBe(true);
      expect(slot?.aiDifficulty).toBe('expert');
      expect(slot?.rankTier).toBe('A');
      expect(slot?.botMmr).toBe(1820);
    }
  });

  it('scales bots to Easy AI (Copper Squire) for sub-1250 MMR beginner lobby', () => {
    const { user: beginner } = db.getOrCreateUser(genName('NovicePlayer'), '🌱');
    beginner.mmr = 1050;
    beginner.rankTier = '9';

    roomManager.registerConnection(beginner.id, {
      ws: { readyState: 1, send: () => {} } as any,
      userId: beginner.id,
      username: beginner.username,
      avatarIcon: '🌱',
    });

    const room = roomManager.createRoom(beginner.id, undefined, 'solo');
    roomManager.fillWithAI(beginner.id);

    // Bots in seats 1, 2, 3 should be Easy AI
    for (let i = 1; i <= 3; i++) {
      const slot = room.slots[i];
      expect(slot?.isAI).toBe(true);
      expect(slot?.aiDifficulty).toBe('easy');
      expect(slot?.rankTier).toBe('9');
    }
  });
});
