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
  avatar_icon TEXT NOT NULL DEFAULT 'the_outlaw',
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  wax_seals INT NOT NULL DEFAULT 150,
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
  equipped_hat TEXT NOT NULL DEFAULT 'the_outlaw',
  equipped_card_back TEXT NOT NULL DEFAULT 'classic_blue',
  equipped_banner TEXT NOT NULL DEFAULT 'default_navy',
  equipped_title TEXT NOT NULL DEFAULT 'Recruit',
  equipped_felt TEXT NOT NULL DEFAULT 'midnight_navy',
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

-- 6. Social: Friendships & Requests (Battle Pass retired in v4.6.0)
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


export const COLLECTIBLE_SCHEMA_DEFINITIONS = `
-- 1. Illustrated Avatar Catalog & Player Inventory
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
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  avatar_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'starter',
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, avatar_id)
);

CREATE INDEX IF NOT EXISTS idx_player_avatars_user_id ON public.player_avatars(user_id);

-- 2. Card Collections & Collectible Cards Catalog
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

-- 3. Player Unopened / Opened Card Packs (1 per qualifying level-up)
CREATE TABLE IF NOT EXISTS public.player_card_packs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'level_up',
  source_ref TEXT NOT NULL,
  earned_level INT,
  status TEXT NOT NULL DEFAULT 'unopened',
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  UNIQUE(user_id, source_ref)
);

CREATE INDEX IF NOT EXISTS idx_player_card_packs_user_status ON public.player_card_packs(user_id, status);

-- 4. Player Collectible Card Inventory
CREATE TABLE IF NOT EXISTS public.player_card_inventory (
  id UUID PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_player_card_inv_user_col ON public.player_card_inventory(user_id, collection_id);

-- 5. Player Unlocked Card Backs
CREATE TABLE IF NOT EXISTS public.player_card_backs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_back_id TEXT NOT NULL,
  collection_id TEXT,
  source TEXT NOT NULL DEFAULT 'collection',
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, card_back_id)
);

CREATE INDEX IF NOT EXISTS idx_player_card_backs_user_id ON public.player_card_backs(user_id);

-- 6. Server-Side Pack Drop History (Audit & Balancing)
CREATE TABLE IF NOT EXISTS public.card_drop_history (
  id UUID PRIMARY KEY,
  pack_id UUID NOT NULL REFERENCES public.player_card_packs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  identity TEXT NOT NULL,
  rarity TEXT NOT NULL,
  slot_index INT NOT NULL,
  was_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  dust_awarded INT NOT NULL DEFAULT 0,
  unlocked_card_back_id TEXT,
  dropped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_drop_history_user_time ON public.card_drop_history(user_id, dropped_at DESC);
`;
