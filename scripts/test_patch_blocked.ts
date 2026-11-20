const SUPABASE_URL = 'https://luqyiarxemhreuxfuzwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1cXlpYXJ4ZW1ocmV1eGZ1end6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTU0ODEsImV4cCI6MjEwNjg3MTQ4MX0.zEGNBVy4wdSBjw7SDr_6WJbQc1ifwBakgv1XzL4cst4';

async function main() {
  console.log('Attempting to PATCH server_registry via PostgREST anon...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/server_registry?id=eq.primary`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      public_url: 'https://cho-convicted-surgeon-advise.trycloudflare.com',
      updated_at: new Date().toISOString(),
    }),
  });
  console.log('Status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Response:', text);

  // Now verify that primary is STILL years-charm-bills-walks
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/server_registry?id=eq.primary&select=public_url,updated_at`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  const data = await checkRes.json();
  console.log('Current server_registry:', data);
}

main().catch(console.error);
