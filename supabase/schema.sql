-- ==============================================================================
-- BOWER JJ — Production PostgreSQL Schema & Security Policies (Supabase)
-- Authoritative Euchre Database Architecture with Strict Row Level Security
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean schema setup (idempotent helper)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 0. COMPATIBILITY SHIM FOR STANDALONE POSTGRESQL / TESTING ENVIRONMENTS
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 1. PROFILES & PLAYER IDENTITY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_player_id ON public.profiles(player_id);

CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 2. PLAYER SETTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  sound_volume NUMERIC(3, 2) NOT NULL DEFAULT 1.0,
  card_animation_speed TEXT NOT NULL DEFAULT 'normal',
  confirm_loner_call BOOLEAN NOT NULL DEFAULT TRUE,
  haptic_feedback BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. COMPETITIVE RANKS & MMR (Server Authoritative)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_ranks (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  rank_tier TEXT NOT NULL DEFAULT '9' CHECK (rank_tier IN ('9', '10', 'Q', 'K', 'A', 'BOWER_JJ')),
  rank_points INT NOT NULL DEFAULT 0 CHECK (rank_points >= 0 AND rank_points <= 100),
  mmr INT NOT NULL DEFAULT 1200,
  placement_matches_remaining INT NOT NULL DEFAULT 5,
  has_demotion_shield BOOLEAN NOT NULL DEFAULT TRUE,
  highest_rank_achieved TEXT NOT NULL DEFAULT '9',
  season_id INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_ranks_mmr ON public.player_ranks(mmr DESC);
CREATE INDEX IF NOT EXISTS idx_player_ranks_tier ON public.player_ranks(rank_tier, rank_points DESC);

-- ------------------------------------------------------------------------------
-- 4. PLAYER LEVEL & XP PROGRESSION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_xp (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
  xp INT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  next_level_xp INT NOT NULL DEFAULT 1000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. LIFETIME STATISTICS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_statistics (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_games INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  tricks_won INT NOT NULL DEFAULT 0,
  euchres INT NOT NULL DEFAULT 0,
  marches INT NOT NULL DEFAULT 0,
  successful_loners INT NOT NULL DEFAULT 0,
  current_streak INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  favorite_suit TEXT NOT NULL DEFAULT 'hearts',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. SEASONAL BATTLE PASS (BOWER PASS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_battle_pass (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  season_id INT NOT NULL DEFAULT 1,
  tier INT NOT NULL DEFAULT 1 CHECK (tier >= 1 AND tier <= 30),
  xp INT NOT NULL DEFAULT 0,
  tier_xp_required INT NOT NULL DEFAULT 500,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  claimed_free_tiers INT[] NOT NULL DEFAULT '{}',
  claimed_premium_tiers INT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, season_id)
);

-- ------------------------------------------------------------------------------
-- 7. ACHIEVEMENTS & TROPHIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, achievement_id)
);

-- ------------------------------------------------------------------------------
-- 8. COSMETICS & INVENTORY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_cosmetics (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  equipped_hat TEXT NOT NULL DEFAULT '🤠',
  equipped_card_back TEXT NOT NULL DEFAULT 'classic_blue',
  equipped_banner TEXT NOT NULL DEFAULT 'default_navy',
  equipped_title TEXT NOT NULL DEFAULT 'Recruit',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cosmetic_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('hat', 'cardBack', 'banner', 'title')),
  item_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category, item_id)
);

-- ------------------------------------------------------------------------------
-- 9. SOCIAL: FRIENDSHIPS, REQUESTS & BLOCKS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_id <> friend_id),
  UNIQUE(user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_user_id <> to_user_id),
  UNIQUE(from_user_id, to_user_id)
);

CREATE TABLE IF NOT EXISTS public.player_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (blocker_id <> blocked_id),
  UNIQUE(blocker_id, blocked_id)
);

-- ------------------------------------------------------------------------------
-- 10. MATCH RECORDS & AUDITABLE RESULTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('ranked_solo', 'ranked_rivals', 'unranked', 'private')),
  human_count INT NOT NULL CHECK (human_count >= 1 AND human_count <= 4),
  bot_count INT NOT NULL CHECK (bot_count >= 0 AND bot_count <= 3),
  composition TEXT NOT NULL CHECK (composition IN ('4H', '3H1B', '2H2B', '1H3B')),
  winning_team INT NOT NULL CHECK (winning_team IN (0, 1)),
  final_score TEXT NOT NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_created_at ON public.matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_composition ON public.matches(composition);

CREATE TABLE IF NOT EXISTS public.match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  team INT NOT NULL CHECK (team IN (0, 1)),
  position INT NOT NULL CHECK (position >= 0 AND position <= 3),
  is_ai BOOLEAN NOT NULL DEFAULT FALSE,
  ai_difficulty TEXT,
  lp_change INT NOT NULL DEFAULT 0,
  mmr_change INT NOT NULL DEFAULT 0,
  tricks_won INT NOT NULL DEFAULT 0,
  euchres INT NOT NULL DEFAULT 0,
  marches INT NOT NULL DEFAULT 0,
  successful_loners INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.player_match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  won BOOLEAN NOT NULL,
  mode TEXT NOT NULL,
  score TEXT NOT NULL,
  lp_change INT NOT NULL DEFAULT 0,
  mmr_change INT NOT NULL DEFAULT 0,
  opponent_names TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_match_history_user ON public.player_match_history(user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 11. REPORTS & INTEGRITY AUDITING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'action_taken', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11b. IDEMPOTENCY & DUPLICATE REWARD PROTECTION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON public.idempotency_keys(created_at DESC);

-- ------------------------------------------------------------------------------
-- 11c. SHARED ACTIVE MATCH PERSISTENCE (MULTI-INSTANCE CLUSTER)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.active_matches (
  room_code TEXT PRIMARY KEY,
  host_user_id TEXT NOT NULL,
  room_data JSONB NOT NULL,
  game_state JSONB NOT NULL,
  last_action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_active_matches_last_action ON public.active_matches(last_action_at DESC);

-- ------------------------------------------------------------------------------
-- 11d. SCHEMA MIGRATIONS VERSION TRACKING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. NEW USER AUTOMATIC INITIALIZATION (SUPABASE AUTH TRIGGER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_player_id TEXT;
  new_username TEXT;
BEGIN
  -- Generate unique player identifier e.g. "JJ-8492"
  new_player_id := 'JJ-' || UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 4));
  
  -- Default username from metadata or random Bower alias
  new_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    'Bower_' || (FLOOR(1000 + RANDOM() * 9000))::text
  );

  -- 1. Insert Profile
  INSERT INTO public.profiles (id, player_id, username, avatar_icon)
  VALUES (
    NEW.id,
    new_player_id,
    new_username,
    COALESCE(NEW.raw_user_meta_data->>'avatar_icon', '🤠')
  );

  -- 2. Insert Settings
  INSERT INTO public.player_settings (user_id) VALUES (NEW.id);

  -- 3. Insert Initial Ranks (Recruit Tier 9, 1200 MMR)
  INSERT INTO public.player_ranks (user_id) VALUES (NEW.id);

  -- 4. Insert Initial XP
  INSERT INTO public.player_xp (user_id) VALUES (NEW.id);

  -- 5. Insert Statistics
  INSERT INTO public.player_statistics (user_id) VALUES (NEW.id);

  -- 6. Insert Cosmetics Loadout
  INSERT INTO public.player_cosmetics (user_id) VALUES (NEW.id);

  -- 7. Insert Initial Cosmetic Inventory
  INSERT INTO public.cosmetic_inventory (user_id, category, item_id)
  VALUES
    (NEW.id, 'hat', '🤠'),
    (NEW.id, 'hat', '🧢'),
    (NEW.id, 'cardBack', 'classic_blue'),
    (NEW.id, 'cardBack', 'classic_red'),
    (NEW.id, 'banner', 'default_navy'),
    (NEW.id, 'title', 'Recruit');

  -- 8. Insert Battle Pass Season 1 Track
  INSERT INTO public.player_battle_pass (user_id, season_id) VALUES (NEW.id, 1);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger firing on every auth.users creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_battle_pass ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmetic_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read, User can update own username/avatar
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile non-competitive fields"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Settings: Only user can view and edit own settings
CREATE POLICY "Users can view own settings"
  ON public.player_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.player_settings FOR UPDATE USING (auth.uid() = user_id);

-- Competitive Progression: Read-only for authenticated users, WRITE ONLY VIA SERVICE ROLE
CREATE POLICY "Ranks viewable by all authenticated users"
  ON public.player_ranks FOR SELECT USING (true);

CREATE POLICY "XP viewable by everyone"
  ON public.player_xp FOR SELECT USING (true);

CREATE POLICY "Stats viewable by everyone"
  ON public.player_statistics FOR SELECT USING (true);

CREATE POLICY "Battle pass viewable by user"
  ON public.player_battle_pass FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Cosmetics viewable by everyone"
  ON public.player_cosmetics FOR SELECT USING (true);

CREATE POLICY "Cosmetic inventory viewable by user"
  ON public.cosmetic_inventory FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Match history viewable by everyone"
  ON public.player_match_history FOR SELECT USING (true);

-- Social relationships
CREATE POLICY "Users can view their friendships"
  ON public.friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can manage their friendships"
  ON public.friendships FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can view incoming/outgoing requests"
  ON public.friend_requests FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can send friend requests"
  ON public.friend_requests FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can delete own requests"
  ON public.friend_requests FOR DELETE USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Reports
CREATE POLICY "Users can insert reports"
  ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Only admins or service role can read reports"
  ON public.reports FOR SELECT USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
