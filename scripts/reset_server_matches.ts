import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://euchre_app.luqyiarxemhreuxfuzwz:7321ae0e-4b4d-4237-aa77-973b7a9b0bb3@aws-1-us-west-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

async function main() {
  console.log('Connecting to PostgreSQL database...');
  try {
    const res = await pool.query('DELETE FROM public.active_matches');
    console.log(`[PG] Successfully cleared ${res.rowCount ?? 0} active match rows.`);
  } catch (err: any) {
    console.warn(`[PG WARN] Could not delete from active_matches: ${err.message}`);
  } finally {
    await pool.end();
  }

  const activeMatchesDir = path.resolve(process.cwd(), 'server', 'data', 'active_matches');
  if (fs.existsSync(activeMatchesDir)) {
    const files = fs.readdirSync(activeMatchesDir);
    let removed = 0;
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          fs.unlinkSync(path.join(activeMatchesDir, file));
          removed++;
        } catch {}
      }
    }
    console.log(`[DISK] Removed ${removed} cached match files from ${activeMatchesDir}.`);
  }

  console.log('Server match reset complete.');
}

main().catch((err) => {
  console.error('Fatal reset error:', err);
  process.exit(1);
});
