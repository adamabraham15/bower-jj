import { Pool } from 'pg';

const connectionString = 'postgresql://euchre_app.luqyiarxemhreuxfuzwz:7321ae0e-4b4d-4237-aa77-973b7a9b0bb3@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

async function main() {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    const ownerRes = await pool.query(`
      SELECT tableowner 
      FROM pg_tables 
      WHERE tablename = 'server_registry'
    `);
    console.log('Owner of server_registry:', ownerRes.rows);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
