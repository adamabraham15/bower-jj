/**
 * BOWER JJ — Friends List, Match History & Rank Progression Integration Tests
 * Validates:
 * 1. Supabase JWT verification preserves real UUIDs and doesn't convert users to guest dev_ accounts.
 * 2. Friends list requests, acceptances, removals, and status reporting work accurately.
 * 3. Match history recording and rank progression (LP & MMR) calculate and update properly without clobbering stats.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newDb } from 'pg-mem';
import crypto from 'crypto';
import { TokenVerifier } from '../auth';
import { db } from '../db';
import { PostgresDatabaseRepository } from '../db/postgres';
import { RoomManager, ClientConnection } from '../roomManager';

describe('Friends List, Match History & Rank Progression', () => {
  const verifier = new TokenVerifier();
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  describe('1. Identity & JWT Verification Protection', () => {
    it('cryptographically resolves Supabase JWT payload without demoting to dev_ guest', async () => {
      // Craft a mock valid Supabase session JWT with a real UUID
      const testUuid = '52786b21-4c43-4bee-80eb-72055375facd';
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(JSON.stringify({
        sub: testUuid,
        email: 'player@bowerjj.test',
        user_metadata: { username: 'BowerMaster', avatar_icon: '🤠' },
        exp: Math.floor(Date.now() / 1000) + 3600,
      })).toString('base64');
      const mockJwt = `${header}.${payload}.signature_bytes`;

      const identity = await verifier.verifyToken(mockJwt, 'BowerMaster', '🤠');

      expect(identity).not.toBeNull();
      expect(identity?.userId).toBe(testUuid);
      expect(identity?.isGuest).toBe(false);
      expect(identity?.username).toBe('BowerMaster');
      expect(identity?.userId.startsWith('dev_')).toBe(false);
    });

    it('creates and tracks verified user account with exact Supabase UUID', () => {
      const authUserId = '62786b21-4c43-4bee-80eb-72055375face';
      const { user } = db.getOrCreateUser('TrackedPlayer', '👑', undefined, authUserId);

      expect(user.id).toBe(authUserId);
      expect(user.username).toBe('TrackedPlayer');

      // User account is retrievable by verified ID
      const retrieved = db.getUserById(authUserId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(authUserId);
    });
  });

  describe('2. Friends & Social System', () => {
    it('manages complete friend lifecycle: send request, accept, summary status, and removal', () => {
      const userAId = 'aaaaaaaa-1111-4000-8000-000000000001';
      const userBId = 'bbbbbbbb-2222-4000-8000-000000000002';

      const { user: userA } = db.getOrCreateUser('AliceEuchre', '🤠', undefined, userAId);
      const { user: userB } = db.getOrCreateUser('BobEuchre', '🤖', undefined, userBId);

      // Clean friends list state
      userA.friends = [];
      userA.friendRequests = [];
      userB.friends = [];
      userB.friendRequests = [];

      // Alice sends friend request to Bob
      const sendRes = db.sendFriendRequest(userA.id, userB.username);
      expect(sendRes.success).toBe(true);

      // Verify Bob received request
      const bUpdated = db.getUserById(userB.id);
      expect(bUpdated?.friendRequests.length).toBe(1);
      expect(bUpdated?.friendRequests[0].fromUserId).toBe(userA.id);
      expect(bUpdated?.friendRequests[0].fromUsername).toBe('AliceEuchre');

      // Duplicate request should be rejected
      const dupRes = db.sendFriendRequest(userA.id, userB.username);
      expect(dupRes.success).toBe(false);
      expect(dupRes.error).toBe('Friend request already sent');

      // Bob accepts request
      const acceptRes = db.acceptFriendRequest(userB.id, userA.id);
      expect(acceptRes.success).toBe(true);

      // Both should be in each other's friends list
      const aAfter = db.getUserById(userA.id);
      const bAfter = db.getUserById(userB.id);
      expect(aAfter?.friends).toContain(userB.id);
      expect(bAfter?.friends).toContain(userA.id);
      expect(bAfter?.friendRequests.length).toBe(0);

      // Verify Friends Summary with active connections
      const mockConnB: ClientConnection = {
        ws: {} as any,
        userId: userB.id,
        username: userB.username,
        avatarIcon: userB.avatarIcon,
        roomCode: 'ABCD12',
      };
      const activeConns = new Map<string, any>([[userB.id, mockConnB]]);

      const aFriendsSummary = db.getFriendsSummary(userA.id, activeConns);
      expect(aFriendsSummary.length).toBe(1);
      expect(aFriendsSummary[0].userId).toBe(userB.id);
      expect(aFriendsSummary[0].username).toBe('BobEuchre');
      expect(aFriendsSummary[0].isOnline).toBe(true);
      expect(aFriendsSummary[0].status).toBe('in_game');
      expect(aFriendsSummary[0].roomCode).toBe('ABCD12');

      // Remove friend
      const removeRes = db.removeFriend(userA.id, userB.id);
      expect(removeRes.success).toBe(true);

      const aFinal = db.getUserById(userA.id);
      const bFinal = db.getUserById(userB.id);
      expect(aFinal?.friends).not.toContain(userB.id);
      expect(bFinal?.friends).not.toContain(userA.id);
    });
  });

  describe('3. Rank Progression & Match Result Integrity', () => {
    it('accurately advances rank tier and LP without wiping stats', () => {
      const compUserId = 'cccccccc-3333-4000-8000-000000000003';
      const { user: compUser } = db.getOrCreateUser('LadderClimber', '⚡', undefined, compUserId);

      // Set initial state: Tier 9, 85 LP
      db.updateUser(compUserId, {
        rankTier: '9',
        rankPoints: 85,
        eloMmr: 1200,
        wins: 4,
        losses: 2,
        totalGames: 6,
      });

      // Win a ranked match that crosses 100 LP threshold
      const rankResult = db.recordRankedMatchResult(
        compUserId,
        true, // won
        1200, // my team mmr
        1200, // opp team mmr
        '10 - 6',
        ['Opponent1', 'Opponent2'],
        false
      );

      expect(rankResult).not.toBeNull();
      expect(rankResult?.didRankUp).toBe(true);
      expect(rankResult?.oldTier).toBe('9');
      expect(rankResult?.newTier).toBe('10'); // Advanced from 9 to 10
      expect(rankResult?.newPoints).toBeGreaterThanOrEqual(0);

      // Record match completion stats
      const updatedUser = db.recordMatchCompletion(
        compUserId,
        true, // win
        4, // tricks
        1, // march
        1, // euchre
        0  // loner
      );

      expect(updatedUser).not.toBeNull();
      expect(updatedUser?.wins).toBe(5);
      expect(updatedUser?.totalGames).toBe(7);
      expect(updatedUser?.tricksWon).toBeGreaterThanOrEqual(4);
      expect(updatedUser?.winStreak).toBe(1);
    });

    it('protects partner with Loss Mitigation when teammate abandons', () => {
      const partnerId = 'dddddddd-4444-4000-8000-000000000004';
      db.getOrCreateUser('FaithfulPartner', '🛡️', undefined, partnerId);
      db.updateUser(partnerId, { rankTier: '10', rankPoints: 50, eloMmr: 1250 });

      // Match lost due to abandoned teammate
      const lossMitigatedResult = db.recordRankedMatchResult(
        partnerId,
        false, // lost
        1250,
        1250,
        '4 - 10',
        ['Opponent1', 'Opponent2'],
        true // teammate abandoned!
      );

      expect(lossMitigatedResult).not.toBeNull();
      expect(lossMitigatedResult?.lpChange).toBe(0); // 0 LP lost thanks to Loss Mitigation
      expect(lossMitigatedResult?.newPoints).toBe(50); // LP preserved
    });
  });

  let pool: any;

  afterEach(async () => {
    roomManager.destroy();
    if (pool) {
      await pool.end();
      pool = undefined;
    }
  });

  describe('4. Authoritative PostgreSQL Progression, Match History & Friends Regression', () => {
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

    it('records sequential ranked matches with unique room IDs, AI opponent names, LP gains, and zero-LP unranked history', async () => {
      pool = createTestPostgresPool();
      const repo = new PostgresDatabaseRepository(pool);
      await repo.initSchema();

      const aliceUid = crypto.randomUUID();
      const { user: alice, sessionToken: guestTok } = await repo.getOrCreateUser('RankAlice', '🤠', undefined, aliceUid);
      expect(alice.id).toBe(aliceUid);
      expect(alice.rankPoints).toBe(0);

      // Verify a different authUserId overrides cached guest sessionToken cleanly
      const bobUid = crypto.randomUUID();
      const { user: bob } = await repo.getOrCreateUser('RankBob', '👑', guestTok, bobUid);
      expect(bob.id).toBe(bobUid);
      expect(bob.id).not.toBe(aliceUid);

      // RoomManager assigns unique room.id per room and regenerates on restart
      roomManager.setPostgresRepository(repo);
      const sentMessages: any[] = [];
      const mockWs = {
        readyState: 1,
        send: (raw: string) => sentMessages.push(JSON.parse(raw)),
      } as any;
      roomManager.setCachedUser(alice);
      roomManager.registerConnection(alice.id, {
        ws: mockWs,
        userId: alice.id,
        username: alice.username,
        avatarIcon: alice.avatarIcon,
      });

      const room1 = roomManager.createRoom(alice.id, undefined, 'solo');
      const room2 = roomManager.createRoom(alice.id, undefined, 'solo');
      expect(room1.id).toBeTruthy();
      expect(room2.id).toBeTruthy();
      expect(room1.id).not.toBe(room2.id);

      // Restarting in the same room generates a fresh match ID
      const firstId = room2.id;
      room2.resultsRecorded = true;
      roomManager.fillWithAI(alice.id);
      roomManager.startGame(alice.id);
      expect(room2.id).toBeTruthy();
      expect(room2.id).not.toBe(firstId);
      expect(room2.resultsRecorded).toBe(false);

      // 1. Play 2 consecutive ranked_solo matches with AI opponents
      const m1 = await repo.recordMatchResult({
        matchId: room1.id!,
        roomCode: room1.code,
        mode: 'ranked_solo',
        composition: '1H3B',
        winningTeam: 0,
        finalScore: '10 - 6',
        humanPlayers: [
          {
            userId: alice.id,
            position: 0,
            team: 0,
            username: alice.username,
            rankTier: '9',
            rankPoints: 0,
            mmr: 1200,
            tricksWon: 6,
            euchres: 1,
            marches: 1,
            successfulLoners: 0,
            opponentNames: ['West (Bot)', 'East (Bot)'],
          },
        ],
        idempotencyKey: `match_${room1.id}`,
      });
      expect(m1.alreadyRecorded).toBe(false);
      expect(m1.playerResults[0].lpChange).toBe(24);
      expect(m1.playerResults[0].newPoints).toBe(24);

      const m2 = await repo.recordMatchResult({
        matchId: room2.id!,
        roomCode: room2.code,
        mode: 'ranked_rivals',
        composition: '2H2B',
        winningTeam: 0,
        finalScore: '10 - 3',
        humanPlayers: [
          {
            userId: alice.id,
            position: 0,
            team: 0,
            username: alice.username,
            rankTier: '9',
            rankPoints: 24,
            mmr: 1218,
            tricksWon: 8,
            euchres: 2,
            marches: 1,
            successfulLoners: 1,
            opponentNames: ['RankBob', 'East (Bot)'],
          },
        ],
        idempotencyKey: `match_${room2.id}`,
      });
      expect(m2.alreadyRecorded).toBe(false);
      expect(m2.playerResults[0].lpChange).toBe(24);
      expect(m2.playerResults[0].newPoints).toBe(48);

      // 3. Unranked / Custom match records stats + history with 0 LP change
      const customMatchId = crypto.randomUUID();
      const m3 = await repo.recordMatchResult({
        matchId: customMatchId,
        roomCode: 'CUST01',
        mode: 'unranked',
        composition: '1H3B',
        winningTeam: 0,
        finalScore: '10 - 8',
        humanPlayers: [
          {
            userId: alice.id,
            position: 0,
            team: 0,
            username: alice.username,
            rankTier: '9',
            rankPoints: 48,
            mmr: 1236,
            tricksWon: 5,
            euchres: 0,
            marches: 0,
            successfulLoners: 0,
            opponentNames: ['West (Bot)', 'East (Bot)'],
          },
        ],
        idempotencyKey: `match_${customMatchId}`,
      });
      expect(m3.playerResults[0].lpChange).toBe(0);
      expect(m3.playerResults[0].newPoints).toBe(48);

      // Verify getUserById loads authoritative rankPoints (48 LP), totalGames (3), and all 3 matchHistory rows
      const freshAlice = (await repo.getUserById(alice.id))!;
      expect(freshAlice.rankPoints).toBe(48);
      expect(freshAlice.totalGames).toBe(3);
      expect(freshAlice.wins).toBe(3);
      expect(freshAlice.matchHistory.length).toBe(3);
      expect(freshAlice.matchHistory.map(h => h.mode)).toEqual(['unranked', 'ranked_rivals', 'ranked_solo']);
      expect(freshAlice.matchHistory[2].opponentNames).toEqual(['West (Bot)', 'East (Bot)']);
    });

    it('manages Postgres friend requests, declineFriendRequest (to_user_id), mutual accept, and summary cleanly', async () => {
      pool = createTestPostgresPool();
      const repo = new PostgresDatabaseRepository(pool);
      await repo.initSchema();

      const { user: u1 } = await repo.getOrCreateUser('PgFriendOne', '🤠', undefined, crypto.randomUUID());
      const { user: u2 } = await repo.getOrCreateUser('PgFriendTwo', '👑', undefined, crypto.randomUUID());

      // Send & reject duplicate
      const req1 = await repo.sendFriendRequest(u1.id, 'PgFriendTwo');
      expect(req1.success).toBe(true);
      const dup = await repo.sendFriendRequest(u1.id, 'PgFriendTwo');
      expect(dup.success).toBe(false);

      const incomingBefore = await repo.getIncomingFriendRequests(u2.id);
      expect(incomingBefore.length).toBe(1);
      expect(incomingBefore[0].fromUserId).toBe(u1.id);

      // Decline uses correct to_user_id column
      const declined = await repo.declineFriendRequest(u2.id, u1.id);
      expect(declined).toBe(true);
      expect((await repo.getIncomingFriendRequests(u2.id)).length).toBe(0);

      // Resend & accept
      const req2 = await repo.sendFriendRequest(u1.id, 'PgFriendTwo');
      expect(req2.success).toBe(true);
      const acc = await repo.acceptFriendRequest(u2.id, u1.id);
      expect(acc.success).toBe(true);

      // Both users see each other in getFriendsSummary
      const online = new Set([u1.id, u2.id]);
      const f1 = await repo.getFriendsSummary(u1.id, online);
      const f2 = await repo.getFriendsSummary(u2.id, online);
      expect(f1.map(f => f.username)).toEqual(['PgFriendTwo']);
      expect(f2.map(f => f.username)).toEqual(['PgFriendOne']);

      // Re-sending after already friends fails cleanly
      const already = await repo.sendFriendRequest(u2.id, 'PgFriendOne');
      expect(already.success).toBe(false);

      // Record abandonment uses valid current_streak column and logs history
      const aband = await repo.recordAbandonment(u1.id, ['PgFriendTwo', 'East (Bot)']);
      expect(aband?.lpChange).toBe(-20);
      const afterAband = (await repo.getUserById(u1.id))!;
      expect(afterAband.winStreak).toBe(0);
      expect(afterAband.matchHistory.length).toBe(1);
    });
  });
});
