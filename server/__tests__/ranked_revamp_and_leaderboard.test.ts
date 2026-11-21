/**
 * BOWER JJ — Season 2 Sovereign Hierarchy Ranked Revamp & Leaderboard Filter Tests
 * Verifies 100 LP per Division (III -> II -> I -> Next Tier III), Division-Up & Tier-Up rewards,
 * and strict Ranked-Queue-Only Leaderboard filtering.
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { newDb } from 'pg-mem';
import { db, PROMOTION_WAX_SEALS, DIVISION_UP_WAX_SEALS } from '../db';
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
  it('defines bespoke metadata, emblems, titles, and 100-LP divisions (III -> II -> I) for all 6 Sovereign Tiers', () => {
    expect(RANK_INFO['9'].name).toBe('Copper Squire');
    expect(RANK_INFO['9'].monogram).toBe('S');
    expect(RANK_INFO['9'].imageUrl).toContain('rank_tier_squire.jpg');
    expect(RANK_INFO['10'].name).toBe('Silver Baron');
    expect(RANK_INFO['10'].monogram).toBe('B');
    expect(RANK_INFO['10'].imageUrl).toContain('rank_tier_baron.jpg');
    expect(RANK_INFO['Q'].name).toBe('Verdant Queen');
    expect(RANK_INFO['K'].name).toBe('Crimson King');
    expect(RANK_INFO['A'].name).toBe('Astral Ace');
    expect(RANK_INFO['BOWER_JJ'].name).toBe('Supreme Bower');

    // Division III (0 - 100 LP)
    const div3 = getRankDivisionInfo('10', 40, 'III');
    expect(div3.division).toBe('III');
    expect(div3.starsFilled).toBe(1);
    expect(div3.lpToNextMilestone).toBe(60);
    expect(div3.lpToNextTier).toBe(260);
    expect(div3.isPromoSeries).toBe(false);

    // Division II (0 - 100 LP)
    const div2 = getRankDivisionInfo('K', 55, 'II');
    expect(div2.division).toBe('II');
    expect(div2.starsFilled).toBe(2);
    expect(div2.lpToNextMilestone).toBe(45);
    expect(div2.lpToNextTier).toBe(145);
    expect(div2.fullRankName).toBe('Crimson King • Div II');

    // Division I & Promo Series (0 - 100 LP, Promo at 76+ LP)
    const div1Promo = getRankDivisionInfo('A', 82, 'I');
    expect(div1Promo.division).toBe('I');
    expect(div1Promo.starsFilled).toBe(3);
    expect(div1Promo.lpToNextMilestone).toBe(18);
    expect(div1Promo.lpToNextTier).toBe(18);
    expect(div1Promo.isPromoSeries).toBe(true);

    // League of Legends Style Apex Tiers (Master, Grandmaster, Challenger)
    const master = getRankDivisionInfo('BOWER_JJ', 40);
    expect(master.division).toBe('MASTER');
    expect(master.fullRankName).toBe('JJ Master');
    expect(master.compactRankName).toBe('Master');
    expect(master.lpToNextMilestone).toBe(210); // 250 - 40

    const gm = getRankDivisionInfo('BOWER_JJ', 310);
    expect(gm.division).toBe('GRANDMASTER');
    expect(gm.fullRankName).toBe('JJ Grandmaster');
    expect(gm.compactRankName).toBe('Grandmaster');
    expect(gm.lpToNextMilestone).toBe(190); // 500 - 310

    const chal = getRankDivisionInfo('BOWER_JJ', 720);
    expect(chal.division).toBe('CHALLENGER');
    expect(chal.fullRankName).toBe('JJ Challenger');
    expect(chal.compactRankName).toBe('Challenger');
    expect(chal.divisionProgressPercent).toBe(100);
  });

  it('progresses through Division III -> II -> I (100 LP each) before promoting to the next Rank Tier', () => {
    const { user } = db.getOrCreateUser(`PromoHero_${Date.now()}`, 'the_outlaw');
    user.rankTier = '9';
    user.rankDivision = 'III';
    user.rankPoints = 88;
    const initialSeals = user.waxSeals ?? 150;

    // 1. Cross 100 LP in Division III -> Promotes to Division II (+25 Wax Seals)
    const resDiv2 = db.recordRankedMatchResult(
      user.id,
      true,
      1200,
      1200,
      '10 - 6',
      ['Opponent A', 'Opponent B']
    );
    expect(resDiv2!.didDivisionUp).toBe(true);
    expect(resDiv2!.didRankUp).toBe(false);
    expect(resDiv2!.newTier).toBe('9');
    expect(resDiv2!.oldDivision).toBe('III');
    expect(resDiv2!.newDivision).toBe('II');
    expect(resDiv2!.newPoints).toBe(12); // 88 + 24 - 100 = 12 LP in Div II
    expect(resDiv2!.promotionSealsAwarded).toBe(DIVISION_UP_WAX_SEALS['II']);

    // 2. Cross 100 LP in Division II -> Promotes to Division I (+35 Wax Seals)
    user.rankPoints = 90;
    const resDiv1 = db.recordRankedMatchResult(
      user.id,
      true,
      1200,
      1200,
      '10 - 6',
      ['Opponent A', 'Opponent B']
    );
    expect(resDiv1!.didDivisionUp).toBe(true);
    expect(resDiv1!.didRankUp).toBe(false);
    expect(resDiv1!.newTier).toBe('9');
    expect(resDiv1!.oldDivision).toBe('II');
    expect(resDiv1!.newDivision).toBe('I');
    expect(resDiv1!.promotionSealsAwarded).toBe(DIVISION_UP_WAX_SEALS['I']);

    // 3. Cross 100 LP in Division I -> Promotes to Next Rank Tier '10' Division III (+75 Wax Seals)
    user.rankPoints = 88;
    const resTierUp = db.recordRankedMatchResult(
      user.id,
      true,
      1200,
      1200,
      '10 - 6',
      ['Opponent A', 'Opponent B']
    );
    expect(resTierUp!.didRankUp).toBe(true);
    expect(resTierUp!.didDivisionUp).toBe(true);
    expect(resTierUp!.oldTier).toBe('9');
    expect(resTierUp!.newTier).toBe('10');
    expect(resTierUp!.oldDivision).toBe('I');
    expect(resTierUp!.newDivision).toBe('III');
    expect(resTierUp!.promotionSealsAwarded).toBe(PROMOTION_WAX_SEALS['10']);
    expect(user.waxSeals).toBe(
      initialSeals +
        DIVISION_UP_WAX_SEALS['II'] +
        DIVISION_UP_WAX_SEALS['I'] +
        PROMOTION_WAX_SEALS['10']
    );
  });

  it('strictly excludes unranked & casual-only players from PostgreSQL Leaderboard and sorts by Tier -> Division -> LP', async () => {
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
      expect(gladiatorEntry.rankDivision).toBe('III');
      expect(gladiatorEntry.rankPoints).toBe(24);
      expect(gladiatorEntry.wins).toBe(1);
      expect(gladiatorEntry.losses).toBe(0);
      expect(gladiatorEntry.rankedGames).toBe(1);
      expect(gladiatorEntry.winRate).toBe(100);
    } finally {
      await pool.end();
    }
  });

  it('handles League of Legends style uncapped LP in BOWER_JJ (Master -> Grandmaster -> Challenger)', async () => {
    const { user } = db.getOrCreateUser(`ApexHero_${Date.now()}`, 'the_outlaw');
    // Start at Astral Ace Division I with 90 LP
    user.rankTier = 'A';
    user.rankDivision = 'I';
    user.rankPoints = 90;

    // 1. Promote to BOWER_JJ -> Enters Master with rollover LP (not capped at 100)
    const resJJ = db.recordRankedMatchResult(user.id, true, 1600, 1600, '10 - 5', ['Opp A', 'Opp B']);
    expect(resJJ!.didRankUp).toBe(true);
    expect(resJJ!.didDivisionUp).toBe(true);
    expect(resJJ!.newTier).toBe('BOWER_JJ');
    expect(resJJ!.newDivision).toBe('MASTER');
    expect(user.rankTier).toBe('BOWER_JJ');
    expect(user.rankDivision).toBe('MASTER');
    expect(user.rankPoints).toBeGreaterThan(0);

    // 2. Climb in Master beyond 100 LP (e.g. 240 LP)
    user.rankPoints = 240;
    const resGm = db.recordRankedMatchResult(user.id, true, 1800, 1800, '10 - 7', ['Opp A', 'Opp B']);
    expect(resGm!.didDivisionUp).toBe(true);
    expect(resGm!.newDivision).toBe('GRANDMASTER');
    expect(user.rankDivision).toBe('GRANDMASTER');
    expect(user.rankPoints).toBeGreaterThanOrEqual(250);

    // 3. Climb in Grandmaster beyond 500 LP -> Promotes to Challenger (Apex pinnacle)
    user.rankPoints = 490;
    const resChal = db.recordRankedMatchResult(user.id, true, 2000, 2000, '10 - 8', ['Opp A', 'Opp B']);
    expect(resChal!.didDivisionUp).toBe(true);
    expect(resChal!.newDivision).toBe('CHALLENGER');
    expect(user.rankDivision).toBe('CHALLENGER');
    expect(user.rankPoints).toBeGreaterThanOrEqual(500);

    // 4. In Challenger, LP continues to climb uncapped
    user.rankPoints = 850;
    const resUncapped = db.recordRankedMatchResult(user.id, true, 2200, 2200, '10 - 2', ['Opp A', 'Opp B']);
    expect(resUncapped!.newDivision).toBe('CHALLENGER');
    expect(user.rankPoints).toBeGreaterThan(850);
  });
});
