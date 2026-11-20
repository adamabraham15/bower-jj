import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const SUPABASE_URL = 'https://luqyiarxemhreuxfuzwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1cXlpYXJ4ZW1ocmV1eGZ1end6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTU0ODEsImV4cCI6MjEwNjg3MTQ4MX0.zEGNBVy4wdSBjw7SDr_6WJbQc1ifwBakgv1XzL4cst4';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
      transport: WebSocket,
    },
  });
  console.log('Signing in Turkeysub...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'adam.abraham.15@gmail.com',
    password: 'BowerTurkeysub2026!',
  });
  if (authErr) {
    console.error('Sign in error:', authErr);
    return;
  }
  const user = authData.user!;
  console.log('Signed in as:', user.id, user.email);

  const start = Date.now();
  const { data: friendships, error: friendErr } = await supabase
    .from('friendships')
    .select('user_id, friend_id, created_at')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

  console.log(`Queried friendships in ${Date.now() - start}ms:`, friendships?.length, 'rows');
  if (friendErr) {
    console.error('Friendships error:', friendErr);
    return;
  }

  const friendIds = (friendships || []).map(f => f.user_id === user.id ? f.friend_id : f.user_id);
  console.log('Friend IDs:', friendIds);

  if (friendIds.length > 0) {
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, username, avatar_icon')
      .in('id', friendIds);

    console.log('Profiles found:', profiles?.length);
    for (const p of profiles || []) {
      console.log(' - Friend profile:', p.username, p.id);
    }
  }
}

main().catch(console.error);
