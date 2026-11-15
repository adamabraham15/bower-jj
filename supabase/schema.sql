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
  avatar_icon TEXT NOT NULL DEFAULT 'the_outlaw',
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
-- 6. COLLECTIBLE AVATARS, CARD PACKS & CARD BACKS (Replaced Battle Pass in v4.6)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.player_battle_pass CASCADE;

CREATE TABLE IF NOT EXISTS public.avatar_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  theme TEXT NOT NULL,
  rarity TEXT NOT NULL,
  image_url TEXT NOT NULL,
  unlocked_by_default BOOLEAN NOT NULL DEFAULT FALSE,
  unlock_hint TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.player_avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  avatar_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'starter',
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, avatar_id)
);

CREATE TABLE IF NOT EXISTS public.card_collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  theme TEXT NOT NULL,
  description TEXT NOT NULL,
  rarity TEXT NOT NULL,
  card_back_id TEXT NOT NULL,
  card_back_image_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.collectible_cards (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES public.card_collections(id) ON DELETE CASCADE,
  identity TEXT NOT NULL,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  image_url TEXT NOT NULL,
  UNIQUE(collection_id, identity)
);

CREATE TABLE IF NOT EXISTS public.player_card_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'level_up',
  source_ref TEXT NOT NULL,
  earned_level INT,
  status TEXT NOT NULL DEFAULT 'unopened',
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  UNIQUE(user_id, source_ref)
);

CREATE TABLE IF NOT EXISTS public.player_card_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  identity TEXT NOT NULL,
  rarity TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  first_acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, card_id)
);

CREATE TABLE IF NOT EXISTS public.player_card_backs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_back_id TEXT NOT NULL,
  collection_id TEXT,
  source TEXT NOT NULL DEFAULT 'collection',
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, card_back_id)
);

CREATE TABLE IF NOT EXISTS public.card_drop_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES public.player_card_packs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  identity TEXT NOT NULL,
  rarity TEXT NOT NULL,
  slot_index INT NOT NULL,
  was_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_card_back_id TEXT,
  dropped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  equipped_hat TEXT NOT NULL DEFAULT 'the_outlaw',
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
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_player_id TEXT;
  new_username TEXT;
  raw_avatar TEXT;
  normalized_avatar TEXT;
BEGIN
  -- Generate unique player identifier e.g. "JJ-A1B2C3"
  new_player_id := 'JJ-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 6));

  -- Default username from metadata or random Bower alias
  new_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    'Bower_' || (FLOOR(1000 + RANDOM() * 9000))::text
  );

  raw_avatar := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'avatar_icon', '')), '');
  normalized_avatar := CASE raw_avatar
    WHEN 'the_outlaw' THEN 'the_outlaw'
    WHEN '🤠' THEN 'the_outlaw'
    WHEN 'elven_trickster' THEN 'elven_trickster'
    WHEN '🧝' THEN 'elven_trickster'
    WHEN 'cyber_bot' THEN 'cyber_bot'
    WHEN '🤖' THEN 'cyber_bot'
    WHEN 'clever_fox' THEN 'clever_fox'
    WHEN '🦊' THEN 'clever_fox'
    WHEN 'velvet_gentleman' THEN 'velvet_gentleman'
    WHEN '🎩' THEN 'velvet_gentleman'
    WHEN 'iron_tactician' THEN 'iron_tactician'
    WHEN '🪖' THEN 'iron_tactician'
    WHEN '⚔️' THEN 'iron_tactician'
    ELSE 'the_outlaw'
  END;

  -- 1. Insert Profile
  INSERT INTO public.profiles (id, player_id, username, avatar_icon)
  VALUES (NEW.id, new_player_id, new_username, normalized_avatar)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Insert Settings
  INSERT INTO public.player_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 3. Insert Initial Ranks (Recruit Tier 9, 1200 MMR)
  INSERT INTO public.player_ranks (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 4. Insert Initial XP
  INSERT INTO public.player_xp (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 5. Insert Statistics
  INSERT INTO public.player_statistics (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 6. Insert Cosmetics Loadout
  INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
  VALUES (NEW.id, normalized_avatar, 'classic_blue', 'default_navy', 'Recruit')
  ON CONFLICT (user_id) DO NOTHING;

  -- 7. Insert Initial Illustrated Starter Avatars
  INSERT INTO public.player_avatars (id, user_id, avatar_id, source, unlocked_at)
  VALUES
    (gen_random_uuid(), NEW.id, 'the_outlaw', 'starter', NOW()),
    (gen_random_uuid(), NEW.id, 'elven_trickster', 'starter', NOW()),
    (gen_random_uuid(), NEW.id, 'cyber_bot', 'starter', NOW()),
    (gen_random_uuid(), NEW.id, 'clever_fox', 'starter', NOW()),
    (gen_random_uuid(), NEW.id, 'velvet_gentleman', 'starter', NOW()),
    (gen_random_uuid(), NEW.id, 'iron_tactician', 'starter', NOW())
  ON CONFLICT (user_id, avatar_id) DO NOTHING;

  -- 8. Insert Initial Starter Card Backs
  INSERT INTO public.player_card_backs (id, user_id, card_back_id, collection_id, source, unlocked_at)
  VALUES
    (gen_random_uuid(), NEW.id, 'classic_blue', NULL, 'starter', NOW()),
    (gen_random_uuid(), NEW.id, 'classic_red', NULL, 'starter', NOW())
  ON CONFLICT (user_id, card_back_id) DO NOTHING;

  -- 9. Insert Legacy Cosmetic Inventory Compatibility Rows
  INSERT INTO public.cosmetic_inventory (id, user_id, category, item_id, unlocked_at)
  VALUES
    (gen_random_uuid(), NEW.id, 'hat', 'the_outlaw', NOW()),
    (gen_random_uuid(), NEW.id, 'hat', 'elven_trickster', NOW()),
    (gen_random_uuid(), NEW.id, 'hat', 'cyber_bot', NOW()),
    (gen_random_uuid(), NEW.id, 'hat', 'clever_fox', NOW()),
    (gen_random_uuid(), NEW.id, 'hat', 'velvet_gentleman', NOW()),
    (gen_random_uuid(), NEW.id, 'hat', 'iron_tactician', NOW()),
    (gen_random_uuid(), NEW.id, 'cardBack', 'classic_blue', NOW()),
    (gen_random_uuid(), NEW.id, 'cardBack', 'classic_red', NOW()),
    (gen_random_uuid(), NEW.id, 'banner', 'default_navy', NOW()),
    (gen_random_uuid(), NEW.id, 'title', 'Recruit', NOW())
  ON CONFLICT (user_id, category, item_id) DO NOTHING;

  RETURN NEW;
END;
$$;

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
