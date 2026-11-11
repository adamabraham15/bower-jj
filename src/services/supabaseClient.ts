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
      const redirectUrl = typeof window !== 'undefined'
        ? window.location.origin
        : 'https://bower-jj.vercel.app';

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
   * Send password reset email
   */
  public async resetPassword(email: string): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured.' };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/#reset-password`,
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
   * Fetch live authoritative multiplayer server URL from Supabase registry
   */
  public async getLiveServerUrl(): Promise<string | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('server_registry')
        .select('public_url, updated_at')
        .eq('id', 'primary')
        .single();
      if (error || !data) return null;
      return data.public_url;
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();
