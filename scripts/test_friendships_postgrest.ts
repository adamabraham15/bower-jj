const SUPABASE_URL = 'https://luqyiarxemhreuxfuzwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1cXlpYXJ4ZW1ocmV1eGZ1end6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTU0ODEsImV4cCI6MjEwNjg3MTQ4MX0.zEGNBVy4wdSBjw7SDr_6WJbQc1ifwBakgv1XzL4cst4';

async function main() {
  const userId = '940b48d0-3291-4902-a09b-d1d792ad6c27';
  console.log('Testing PostgREST friendships or query...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/friendships?or=(user_id.eq.${userId},friend_id.eq.${userId})&select=*`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  console.log('Status:', res.status, res.statusText);
  const rows = await res.json();
  console.log('Rows count:', Array.isArray(rows) ? rows.length : rows);
}

main().catch(console.error);
