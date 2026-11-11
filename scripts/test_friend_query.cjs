const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://euchre_app.luqyiarxemhreuxfuzwz:7321ae0e-4b4d-4237-aa77-973b7a9b0bb3@aws-1-us-west-2.pooler.supabase.com:6543/postgres'
});
async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT
      r.from_user_id as "fromUserId",
      p.username as "fromUsername",
      p.avatar_icon as "fromAvatar",
      ROUND(EXTRACT(EPOCH FROM r.created_at) * 1000) as "timestamp"
    FROM public.friend_requests r
    JOIN public.profiles p ON r.from_user_id = p.id
    WHERE r.to_user_id = 'c36db14a-5372-4245-aeee-13532524f69b'
  `);
  console.log('StephenAbraham INCOMING REQUESTS:', res.rows);
  await client.end();
}
main().catch(console.error);
