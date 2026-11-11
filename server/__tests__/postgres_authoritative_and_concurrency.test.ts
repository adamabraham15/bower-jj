/**
 * BOWER JJ — Stage 4.5 PostgreSQL Migration & Authoritative Database Cutover Test Suite
 *
 * Verifies:
 * 1. PostgreSQL connection pooling and health diagnostics.
 * 2. Profile reads, updates, and constraint integrity.
 * 3. Transactional competitive progression (atomic rank, LP, MMR, XP, battle pass).
 * 4. Idempotency protection against duplicate match rewards.
 * 5. Multi-instance concurrency across independent server nodes sharing the database.
 * 6. Transaction rollback and zero-partial-write safety on failure.
 * 7. Clustered active-match persistence in PostgreSQL for horizontal scaling.
 * 8. Legacy JSON migration integrity and value parity verification.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { newDb } from 'pg-mem';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PostgresDatabaseRepository } from '../db/postgres';
import { executePostgresMigration } from '../../scripts/migrate_to_postgres';
import { createPostgresBackup } from '../db/postgres_backup';
import { restorePostgresBackup } from '../db/postgres_restore';
import { UserAccount } from '../types';
import { createMultiplayerServer } from '../index';
import { WebSocket } from 'ws';

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

describe('Stage 4.5: PostgreSQL Migration & Authoritative Database Cutover', () => {
  let pool: any;
  let repoInstanceA: PostgresDatabaseRepository;
  let repoInstanceB: PostgresDatabaseRepository;

  beforeEach(async () => {
    pool = createTestPostgresPool();
    repoInstanceA = new PostgresDatabaseRepository(pool);
    repoInstanceB = new PostgresDatabaseRepository(pool);
    await repoInstanceA.initSchema();
  });

  afterEach(async () => {
    await repoInstanceA.close();
    await repoInstanceB.close();
  });

  // ---------------------------------------------------------------------------
  // 1. CONNECTION POOLING & HEALTH DIAGNOSTICS
  // ---------------------------------------------------------------------------
  it('establishes connection pool and returns healthy diagnostics', async () => {
    const health = await repoInstanceA.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.error).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 2. PROFILE READS, WRITES & STRICT UNIQUE CONSTRAINTS
  // ---------------------------------------------------------------------------
  it('creates and updates player profiles with atomic persistence', async () => {
    const { user, sessionToken } = await repoInstanceA.getOrCreateUser('MasterBower', '👑');
    expect(user.id).toBeDefined();
    expect(user.username).toBe('MasterBower');
    expect(user.avatarIcon).toBe('👑');
    expect(user.rankTier).toBe('9');
    expect(user.rankPoints).toBe(0);
    expect(user.mmr).toBe(1200);

    // Update player profile
    const updated = await repoInstanceA.updateUser(user.id, {
      rankTier: '10',
      rankPoints: 45,
      mmr: 1280,
      equippedCosmetics: {
        hat: '🥷',
        cardBack: 'midnight_black',
        banner: 'cyber_purple',
        title: 'Bower Master',
      },
    });

    expect(updated).not.toBeNull();
    expect(updated!.rankTier).toBe('10');
    expect(updated!.rankPoints).toBe(45);
    expect(updated!.mmr).toBe(1280);
    expect(updated!.equippedCosmetics.cardBack).toBe('midnight_black');

    // Instance B reads the updated profile from shared PostgreSQL
    const readFromB = await repoInstanceB.getUserById(user.id);
    expect(readFromB).not.toBeNull();
    expect(readFromB!.rankTier).toBe('10');
    expect(readFromB!.rankPoints).toBe(45);
    expect(readFromB!.equippedCosmetics.cardBack).toBe('midnight_black');
  });

  // ---------------------------------------------------------------------------
  // 3. TRANSACTIONAL COMPETITIVE PROGRESSION
  // ---------------------------------------------------------------------------
  it('atomically records match results, updating rank, LP, MMR, statistics, and XP', async () => {
    const p1 = (await repoInstanceA.getOrCreateUser('WinnerNorth', '🤠')).user;
    const p2 = (await repoInstanceA.getOrCreateUser('LoserEast', '👽')).user;

    const result = await repoInstanceA.recordMatchResult({
      matchId: 'match_pg_001',
      roomCode: 'RM1001',
      mode: 'ranked_solo',
      composition: '4H',
      winningTeam: 0,
      finalScore: '10 - 8',
      durationSeconds: 145,
      humanPlayers: [
        {
          userId: p1.id,
          position: 0,
          team: 0,
          username: p1.username,
          rankTier: p1.rankTier,
          rankPoints: p1.rankPoints,
          mmr: p1.mmr,
          tricksWon: 6,
          euchres: 1,
          marches: 1,
          successfulLoners: 0,
        },
        {
          userId: p2.id,
          position: 1,
          team: 1,
          username: p2.username,
          rankTier: p2.rankTier,
          rankPoints: p2.rankPoints,
          mmr: p2.mmr,
          tricksWon: 4,
          euchres: 0,
          marches: 0,
          successfulLoners: 0,
        },
      ],
      idempotencyKey: 'idemp_match_pg_001',
    });

    expect(result.success).toBe(true);
    expect(result.alreadyRecorded).toBe(false);
    expect(result.playerResults.length).toBe(2);

    const winnerRes = result.playerResults.find((r) => r.userId === p1.id)!;
    expect(winnerRes.won).toBe(true);
    expect(winnerRes.lpChange).toBe(24);
    expect(winnerRes.newPoints).toBe(24);
    expect(winnerRes.newMmr).toBe(1218);
    expect(winnerRes.newXp).toBe(350);

    const loserRes = result.playerResults.find((r) => r.userId === p2.id)!;
    expect(loserRes.won).toBe(false);
    expect(loserRes.lpChange).toBe(-16);
    expect(loserRes.newPoints).toBe(0); // Demotion floor at 9 rank
    expect(loserRes.newMmr).toBe(1186);

    // Verify persistence in PostgreSQL
    const p1InDb = (await repoInstanceA.getUserById(p1.id))!;
    expect(p1InDb.wins).toBe(1);
    expect(p1InDb.losses).toBe(0);
    expect(p1InDb.totalGames).toBe(1);
    expect(p1InDb.tricksWon).toBe(6);

    const p2InDb = (await repoInstanceA.getUserById(p2.id))!;
    expect(p2InDb.wins).toBe(0);
    expect(p2InDb.losses).toBe(1);
    expect(p2InDb.totalGames).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // 4. IDEMPOTENCY KEY & DUPLICATE REWARD PREVENTION
  // ---------------------------------------------------------------------------
  it('prevents duplicate rewards when match completion message is repeated', async () => {
    const p1 = (await repoInstanceA.getOrCreateUser('IdempPlayer', '⚡')).user;

    const matchPayload = {
      matchId: 'match_dup_check',
      roomCode: 'DUP001',
      mode: 'ranked_solo' as const,
      composition: '4H' as const,
      winningTeam: 0,
      finalScore: '10 - 4',
      humanPlayers: [
        {
          userId: p1.id,
          position: 0 as const,
          team: 0,
          username: p1.username,
          rankTier: p1.rankTier,
          rankPoints: p1.rankPoints,
          mmr: p1.mmr,
          tricksWon: 8,
          euchres: 2,
          marches: 2,
          successfulLoners: 0,
        },
      ],
      idempotencyKey: 'idemp_key_unique_777',
    };

    // 1. Initial Match Submission
    const firstCall = await repoInstanceA.recordMatchResult(matchPayload);
    expect(firstCall.success).toBe(true);
    expect(firstCall.alreadyRecorded).toBe(false);

    const p1AfterFirst = (await repoInstanceA.getUserById(p1.id))!;
    expect(p1AfterFirst.rankPoints).toBe(24);
    expect(p1AfterFirst.wins).toBe(1);

    // 2. Duplicate Match Submission via Instance B
    const duplicateCall = await repoInstanceB.recordMatchResult(matchPayload);
    expect(duplicateCall.success).toBe(true);
    expect(duplicateCall.alreadyRecorded).toBe(true);
    expect(duplicateCall.playerResults.length).toBe(0); // Zero rewards awarded!

    // Verify player stats were NOT incremented twice
    const p1AfterDuplicate = (await repoInstanceB.getUserById(p1.id))!;
    expect(p1AfterDuplicate.rankPoints).toBe(24); // Still 24 LP, not 48 LP!
    expect(p1AfterDuplicate.wins).toBe(1); // Still 1 win, not 2 wins!
  });

  // ---------------------------------------------------------------------------
  // 5. MULTI-INSTANCE CONCURRENCY (TWO SERVERS, SHARED POSTGRESQL)
  // ---------------------------------------------------------------------------
  it('supports two independent server instances modifying shared player data without lost updates', async () => {
    const sharedPlayer = (await repoInstanceA.getOrCreateUser('ConcurrentPro', '🧝')).user;

    // Both instances update different aspects of the same player concurrently
    await Promise.all([
      repoInstanceA.updateUser(sharedPlayer.id, { xp: 800, level: 2 }),
      repoInstanceB.updateUser(sharedPlayer.id, { rankTier: 'Q', rankPoints: 80 }),
    ]);

    const finalPlayer = (await repoInstanceA.getUserById(sharedPlayer.id))!;
    expect(finalPlayer.xp).toBe(800);
    expect(finalPlayer.level).toBe(2);
    expect(finalPlayer.rankTier).toBe('Q');
    expect(finalPlayer.rankPoints).toBe(80);
  });

  // ---------------------------------------------------------------------------
  // 6. FAILED TRANSACTION ROLLBACK SAFETY
  // ---------------------------------------------------------------------------
  it('aborts cleanly and issues ROLLBACK on error, preventing corrupted state', async () => {
    const p = (await repoInstanceA.getOrCreateUser('RollbackTest', '🤖')).user;

    const client = await repoInstanceA.getPool().connect();
    let rollbackExecuted = false;
    let queryFailed = false;

    try {
      await client.query('BEGIN');
      // Intentionally invalid statement triggering constraint error
      await client.query(`INSERT INTO public.player_ranks (user_id, rank_tier) VALUES ('00000000-0000-0000-0000-000000000000', 'INVALID')`);
      await client.query('COMMIT');
    } catch {
      queryFailed = true;
      await client.query('ROLLBACK');
      rollbackExecuted = true;
    } finally {
      client.release();
    }

    expect(queryFailed).toBe(true);
    expect(rollbackExecuted).toBe(true);

    // Verify player state is completely unaffected
    const playerCheck = (await repoInstanceA.getUserById(p.id))!;
    expect(playerCheck.rankPoints).toBe(0);
    expect(playerCheck.username).toBe('RollbackTest');
  });

  // ---------------------------------------------------------------------------
  // 7. SHARED ACTIVE-MATCH PERSISTENCE (CLUSTERED HORIZONTAL SCALING)
  // ---------------------------------------------------------------------------
  it('shares active match state across instances via PostgreSQL active_matches table', async () => {
    const host = (await repoInstanceA.getOrCreateUser('ClusterHost', '👑')).user;

    const room: any = {
      code: 'CLUST1',
      hostUserId: host.id,
      status: 'playing',
      rules: { targetScore: 10 },
      slots: [{ position: 0, userId: host.id, username: host.username, isAI: false }],
    };

    const state: any = {
      phase: 'playing',
      dealer: 0,
      currentTurn: 1,
      scores: [4, 2],
      currentTrick: { cards: [{ player: 0, card: { id: 'card_1', suit: 'hearts', rank: 'A' } }] },
    };

    // Instance A writes active game state to PostgreSQL
    await repoInstanceA.saveActiveMatch('CLUST1', host.id, room, state);

    // Instance B loads all in-flight matches from PostgreSQL
    const loadedOnB = await repoInstanceB.loadActiveMatches(15);
    expect(loadedOnB.length).toBeGreaterThan(0);

    const matchOnB = loadedOnB.find((m) => m.room.code === 'CLUST1')!;
    expect(matchOnB).toBeDefined();
    expect(matchOnB.state.scores).toEqual([4, 2]);
    expect(matchOnB.state.currentTrick.cards.length).toBe(1);

    // Instance B deletes the active match after completion
    await repoInstanceB.deleteActiveMatch('CLUST1');

    // Instance A confirms it has been purged from shared cluster storage
    const remainingOnA = await repoInstanceA.loadActiveMatches(15);
    expect(remainingOnA.find((m) => m.room.code === 'CLUST1')).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 8. LEGACY JSON DATA MIGRATION INTEGRITY & VALUE PARITY
  // ---------------------------------------------------------------------------
  it('executes full 10-step legacy migration from db.json and validates value parity', async () => {
    // Create an isolated sample db.json
    const sampleDir = path.resolve(process.cwd(), 'server', 'data', 'test_migration_sandbox');
    if (!fs.existsSync(sampleDir)) fs.mkdirSync(sampleDir, { recursive: true });
    const sampleFile = path.join(sampleDir, 'sample_legacy_db.json');

    const sampleUsers: Record<string, UserAccount> = {
      usr_legacy_1: {
        id: 'usr_legacy_1',
        username: 'VeteranEuchre',
        avatarIcon: '🤠',
        level: 4,
        xp: 3200,
        rankTier: 'K',
        rankPoints: 85,
        mmr: 1420,
        placementMatchesRemaining: 0,
        hasDemotionShield: false,
        totalGames: 25,
        wins: 18,
        losses: 7,
        tricksWon: 85,
        euchres: 6,
        marches: 9,
        successfulLoners: 2,
        winStreak: 3,
        bestWinStreak: 8,
        equippedCosmetics: {
          hat: '🤠',
          cardBack: 'golden_bower',
          banner: 'golden_royale',
          title: 'Loner Legend',
        },
        battlePass: {
          tier: 7,
          xp: 220,
          tierXpRequired: 500,
          isPremium: true,
          claimedFreeTiers: [1, 2, 3],
          claimedPremiumTiers: [1, 2],
        },
        friends: ['usr_legacy_2'],
        createdAt: 1794300000000,
        lastActive: 1794350000000,
      },
      usr_legacy_2: {
        id: 'usr_legacy_2',
        username: 'PartnerJack',
        avatarIcon: '🥷',
        level: 2,
        xp: 1100,
        rankTier: '10',
        rankPoints: 30,
        mmr: 1240,
        placementMatchesRemaining: 2,
        hasDemotionShield: false,
        totalGames: 10,
        wins: 6,
        losses: 4,
        tricksWon: 28,
        euchres: 1,
        marches: 2,
        successfulLoners: 0,
        winStreak: 1,
        bestWinStreak: 3,
        friends: ['usr_legacy_1'],
        createdAt: 1794310000000,
        lastActive: 1794351000000,
      },
    };

    fs.writeFileSync(sampleFile, JSON.stringify({ users: sampleUsers }, null, 2), 'utf-8');

    // Run the migration pipeline with a dedicated fresh pool
    const migrationPool = createTestPostgresPool();
    const migrationRepo = new PostgresDatabaseRepository(migrationPool);
    const migrationReport = await executePostgresMigration(migrationPool, sampleFile);

    expect(migrationReport.success).toBe(true);
    expect(migrationReport.verificationPassed).toBe(true);
    expect(migrationReport.migratedProfiles).toBe(2);
    expect(migrationReport.migratedRanks).toBe(2);
    expect(migrationReport.migratedStats).toBe(2);
    expect(migrationReport.migratedFriendships).toBe(2);

    // Verify value parity in PostgreSQL
    const migratedUser = await migrationRepo.getUserByUsername('VeteranEuchre');
    expect(migratedUser).not.toBeNull();
    expect(migratedUser!.rankTier).toBe('K');
    expect(migratedUser!.rankPoints).toBe(85);
    expect(migratedUser!.mmr).toBe(1420);
    expect(migratedUser!.wins).toBe(18);
    expect(migratedUser!.losses).toBe(7);
    expect(migratedUser!.equippedCosmetics.cardBack).toBe('golden_bower');
    expect(migratedUser!.battlePass?.tier).toBe(7);
    expect(migratedUser!.battlePass?.isPremium).toBe(true);

    await migrationRepo.close();
    expect(migratedUser!.equippedCosmetics.cardBack).toBe('golden_bower');
    expect(migratedUser!.battlePass?.tier).toBe(7);
    expect(migratedUser!.battlePass?.isPremium).toBe(true);

    // Clean test sandbox
    try {
      fs.unlinkSync(sampleFile);
      fs.unlinkSync(`${sampleFile}.legacy_readonly.json`);
      fs.unlinkSync(migrationReport.backupFile);
      fs.rmdirSync(sampleDir);
    } catch {}
  });

  it('wires into createMultiplayerServer and exposes PostgreSQL health and ready status', async () => {
    const serverInstance = await createMultiplayerServer(0, undefined, undefined, repoInstanceA);
    try {
      const port = serverInstance.port;
      const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
      const healthData = (await healthRes.json()) as any;
      expect(healthRes.status).toBe(200);
      expect(healthData.database.provider).toBe('postgresql');
      expect(healthData.database.authoritative).toBe(true);
      expect(healthData.dbStatus).toBe('healthy');

      const readyRes = await fetch(`http://127.0.0.1:${port}/ready`);
      const readyData = (await readyRes.json()) as any;
      expect(readyRes.status).toBe(200);
      expect(readyData.ready).toBe(true);

      // Verify WebSocket authentication persists directly into PostgreSQL
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'AUTH',
            username: 'PostgresGamer',
            avatarIcon: '👑',
          }));
        });
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'AUTH_SUCCESS') {
            expect(msg.user.username).toBe('PostgresGamer');
            ws.close();
            resolve();
          }
        });
        ws.on('error', reject);
      });

      // Verify record is in PostgreSQL
      const dbUser = await repoInstanceA.getUserByUsername('PostgresGamer');
      expect(dbUser).not.toBeNull();
      expect(dbUser!.username).toBe('PostgresGamer');
    } finally {
      await serverInstance.close();
    }
  });

  it('enforces production fail-safe: refuses to start without DATABASE_URL and prohibits db.json fallback', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevDbUrl = process.env.DATABASE_URL;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DATABASE_URL;

      await expect(createMultiplayerServer(0)).rejects.toThrow(
        /Production environment requires authoritative PostgreSQL database connection via DATABASE_URL/
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevDbUrl) process.env.DATABASE_URL = prevDbUrl;
    }
  });

  it('prevents duplicate battle pass reward claims across multiple concurrent server nodes', async () => {
    const user = await repoInstanceA.getOrCreateUser('PassChallenger', '🎯');
    // Set battle pass tier to 5
    await pool.query(
      `UPDATE player_battle_pass
       SET tier = 5, is_premium = true, claimed_free_tiers = '{}'
       WHERE user_id = $1`,
      [user.user.id]
    );

    // Node A claims Tier 3 reward
    const claimA = await repoInstanceA.claimPassReward(user.user.id, 3, false);
    expect(claimA.success).toBe(true);
    expect(claimA.item).toBe('🎩 Top Hat');

    // Node B attempts to claim the same Tier 3 reward on a different server instance
    const claimB = await repoInstanceB.claimPassReward(user.user.id, 3, false);
    expect(claimB.success).toBe(false);

    // Verify inventory in PostgreSQL contains exactly one item
    const invRes = await pool.query(
      `SELECT * FROM cosmetic_inventory WHERE user_id = $1 AND item_id = '🎩'`,
      [user.user.id]
    );
    expect(invRes.rows.length).toBe(1);
  });

  it('creates a validated PostgreSQL JSON backup snapshot and verifies dry-run restoration into a separate pool', async () => {
    // Seed sample user
    await repoInstanceA.getOrCreateUser('BackupP1', '👑');

    // Create backup
    const backupRes = await createPostgresBackup(pool);
    expect(backupRes.success).toBe(true);
    expect(backupRes.profilesCount).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(backupRes.backupPath!)).toBe(true);

    // Create a separate test database pool
    const separatePool = createTestPostgresPool();
    const separateRepo = new PostgresDatabaseRepository(separatePool);
    await separateRepo.initSchema();

    // Verify dry run restoration on the separate test database
    const dryRunRes = await restorePostgresBackup(backupRes.backupPath!, separatePool, true);
    expect(dryRunRes.success).toBe(true);
    expect(dryRunRes.dryRun).toBe(true);
    expect(dryRunRes.restoredProfiles).toBe(backupRes.profilesCount);

    // Verify live commit restoration on the separate test database
    const liveRestoreRes = await restorePostgresBackup(backupRes.backupPath!, separatePool, false);
    expect(liveRestoreRes.success).toBe(true);
    expect(liveRestoreRes.dryRun).toBe(false);

    // Verify player progression survived restoration in separate database
    const restoredUser = await separateRepo.getUserByUsername('BackupP1');
    expect(restoredUser).not.toBeNull();
    expect(restoredUser!.username).toBe('BackupP1');

    await separateRepo.close();

    // Clean up backup file
    try {
      fs.unlinkSync(backupRes.backupPath!);
    } catch {}
  });
});
