-- ==============================================================================
-- BOWER JJ — Fix Supabase Signup Trigger (Migration 4.6.1)
-- Replaces legacy handle_new_user() that referenced the retired player_battle_pass
-- table and legacy emoji defaults, and seeds starter avatars & card backs instead.
-- Run this once in the Supabase Dashboard SQL Editor as the `postgres` owner.
-- ==============================================================================

DROP TABLE IF EXISTS public.player_battle_pass CASCADE;

ALTER TABLE public.profiles
  ALTER COLUMN avatar_icon SET DEFAULT 'the_outlaw';

ALTER TABLE public.player_cosmetics
  ALTER COLUMN equipped_hat SET DEFAULT 'the_outlaw';

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
  new_player_id := 'JJ-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 6));

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

  INSERT INTO public.profiles (id, player_id, username, avatar_icon)
  VALUES (NEW.id, new_player_id, new_username, normalized_avatar)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.player_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.player_ranks (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.player_xp (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.player_statistics (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.player_cosmetics (user_id, equipped_hat, equipped_card_back, equipped_banner, equipped_title)
  VALUES (NEW.id, normalized_avatar, 'classic_blue', 'default_navy', 'Recruit')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.player_avatars (id, user_id, avatar_id, source, unlocked_at)
  VALUES
    (gen_random_uuid(), NEW.id, 'the_outlaw', 'starter', NOW()),
    (gen_random_uuid(), NEW.id, 'elven_trickster', 'starter', NOW()),
    (gen_random_uuid(), NEW.id, 'cyber_bot', 'starter', NOW()),
    (gen_random_uuid(), NEW.id, 'clever_fox', 'starter', NOW()),
    (gen_random_uuid(), NEW.id, 'velvet_gentleman', 'starter', NOW()),
    (gen_random_uuid(), NEW.id, 'iron_tactician', 'starter', NOW())
  ON CONFLICT (user_id, avatar_id) DO NOTHING;

  INSERT INTO public.player_card_backs (id, user_id, card_back_id, collection_id, source, unlocked_at)
  VALUES
    (gen_random_uuid(), NEW.id, 'classic_blue', NULL, 'starter', NOW()),
    (gen_random_uuid(), NEW.id, 'classic_red', NULL, 'starter', NOW())
  ON CONFLICT (user_id, card_back_id) DO NOTHING;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.schema_migrations (version, description, applied_at)
VALUES ('4.6.1', 'Update handle_new_user trigger & column defaults for starter collectibles (no player_battle_pass)', NOW())
ON CONFLICT (version) DO NOTHING;
