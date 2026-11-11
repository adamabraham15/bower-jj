/**
 * BOWER JJ — Stage 4.1 Automated Test Suite
 * Tests Token Verification, Identity Protection, Spoof Prevention, and Idempotent Legacy Migration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TokenVerifier } from '../auth';
import { db } from '../db';
import { runLegacyMigration } from '../db/migrateLegacy';

describe('Stage 4.1: Token Verification & Impersonation Prevention', () => {
  const verifier = new TokenVerifier();

  it('generates consistent verified identity in offline/dev fallback mode', async () => {
    const identity = await verifier.verifyToken(
      'tok_sample_session_123',
      'HonestPlayer',
      '🤠'
    );

    expect(identity).not.toBeNull();
    expect(identity?.username).toBe('HonestPlayer');
    expect(identity?.avatarIcon).toBe('🤠');
    expect(identity?.isGuest).toBe(true);
    expect(identity?.userId).toBe('usr_sample_session_123');
  });

  it('prevents username-based account takeover when verified ID is supplied', () => {
    // 1. Legitimate user registers with Supabase Auth UUID
    const authUserId = '00000000-0000-4000-8000-000000000001';
    const { user: realUser } = db.getOrCreateUser(
      'OriginalBowerKing',
      '👑',
      undefined,
      authUserId
    );

    expect(realUser.id).toBe(authUserId);
    expect(realUser.username).toBe('OriginalBowerKing');

    // 2. An impersonator connects with the SAME username but a different/attacker userId
    const attackerId = '99999999-9999-4000-8000-999999999999';
    const { user: attackerUser } = db.getOrCreateUser(
      'OriginalBowerKing',
      '🥷',
      undefined,
      attackerId
    );

    // The attacker MUST NOT be logged into the legitimate user's account!
    expect(attackerUser.id).toBe(attackerId);
    expect(attackerUser.id).not.toBe(realUser.id);
  });

  it('preserves user stats and sessions when logging in with verified ID', () => {
    const userId = '00000000-0000-4000-8000-000000000042';
    const { user, sessionToken } = db.getOrCreateUser(
      'ConsistentPlayer',
      '🤠',
      undefined,
      userId
    );

    expect(user.id).toBe(userId);

    // Update player progression
    db.updateUser(userId, { xp: 1200, level: 3 });

    // Subsequent login with same userId must retrieve updated stats
    const relogin = db.getOrCreateUser(
      'ConsistentPlayer',
      '🤠',
      sessionToken,
      userId
    );

    expect(relogin.user.xp).toBe(1200);
    expect(relogin.user.level).toBe(3);
  });
});

describe('Stage 4.1: Legacy Player Data Migration Suite', () => {
  const testDbDir = path.resolve(__dirname, '../../test_migration_sandbox');
  const testDbPath = path.join(testDbDir, 'test_db.json');
  const testSqlOut = path.join(testDbDir, 'test_migration.sql');

  beforeEach(() => {
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }

    // Sample legacy database with intentional duplicate username to verify collision detection
    const sampleLegacyData = {
      users: {
        usr_alpha1: {
          id: 'usr_alpha1',
          username: 'MasterEuchre',
          avatarIcon: '👑',
          level: 5,
          xp: 4200,
          rankTier: 'A',
          rankPoints: 85,
          hiddenMMR: 1850,
          wins: 40,
          losses: 10,
          totalGames: 50,
          tricksWon: 190,
          euchres: 25,
          marches: 18,
          successfulLoners: 8,
          winStreak: 6,
          bestWinStreak: 9,
          createdAt: 1700000000000,
          lastActive: 1700050000000,
          equippedCosmetics: { banner: 'golden_royale' },
          unlockedCosmetics: ['golden_royale', 'classic_blue'],
        },
        usr_alpha2: {
          id: 'usr_alpha2',
          username: 'MasterEuchre', // Duplicate username collision!
          avatarIcon: '🤠',
          level: 1,
          xp: 200,
          rankTier: '9',
          rankPoints: 20,
          hiddenMMR: 1200,
          wins: 1,
          losses: 1,
          totalGames: 2,
          tricksWon: 6,
          euchres: 0,
          marches: 0,
          successfulLoners: 0,
          winStreak: 0,
          bestWinStreak: 1,
          createdAt: 1700010000000,
          lastActive: 1700010000000,
        },
        usr_beta1: {
          id: 'usr_beta1',
          username: 'LonerQueen',
          avatarIcon: '🧝',
          level: 4,
          xp: 3100,
          rankTier: 'K',
          rankPoints: 60,
          hiddenMMR: 1620,
          wins: 25,
          losses: 8,
          totalGames: 33,
          tricksWon: 110,
          euchres: 12,
          marches: 9,
          successfulLoners: 5,
          winStreak: 2,
          bestWinStreak: 7,
          createdAt: 1700020000000,
          lastActive: 1700040000000,
        },
      },
      sessions: {
        tok_alpha: 'usr_alpha1',
      },
      reports: [],
    };

    fs.writeFileSync(testDbPath, JSON.stringify(sampleLegacyData, null, 2), 'utf-8');
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testDbDir)) {
        fs.rmSync(testDbDir, { recursive: true, force: true });
      }
    } catch {
      // Ignored
    }
  });

  it('creates automatic backup, flags duplicates, and generates valid relational SQL', () => {
    const report = runLegacyMigration(testDbPath, testSqlOut);

    // 1. Report accuracy
    expect(report.totalUsersFound).toBe(3);
    expect(report.migratedCount).toBe(2); // MasterEuchre (first) + LonerQueen
    expect(report.duplicateUsernamesFound.length).toBe(1); // Second duplicate flagged
    expect(report.duplicateUsernamesFound).toContain('MasterEuchre');

    // 2. Backup created and intact
    expect(fs.existsSync(report.backupFile)).toBe(true);
    const backupContent = fs.readFileSync(report.backupFile, 'utf-8');
    expect(backupContent).toContain('MasterEuchre');

    // 3. SQL output generated with idempotent INSERT ... ON CONFLICT
    expect(fs.existsSync(testSqlOut)).toBe(true);
    const sql = fs.readFileSync(testSqlOut, 'utf-8');
    expect(sql).toContain('INSERT INTO public.profiles');
    expect(sql).toContain('ON CONFLICT (username) DO NOTHING');
    expect(sql).toContain('INSERT INTO public.player_ranks');
    expect(sql).toContain('ON CONFLICT (user_id) DO UPDATE');
    expect(sql).toContain('INSERT INTO public.player_xp');
    expect(sql).toContain('INSERT INTO public.player_statistics');
    expect(sql).toContain('LonerQueen');
  });

  it('runs idempotently without failing or corrupting data on repeated runs', () => {
    const run1 = runLegacyMigration(testDbPath, testSqlOut);
    const run2 = runLegacyMigration(testDbPath, testSqlOut);

    expect(run1.migratedCount).toBe(run2.migratedCount);
    expect(run1.duplicateUsernamesFound.length).toBe(run2.duplicateUsernamesFound.length);
  });
});
