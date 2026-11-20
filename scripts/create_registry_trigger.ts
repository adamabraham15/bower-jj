import { Pool } from 'pg';

const connectionString = 'postgresql://euchre_app.luqyiarxemhreuxfuzwz:7321ae0e-4b4d-4237-aa77-973b7a9b0bb3@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

async function main() {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.guard_server_registry()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Block anon role from updating server_registry (only authoritative postgres/euchre_app allowed)
        IF current_user = 'anon' OR session_user = 'anon' THEN
          RAISE EXCEPTION 'Anonymous role cannot update server_registry';
        END IF;

        -- Block any tunnel containing cho-convicted or other non-authoritative fallback URLs
        IF NEW.public_url ILIKE '%cho-convicted%' OR NEW.public_url ILIKE '%occasionally-conflicts%' THEN
          RETURN OLD; -- Silently ignore stale fallback tunnel registration
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      DROP TRIGGER IF EXISTS trg_guard_server_registry ON public.server_registry;
      CREATE TRIGGER trg_guard_server_registry
        BEFORE INSERT OR UPDATE ON public.server_registry
        FOR EACH ROW
        EXECUTE FUNCTION public.guard_server_registry();
    `);
    console.log('Successfully created guard_server_registry trigger!');

    // Now update server_registry to authoritative tunnel
    const res = await pool.query(`
      UPDATE public.server_registry 
      SET public_url = 'https://years-charm-bills-walks.trycloudflare.com', updated_at = NOW() 
      WHERE id = 'primary'
      RETURNING *;
    `);
    console.log('Updated server_registry:', res.rows);

  } catch (err) {
    console.error('Error creating trigger:', err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
