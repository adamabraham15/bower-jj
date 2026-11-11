--
-- BOWER JJ LEGACY DATA MIGRATION: 2026-11-10T23:02:33.398Z
-- Migrated 55 legacy accounts from C:\Users\adama\.gemini\antigravity\scratch\bower-jj\server\data\db.json
--
BEGIN;

-- Legacy User: TestPlayer (usr_e12759ad9b60)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-9B60',
        'TestPlayer',
        '👑',
        TO_TIMESTAMP(1794347789),
        TO_TIMESTAMP(1794347789)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 2, 2, 0, 10,
        0, 2, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'TestPlayer'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 0, false
      FROM public.profiles p WHERE p.username = 'TestPlayer'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 2, 200, 1000
      FROM public.profiles p WHERE p.username = 'TestPlayer'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'TestPlayer'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: BowerKing (usr_2395123ccf8f)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-CF8F',
        'BowerKing',
        '🪖',
        TO_TIMESTAMP(1794347953),
        TO_TIMESTAMP(1794350959)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'BowerKing'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 0, false
      FROM public.profiles p WHERE p.username = 'BowerKing'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'BowerKing'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'BowerKing'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: HostPlayer1 (usr_b970c1acf83f)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-F83F',
        'HostPlayer1',
        '👑',
        TO_TIMESTAMP(1794348089),
        TO_TIMESTAMP(1794351162)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'HostPlayer1'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 0, false
      FROM public.profiles p WHERE p.username = 'HostPlayer1'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'HostPlayer1'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'HostPlayer1'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: GuestPlayer2 (usr_22dd8064b5d1)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-B5D1',
        'GuestPlayer2',
        '🦊',
        TO_TIMESTAMP(1794348089),
        TO_TIMESTAMP(1794351162)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'GuestPlayer2'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 0, false
      FROM public.profiles p WHERE p.username = 'GuestPlayer2'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'GuestPlayer2'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'GuestPlayer2'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Alpha_rw6gke (usr_8638419b88ed)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-88ED',
        'Alpha_rw6gke',
        '🤠',
        TO_TIMESTAMP(1794348978),
        TO_TIMESTAMP(1794348978)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Alpha_rw6gke'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'Alpha_rw6gke'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Alpha_rw6gke'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Alpha_rw6gke'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: RankTester_djs2od (usr_d0d58a6942a1)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-42A1',
        'RankTester_djs2od',
        '👑',
        TO_TIMESTAMP(1794348978),
        TO_TIMESTAMP(1794348978)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'RankTester_djs2od'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 20, 1220, 4, true
      FROM public.profiles p WHERE p.username = 'RankTester_djs2od'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'RankTester_djs2od'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'RankTester_djs2od'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Underdog_18wmo4 (usr_257f5b6335cc)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-35CC',
        'Underdog_18wmo4',
        '🤠',
        TO_TIMESTAMP(1794348978),
        TO_TIMESTAMP(1794348978)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Underdog_18wmo4'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 35, 1236, 4, true
      FROM public.profiles p WHERE p.username = 'Underdog_18wmo4'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Underdog_18wmo4'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Underdog_18wmo4'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Ascender_82pwyb (usr_af85c9af87d9)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-87D9',
        'Ascender_82pwyb',
        '🚀',
        TO_TIMESTAMP(1794348978),
        TO_TIMESTAMP(1794348978)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Ascender_82pwyb'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '10', 10, 1220, 4, true
      FROM public.profiles p WHERE p.username = 'Ascender_82pwyb'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Ascender_82pwyb'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Ascender_82pwyb'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Shielded_21bzb2j (usr_18ae2a17c641)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-C641',
        'Shielded_21bzb2j',
        '🛡️',
        TO_TIMESTAMP(1794348978),
        TO_TIMESTAMP(1794348978)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Shielded_21bzb2j'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, 'Q', 0, 1190, 4, false
      FROM public.profiles p WHERE p.username = 'Shielded_21bzb2j'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Shielded_21bzb2j'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Shielded_21bzb2j'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Alice_jqtajp (usr_65ba0de89851)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-9851',
        'Alice_jqtajp',
        '🧝',
        TO_TIMESTAMP(1794348978),
        TO_TIMESTAMP(1794348978)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Alice_jqtajp'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'Alice_jqtajp'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Alice_jqtajp'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Alice_jqtajp'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Bob_03qp6c (usr_1eec3f63966a)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-966A',
        'Bob_03qp6c',
        '🧙',
        TO_TIMESTAMP(1794348978),
        TO_TIMESTAMP(1794348978)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Bob_03qp6c'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'Bob_03qp6c'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Bob_03qp6c'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Bob_03qp6c'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: ProgHero_bwmmmn (usr_8147e6183581)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-3581',
        'ProgHero_bwmmmn',
        '⚡',
        TO_TIMESTAMP(1794348978),
        TO_TIMESTAMP(1794348978)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 1, 1, 0, 4,
        1, 1, 0, 1, 1
      FROM public.profiles p WHERE p.username = 'ProgHero_bwmmmn'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'ProgHero_bwmmmn'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 1150, 1000
      FROM public.profiles p WHERE p.username = 'ProgHero_bwmmmn'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'ProgHero_bwmmmn'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: RivalHost_67iu95 (usr_c7f7a23e2d2c)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-2D2C',
        'RivalHost_67iu95',
        '🤠',
        TO_TIMESTAMP(1794348978),
        TO_TIMESTAMP(1794348978)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'RivalHost_67iu95'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'RivalHost_67iu95'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'RivalHost_67iu95'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'RivalHost_67iu95'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: RivalGuest_ztan2 (usr_bd526a5e87cd)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-87CD',
        'RivalGuest_ztan2',
        '🧝',
        TO_TIMESTAMP(1794348978),
        TO_TIMESTAMP(1794348978)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'RivalGuest_ztan2'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'RivalGuest_ztan2'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'RivalGuest_ztan2'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'RivalGuest_ztan2'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Alpha_tmwc7c (usr_0c71b117d008)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-D008',
        'Alpha_tmwc7c',
        '🤠',
        TO_TIMESTAMP(1794350158),
        TO_TIMESTAMP(1794350158)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Alpha_tmwc7c'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'Alpha_tmwc7c'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Alpha_tmwc7c'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Alpha_tmwc7c'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: RankTester_25cnrq (usr_9672f1dfd4a9)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-D4A9',
        'RankTester_25cnrq',
        '👑',
        TO_TIMESTAMP(1794350158),
        TO_TIMESTAMP(1794350158)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'RankTester_25cnrq'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 20, 1220, 4, true
      FROM public.profiles p WHERE p.username = 'RankTester_25cnrq'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'RankTester_25cnrq'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'RankTester_25cnrq'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Underdog_g7fcv (usr_dc541cec91ba)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-91BA',
        'Underdog_g7fcv',
        '🤠',
        TO_TIMESTAMP(1794350158),
        TO_TIMESTAMP(1794350158)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Underdog_g7fcv'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 35, 1236, 4, true
      FROM public.profiles p WHERE p.username = 'Underdog_g7fcv'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Underdog_g7fcv'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Underdog_g7fcv'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Ascender_8l4l8e (usr_4ec9ef194367)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-4367',
        'Ascender_8l4l8e',
        '🚀',
        TO_TIMESTAMP(1794350158),
        TO_TIMESTAMP(1794350158)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Ascender_8l4l8e'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '10', 10, 1220, 4, true
      FROM public.profiles p WHERE p.username = 'Ascender_8l4l8e'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Ascender_8l4l8e'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Ascender_8l4l8e'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Shielded_1vlnxk (usr_253f8115a026)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-A026',
        'Shielded_1vlnxk',
        '🛡️',
        TO_TIMESTAMP(1794350158),
        TO_TIMESTAMP(1794350158)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Shielded_1vlnxk'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, 'Q', 0, 1190, 4, false
      FROM public.profiles p WHERE p.username = 'Shielded_1vlnxk'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Shielded_1vlnxk'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Shielded_1vlnxk'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Alice_u9v0qb (usr_e3ecd909cbae)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-CBAE',
        'Alice_u9v0qb',
        '🧝',
        TO_TIMESTAMP(1794350158),
        TO_TIMESTAMP(1794350158)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Alice_u9v0qb'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'Alice_u9v0qb'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Alice_u9v0qb'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Alice_u9v0qb'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Bob_ixi7m (usr_13dfbdfb23a9)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-23A9',
        'Bob_ixi7m',
        '🧙',
        TO_TIMESTAMP(1794350158),
        TO_TIMESTAMP(1794350158)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Bob_ixi7m'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'Bob_ixi7m'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Bob_ixi7m'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Bob_ixi7m'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: ProgHero_qsww3t (usr_c9aff0195c05)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-5C05',
        'ProgHero_qsww3t',
        '⚡',
        TO_TIMESTAMP(1794350158),
        TO_TIMESTAMP(1794350158)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 1, 1, 0, 4,
        1, 1, 0, 1, 1
      FROM public.profiles p WHERE p.username = 'ProgHero_qsww3t'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'ProgHero_qsww3t'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 1150, 1000
      FROM public.profiles p WHERE p.username = 'ProgHero_qsww3t'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'ProgHero_qsww3t'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: RivalHost_mxbe0y (usr_328f1c2281af)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-81AF',
        'RivalHost_mxbe0y',
        '🤠',
        TO_TIMESTAMP(1794350159),
        TO_TIMESTAMP(1794350159)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'RivalHost_mxbe0y'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'RivalHost_mxbe0y'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'RivalHost_mxbe0y'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'RivalHost_mxbe0y'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: RivalGuest_2swkt (usr_a6d075113a8a)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-3A8A',
        'RivalGuest_2swkt',
        '🧝',
        TO_TIMESTAMP(1794350159),
        TO_TIMESTAMP(1794350159)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'RivalGuest_2swkt'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'RivalGuest_2swkt'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'RivalGuest_2swkt'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'RivalGuest_2swkt'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: InspectedUser_isrchhm (usr_19fd00bc65c6)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-65C6',
        'InspectedUser_isrchhm',
        '👑',
        TO_TIMESTAMP(1794350159),
        TO_TIMESTAMP(1794350159)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'InspectedUser_isrchhm'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'InspectedUser_isrchhm'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'InspectedUser_isrchhm'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'golden_bower', 'golden_royale', 'Bower Master'
      FROM public.profiles p WHERE p.username = 'InspectedUser_isrchhm'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: ViewerUser_8z0g4e (usr_319dfe591e2a)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-1E2A',
        'ViewerUser_8z0g4e',
        '🤠',
        TO_TIMESTAMP(1794350159),
        TO_TIMESTAMP(1794350159)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'ViewerUser_8z0g4e'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'ViewerUser_8z0g4e'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'ViewerUser_8z0g4e'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'ViewerUser_8z0g4e'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: ReporterUser_wo0r5g (usr_74a1f2d8d650)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-D650',
        'ReporterUser_wo0r5g',
        '🤠',
        TO_TIMESTAMP(1794350159),
        TO_TIMESTAMP(1794350159)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'ReporterUser_wo0r5g'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'ReporterUser_wo0r5g'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'ReporterUser_wo0r5g'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'ReporterUser_wo0r5g'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Alpha_j9fga8 (usr_dda95d29528f)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-528F',
        'Alpha_j9fga8',
        '🤠',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Alpha_j9fga8'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'Alpha_j9fga8'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Alpha_j9fga8'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Alpha_j9fga8'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: RankTester_b2j0hc (usr_59bb0d383830)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-3830',
        'RankTester_b2j0hc',
        '👑',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'RankTester_b2j0hc'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 20, 1220, 4, true
      FROM public.profiles p WHERE p.username = 'RankTester_b2j0hc'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'RankTester_b2j0hc'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'RankTester_b2j0hc'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Underdog_lwn06b (usr_823fae9b553d)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-553D',
        'Underdog_lwn06b',
        '🤠',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Underdog_lwn06b'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 35, 1236, 4, true
      FROM public.profiles p WHERE p.username = 'Underdog_lwn06b'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Underdog_lwn06b'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Underdog_lwn06b'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Ascender_78jr1i (usr_20e2029c14b6)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-14B6',
        'Ascender_78jr1i',
        '🚀',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Ascender_78jr1i'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '10', 10, 1220, 4, true
      FROM public.profiles p WHERE p.username = 'Ascender_78jr1i'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Ascender_78jr1i'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Ascender_78jr1i'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Shielded_l8d7w (usr_ce8c8c3fad45)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-AD45',
        'Shielded_l8d7w',
        '🛡️',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Shielded_l8d7w'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, 'Q', 0, 1190, 4, false
      FROM public.profiles p WHERE p.username = 'Shielded_l8d7w'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Shielded_l8d7w'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Shielded_l8d7w'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Alice_td3pm9i (usr_d1cf564da9a1)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-A9A1',
        'Alice_td3pm9i',
        '🧝',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Alice_td3pm9i'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'Alice_td3pm9i'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Alice_td3pm9i'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Alice_td3pm9i'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Bob_0y4wco (usr_7f95ccc0f776)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-F776',
        'Bob_0y4wco',
        '🧙',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Bob_0y4wco'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'Bob_0y4wco'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Bob_0y4wco'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Bob_0y4wco'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: ProgHero_4w5h05 (usr_49b26d74fea5)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-FEA5',
        'ProgHero_4w5h05',
        '⚡',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 1, 1, 0, 4,
        1, 1, 0, 1, 1
      FROM public.profiles p WHERE p.username = 'ProgHero_4w5h05'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'ProgHero_4w5h05'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 1150, 1000
      FROM public.profiles p WHERE p.username = 'ProgHero_4w5h05'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'ProgHero_4w5h05'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: RivalHost_ojlhjr (usr_75ebd67ca7c9)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-A7C9',
        'RivalHost_ojlhjr',
        '🤠',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'RivalHost_ojlhjr'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'RivalHost_ojlhjr'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'RivalHost_ojlhjr'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'RivalHost_ojlhjr'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: RivalGuest_dfinas (usr_363598bb56b0)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-56B0',
        'RivalGuest_dfinas',
        '🧝',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'RivalGuest_dfinas'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'RivalGuest_dfinas'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'RivalGuest_dfinas'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'RivalGuest_dfinas'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: InspectedUser_o9fxs4 (usr_b9c2f9c27a90)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-7A90',
        'InspectedUser_o9fxs4',
        '👑',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'InspectedUser_o9fxs4'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'InspectedUser_o9fxs4'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'InspectedUser_o9fxs4'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'golden_bower', 'golden_royale', 'Bower Master'
      FROM public.profiles p WHERE p.username = 'InspectedUser_o9fxs4'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: ViewerUser_4juqoz (usr_8aaa8116ebcb)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-EBCB',
        'ViewerUser_4juqoz',
        '🤠',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'ViewerUser_4juqoz'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'ViewerUser_4juqoz'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'ViewerUser_4juqoz'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'ViewerUser_4juqoz'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: ReporterUser_gwp4oj (usr_746685efa48e)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-A48E',
        'ReporterUser_gwp4oj',
        '🤠',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'ReporterUser_gwp4oj'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'ReporterUser_gwp4oj'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'ReporterUser_gwp4oj'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'ReporterUser_gwp4oj'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: LobbyHost_w7hjkg (usr_45034cfb2037)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-2037',
        'LobbyHost_w7hjkg',
        '👑',
        TO_TIMESTAMP(1794351068),
        TO_TIMESTAMP(1794351068)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'LobbyHost_w7hjkg'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'LobbyHost_w7hjkg'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'LobbyHost_w7hjkg'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'LobbyHost_w7hjkg'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Alpha_9b0muh (usr_203156391ecf)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-1ECF',
        'Alpha_9b0muh',
        '🤠',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Alpha_9b0muh'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'Alpha_9b0muh'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Alpha_9b0muh'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Alpha_9b0muh'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: RankTester_1d57dk (usr_6114a006770e)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-770E',
        'RankTester_1d57dk',
        '👑',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'RankTester_1d57dk'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 20, 1220, 4, true
      FROM public.profiles p WHERE p.username = 'RankTester_1d57dk'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'RankTester_1d57dk'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'RankTester_1d57dk'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Underdog_2o1ng9 (usr_c6abfda149bd)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-49BD',
        'Underdog_2o1ng9',
        '🤠',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Underdog_2o1ng9'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 35, 1236, 4, true
      FROM public.profiles p WHERE p.username = 'Underdog_2o1ng9'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Underdog_2o1ng9'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Underdog_2o1ng9'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Ascender_9733m (usr_b8fa7320ef9f)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-EF9F',
        'Ascender_9733m',
        '🚀',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Ascender_9733m'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '10', 10, 1220, 4, true
      FROM public.profiles p WHERE p.username = 'Ascender_9733m'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Ascender_9733m'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Ascender_9733m'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Shielded_30uxil (usr_476afff8d593)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-D593',
        'Shielded_30uxil',
        '🛡️',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Shielded_30uxil'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, 'Q', 0, 1190, 4, false
      FROM public.profiles p WHERE p.username = 'Shielded_30uxil'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Shielded_30uxil'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Shielded_30uxil'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Alice_brmcy (usr_0c457c44730c)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-730C',
        'Alice_brmcy',
        '🧝',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Alice_brmcy'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'Alice_brmcy'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Alice_brmcy'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Alice_brmcy'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: Bob_56igc8 (usr_ee9b454c760f)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-760F',
        'Bob_56igc8',
        '🧙',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'Bob_56igc8'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'Bob_56igc8'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'Bob_56igc8'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'Bob_56igc8'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: ProgHero_v7zkht (usr_8ecaa7315c4a)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-5C4A',
        'ProgHero_v7zkht',
        '⚡',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 1, 1, 0, 4,
        1, 1, 0, 1, 1
      FROM public.profiles p WHERE p.username = 'ProgHero_v7zkht'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'ProgHero_v7zkht'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 1150, 1000
      FROM public.profiles p WHERE p.username = 'ProgHero_v7zkht'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'ProgHero_v7zkht'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: RivalHost_j9eag6d (usr_3b1d7d9e2d08)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-2D08',
        'RivalHost_j9eag6d',
        '🤠',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'RivalHost_j9eag6d'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'RivalHost_j9eag6d'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'RivalHost_j9eag6d'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'RivalHost_j9eag6d'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: RivalGuest_y54wgq (usr_0ae9cf16fae9)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-FAE9',
        'RivalGuest_y54wgq',
        '🧝',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'RivalGuest_y54wgq'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'RivalGuest_y54wgq'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'RivalGuest_y54wgq'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'RivalGuest_y54wgq'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: InspectedUser_xm1y26 (usr_0c956739b16c)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-B16C',
        'InspectedUser_xm1y26',
        '👑',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'InspectedUser_xm1y26'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'InspectedUser_xm1y26'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'InspectedUser_xm1y26'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'golden_bower', 'golden_royale', 'Bower Master'
      FROM public.profiles p WHERE p.username = 'InspectedUser_xm1y26'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: ViewerUser_os5quo (usr_0103cb60c353)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-C353',
        'ViewerUser_os5quo',
        '🤠',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'ViewerUser_os5quo'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'ViewerUser_os5quo'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'ViewerUser_os5quo'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'ViewerUser_os5quo'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: ReporterUser_ex8yb (usr_25f8900920b7)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-20B7',
        'ReporterUser_ex8yb',
        '🤠',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'ReporterUser_ex8yb'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'ReporterUser_ex8yb'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'ReporterUser_ex8yb'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'ReporterUser_ex8yb'
      ON CONFLICT (user_id) DO NOTHING;
    
-- Legacy User: LobbyHost_telsyo (usr_ae77790ca0fa)

      INSERT INTO public.profiles (id, player_id, username, avatar_icon, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        'JJ-A0FA',
        'LobbyHost_telsyo',
        '👑',
        TO_TIMESTAMP(1794351147),
        TO_TIMESTAMP(1794351147)
      )
      ON CONFLICT (username) DO NOTHING;
    

      INSERT INTO public.player_statistics (
        user_id, total_games, wins, losses, tricks_won, euchres, marches, successful_loners, current_streak, best_streak
      )
      SELECT
        p.id, 0, 0, 0, 0,
        0, 0, 0, 0, 0
      FROM public.profiles p WHERE p.username = 'LobbyHost_telsyo'
      ON CONFLICT (user_id) DO UPDATE SET
        total_games = EXCLUDED.total_games,
        wins = EXCLUDED.wins,
        losses = EXCLUDED.losses;
    

      INSERT INTO public.player_ranks (user_id, rank_tier, rank_points, mmr, placement_matches_remaining, has_demotion_shield)
      SELECT p.id, '9', 0, 1200, 5, true
      FROM public.profiles p WHERE p.username = 'LobbyHost_telsyo'
      ON CONFLICT (user_id) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_points = EXCLUDED.rank_points,
        mmr = EXCLUDED.mmr;
    

      INSERT INTO public.player_xp (user_id, level, xp, next_level_xp)
      SELECT p.id, 1, 0, 1000
      FROM public.profiles p WHERE p.username = 'LobbyHost_telsyo'
      ON CONFLICT (user_id) DO NOTHING;
    

      INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
      SELECT p.id, '🤠', 'classic_blue', 'default_navy', 'Recruit'
      FROM public.profiles p WHERE p.username = 'LobbyHost_telsyo'
      ON CONFLICT (user_id) DO NOTHING;
    
COMMIT;