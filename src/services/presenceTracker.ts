/**
 * BOWER JJ — Real-Time Site Presence & Visitor Analytics Service
 * Tracks live concurrent users, current in-app activity, device type, and ad/referral source
 * via both Supabase Realtime Presence (sub-second WebSockets) and PostgreSQL heartbeats.
 */

import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface LivePresenceRecord {
  session_id: string;
  player_id: string;
  username: string;
  rank_tier: string;
  activity: string;
  device: string;
  traffic_source: string;
  page_url: string;
  started_at: string;
  last_seen_at: string;
}

export interface SiteTrafficSummary {
  onlineNow: number;
  activeInMatch: number;
  inQueue: number;
  inMainMenu: number;
  inVaultOrPacks: number;
  visitsLastHour: number;
  visitsToday: number;
  visitsAllTime: number;
  activeSessions: LivePresenceRecord[];
  sourceBreakdown: Record<string, number>;
  deviceBreakdown: Record<string, number>;
  activityBreakdown: Record<string, number>;
}

const SESSION_KEY = 'bower_jj_live_session_id';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr-session';
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid =
        'sess_' +
        Date.now().toString(36) +
        '_' +
        Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return 'sess_' + Math.random().toString(36).substring(2, 11);
  }
}

export function detectDeviceType(): string {
  if (typeof navigator === 'undefined') return 'Desktop';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod/i.test(ua)) return 'iPhone / iOS';
  if (/iPad/i.test(ua)) return 'iPad / Tablet';
  if (/Android/i.test(ua)) return 'Android';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac Desktop';
  if (/Windows/i.test(ua)) return 'Windows PC';
  return 'Desktop';
}

export function detectTrafficSource(): string {
  if (typeof window === 'undefined') return 'Direct';
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = (params.get('utm_source') || params.get('ref') || params.get('source') || '').toLowerCase();
    if (utm.includes('youtube') || utm.includes('yt') || utm.includes('short')) return 'YouTube Shorts';
    if (utm.includes('facebook') || utm.includes('fb') || params.has('fbclid')) return 'Facebook Ads';
    if (utm.includes('instagram') || utm.includes('ig')) return 'Instagram';
    if (utm.includes('tiktok') || utm.includes('tt') || params.has('ttclid')) return 'TikTok';

    const ref = (document.referrer || '').toLowerCase();
    if (ref.includes('youtube.com') || ref.includes('youtu.be')) return 'YouTube Shorts';
    if (ref.includes('facebook.com') || ref.includes('fb.com') || ref.includes('m.facebook.com')) return 'Facebook Ads';
    if (ref.includes('instagram.com')) return 'Instagram';
    if (ref.includes('tiktok.com')) return 'TikTok';
    if (ref.includes('google.')) return 'Google Search';
    if (ref.includes('t.co') || ref.includes('twitter.com') || ref.includes('x.com')) return 'X / Twitter';
    if (ref && !ref.includes(window.location.hostname)) {
      try {
        return new URL(document.referrer).hostname.replace(/^www\./, '');
      } catch {
        return 'Referral';
      }
    }
    return 'Direct (bowerjj.com)';
  } catch {
    return 'Direct (bowerjj.com)';
  }
}

class PresenceTrackerService {
  private sessionId: string = getOrCreateSessionId();
  private startedAt: string = new Date().toISOString();
  private playerId: string = 'guest';
  private username: string = 'Guest';
  private rankTier: string = '9';
  private activity: string = 'Main Menu';
  private device: string = detectDeviceType();
  private trafficSource: string = detectTrafficSource();
  private channel: RealtimeChannel | null = null;
  private heartbeatTimer: any = null;
  private initialized: boolean = false;
  private visitLogged: boolean = false;

  public startPlayerTracking(initialProfile?: {
    playerId?: string;
    username?: string;
    rankTier?: string;
    activity?: string;
  }) {
    if (typeof window === 'undefined' || !supabase) return;
    if (initialProfile?.playerId) this.playerId = initialProfile.playerId;
    if (initialProfile?.username) this.username = initialProfile.username;
    if (initialProfile?.rankTier) this.rankTier = initialProfile.rankTier;
    if (initialProfile?.activity) this.activity = initialProfile.activity;

    if (this.initialized) {
      this.syncNow();
      return;
    }
    this.initialized = true;

    // 1. Join Supabase Realtime Presence channel for instant sub-second presence
    try {
      this.channel = supabase.channel('bower_jj_live_presence', {
        config: {
          presence: { key: this.sessionId },
        },
      });

      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.trackOnChannel();
        }
      });
    } catch (err) {
      console.warn('[PresenceTracker] Realtime channel error:', err);
    }

    // 2. Log unique session visit & initial heartbeat in PostgreSQL
    this.syncNow();

    // 3. Periodic 20-second heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.syncNow();
    }, 20000);

    // 4. Clean up on tab close / visibility change
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.syncNow();
      }
    });

    window.addEventListener('beforeunload', () => {
      this.cleanupSession();
    });
  }

  public updateState(update: {
    playerId?: string;
    username?: string;
    rankTier?: string;
    activity?: string;
  }) {
    let changed = false;
    if (update.playerId && update.playerId !== this.playerId) {
      this.playerId = update.playerId;
      changed = true;
    }
    if (update.username && update.username !== this.username) {
      this.username = update.username;
      changed = true;
    }
    if (update.rankTier && update.rankTier !== this.rankTier) {
      this.rankTier = update.rankTier;
      changed = true;
    }
    if (update.activity && update.activity !== this.activity) {
      this.activity = update.activity;
      changed = true;
    }
    if (changed && this.initialized) {
      this.syncNow();
    }
  }

  private getPayload(): LivePresenceRecord {
    return {
      session_id: this.sessionId,
      player_id: this.playerId,
      username: this.username,
      rank_tier: this.rankTier,
      activity: this.activity,
      device: this.device,
      traffic_source: this.trafficSource,
      page_url: typeof window !== 'undefined' ? window.location.href : 'https://bowerjj.com',
      started_at: this.startedAt,
      last_seen_at: new Date().toISOString(),
    };
  }

  private async trackOnChannel() {
    if (!this.channel) return;
    try {
      await this.channel.track(this.getPayload());
    } catch {
      // Ignore transient realtime errors
    }
  }

  private async syncNow() {
    if (!supabase) return;
    const payload = this.getPayload();
    this.trackOnChannel();

    try {
      await supabase.from('site_presence').upsert(payload, { onConflict: 'session_id' });

      if (!this.visitLogged) {
        this.visitLogged = true;
        await supabase.from('site_visits').upsert(
          {
            session_id: this.sessionId,
            player_id: this.playerId,
            username: this.username,
            device: this.device,
            traffic_source: this.trafficSource,
            referrer: typeof document !== 'undefined' ? document.referrer || null : null,
          },
          { onConflict: 'session_id' }
        );
      }
    } catch {
      // Silently ignore if table is still propagating
    }
  }

  private cleanupSession() {
    if (!supabase) return;
    try {
      supabase.from('site_presence').delete().eq('session_id', this.sessionId).then(() => {});
    } catch {
      // Ignore
    }
  }
}

export const presenceTracker = new PresenceTrackerService();
