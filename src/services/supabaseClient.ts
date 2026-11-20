/**
 * BOWER JJ — Supabase Client & Authentication Service (Frontend)
 * Manages email/password registration, login, session restoration, and profile synchronization.
 */

import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { captureInitialAuthRedirect, formatAuthError } from './authCallback';
import { resolveAvatarId, resolveCardBackId, resolveTableFeltId } from '../config/collectiblesCatalog';
import type { FriendSummary } from '../../server/types';

// Capture auth redirect parameters before Supabase client initializes and scrubs URL fragments
captureInitialAuthRedirect();

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
  private tokenHashVerifyCache = new Map<
    string,
    Promise<{ user: User | null; session: Session | null; error: string | null }>
  >();

  /**
   * Check if username is already taken (case-insensitive)
   */
  public async isUsernameAvailable(username: string): Promise<boolean> {
    if (!supabase) return true;
    try {
      const clean = username.trim();
      if (!clean) return false;
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', clean)
        .maybeSingle();

      if (error) return true;
      return data === null;
    } catch {
      return true;
    }
  }

  /**
   * Register new player with Username and Password (no email required)
   */
  public async register(
    username: string,
    password: string,
    avatarIcon: string = 'the_outlaw'
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
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      return { user: null, session: null, error: 'Username can only contain letters, numbers, underscores, and hyphens.' };
    }

    const available = await this.isUsernameAvailable(cleanUsername);
    if (!available) {
      return { user: null, session: null, error: `Username "${cleanUsername}" is already taken.` };
    }

    try {
      const redirectUrl = this.getPublicAppUrl();
      const synthesizedEmail = `${cleanUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}@bowerjj.app`;

      const { data, error } = await supabase.auth.signUp({
        email: synthesizedEmail,
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
        return { user: null, session: null, error: formatAuthError(error, 'Registration failed.') };
      }

      let user = data.user;
      let session = data.session;

      // If Supabase didn't return session immediately, sign in right away
      if (!session && user) {
        const loginRes = await supabase.auth.signInWithPassword({
          email: synthesizedEmail,
          password,
        });
        if (loginRes.data.session) {
          session = loginRes.data.session;
          user = loginRes.data.user;
        }
      }

      // Ensure public.profiles has email and metadata synced
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({
            email: synthesizedEmail,
            username: cleanUsername,
            avatar_icon: avatarIcon,
          })
          .eq('id', user.id);
      }

      return {
        user,
        session,
        error: null,
      };
    } catch (err: any) {
      return { user: null, session: null, error: formatAuthError(err, 'Registration failed.') };
    }
  }

  /**
   * Sign in with Username (or Email) and Password
   * Supports existing users by username via public.profiles email lookup.
   */
  public async login(
    identifier: string,
    password: string
  ): Promise<{ user: User | null; session: Session | null; error: string | null }> {
    if (!supabase) {
      return {
        user: null,
        session: null,
        error: 'Supabase is not configured. Running in offline/guest mode.',
      };
    }

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier || !password) {
      return { user: null, session: null, error: 'Please enter both username and password.' };
    }

    try {
      let emailToUse = cleanIdentifier;

      // If identifier is not already an email, lookup user's registered email in public.profiles
      if (!cleanIdentifier.includes('@')) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, username')
          .ilike('username', cleanIdentifier)
          .maybeSingle();

        if (profile?.email) {
          emailToUse = profile.email;
        } else {
          // Fallback to internal synthesized domain
          emailToUse = `${cleanIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '')}@bowerjj.app`;
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (error) {
        return { user: null, session: null, error: 'Invalid username or password.' };
      }

      return {
        user: data.user,
        session: data.session,
        error: null,
      };
    } catch (err: any) {
      return { user: null, session: null, error: formatAuthError(err, 'Login failed.') };
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
    return 'https://bowerjj.com';
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
        return { success: false, error: formatAuthError(error, 'Password reset request failed.') };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: formatAuthError(err, 'Password reset request failed.') };
    }
  }

  /**
   * Verify a scanner-proof signup token_hash link from confirmation email
   */
  public async verifyTokenHash(
    tokenHash: string,
    type: 'signup' | 'email' = 'signup'
  ): Promise<{ user: User | null; session: Session | null; error: string | null }> {
    if (!supabase) {
      return { user: null, session: null, error: 'Supabase is not configured.' };
    }

    const cacheKey = `${type}:${tokenHash}`;
    const existing = this.tokenHashVerifyCache.get(cacheKey);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        if (error) {
          return { user: null, session: null, error: formatAuthError(error, 'Account verification failed.') };
        }
        return { user: data.user, session: data.session, error: null };
      } catch (err: any) {
        return { user: null, session: null, error: formatAuthError(err, 'Account verification failed.') };
      }
    })();

    this.tokenHashVerifyCache.set(cacheKey, promise);
    return promise;
  }

  /**
   * Verify a 6-digit email confirmation OTP code entered directly by the player
   */
  public async verifyEmailOtpCode(
    email: string,
    token: string
  ): Promise<{ user: User | null; session: Session | null; error: string | null }> {
    if (!supabase) {
      return { user: null, session: null, error: 'Supabase is not configured.' };
    }

    try {
      const cleanToken = token.replace(/\s+/g, '').trim();
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanToken,
        type: 'signup',
      });
      if (error) {
        return { user: null, session: null, error: formatAuthError(error, 'Verification code invalid or expired.') };
      }
      return { user: data.user, session: data.session, error: null };
    } catch (err: any) {
      return { user: null, session: null, error: formatAuthError(err, 'Verification code invalid or expired.') };
    }
  }

  /**
   * Resend account confirmation email to the specified address
   */
  public async resendConfirmationEmail(
    email: string
  ): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured.' };
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: this.getPublicAppUrl(),
        },
      });
      if (error) {
        return { success: false, error: formatAuthError(error, 'Could not resend confirmation email.') };
      }
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: formatAuthError(err, 'Could not resend confirmation email.') };
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
      const [profileRes, rankRes, xpRes, statsRes, settingsRes, cosmeticsRes, packsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('player_ranks').select('*').eq('user_id', userId).single(),
        supabase.from('player_xp').select('*').eq('user_id', userId).single(),
        supabase.from('player_statistics').select('*').eq('user_id', userId).single(),
        supabase.from('player_settings').select('*').eq('user_id', userId).single(),
        supabase.from('player_cosmetics').select('*').eq('user_id', userId).single(),
        supabase.from('player_card_packs').select('id').eq('user_id', userId).eq('status', 'unopened'),
      ]);

      if (profileRes.error) return null;

      return {
        profile: profileRes.data,
        rank: rankRes.data,
        xp: xpRes.data,
        statistics: statsRes.data,
        settings: settingsRes.data,
        cosmetics: cosmeticsRes.data,
        unopenedPacksCount: Array.isArray(packsRes.data) ? packsRes.data.length : 0,
      };
    } catch (err) {
      console.error('Failed to fetch full authoritative profile:', err);
      return null;
    }
  }

  /**
   * Fetch user's friends directly from Supabase (REST fallback for instant load)
   */
  public async fetchFriends(userId: string): Promise<FriendSummary[]> {
    if (!supabase || !userId) return [];
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (!isUuid) return [];

    try {
      const { data: friendships, error: friendErr } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (friendErr || !friendships || friendships.length === 0) return [];

      const friendIds = friendships.map(f => (f.user_id === userId ? f.friend_id : f.user_id));
      if (friendIds.length === 0) return [];

      const [profilesRes, ranksRes, xpRes] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_icon').in('id', friendIds),
        supabase.from('player_ranks').select('user_id, rank_tier, rank_division, rank_points').in('user_id', friendIds),
        supabase.from('player_xp').select('user_id, level').in('user_id', friendIds),
      ]);

      const rankMap = new Map((ranksRes.data || []).map(r => [r.user_id, r]));
      const xpMap = new Map((xpRes.data || []).map(x => [x.user_id, x]));

      const results: FriendSummary[] = (profilesRes.data || []).map(p => {
        const r = rankMap.get(p.id);
        const x = xpMap.get(p.id);
        return {
          userId: p.id,
          username: p.username || 'Player',
          avatarIcon: resolveAvatarId(p.avatar_icon),
          rankTier: (r?.rank_tier as any) || '9',
          rankDivision: (r?.rank_division as any) || 'III',
          rankPoints: r?.rank_points ?? 0,
          level: x?.level ?? 1,
          isOnline: false,
          status: 'offline',
        };
      });

      return results;
    } catch (err) {
      console.warn('Could not fetch friends directly from Supabase:', err);
      return [];
    }
  }

  /**
   * Persist avatar change directly to Supabase profiles, player_cosmetics, and user metadata
   */
  public async updateUserAvatar(userId: string, avatarIcon: string): Promise<boolean> {
    if (!supabase || !userId || !avatarIcon) return false;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (!isUuid) return false;
    try {
      const now = new Date().toISOString();
      const resolvedAvatar = resolveAvatarId(avatarIcon);
      await Promise.all([
        supabase.from('profiles').update({ avatar_icon: resolvedAvatar, updated_at: now }).eq('id', userId),
        supabase.from('player_cosmetics').update({ equipped_hat: resolvedAvatar, updated_at: now }).eq('user_id', userId),
        supabase.auth.updateUser({ data: { avatar_icon: resolvedAvatar } }).catch(() => {}),
      ]);
      return true;
    } catch (err) {
      console.warn('Could not persist avatar to Supabase:', err);
      return false;
    }
  }

  /**
   * Persist cosmetic change directly to Supabase player_cosmetics (and profiles if hat)
   */
  public async updateUserCosmetic(
    userId: string,
    category: 'hat' | 'cardBack' | 'banner' | 'title' | 'tableFelt',
    itemId: string
  ): Promise<boolean> {
    if (!supabase || !userId || !itemId) return false;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (!isUuid) return false;
    const colMap: Record<string, string> = {
      hat: 'equipped_hat',
      cardBack: 'equipped_card_back',
      banner: 'equipped_banner',
      title: 'equipped_title',
      tableFelt: 'equipped_felt',
    };
    const col = colMap[category];
    if (!col) return false;
    try {
      const now = new Date().toISOString();
      const normalizedItem =
        category === 'hat'
          ? resolveAvatarId(itemId)
          : category === 'cardBack'
            ? resolveCardBackId(itemId)
            : category === 'tableFelt'
              ? resolveTableFeltId(itemId)
              : itemId;
      const { error: updateErr } = await supabase.from('player_cosmetics').update({ [col]: normalizedItem, updated_at: now }).eq('user_id', userId);
      if (updateErr) {
        // If row didn't exist yet, perform upsert
        await supabase.from('player_cosmetics').upsert({ user_id: userId, [col]: normalizedItem, updated_at: now }, { onConflict: 'user_id' });
      }
      if (category === 'hat') {
        await supabase.from('profiles').update({ avatar_icon: normalizedItem, updated_at: now }).eq('id', userId);
      }
      return true;
    } catch (err) {
      console.warn('Could not persist cosmetic to Supabase:', err);
      return false;
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
  ): Promise<boolean> {
    if (!supabase) return false;
    try {
      const [statsRes, xpRes] = await Promise.all([
        supabase.from('player_statistics').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('player_xp').select('xp, level, next_level_xp').eq('user_id', userId).maybeSingle(),
      ]);

      let updatedAny = false;
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

        const { error: statsUpdateErr } = await supabase.from('player_statistics').update({
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
        if (!statsUpdateErr) {
          updatedAny = true;
        }
      }

      if (xpRes.data) {
        const xpEarned = won ? 150 : 50;
        const rawXp = xpRes.data.xp || 0;
        const baseXp = rawXp % 1000;
        const baseLevel = rawXp >= 1000 ? Math.floor(rawXp / 1000) + 1 : (xpRes.data.level || 1);
        const totalXp = baseXp + xpEarned;
        const levelsGained = Math.floor(totalXp / 1000);
        const level = baseLevel + levelsGained;
        const xp = totalXp % 1000;
        const next_level_xp = 1000;
        const { error: xpUpdateErr } = await supabase
          .from('player_xp')
          .update({ xp, level, next_level_xp, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
        if (!xpUpdateErr && levelsGained > 0 && typeof crypto !== 'undefined' && crypto.randomUUID) {
          for (let lvl = baseLevel + 1; lvl <= level; lvl++) {
            await supabase
              .from('player_card_packs')
              .upsert(
                {
                  id: crypto.randomUUID(),
                  user_id: userId,
                  source: 'level_up',
                  source_ref: `level_${lvl}`,
                  earned_level: lvl,
                  status: 'unopened',
                  earned_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,source_ref', ignoreDuplicates: true }
              );
          }
        }
      }

      // Note: Offline bot/practice matches do NOT award LP or update player_ranks.
      // Rank progression and LP are strictly earned in matchmade Competitive Ranked play.

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
          lp_change: 0,
          mmr_change: 0,
          opponent_names: details?.opponentNames || ['BowerAI North', 'BowerAI East', 'BowerAI West'],
          created_at: new Date().toISOString(),
        });
      } catch (histErr) {
        console.warn('Could not insert match history record:', histErr);
      }
      return updatedAny;
    } catch (err) {
      console.warn('Could not record match to Supabase:', err);
      return false;
    }
  }

  /**
   * Fetch user's match history from PostgreSQL
   */
  public async fetchMatchHistory(userId: string, limit = 50): Promise<any[]> {
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
   * Fetch global leaderboard rankings directly from Supabase (Strictly Ranked Queue Players Only)
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
          player_ranks!inner (
            rank_tier,
            rank_division,
            rank_points,
            mmr,
            placement_matches_remaining
          ),
          player_statistics (
            wins,
            losses,
            total_games,
            current_streak,
            best_streak
          ),
          player_match_history (
            won,
            mode
          )
        `)
        .eq('is_banned', false)
        .not('username', 'like', 'Bench_%')
        .or('placement_matches_remaining.lt.5,rank_points.gt.0,rank_tier.neq.9,mmr.neq.1200', {
          foreignTable: 'player_ranks',
        })
        .limit(200);

      if (error || !data) return [];

      const tierWeights: Record<string, number> = {
        BOWER_JJ: 6,
        A: 5,
        K: 4,
        Q: 3,
        '10': 2,
        '9': 1,
      };
      const divWeights: Record<string, number> = {
        APEX: 4,
        I: 3,
        II: 2,
        III: 1,
      };

      const isRankedMode = (mode?: string) =>
        mode === 'ranked_solo' ||
        mode === 'ranked_duo' ||
        mode === 'ranked_rivals' ||
        (typeof mode === 'string' && mode.toLowerCase().includes('ranked'));

      // Filter strictly to players who have queued ranked games
      const rankedPlayers = data.filter((p: any) => {
        const r = Array.isArray(p.player_ranks) ? p.player_ranks[0] : p.player_ranks;
        const mh = Array.isArray(p.player_match_history) ? p.player_match_history : [];
        const hasRankedMatch = mh.some((m: any) => isRankedMode(m.mode));
        if (hasRankedMatch) return true;
        if (!r) return false;
        return (
          (typeof r.placement_matches_remaining === 'number' && r.placement_matches_remaining < 5) ||
          (r.rank_points || 0) > 0 ||
          (r.rank_tier && r.rank_tier !== '9') ||
          (typeof r.mmr === 'number' && r.mmr !== 1200)
        );
      });

      const formatted = rankedPlayers.map((p: any) => {
        const r = Array.isArray(p.player_ranks) ? p.player_ranks[0] : p.player_ranks;
        const s = Array.isArray(p.player_statistics) ? p.player_statistics[0] : p.player_statistics;
        const mh = Array.isArray(p.player_match_history)
          ? p.player_match_history.filter((m: any) => isRankedMode(m.mode))
          : [];

        const hasRankedHist = mh.length > 0;
        const wins = hasRankedHist ? mh.filter((m: any) => m.won).length : (s?.wins || 0);
        const losses = hasRankedHist ? mh.filter((m: any) => !m.won).length : (s?.losses || 0);
        const totalGames = hasRankedHist ? mh.length : (s?.total_games || 0);
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        const tier = r?.rank_tier || '9';
        const division = tier === 'BOWER_JJ' ? 'APEX' : (r?.rank_division || 'III');
        const points = r?.rank_points || 0;
        const mmr = r?.mmr || 1200;

        return {
          userId: p.id,
          username: p.username || 'Player',
          avatarIcon: resolveAvatarId(p.avatar_icon),
          rankTier: tier,
          rankDivision: division,
          rankPoints: points,
          mmr,
          wins,
          losses,
          totalGames,
          rankedGames: totalGames,
          winRate,
          winStreak: s?.current_streak || 0,
          bestStreak: s?.best_streak || 0,
          tierWeight: tierWeights[tier] || 1,
          divWeight: divWeights[division] || 1,
        };
      });

      formatted.sort((a, b) => {
        if (b.tierWeight !== a.tierWeight) return b.tierWeight - a.tierWeight;
        if (b.divWeight !== a.divWeight) return b.divWeight - a.divWeight;
        if (b.rankPoints !== a.rankPoints) return b.rankPoints - a.rankPoints;
        return b.mmr - a.mmr;
      });

      return formatted.slice(0, limit).map((e, idx) => ({
        rankPosition: idx + 1,
        userId: e.userId,
        username: e.username,
        avatarIcon: e.avatarIcon,
        rankTier: e.rankTier,
        rankDivision: e.rankDivision,
        rankPoints: e.rankPoints,
        mmr: e.mmr,
        wins: e.wins,
        losses: e.losses,
        winRate: e.winRate,
        totalGames: e.totalGames,
        rankedGames: e.rankedGames,
        winStreak: e.winStreak,
        bestStreak: e.bestStreak,
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
