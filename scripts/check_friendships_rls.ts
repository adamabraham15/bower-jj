import { Pool } from 'pg';

const connectionString = 'postgresql://euchre_app.luqyiarxemhreuxfuzwz:7321ae0e-4b4d-4237-aa77-973b7a9b0bb3@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

async function main() {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    const rlsRes = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE tablename = 'friendships'
    `);
    console.log('RLS on friendships:', rlsRes.rows);

    const policiesRes = await pool.query(`
      SELECT policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'friendships'
    `);
    console.log('Policies on friendships:', policiesRes.rows);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
