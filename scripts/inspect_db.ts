import { Pool } from 'pg';

const connectionString = 'postgresql://euchre_app.luqyiarxemhreuxfuzwz:7321ae0e-4b4d-4237-aa77-973b7a9b0bb3@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

async function main() {
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    const userId = '940b48d0-3291-4902-a09b-d1d792ad6c27';
    console.log('=== Checking Turkeysub:', userId);

    const friendsRes = await pool.query(
      `SELECT * FROM public.friendships WHERE user_id = $1 OR friend_id = $1`,
      [userId]
    );
    console.log('Friendships rows for Turkeysub:', friendsRes.rows);

    const allFriendsRes = await pool.query(`SELECT * FROM public.friendships`);
    console.log('All Friendships rows in DB:', allFriendsRes.rows);

    const serverRegRes = await pool.query(`SELECT * FROM public.server_registry`);
    console.log('server_registry:', serverRegRes.rows);

  } finally {
    await pool.end();
  }
}

main().catch(console.error);
