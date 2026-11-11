/**
 * BOWER JJ — Authoritative PostgreSQL DDL Schema & Table Definitions
 * Standard ANSI SQL compatible with Supabase, AWS RDS, Neon, Docker Postgres, and pg-mem.
 */

export const POSTGRES_TABLE_DEFINITIONS = `
-- 1. Profiles & Player Identity
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  player_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_icon TEXT NOT NULL DEFAULT '🤠',
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_player_id ON profiles(player_id);

-- 2. Player Ranks & MMR
CREATE TABLE IF NOT EXISTS player_ranks (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  rank_tier TEXT NOT NULL DEFAULT '9',
  rank_points INT NOT NULL DEFAULT 0,
  mmr INT NOT NULL DEFAULT 1200,
  placement_matches_remaining INT NOT NULL DEFAULT 5,
  has_demotion_shield BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Player Statistics
CREATE TABLE IF NOT EXISTS player_statistics (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_games INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  tricks_won INT NOT NULL DEFAULT 0,
  euchres INT NOT NULL DEFAULT 0,
  marches INT NOT NULL DEFAULT 0,
  successful_loners INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. XP and Level
CREATE TABLE IF NOT EXISTS player_xp (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1,
  xp INT NOT NULL DEFAULT 0,
  next_level_xp INT NOT NULL DEFAULT 1000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Cosmetics & Wardrobe
CREATE TABLE IF NOT EXISTS player_cosmetics (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  equipped_hat TEXT NOT NULL DEFAULT '🤠',
  equipped_card_back TEXT NOT NULL DEFAULT 'classic_blue',
  equipped_banner TEXT NOT NULL DEFAULT 'default_navy',
  equipped_title TEXT NOT NULL DEFAULT 'Recruit',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cosmetic_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  item_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category, item_id)
);

-- 6. Seasonal Battle Pass (Bower Pass)
CREATE TABLE IF NOT EXISTS player_battle_pass (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  season_id INT NOT NULL DEFAULT 1,
  tier INT NOT NULL DEFAULT 1,
  xp INT NOT NULL DEFAULT 0,
  tier_xp_required INT NOT NULL DEFAULT 500,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_free_tiers INT[] NOT NULL DEFAULT '{}',
  claimed_premium_tiers INT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, season_id)
);

-- 7. Social: Friendships & Requests
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

-- 8. Match Records & Auditable Results
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL,
  mode TEXT NOT NULL,
  human_count INT NOT NULL DEFAULT 4,
  bot_count INT NOT NULL DEFAULT 0,
  composition TEXT NOT NULL DEFAULT '4H',
  winning_team INT NOT NULL,
  final_score TEXT NOT NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  won BOOLEAN NOT NULL,
  mode TEXT NOT NULL,
  score TEXT NOT NULL,
  lp_change INT NOT NULL DEFAULT 0,
  mmr_change INT NOT NULL DEFAULT 0,
  opponent_names TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_match_history_user ON player_match_history(user_id, created_at DESC);

-- 9. Idempotency Keys (Anti-Duplicate Exploits)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Shared Active Matches (Multi-Instance Clustered Servers)
CREATE TABLE IF NOT EXISTS active_matches (
  room_code TEXT PRIMARY KEY,
  host_user_id TEXT NOT NULL,
  room_data JSONB NOT NULL,
  game_state JSONB NOT NULL,
  last_action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Schema Migrations Version Tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
