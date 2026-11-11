/**
 * BOWER JJ — Legacy Database Migration Utility
 * Migrates server/data/db.json into PostgreSQL / Supabase relational architecture.
 * Produces timestamped backups, conflict analysis, and an auditable migration report.
 */

import fs from 'fs';
import path from 'path';
import { UserAccount, RankTier } from '../types';

export interface MigrationReport {
  timestamp: string;
  sourceFile: string;
  backupFile: string;
  totalUsersFound: number;
  migratedCount: number;
  duplicateUsernamesFound: string[];
  skippedRecords: { id: string; username: string; reason: string }[];
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  sqlOutputPath?: string;
}

export function runLegacyMigration(
  sourcePath: string = path.resolve(process.cwd(), 'server', 'data', 'db.json'),
  customSqlOut?: string
): MigrationReport {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${sourcePath}.backup.${timestamp}.json`;
  const reportPath = path.resolve(process.cwd(), 'server', 'data', `migration_report_${timestamp}.json`);
  const sqlPath = customSqlOut || path.resolve(process.cwd(), 'server', 'data', `legacy_migration_${timestamp}.sql`);

  if (!fs.existsSync(sourcePath)) {
    return {
      timestamp: new Date().toISOString(),
      sourceFile: sourcePath,
      backupFile: '',
      totalUsersFound: 0,
      migratedCount: 0,
      duplicateUsernamesFound: [],
      skippedRecords: [],
      status: 'FAILED',
    };
  }

  // 1. Create Timestamped Backup
  fs.copyFileSync(sourcePath, backupPath);

  const raw = fs.readFileSync(sourcePath, 'utf-8');
  let data: { users?: Record<string, UserAccount> } = {};
  try {
    data = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`Failed to parse legacy database: ${err.message}`);
  }

  const users = Object.values(data.users || {});
  const seenUsernames = new Set<string>();
  const duplicateUsernames: string[] = [];
  const validUsers: UserAccount[] = [];
  const skipped: { id: string; username: string; reason: string }[] = [];

  // 2. Validate and Detect Conflicts
  for (const u of users) {
    if (!u.id || !u.username) {
      skipped.push({ id: u.id || 'unknown', username: u.username || 'unknown', reason: 'Missing id or username' });
      continue;
    }

    const lowerName = u.username.toLowerCase();
    if (seenUsernames.has(lowerName)) {
      duplicateUsernames.push(u.username);
      skipped.push({ id: u.id, username: u.username, reason: 'Duplicate username conflict in legacy data' });
      continue;
    }

    seenUsernames.add(lowerName);
    validUsers.push(u);
  }

  // 3. Generate Idempotent SQL Inserts for PostgreSQL / Supabase
  const sqlStatements: string[] = [
    '--',
    `-- BOWER JJ LEGACY DATA MIGRATION: ${new Date().toISOString()}`,
    `-- Migrated ${validUsers.length} legacy accounts from ${sourcePath}`,
    '--',
    'BEGIN;',
    '',
  ];

  for (const u of validUsers) {
    const playerId = `JJ-${(u.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '1000').toUpperCase()}`;
    const cleanUsername = u.username.replace(/'/g, "''");
    const avatar = (u.avatarIcon || '🤠').replace(/'/g, "''");
    const tier = (u.rankTier as RankTier) || '9';
    const lp = Math.min(100, Math.max(0, u.rankPoints || 0));
    const mmr = u.mmr || 1200;
    const level = Math.max(1, u.level || 1);
    const xp = Math.max(0, u.xp || 0);

    // Insert or update profiles
    sqlStatements.push(`-- Legacy User: ${cleanUsername} (${u.id})`);
    sqlStatements.push(`
      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        '${playerId}',
        '${cleanUsername}',
        '${avatar}',
        TO_TIMESTAMP(${Math.floor((u.createdAt || Date.now()) / 1000)}),
        TO_TIMESTAMP(${Math.floor((u.lastActive || Date.now()) / 1000)})
      )
      ON CONFLICT (username) DO NOTHING;
    `);

    // Insert statistics
    sqlStatements.push(`
      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, ${u.totalGames || 0}, ${u.wins || 0}, ${u.losses || 0}, ${u.tricksWon || 0},
        ${u.euchres || 0}, ${u.marches || 0}, ${u.successfulLoners || 0}, ${u.winStreak || 0}, ${u.bestWinStreak || 0}
      FROM public.profiles p WHERE p.username = '${cleanUsername}'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    `);

    // Insert rank
    sqlStatements.push(`
      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '${tier}', ${lp}, ${mmr}, ${u.placementMatchesRemaining ?? 0}, ${Boolean(u.hasDemotionShield)}
      FROM public.profiles p WHERE p.username = '${cleanUsername}'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    `);

    // Insert XP
    sqlStatements.push(`
      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, ${level}, ${xp}, 1000
      FROM public.profiles p WHERE p.username = '${cleanUsername}'
      ON CONFLICT (user_id) DO NOTHING;
    `);

    // Insert Cosmetics
    const hat = (u.equippedCosmetics?.hat || '🤠').replace(/'/g, "''");
    const cb = (u.equippedCosmetics?.cardBack || 'classic_blue').replace(/'/g, "''");
    const banner = (u.equippedCosmetics?.banner || 'default_navy').replace(/'/g, "''");
    const title = (u.equippedCosmetics?.title || 'Recruit').replace(/'/g, "''");

    sqlStatements.push(`
      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '${hat}', '${cb}', '${banner}', '${title}'
      FROM public.profiles p WHERE p.username = '${cleanUsername}'
      ON CONFLICT (user_id) DO NOTHING;
    `);

    // Insert Seasonal Battle Pass
    if (u.battlePass) {
      const bpTier = u.battlePass.tier || 1;
      const bpXp = u.battlePass.xp || 0;
      const bpReq = u.battlePass.tierXpRequired || 500;
      const bpPrem = Boolean(u.battlePass.isPremium);
      const freeClaimed = JSON.stringify(u.battlePass.claimedFreeTiers || []).replace('[', '{').replace(']', '}');
      const premClaimed = JSON.stringify(u.battlePass.claimedPremiumTiers || []).replace('[', '{').replace(']', '}');
      sqlStatements.push(`
        INSERT INTO public.player_battle_pass (user_id, season_id, tier, xp, tier_xp_required, is_premium, claimed_free_tiers, claimed_premium_tiers)
        SELECT p.id, 1, ${bpTier}, ${bpXp}, ${bpReq}, ${bpPrem}, '${freeClaimed}'::INT[], '${premClaimed}'::INT[]
        FROM public.profiles p WHERE p.username = '${cleanUsername}'
        ON CONFLICT (user_id, season_id) DO UPDATE SET
          tier = EXCLUDED.tier,
          xp = EXCLUDED.xp,
          is_premium = EXCLUDED.is_premium;
      `);
    }

    // Insert Achievements
    if (Array.isArray(u.achievements)) {
      for (const ach of u.achievements) {
        const cleanAch = ach.replace(/'/g, "''");
        sqlStatements.push(`
          INSERT INTO public.player_achievements (user_id, achievement_id, progress, completed, completed_at)
          SELECT p.id, '${cleanAch}', 100, true, NOW()
          FROM public.profiles p WHERE p.username = '${cleanUsername}'
          ON CONFLICT (user_id, achievement_id) DO NOTHING;
        `);
      }
    }

    // Insert Unlocked Cosmetics into Inventory
    if (Array.isArray(u.unlockedCosmetics)) {
      for (const item of u.unlockedCosmetics) {
        const cleanItem = item.replace(/'/g, "''");
        let cat = 'cardBack';
        if (cleanItem.startsWith('hat_') || cleanItem.includes('hat')) cat = 'hat';
        else if (cleanItem.includes('banner') || cleanItem.includes('navy') || cleanItem.includes('crimson')) cat = 'banner';
        else if (cleanItem.includes('title') || ['Recruit', 'Trick Collector', 'The Undefeated'].includes(cleanItem)) cat = 'title';

        sqlStatements.push(`
          INSERT INTO public.cosmetic_inventory (user_id, category, item_id)
          SELECT p.id, '${cat}', '${cleanItem}'
          FROM public.profiles p WHERE p.username = '${cleanUsername}'
          ON CONFLICT (user_id, category, item_id) DO NOTHING;
        `);
      }
    }
  }

  // 4. Migrate Social Relationships (Friendships)
  for (const u of validUsers) {
    if (Array.isArray(u.friends)) {
      for (const friendId of u.friends) {
        const friendUser = validUsers.find((v) => v.id === friendId);
        if (friendUser) {
          const u1 = u.username.replace(/'/g, "''");
          const u2 = friendUser.username.replace(/'/g, "''");
          sqlStatements.push(`
            INSERT INTO public.friendships (user_id, friend_id)
            SELECT p1.id, p2.id
            FROM public.profiles p1, public.profiles p2
            WHERE p1.username = '${u1}' AND p2.username = '${u2}'
            ON CONFLICT (user_id, friend_id) DO NOTHING;
          `);
        }
      }
    }
  }

  sqlStatements.push('COMMIT;');

  fs.writeFileSync(sqlPath, sqlStatements.join('\n'), 'utf-8');

  const report: MigrationReport = {
    timestamp: new Date().toISOString(),
    sourceFile: sourcePath,
    backupFile: backupPath,
    totalUsersFound: users.length,
    migratedCount: validUsers.length,
    duplicateUsernamesFound: duplicateUsernames,
    skippedRecords: skipped,
    status: skipped.length === 0 ? 'SUCCESS' : 'PARTIAL',
    sqlOutputPath: sqlPath,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`[MIGRATION] Legacy data backup saved to: ${backupPath}`);
  console.log(`[MIGRATION] Generated idempotent SQL migration: ${sqlPath}`);
  console.log(`[MIGRATION] Processed ${validUsers.length}/${users.length} valid accounts. Duplicates detected: ${duplicateUsernames.length}`);

  return report;
}

// Allow direct CLI execution: node server/db/migrateLegacy.js
if (process.argv[1] && process.argv[1].endsWith('migrateLegacy.ts')) {
  runLegacyMigration();
}
