/**
 * BOWER JJ — Season 2 Sovereign Hierarchy Ranked Revamp & Leaderboard Filter Tests
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { newDb } from 'pg-mem';
import { db, PROMOTION_WAX_SEALS } from '../db';
import { PostgresDatabaseRepository } from '../db/postgres';
import { RANK_INFO, getRankDivisionInfo } from '../../src/components/RankBadge';

function createTestPostgresPool() {
  const mem = newDb();
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });
  const pg = mem.adapters.createPg();
  return new pg.Pool();
}

describe('Season 2 Sovereign Hierarchy Ranked System & Leaderboard Filter', () => {
  it('defines bespoke metadata, emblems, titles, and sub-divisions for all 6 Sovereign Tiers', () => {
    expect(RANK_INFO['9'].name).toBe('Copper IX');
    expect(RANK_INFO['9'].imageUrl).toContain('rank_tier_9.jpg');
    expect(RANK_INFO['10'].name).toBe('Silver X');
    expect(RANK_INFO['Q'].name).toBe('Verdant Queen');
    expect(RANK_INFO['K'].name).toBe('Crimson King');
    expect(RANK_INFO['A'].name).toBe('Astral Ace');
    expect(RANK_INFO['BOWER_JJ'].name).toBe('Supreme Bower');

    // Sub-Division III (0 - 33 LP)
    const div3 = getRankDivisionInfo('10', 20);
    expect(div3.division).toBe('III');
    expect(div3.starsFilled).toBe(1);
    expect(div3.isPromoSeries).toBe(false);

    // Sub-Division II (34 - 66 LP)
    const div2 = getRankDivisionInfo('K', 55);
    expect(div2.division).toBe('II');
    expect(div2.starsFilled).toBe(2);
    expect(div2.fullRankName).toBe('Crimson King • Div II');

    // Sub-Division I & Promo Series (67 - 99 LP, Promo at 76+ LP)
    const div1Promo = getRankDivisionInfo('A', 82);
    expect(div1Promo.division).toBe('I');
    expect(div1Promo.starsFilled).toBe(3);
    expect(div1Promo.isPromoSeries).toBe(true);

    // Apex Tier
    const apex = getRankDivisionInfo('BOWER_JJ', 40);
    expect(apex.division).toBe('APEX');
  });

  it('awards Promotion Wax Seal Spoils when ascending to a new Rank Tier', () => {
    const { user } = db.getOrCreateUser(`PromoHero_${Date.now()}`, 'the_outlaw');
    user.rankTier = '9';
    user.rankPoints = 88;
    const initialSeals = user.waxSeals ?? 150;

    const res = db.recordRankedMatchResult(
      user.id,
      true,
      1200,
      1200,
      '10 - 6',
      ['Opponent A', 'Opponent B']
    );

    expect(res).not.toBeNull();
    expect(res!.didRankUp).toBe(true);
    expect(res!.newTier).toBe('10');
    expect(res!.promotionSealsAwarded).toBe(PROMOTION_WAX_SEALS['10']);
    expect(user.waxSeals).toBe(initialSeals + PROMOTION_WAX_SEALS['10']);
  });

  it('strictly excludes unranked & casual-only players from PostgreSQL Leaderboard', async () => {
    const pool = createTestPostgresPool();
    const repo = new PostgresDatabaseRepository(pool);
    await repo.initSchema();

    try {
      const unrankedGuestId = crypto.randomUUID();
      const casualPlayerId = crypto.randomUUID();
      const rankedPlayerId = crypto.randomUUID();

      await repo.getOrCreateUser('UnrankedGuest_99', 'the_outlaw', undefined, unrankedGuestId);
      await repo.getOrCreateUser('CasualChillPlayer', 'the_outlaw', undefined, casualPlayerId);
      await repo.getOrCreateUser('RankedGladiator', 'the_outlaw', undefined, rankedPlayerId);

      // 1. CasualChillPlayer plays an UNRANKED custom match
      await repo.recordMatchResult({
        matchId: crypto.randomUUID(),
        roomCode: 'CHILL1',
        mode: 'unranked',
        composition: '1H3B',
        winningTeam: 0,
        finalScore: '10 - 4',
        humanPlayers: [
          {
            userId: casualPlayerId,
            position: 0,
            team: 0,
            username: 'CasualChillPlayer',
            rankTier: '9',
            rankPoints: 0,
            mmr: 1200,
            tricksWon: 5,
            euchres: 1,
            marches: 1,
            successfulLoners: 0,
            opponentNames: ['Bot 1', 'Bot 2'],
          },
        ],
      });

      // 2. RankedGladiator queues and completes a RANKED match
      await repo.recordMatchResult({
        matchId: crypto.randomUUID(),
        roomCode: 'RANK01',
        mode: 'ranked_solo',
        composition: '1H3B',
        winningTeam: 0,
        finalScore: '10 - 7',
        humanPlayers: [
          {
            userId: rankedPlayerId,
            position: 0,
            team: 0,
            username: 'RankedGladiator',
            rankTier: '9',
            rankPoints: 0,
            mmr: 1200,
            tricksWon: 4,
            euchres: 0,
            marches: 1,
            successfulLoners: 0,
            opponentNames: ['Bot 1', 'Bot 2'],
          },
        ],
      });

      const leaderboard = await repo.getLeaderboard(50);
      const usernames = leaderboard.map((e) => e.username);

      expect(usernames).toContain('RankedGladiator');
      expect(usernames).not.toContain('UnrankedGuest_99');
      expect(usernames).not.toContain('CasualChillPlayer');

      const gladiatorEntry = leaderboard.find((e) => e.username === 'RankedGladiator')!;
      expect(gladiatorEntry.wins).toBe(1);
      expect(gladiatorEntry.losses).toBe(0);
      expect(gladiatorEntry.rankedGames).toBe(1);
      expect(gladiatorEntry.winRate).toBe(100);
    } finally {
      await pool.end();
    }
  });
});
