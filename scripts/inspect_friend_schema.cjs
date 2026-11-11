const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://euchre_app.luqyiarxemhreuxfuzwz:7321ae0e-4b4d-4237-aa77-973b7a9b0bb3@aws-1-us-west-2.pooler.supabase.com:6543/postgres'
});
async function main() {
  await client.connect();
  const c = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'friend_requests'");
  console.log('FRIEND REQUESTS COLUMNS:', c.rows);
  const rows = await client.query('SELECT * FROM public.friend_requests');
  console.log('EXISTING FRIEND REQUESTS:', rows.rows);
  const f = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'friendships'");
  console.log('FRIENDSHIPS COLUMNS:', f.rows);
  await client.end();
}
main().catch(console.error);
