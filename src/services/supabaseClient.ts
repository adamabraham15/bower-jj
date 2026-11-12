/**
 * BOWER JJ — Supabase Client & Authentication Service (Frontend)
 * Manages email/password registration, login, session restoration, and profile synchronization.
 */

import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://luqyiarxemhreuxfuzwz.supabase.co';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1cXlpYXJ4ZW1ocmV1eGZ1end6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTU0ODEsImV4cCI6MjEwNjg3MTQ4MX0.zEGNBVy4wdSBjw7SDr_6WJbQc1ifwBakgv1XzL4cst4';

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_URL.includes('prod-project')
);

// Initialize Supabase Client
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export interface AuthUserProfile {
  id: string;
  playerId: string;
  username: string;
  avatarIcon: string;
  email?: string;
  isAdmin?: boolean;
}

class AuthService {
  /**
   * Check if username is already taken
   */
  public async isUsernameAvailable(username: string): Promise<boolean> {
    if (!supabase) return true;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .maybeSingle();

      if (error) return true;
      return data === null;
    } catch {
      return true;
    }
  }

  /**
   * Register new player with Email, Password & desired Username
   */
  public async register(
    email: string,
    password: string,
    username: string,
    avatarIcon: string = '🤠'
  ): Promise<{ user: User | null; session: Session | null; error: string | null }> {
    if (!supabase) {
      return {
        user: null,
        session: null,
        error: 'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      };
    }

    // 1. Verify username format and uniqueness
    const cleanUsername = username.trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      return { user: null, session: null, error: 'Username must be between 3 and 20 characters.' };
    }

    const available = await this.isUsernameAvailable(cleanUsername);
    if (!available) {
      return { user: null, session: null, error: `Username "${cleanUsername}" is already taken.` };
    }

    try {
      const redirectUrl = this.getPublicAppUrl();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            username: cleanUsername,
            avatar_icon: avatarIcon,
          },
        },
      });

      if (error) {
        return { user: null, session: null, error: error.message };
      }

      return {
        user: data.user,
        session: data.session,
        error: null,
      };
    } catch (err: any) {
      return { user: null, session: null, error: err.message || 'Registration failed' };
    }
  }

  /**
   * Sign in with Email and Password
   */
  public async login(
    email: string,
    password: string
  ): Promise<{ user: User | null; session: Session | null; error: string | null }> {
    if (!supabase) {
      return {
        user: null,
        session: null,
        error: 'Supabase is not configured. Running in offline/guest mode.',
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, session: null, error: error.message };
      }

      return {
        user: data.user,
        session: data.session,
        error: null,
      };
    } catch (err: any) {
      return { user: null, session: null, error: err.message || 'Login failed' };
    }
  }

  /**
   * Sign out current user
   */
  public async logout(): Promise<void> {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out warning:', err);
      }
    }
  }

  /**
   * Resolve public application origin for email confirmation & redirects.
   * Ensures emails never link to localhost, avoiding 'connection refused' errors.
   */
  public getPublicAppUrl(): string {
    const envUrl = (import.meta.env?.VITE_APP_URL as string | undefined)?.trim();
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/\/$/, '');
    }
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return origin.replace(/\/$/, '');
      }
    }
    return 'https://bower-jj.vercel.app';
  }

  /**
   * Send password reset email
   */
  public async resetPassword(email: string): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured.' };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${this.getPublicAppUrl()}/#reset-password`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Password reset request failed' };
    }
  }

  /**
   * Get fresh authoritative access token, refreshing if needed
   */
  public async getFreshAccessToken(): Promise<string | null> {
    if (!supabase) return null;
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        return data.session.access_token;
      }
      const { data: refreshData } = await supabase.auth.refreshSession();
      return refreshData.session?.access_token || null;
    } catch {
      return null;
    }
  }

  /**
   * Get current session and access token
   */
  public async getSession(): Promise<Session | null> {
    if (!supabase) return null;
    try {
      const { data } = await supabase.auth.getSession();
      return data.session;
    } catch {
      return null;
    }
  }

  /**
   * Subscribe to auth state changes (login, logout, token refresh)
   */
  public onAuthStateChange(callback: (session: Session | null, user: User | null) => void) {
    if (!supabase) return () => {};

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session, session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }

  /**
   * Fetch full authoritative user profile and progression from PostgreSQL
   */
  public async fetchFullProfile(userId: string) {
    if (!supabase) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (!isUuid) return null;

    try {
      const [profileRes, rankRes, xpRes, statsRes, settingsRes, cosmeticsRes, passRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('player_ranks').select('*').eq('user_id', userId).single(),
        supabase.from('player_xp').select('*').eq('user_id', userId).single(),
        supabase.from('player_statistics').select('*').eq('user_id', userId).single(),
        supabase.from('player_settings').select('*').eq('user_id', userId).single(),
        supabase.from('player_cosmetics').select('*').eq('user_id', userId).single(),
        supabase.from('player_battle_pass').select('*').eq('user_id', userId).maybeSingle(),
      ]);

      if (profileRes.error) return null;

      return {
        profile: profileRes.data,
        rank: rankRes.data,
        xp: xpRes.data,
        statistics: statsRes.data,
        settings: settingsRes.data,
        cosmetics: cosmeticsRes.data,
        battlePass: passRes.data,
      };
    } catch (err) {
      console.error('Failed to fetch full authoritative profile:', err);
      return null;
    }
  }

  /**
   * Record match outcome for authenticated users
   */
  public async recordOfflineMatch(
    userId: string,
    won: boolean,
    details?: {
      tricksWon?: number;
      euchres?: number;
      marches?: number;
      successfulLoners?: number;
      score?: string;
      mode?: string;
      opponentNames?: string[];
    }
  ): Promise<void> {
    if (!supabase) return;
    try {
      const [statsRes, xpRes] = await Promise.all([
        supabase.from('player_statistics').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('player_xp').select('xp, level, next_level_xp').eq('user_id', userId).maybeSingle(),
      ]);

      if (statsRes.data) {
        const wins = won ? (statsRes.data.wins || 0) + 1 : (statsRes.data.wins || 0);
        const losses = won ? (statsRes.data.losses || 0) : (statsRes.data.losses || 0) + 1;
        const total_games = (statsRes.data.total_games || 0) + 1;
        const tricks_won = (statsRes.data.tricks_won || 0) + (details?.tricksWon || 0);
        const euchres = (statsRes.data.euchres || 0) + (details?.euchres || 0);
        const marches = (statsRes.data.marches || 0) + (details?.marches || 0);
        const successful_loners = (statsRes.data.successful_loners || 0) + (details?.successfulLoners || 0);
        const current_streak = won ? (statsRes.data.current_streak || 0) + 1 : 0;
        const best_streak = Math.max(statsRes.data.best_streak || 0, current_streak);

        await supabase.from('player_statistics').update({
          wins,
          losses,
          total_games,
          tricks_won,
          euchres,
          marches,
          successful_loners,
          current_streak,
          best_streak,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
      }

      if (xpRes.data) {
        const xpEarned = won ? 150 : 50;
        const totalXp = (xpRes.data.xp || 0) + xpEarned;
        const levelUp = totalXp >= (xpRes.data.next_level_xp || 1000);
        const level = levelUp ? (xpRes.data.level || 1) + 1 : (xpRes.data.level || 1);
        const next_level_xp = levelUp ? (xpRes.data.next_level_xp || 1000) + 1000 : (xpRes.data.next_level_xp || 1000);
        await supabase.from('player_xp').update({ xp: totalXp, level, next_level_xp, updated_at: new Date().toISOString() }).eq('user_id', userId);
      }

      // Record rank progression for competitive ranking
      const rankRes = await supabase.from('player_ranks').select('rank_tier, rank_points, mmr').eq('user_id', userId).maybeSingle();
      if (rankRes.data) {
        const lpDelta = won ? 20 : -15;
        const TIER_ORDER = ['9', '10', 'Q', 'K', 'A', 'BOWER_JJ'];
        let newPoints = (rankRes.data.rank_points || 0) + lpDelta;
        let newTier = rankRes.data.rank_tier || '9';
        const currentTierIdx = TIER_ORDER.indexOf(newTier);

        if (newPoints >= 100) {
          if (currentTierIdx < TIER_ORDER.length - 1) {
            newTier = TIER_ORDER[currentTierIdx + 1];
            newPoints = newPoints - 100;
          } else {
            newPoints = 100;
          }
        } else if (newPoints < 0) {
          if (currentTierIdx > 0) {
            newTier = TIER_ORDER[currentTierIdx - 1];
            newPoints = 75;
          } else {
            newPoints = 0;
          }
        }

        const newMmr = Math.max(800, (rankRes.data.mmr || 1200) + (won ? 15 : -10));
        await supabase.from('player_ranks').update({
          rank_tier: newTier,
          rank_points: newPoints,
          mmr: newMmr,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
      }

      // Record entry in player_match_history
      try {
        const recordId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `hist_${Date.now()}`;
        await supabase.from('player_match_history').insert({
          id: recordId,
          user_id: userId,
          match_id: null,
          won,
          mode: details?.mode || 'offline_ai',
          score: details?.score || (won ? '10 - 7' : '7 - 10'),
          lp_change: won ? 20 : -15,
          mmr_change: won ? 15 : -10,
          opponent_names: details?.opponentNames || ['BowerAI North', 'BowerAI East', 'BowerAI West'],
          created_at: new Date().toISOString(),
        });
      } catch (histErr) {
        console.warn('Could not insert match history record:', histErr);
      }
    } catch (err) {
      console.warn('Could not record match to Supabase:', err);
    }
  }

  /**
   * Fetch user's match history from PostgreSQL
   */
  public async fetchMatchHistory(userId: string, limit = 20): Promise<any[]> {
    if (!supabase) return [];
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (!isUuid) return [];
    try {
      const { data, error } = await supabase
        .from('player_match_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data) return [];
      return data;
    } catch (err) {
      console.warn('Could not fetch match history:', err);
      return [];
    }
  }

  /**
   * Fetch global leaderboard rankings directly from Supabase
   */
  public async getLeaderboard(limit = 50): Promise<any[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          avatar_icon,
          player_ranks (
            rank_tier,
            rank_points,
            mmr
          ),
          player_statistics (
            wins,
            losses,
            total_games
          )
        `)
        .eq('is_banned', false)
        .not('username', 'like', 'Bench_%')
        .limit(limit * 2);

      if (error || !data) return [];

      const tierWeights: Record<string, number> = {
        BOWER_JJ: 6,
        A: 5,
        K: 4,
        Q: 3,
        '10': 2,
        '9': 1,
      };

      const formatted = data.map((p: any) => {
        const r = Array.isArray(p.player_ranks) ? p.player_ranks[0] : p.player_ranks;
        const s = Array.isArray(p.player_statistics) ? p.player_statistics[0] : p.player_statistics;
        const totalGames = s?.total_games || 0;
        const wins = s?.wins || 0;
        const losses = s?.losses || 0;
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        const tier = r?.rank_tier || '9';
        const points = r?.rank_points || 0;
        const mmr = r?.mmr || 1200;

        return {
          userId: p.id,
          username: p.username || 'Player',
          avatarIcon: p.avatar_icon || '🤠',
          rankTier: tier,
          rankPoints: points,
          mmr,
          wins,
          losses,
          totalGames,
          winRate,
          tierWeight: tierWeights[tier] || 1,
        };
      });

      formatted.sort((a, b) => {
        if (b.tierWeight !== a.tierWeight) return b.tierWeight - a.tierWeight;
        if (b.rankPoints !== a.rankPoints) return b.rankPoints - a.rankPoints;
        return b.mmr - a.mmr;
      });

      return formatted.slice(0, limit).map((e, idx) => ({
        rankPosition: idx + 1,
        userId: e.userId,
        username: e.username,
        avatarIcon: e.avatarIcon,
        rankTier: e.rankTier,
        rankPoints: e.rankPoints,
        mmr: e.mmr,
        wins: e.wins,
        losses: e.losses,
        winRate: e.winRate,
        totalGames: e.totalGames,
      }));
    } catch (err) {
      console.warn('Could not query leaderboard from Supabase:', err);
      return [];
    }
  }

  /**
   * Fetch live authoritative multiplayer server URL from Supabase registry
   */
  public async getLiveServerUrl(): Promise<string | null> {
    // 1. Try via Supabase JS client
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('server_registry')
          .select('public_url, updated_at')
          .eq('id', 'primary')
          .single();
        if (!error && data?.public_url) return data.public_url;
      } catch {}
    }

    // 2. Direct bulletproof REST fallback via fetch (bypasses any Supabase client session lock)
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/server_registry?id=eq.primary&select=public_url`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0 && rows[0].public_url) {
          return rows[0].public_url;
        }
      }
    } catch {}

    return null;
  }
}

export const authService = new AuthService();
