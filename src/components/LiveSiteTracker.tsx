/**
 * BOWER JJ — Separate Live Website Traffic & Online Player Tracker Dashboard
 * Accessible at https://bowerjj.com/tracker or https://bowerjj.com/?tracker=1
 * Monitors real-time active users, current in-app screens, ad campaign sources, and visitor history.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Users,
  Globe,
  Smartphone,
  Monitor,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  Gamepad2,
  Clock,
  Radio,
  Sparkles,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { presenceTracker, LivePresenceRecord } from '../services/presenceTracker';

interface LiveSiteTrackerProps {
  onBackToGame?: () => void;
}

interface VisitRow {
  id: number;
  session_id: string;
  player_id: string | null;
  username: string | null;
  device: string;
  traffic_source: string;
  referrer: string | null;
  created_at: string;
}

function formatDurationSince(isoDate: string): string {
  const start = new Date(isoDate).getTime();
  if (isNaN(start)) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - start) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatTimeAgo(isoDate: string): string {
  const ts = new Date(isoDate).getTime();
  if (isNaN(ts)) return ' now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 8) return 'Live now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

const VALID_ADMIN_KEYS = ['bower777', 'boweradmin', 'bowerjj2026', 'bowerjj777'];

export const LiveSiteTracker: React.FC<LiveSiteTrackerProps> = ({ onBackToGame }) => {
  // Admin authorization gate: Only the site owner can view live telemetry
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (localStorage.getItem('bower_tracker_admin_authorized') === 'true') {
      return true;
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const keyParam = (params.get('key') || params.get('admin') || params.get('pin') || params.get('pass') || '').trim().toLowerCase();
      if (VALID_ADMIN_KEYS.includes(keyParam)) {
        localStorage.setItem('bower_tracker_admin_authorized', 'true');
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
        return true;
      }
    } catch {}
    return false;
  });

  const [passcodeAttempt, setPasscodeAttempt] = useState<string>('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  const [realtimeMap, setRealtimeMap] = useState<Record<string, LivePresenceRecord>>({});
  const [dbPresence, setDbPresence] = useState<LivePresenceRecord[]>([]);
  const [recentVisits, setRecentVisits] = useState<VisitRow[]>([]);
  const [visitsTodayCount, setVisitsTodayCount] = useState<number>(0);
  const [visitsHourCount, setVisitsHourCount] = useState<number>(0);
  const [visitsAllTimeCount, setVisitsAllTimeCount] = useState<number>(0);
  const [totalRegisteredProfiles, setTotalRegisteredProfiles] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [, setTick] = useState<number>(0);

  const fetchMetrics = useCallback(async () => {
    if (!supabase) return;
    setIsRefreshing(true);
    try {
      const now = Date.now();
      const activeCutoffIso = new Date(now - 65 * 1000).toISOString();
      const hourCutoffIso = new Date(now - 60 * 60 * 1000).toISOString();
      const dayCutoffIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();

      // Clean up stale rows older than 5 minutes in background
      const staleCutoffIso = new Date(now - 5 * 60 * 1000).toISOString();
      supabase.from('site_presence').delete().lt('last_seen_at', staleCutoffIso).then(() => {});

      const [presenceRes, hourRes, dayRes, totalVisitsRes, recentVisitsRes, profilesRes] =
        await Promise.all([
          supabase
            .from('site_presence')
            .select('*')
            .gte('last_seen_at', activeCutoffIso)
            .order('last_seen_at', { ascending: false }),
          supabase
            .from('site_visits')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', hourCutoffIso),
          supabase
            .from('site_visits')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', dayCutoffIso),
          supabase.from('site_visits').select('id', { count: 'exact', head: true }),
          supabase
            .from('site_visits')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
        ]);

      if (presenceRes.data) {
        setDbPresence(presenceRes.data as LivePresenceRecord[]);
      }
      if (typeof hourRes.count === 'number') setVisitsHourCount(hourRes.count);
      if (typeof dayRes.count === 'number') setVisitsTodayCount(dayRes.count);
      if (typeof totalVisitsRes.count === 'number') setVisitsAllTimeCount(totalVisitsRes.count);
      if (recentVisitsRes.data) setRecentVisits(recentVisitsRes.data as VisitRow[]);
      if (typeof profilesRes.count === 'number') setTotalRegisteredProfiles(profilesRes.count);

      setLastUpdated(new Date());
    } catch (err) {
      console.warn('[LiveSiteTracker] Fetch error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    fetchMetrics();

    const pollInterval = setInterval(fetchMetrics, 8000);
    const uiTickInterval = setInterval(() => setTick((t) => t + 1), 1000);

    // Subscribe to shared PresenceTracker singleton for instant sub-second presence
    const unsubPresence = presenceTracker.subscribeToPresenceState((nextMap) => {
      setRealtimeMap(nextMap);
    });

    // Also listen to postgres_changes on site_presence & site_visits
    let dbChangesChannel: any = null;
    if (supabase) {
      dbChangesChannel = supabase
        .channel('bower_jj_tracker_db_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_presence' }, () => {
          fetchMetrics();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_visits' }, () => {
          fetchMetrics();
        })
        .subscribe();
    }

    return () => {
      clearInterval(pollInterval);
      clearInterval(uiTickInterval);
      unsubPresence();
      if (supabase && dbChangesChannel) {
        supabase.removeChannel(dbChangesChannel);
      }
    };
  }, [fetchMetrics, isAuthorized]);

  // Merge Realtime WebSocket presence + active DB heartbeat rows
  const mergedSessionsMap = new Map<string, LivePresenceRecord>();
  dbPresence.forEach((row) => {
    mergedSessionsMap.set(row.session_id, row);
  });
  Object.values(realtimeMap).forEach((rtRow) => {
    mergedSessionsMap.set(rtRow.session_id, rtRow);
  });

  const activeSessions = Array.from(mergedSessionsMap.values()).sort(
    (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
  );

  const onlineNow = activeSessions.length;
  const activeInMatchOrQueue = activeSessions.filter(
    (s) =>
      s.activity.toLowerCase().includes('play') ||
      s.activity.toLowerCase().includes('match') ||
      s.activity.toLowerCase().includes('queue') ||
      s.activity.toLowerCase().includes('lobby')
  ).length;

  // Compute breakdowns
  const activityCounts: Record<string, number> = {};
  const deviceCounts: Record<string, number> = {};
  activeSessions.forEach((s) => {
    activityCounts[s.activity] = (activityCounts[s.activity] || 0) + 1;
    deviceCounts[s.device] = (deviceCounts[s.device] || 0) + 1;
  });

  // Traffic sources from recent 100 visits (or active sessions if visits empty)
  const sourceCounts: Record<string, number> = {};
  const sourcePool = recentVisits.length > 0 ? recentVisits : activeSessions;
  sourcePool.forEach((v) => {
    const src = v.traffic_source || 'Direct (bowerjj.com)';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });

  const copyTrackingUrl = (url: string, label: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen w-full bg-[#070b14] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Ambient Top Glow */}
        <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-gradient-to-b from-amber-500/10 via-yellow-500/5 to-transparent" />

        <div className="w-full max-w-md bg-[#0f172a] border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden z-10 backdrop-blur-xl">
          {/* Top Gold Accent Bar */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

          {/* Logo badge */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-xl shadow-amber-500/25 mb-4">
            <div className="w-full h-full bg-[#0b1324] rounded-[14px] flex flex-col items-center justify-center leading-none">
              <span className="text-[10px] font-black tracking-tighter text-amber-300">BOWER</span>
              <span className="text-base font-black text-amber-400">JJ</span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>Private Live Telemetry</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
            Admin Verification Required
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1.5 mb-6 max-w-xs">
            This real-time traffic and presence dashboard is private. Please enter your administrator passcode to proceed.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = passcodeAttempt.trim().toLowerCase();
              if (VALID_ADMIN_KEYS.includes(trimmed)) {
                try {
                  localStorage.setItem('bower_tracker_admin_authorized', 'true');
                } catch {}
                setIsAuthorized(true);
                setPasscodeError(null);
              } else {
                setPasscodeError('Invalid administrator passcode. Access denied.');
              }
            }}
            className="w-full space-y-3.5"
          >
            <div>
              <input
                type="password"
                value={passcodeAttempt}
                onChange={(e) => {
                  setPasscodeAttempt(e.target.value);
                  if (passcodeError) setPasscodeError(null);
                }}
                placeholder="Enter Administrator Passcode"
                className="w-full px-4 py-3 bg-[#080d1a] border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl text-sm font-mono text-white placeholder-slate-500 outline-none transition-all text-center"
                autoFocus
              />
              {passcodeError && (
                <div className="mt-2 text-xs font-bold text-rose-400 animate-pulse">
                  {passcodeError}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/25 active:scale-98 transition-all cursor-pointer"
            >
              Unlock Dashboard
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/80 w-full flex items-center justify-center">
            <button
              onClick={() => {
                if (onBackToGame) {
                  onBackToGame();
                } else {
                  window.location.href = '/';
                }
              }}
              className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              ← Return to BOWER JJ Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#060a14] text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950 overflow-y-auto pb-16">
      {/* Top Ambient Glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-gradient-to-b from-emerald-500/10 via-amber-500/5 to-transparent" />

      {/* Header Navigation Bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#090f1d]/90 border-b border-slate-800/80 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-[#0b1324] rounded-[10px] flex flex-col items-center justify-center leading-none">
                <span className="text-[9px] font-black tracking-tighter text-amber-300">BOWER</span>
                <span className="text-sm font-black text-amber-400">JJ</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  BOWERJJ.COM — LIVE TRAFFIC TRACKER
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-Time Online Presence, Active Game Rooms & Social Ad Attribution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:inline">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
            <button
              onClick={fetchMetrics}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-bold text-slate-200 transition-all active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              Refresh
            </button>
            <a
              href="/"
              onClick={(e) => {
                if (onBackToGame) {
                  e.preventDefault();
                  onBackToGame();
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-xs font-black text-white shadow-lg shadow-emerald-600/25 transition-all"
            >
              Open Game
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('bower_tracker_admin_authorized');
                } catch {}
                setIsAuthorized(false);
              }}
              title="Lock Live Tracker (Sign Out)"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-xs font-bold text-slate-400 hover:text-rose-300 transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6 relative z-10">
        {/* =====================================================================
            ROW 1: 4 HERO KPI CARDS
        ===================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Online Right Now */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#101c2e] to-[#0b1322] border border-emerald-500/40 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                Online Right Now
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                {onlineNow}
              </span>
              <span className="text-xs font-bold text-emerald-400">
                active {onlineNow === 1 ? 'person' : 'people'} on site
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Instant WebSocket presence + 60s heartbeat
            </p>
          </div>

          {/* Card 2: In Game / Matchmaking */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#101c2e] to-[#0b1322] border border-amber-500/35 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                In Match / Queue
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                {activeInMatchOrQueue}
              </span>
              <span className="text-xs font-bold text-amber-300">playing or queuing</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {Math.max(0, onlineNow - activeInMatchOrQueue)} in menus, vault, or leaderboard
            </p>
          </div>

          {/* Card 3: Visitors Today (24h) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#101c2e] to-[#0b1322] border border-sky-500/35 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-sky-400">
                Visitors Today (24h)
              </span>
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                {visitsTodayCount}
              </span>
              <span className="text-xs font-bold text-sky-300">
                ({visitsHourCount} in last hour)
              </span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Unique browser sessions in the past 24 hours
            </p>
          </div>

          {/* Card 4: Total Visits & Registered Accounts */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#101c2e] to-[#0b1322] border border-purple-500/35 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-purple-400">
                All-Time Traffic
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2.5">
              <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                {visitsAllTimeCount}
              </span>
              <span className="text-xs font-bold text-purple-300">total sessions</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {totalRegisteredProfiles} registered player profiles in DB
            </p>
          </div>
        </div>

        {/* =====================================================================
            ROW 2: BREAKDOWNS (AD SOURCES, LIVE SCREENS, DEVICES)
        ===================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Panel 1: Traffic & Social Ad Source Breakdown */}
          <div className="rounded-2xl bg-[#0d1526]/90 border border-slate-800 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Traffic & Ad Sources
                </h2>
                <span className="text-[11px] text-slate-400">Recent {sourcePool.length} sessions</span>
              </div>

              {Object.keys(sourceCounts).length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No traffic source data recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(sourceCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([src, count]) => {
                      const pct = Math.round((count / Math.max(1, sourcePool.length)) * 100);
                      return (
                        <div key={src} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-200">{src}</span>
                            <span className="font-mono text-amber-300">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400"
                              style={{ width: `${Math.max(6, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Quick Copy UTM Links for YouTube Shorts & Facebook Ads */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2">
              <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Ad Tracking Links (Use in Shorts / FB Ads):
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    copyTrackingUrl('https://bowerjj.com/?utm_source=youtube_shorts', 'yt')
                  }
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-bold text-slate-200 transition-all"
                >
                  <span>▶️ YouTube Link</span>
                  {copiedLink === 'yt' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>
                <button
                  onClick={() =>
                    copyTrackingUrl('https://bowerjj.com/?utm_source=facebook_ads', 'fb')
                  }
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-bold text-slate-200 transition-all"
                >
                  <span>📘 Facebook Link</span>
                  {copiedLink === 'fb' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Panel 2: Live Activity Breakdown */}
          <div className="rounded-2xl bg-[#0d1526]/90 border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Where Users Are Right Now
              </h2>
              <span className="text-[11px] text-slate-400">{onlineNow} online</span>
            </div>

            {Object.keys(activityCounts).length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                No active sessions at this exact moment.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(activityCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([act, count]) => {
                    const pct = Math.round((count / Math.max(1, onlineNow)) * 100);
                    return (
                      <div key={act} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200">{act}</span>
                          <span className="font-mono text-emerald-400">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                            style={{ width: `${Math.max(8, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Panel 3: Live Device Breakdown */}
          <div className="rounded-2xl bg-[#0d1526]/90 border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-sky-400 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Active Devices
              </h2>
              <span className="text-[11px] text-slate-400">Live breakdown</span>
            </div>

            {Object.keys(deviceCounts).length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                Waiting for active device connections...
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(deviceCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([dev, count]) => {
                    const pct = Math.round((count / Math.max(1, onlineNow)) * 100);
                    return (
                      <div key={dev} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200 flex items-center gap-1.5">
                            {dev.includes('iPhone') || dev.includes('Android') || dev.includes('iPad') ? (
                              <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                            ) : (
                              <Monitor className="w-3.5 h-3.5 text-sky-400" />
                            )}
                            {dev}
                          </span>
                          <span className="font-mono text-sky-300">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                            style={{ width: `${Math.max(8, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* =====================================================================
            ROW 3: LIVE ACTIVE USERS TABLE
        ===================================================================== */}
        <div className="rounded-2xl bg-[#0d1526]/95 border border-slate-800 overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                People Online Right Now ({onlineNow})
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              Updates automatically as visitors navigate around bowerjj.com
            </span>
          </div>

          {activeSessions.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-300">
                No active player tabs open on bowerjj.com right now.
              </p>
              <p className="text-xs text-slate-500">
                Open <a href="/" target="_blank" rel="noreferrer" className="text-amber-400 underline">bowerjj.com</a> in another tab or on your phone to watch it appear here instantly!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-900/50">
                    <th className="py-3 px-4">Player / Visitor</th>
                    <th className="py-3 px-4">Current Screen / Activity</th>
                    <th className="py-3 px-4">Device</th>
                    <th className="py-3 px-4">Traffic Source</th>
                    <th className="py-3 px-4">Time on Site</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {activeSessions.map((sess) => (
                    <tr key={sess.session_id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-black">
                          {sess.rank_tier || '9'}
                        </span>
                        <div>
                          <div>{sess.username || 'Guest'}</div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {sess.session_id.slice(0, 14)}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {sess.activity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-medium">{sess.device}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-amber-300 font-bold text-[11px]">
                          {sess.traffic_source}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {formatDurationSince(sess.started_at)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400 font-bold">
                        {formatTimeAgo(sess.last_seen_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =====================================================================
            ROW 4: RECENT VISITOR LOG (LAST 25 VISITS)
        ===================================================================== */}
        <div className="rounded-2xl bg-[#0d1526]/95 border border-slate-800 overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
              Recent Visitor Log (Last {Math.min(25, recentVisits.length)} Sessions)
            </h2>
            <span className="text-xs text-slate-400">Persistent PostgreSQL history</span>
          </div>

          {recentVisits.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No visits logged yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-900/50">
                    <th className="py-2.5 px-4">Time</th>
                    <th className="py-2.5 px-4">Visitor</th>
                    <th className="py-2.5 px-4">Device</th>
                    <th className="py-2.5 px-4">Source</th>
                    <th className="py-2.5 px-4">Session ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {recentVisits.slice(0, 25).map((v) => (
                    <tr key={v.id} className="hover:bg-slate-800/20">
                      <td className="py-2.5 px-4 text-slate-300 font-mono">
                        {new Date(v.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-white">
                        {v.username || 'Guest Visitor'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300">{v.device}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold text-[11px]">
                          {v.traffic_source}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px]">
                        {v.session_id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
