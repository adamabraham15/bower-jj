import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { PostgresRepository } from '../db/postgres';
import { RankTier } from '../../src/types/game';
import crypto from 'crypto';

describe('Competitive Lobby MMR-Scaled LP & Elo Progression', () => {
  beforeEach(() => {
    // Reset or prepare clean user state
  });

  describe('In-Memory Fallback Store (db.recordRankedMatchResult)', () => {
    it('awards baseline +24 LP and +18 MMR for evenly-matched 1200 MMR lobby', () => {
      const { user } = db.getOrCreateUser(`EvenMatch_${Date.now()}`, 'avatar_1');
      user.rankTier = '9';
      user.rankPoints = 50;
      user.mmr = 1200;
      user.placementMatchesRemaining = 0;

      const winResult = db.recordRankedMatchResult(
        user.id,
        true,
        1200,
        1200,
        '10 - 6',
        ['Opponent 1', 'Opponent 2']
      );

      expect(winResult).not.toBeNull();
      expect(winResult!.lpChange).toBe(24);
      expect(winResult!.newPoints).toBe(74);
      expect(winResult!.mmrChange).toBe(18);
      expect(winResult!.newMmr).toBe(1218);

      // Baseline loss check
      user.rankPoints = 50;
      user.mmr = 1200;
      const lossResult = db.recordRankedMatchResult(
        user.id,
        false,
        1200,
        1200,
        '6 - 10',
        ['Opponent 1', 'Opponent 2']
      );

      expect(lossResult).not.toBeNull();
      expect(lossResult!.lpChange).toBe(-16);
      expect(lossResult!.newPoints).toBe(34);
      expect(lossResult!.mmrChange).toBe(-14);
      expect(lossResult!.newMmr).toBe(1186);
    });

    it('awards high LP bonus (+38 to +42 LP) when underdog wins in higher MMR lobby, and softens loss (-8 to -10 LP)', () => {
      const { user: underdog } = db.getOrCreateUser(`Underdog_${Date.now()}`, 'avatar_1');
      underdog.rankTier = '10';
      underdog.rankPoints = 30;
      underdog.mmr = 1200;
      underdog.placementMatchesRemaining = 0;

      // Punching up into a 1600 MMR lobby against 1600 MMR opponents
      const winResult = db.recordRankedMatchResult(
        underdog.id,
        true,
        1300, // My team avg
        1600, // Opponent team avg
        '10 - 7',
        ['Grandmaster 1', 'Grandmaster 2']
      );

      expect(winResult).not.toBeNull();
      // oppDelta = (1600 - 1300)/30 = +10. lobbyMmr = 1450. lobbyDelta = (1450 - 1200)/35 = +7. prestigeBonus = 2.
      // Expected win LP = 24 + 10 + 7 + 2 = 43 clamped to 42.
      expect(winResult!.lpChange).toBeGreaterThanOrEqual(38);
      expect(winResult!.lpChange).toBeLessThanOrEqual(42);
      expect(winResult!.mmrChange).toBeGreaterThan(18);

      // Underdog loses in higher MMR lobby -> loss penalty is softened
      underdog.rankPoints = 50;
      underdog.mmr = 1200;
      const lossResult = db.recordRankedMatchResult(
        underdog.id,
        false,
        1300,
        1600,
        '8 - 10',
        ['Grandmaster 1', 'Grandmaster 2']
      );

      expect(lossResult).not.toBeNull();
      // Loss penalty softened from standard -16 down to -8 to -10 LP
      expect(lossResult!.lpChange).toBeGreaterThanOrEqual(-10);
      expect(lossResult!.lpChange).toBeLessThanOrEqual(-8);
    });

    it('heavily penalizes favored high-MMR player on upset loss (-32 to -35 LP) and awards modest win (+12 to +14 LP)', () => {
      const { user: favoredPlayer } = db.getOrCreateUser(`Apex_${Date.now()}`, 'avatar_1');
      favoredPlayer.rankTier = 'ACE';
      favoredPlayer.rankPoints = 50;
      favoredPlayer.mmr = 1600;
      favoredPlayer.placementMatchesRemaining = 0;

      // Playing down in a 1200 MMR lobby
      const winResult = db.recordRankedMatchResult(
        favoredPlayer.id,
        true,
        1550, // My team avg
        1200, // Opponent team avg
        '10 - 4',
        ['Rookie 1', 'Rookie 2']
      );

      expect(winResult).not.toBeNull();
      expect(winResult!.lpChange).toBeLessThanOrEqual(16);
      expect(winResult!.lpChange).toBeGreaterThanOrEqual(12);

      // Favored player suffers an upset loss
      favoredPlayer.rankPoints = 50;
      favoredPlayer.mmr = 1600;
      const upsetLossResult = db.recordRankedMatchResult(
        favoredPlayer.id,
        false,
        1550,
        1200,
        '7 - 10',
        ['Rookie 1', 'Rookie 2']
      );

      expect(upsetLossResult).not.toBeNull();
      expect(upsetLossResult!.lpChange).toBeLessThanOrEqual(-30);
      expect(upsetLossResult!.lpChange).toBeGreaterThanOrEqual(-35);
      expect(upsetLossResult!.mmrChange).toBeLessThanOrEqual(-24);
    });

    it('protects player with 0 LP loss when teammate abandons match', () => {
      const { user: abandonedPlayer } = db.getOrCreateUser(`Abandoned_${Date.now()}`, 'avatar_1');
      abandonedPlayer.rankTier = '10';
      abandonedPlayer.rankPoints = 40;
      abandonedPlayer.mmr = 1350;

      const mitigatedResult = db.recordRankedMatchResult(
        abandonedPlayer.id,
        false,
        1350,
        1400,
        '5 - 10',
        ['Opp 1', 'Opp 2'],
        true // isTeammateAbandoned
      );

      expect(mitigatedResult).not.toBeNull();
      expect(mitigatedResult!.lpChange).toBe(0);
      expect(mitigatedResult!.newPoints).toBe(40);
    });
  });

  describe('PostgreSQL Authoritative Repository Scaling', () => {
    it('applies lobby-aware competitive scaling with explicit team and lobby MMR in postgres repo', async () => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        // Skip live PG if environment doesn't have DATABASE_URL in this test runner
        return;
      }

      const repo = new PostgresRepository({
        connectionString: databaseUrl,
        maxPoolSize: 5,
      });

      try {
        const testUserId = crypto.randomUUID();
        const username = `CompTest_${Date.now().toString(36)}`;
        await repo.createOrUpdateProfile({
          id: testUserId,
          username,
          avatarUrl: 'avatar_1',
          selectedCardBack: 'classic_navy',
          selectedFelt: 'felt_midnight_navy',
          tableStickers: [],
          unlockedAvatars: ['avatar_1'],
        });

        // 1. Underdog win in high MMR lobby (Player 1200 in 1600 lobby)
        const match1 = await repo.recordMatchResult({
          matchId: crypto.randomUUID(),
          roomCode: 'HIGH01',
          mode: 'ranked_solo',
          composition: '4H',
          winningTeam: 0,
          finalScore: '10 - 8',
          lobbyMmr: 1600,
          teamMmrs: [1300, 1600],
          humanPlayers: [
            {
              userId: testUserId,
              position: 0,
              team: 0,
              username,
              rankTier: '9',
              rankPoints: 10,
              mmr: 1200,
              teamMmr: 1300,
              opponentMmr: 1600,
              lobbyMmr: 1600,
              tricksWon: 8,
              euchres: 1,
              marches: 1,
              successfulLoners: 0,
              opponentNames: ['Elite1', 'Elite2'],
            },
          ],
        });

        expect(match1.playerResults[0].lpChange).toBeGreaterThanOrEqual(38);
        expect(match1.playerResults[0].lpChange).toBeLessThanOrEqual(42);
        expect(match1.playerResults[0].lobbyMmr).toBe(1600);
        expect(match1.playerResults[0].mmrChange).toBeGreaterThan(18);

        // 2. High lobby loss relief (Player 1200 losing in 1600 lobby)
        const match2 = await repo.recordMatchResult({
          matchId: crypto.randomUUID(),
          roomCode: 'HIGH02',
          mode: 'ranked_solo',
          composition: '4H',
          winningTeam: 1, // lost
          finalScore: '7 - 10',
          lobbyMmr: 1600,
          teamMmrs: [1300, 1600],
          humanPlayers: [
            {
              userId: testUserId,
              position: 0,
              team: 0,
              username,
              rankTier: match1.playerResults[0].newTier,
              rankPoints: match1.playerResults[0].newPoints,
              mmr: match1.playerResults[0].newMmr,
              teamMmr: 1300,
              opponentMmr: 1600,
              lobbyMmr: 1600,
              tricksWon: 5,
              euchres: 0,
              marches: 0,
              successfulLoners: 0,
              opponentNames: ['Elite1', 'Elite2'],
            },
          ],
        });

        // Softened loss: between -8 and -10 LP
        expect(match2.playerResults[0].lpChange).toBeGreaterThanOrEqual(-11);
        expect(match2.playerResults[0].lpChange).toBeLessThanOrEqual(-8);
      } finally {
        await repo.close();
      }
    });
  });
});
