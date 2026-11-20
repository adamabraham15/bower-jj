import { Pool } from 'pg';

const connectionString = 'postgresql://euchre_app.luqyiarxemhreuxfuzwz:7321ae0e-4b4d-4237-aa77-973b7a9b0bb3@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

async function main() {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await pool.query(`
      DROP POLICY IF EXISTS "Allow server write server_registry" ON public.server_registry;
      DROP POLICY IF EXISTS "Allow euchre_app write server_registry" ON public.server_registry;
      CREATE POLICY "Allow euchre_app write server_registry" 
        ON public.server_registry 
        FOR ALL 
        TO euchre_app, service_role 
        USING (true) 
        WITH CHECK (true);
    `);
    console.log('Successfully updated policies on server_registry!');

    // Update server_registry immediately to the authoritative PostgreSQL tunnel
    await pool.query(`
      UPDATE public.server_registry 
      SET public_url = 'https://years-charm-bills-walks.trycloudflare.com', updated_at = NOW() 
      WHERE id = 'primary';
    `);
    console.log('Successfully updated server_registry to https://years-charm-bills-walks.trycloudflare.com');

  } catch (err) {
    console.error('Error applying policy:', err);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
