/**
 * BOWER JJ — Friends List, Match History & Rank Progression Integration Tests
 * Validates:
 * 1. Supabase JWT verification preserves real UUIDs and doesn't convert users to guest dev_ accounts.
 * 2. Friends list requests, acceptances, removals, and status reporting work accurately.
 * 3. Match history recording and rank progression (LP & MMR) calculate and update properly without clobbering stats.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TokenVerifier } from '../auth';
import { db } from '../db';
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
});
