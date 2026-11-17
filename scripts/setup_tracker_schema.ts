import pg from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://euchre_app.luqyiarxemhreuxfuzwz:7321ae0e-4b4d-4237-aa77-973b7a9b0bb3@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

async function main() {
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.site_presence (
        session_id TEXT PRIMARY KEY,
        player_id TEXT,
        username TEXT NOT NULL DEFAULT 'Guest',
        rank_tier TEXT NOT NULL DEFAULT '9',
        activity TEXT NOT NULL DEFAULT 'Main Menu',
        device TEXT NOT NULL DEFAULT 'Desktop',
        traffic_source TEXT NOT NULL DEFAULT 'Direct',
        page_url TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_site_presence_last_seen
        ON public.site_presence (last_seen_at DESC);

      CREATE TABLE IF NOT EXISTS public.site_visits (
        id BIGSERIAL PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE,
        player_id TEXT,
        username TEXT,
        device TEXT NOT NULL DEFAULT 'Desktop',
        traffic_source TEXT NOT NULL DEFAULT 'Direct',
        referrer TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_site_visits_created_at
        ON public.site_visits (created_at DESC);

      ALTER TABLE public.site_presence ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

      GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_presence TO anon, authenticated;
      GRANT SELECT, INSERT, UPDATE ON public.site_visits TO anon, authenticated;
      GRANT USAGE, SELECT ON SEQUENCE public.site_visits_id_seq TO anon, authenticated;

      DROP POLICY IF EXISTS site_presence_select_policy ON public.site_presence;
      CREATE POLICY site_presence_select_policy ON public.site_presence
        FOR SELECT TO anon, authenticated USING (true);

      DROP POLICY IF EXISTS site_presence_insert_policy ON public.site_presence;
      CREATE POLICY site_presence_insert_policy ON public.site_presence
        FOR INSERT TO anon, authenticated WITH CHECK (true);

      DROP POLICY IF EXISTS site_presence_update_policy ON public.site_presence;
      CREATE POLICY site_presence_update_policy ON public.site_presence
        FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS site_presence_delete_policy ON public.site_presence;
      CREATE POLICY site_presence_delete_policy ON public.site_presence
        FOR DELETE TO anon, authenticated USING (true);

      DROP POLICY IF EXISTS site_visits_select_policy ON public.site_visits;
      CREATE POLICY site_visits_select_policy ON public.site_visits
        FOR SELECT TO anon, authenticated USING (true);

      DROP POLICY IF EXISTS site_visits_insert_policy ON public.site_visits;
      CREATE POLICY site_visits_insert_policy ON public.site_visits
        FOR INSERT TO anon, authenticated WITH CHECK (true);

      DROP POLICY IF EXISTS site_visits_update_policy ON public.site_visits;
      CREATE POLICY site_visits_update_policy ON public.site_visits
        FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

      NOTIFY pgrst, 'reload schema';
    `);
    console.log('Successfully created public.site_presence and public.site_visits in Supabase!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
