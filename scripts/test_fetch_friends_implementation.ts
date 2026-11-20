import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const SUPABASE_URL = 'https://luqyiarxemhreuxfuzwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1cXlpYXJ4ZW1ocmV1eGZ1end6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTU0ODEsImV4cCI6MjEwNjg3MTQ4MX0.zEGNBVy4wdSBjw7SDr_6WJbQc1ifwBakgv1XzL4cst4';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { transport: WebSocket },
  });
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'adam.abraham.15@gmail.com',
    password: 'BowerTurkeysub2026!',
  });
  const userId = authData.user!.id;

  const start = Date.now();
  const { data: friendships } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  const friendIds = (friendships || []).map(f => f.user_id === userId ? f.friend_id : f.user_id);

  const [profilesRes, ranksRes, xpRes] = await Promise.all([
    supabase.from('profiles').select('id, username, avatar_icon').in('id', friendIds),
    supabase.from('player_ranks').select('user_id, rank_tier, rank_division, rank_points').in('user_id', friendIds),
    supabase.from('player_xp').select('user_id, level').in('user_id', friendIds),
  ]);

  const rankMap = new Map((ranksRes.data || []).map(r => [r.user_id, r]));
  const xpMap = new Map((xpRes.data || []).map(x => [x.user_id, x]));

  const results = (profilesRes.data || []).map(p => {
    const r = rankMap.get(p.id);
    const x = xpMap.get(p.id);
    return {
      userId: p.id,
      username: p.username || 'Player',
      avatarIcon: p.avatar_icon,
      rankTier: r?.rank_tier || '9',
      rankDivision: r?.rank_division || 'III',
      rankPoints: r?.rank_points ?? 0,
      level: x?.level ?? 1,
      isOnline: false,
      status: 'offline',
    };
  });

  console.log(`Resolved ${results.length} friends in ${Date.now() - start}ms:`);
  for (const f of results) {
    console.log(` - ${f.username} (${f.rankTier} ${f.rankDivision}, Lv.${f.level})`);
  }
}

main().catch(console.error);
