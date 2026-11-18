/**
 * BOWER JJ — Global Competitive Leaderboard & Sovereign Path Modal (Season 2)
 * Strictly displays players who have queued Ranked matches, plus an interactive
 * Ranked Progression Road showcasing all 6 artistic Sovereign Rank Badges & rewards.
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  Trophy,
  Flame,
  Shield,
  Crown,
  Star,
  Sparkles,
  Clock,
  Check,
  Compass,
  Award,
  Lock,
  ChevronRight,
  Swords,
} from 'lucide-react';
import { LeaderboardEntry, RankTier } from '../../server/types';
import {
  RankBadge,
  RankDivision,
  RANK_INFO,
  RANK_TIER_ORDER,
  getRankDivisionInfo,
} from './RankBadge';
import { AvatarPortrait } from './AvatarPortrait';
import { multiplayerClient } from '../services/multiplayerClient';
import { authService } from '../services/supabaseClient';
import { sounds } from '../audio/sound';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  yourRank?: number;
  currentUsername: string;
  currentUserId?: string;
  currentRankTier?: RankTier;
  currentRankDivision?: RankDivision;
  currentRankPoints?: number;
  onPreviewPromotion?: (mode: 'division' | 'tier') => void;
}

export const TopRankBadge: React.FC<{ position: number }> = ({ position }) => {
  if (position === 1) {
    return (
      <div className="relative flex items-center justify-center flex-shrink-0 pt-1">
        <div className="absolute -top-2.5 z-10 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-bounce duration-1000">
          <Crown className="w-4 h-4 text-amber-300 fill-amber-300" />
        </div>
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-b from-amber-200 via-yellow-400 to-amber-600 border-2 border-yellow-200 shadow-[0_0_14px_rgba(245,158,11,0.8),inset_0_1px_2px_rgba(255,255,255,0.8)] flex items-center justify-center ring-2 ring-amber-500/50 relative overflow-hidden">
          <div className="absolute -top-3 -left-3 w-6 h-12 bg-white/40 rotate-[25deg] pointer-events-none" />
          <span className="text-slate-950 font-black text-xs sm:text-sm leading-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)] select-none">
            1
          </span>
        </div>
      </div>
    );
  }

  if (position === 2) {
    return (
      <div className="relative flex items-center justify-center flex-shrink-0 pt-1">
        <div className="absolute -top-2 z-10 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          <Star className="w-3.5 h-3.5 text-slate-100 fill-slate-200" />
        </div>
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-b from-slate-100 via-slate-300 to-slate-400 border-2 border-white shadow-[0_0_12px_rgba(203,213,225,0.7),inset_0_1px_2px_rgba(255,255,255,0.9)] flex items-center justify-center ring-2 ring-slate-400/50 relative overflow-hidden">
          <div className="absolute -top-3 -left-3 w-6 h-12 bg-white/40 rotate-[25deg] pointer-events-none" />
          <span className="text-slate-950 font-black text-xs sm:text-sm leading-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)] select-none">
            2
          </span>
        </div>
      </div>
    );
  }

  if (position === 3) {
    return (
      <div className="relative flex items-center justify-center flex-shrink-0 pt-1">
        <div className="absolute -top-2 z-10 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-400" />
        </div>
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-b from-amber-500 via-amber-700 to-amber-900 border-2 border-amber-400/90 shadow-[0_0_12px_rgba(217,119,6,0.6),inset_0_1px_2px_rgba(255,255,255,0.5)] flex items-center justify-center ring-2 ring-amber-700/50 relative overflow-hidden">
          <div className="absolute -top-3 -left-3 w-6 h-12 bg-white/25 rotate-[25deg] pointer-events-none" />
          <span className="text-amber-100 font-black text-xs sm:text-sm leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] select-none">
            3
          </span>
        </div>
      </div>
    );
  }

  return (
    <span className="text-xs sm:text-sm font-bold text-gray-400 font-mono">
      #{position}
    </span>
  );
};

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  entries,
  yourRank,
  currentUsername,
  currentUserId,
  currentRankTier,
  currentRankDivision,
  currentRankPoints,
  onPreviewPromotion,
}) => {
  const [localEntries, setLocalEntries] = useState<LeaderboardEntry[]>(entries);
  const [isLoading, setIsLoading] = useState<boolean>(entries.length === 0);
  const [activeTab, setActiveTab] = useState<'standings' | 'road'>('standings');

  useEffect(() => {
    if (entries.length > 0) {
      setLocalEntries(entries);
      setIsLoading(false);
    }
  }, [entries]);

  useEffect(() => {
    if (isOpen) {
      multiplayerClient.fetchLeaderboard();

      authService
        .getLeaderboard()
        .then((dbEntries) => {
          if (dbEntries && dbEntries.length > 0) {
            setLocalEntries(dbEntries);
            setIsLoading(false);
          }
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Strictly ensure displayed entries have queued/played ranked games
  const rankedOnlyEntries = localEntries.filter((e) => {
    if (!e.username || e.username.startsWith('Bench_')) return false;
    const rg = e.rankedGames ?? e.totalGames ?? 0;
    return rg > 0 || (e.rankPoints || 0) > 0 || e.rankTier !== '9' || (e.mmr && e.mmr !== 1200);
  });

  // Resolve user's current tier & division
  const myEntry = rankedOnlyEntries.find(
    (e) =>
      (Boolean(currentUsername) && e.username.toLowerCase() === currentUsername.toLowerCase()) ||
      (Boolean(currentUserId) && e.userId === currentUserId)
  );
  const resolvedTier: RankTier = currentRankTier || myEntry?.rankTier || '9';
  const resolvedDivision: RankDivision =
    currentRankDivision || myEntry?.rankDivision || (resolvedTier === 'BOWER_JJ' ? 'APEX' : 'III');
  const resolvedPoints: number = currentRankPoints ?? myEntry?.rankPoints ?? 0;
  const resolvedInfo = RANK_INFO[resolvedTier] || RANK_INFO['9'];
  const resolvedDiv = getRankDivisionInfo(resolvedTier, resolvedPoints, resolvedDivision);

  const tierWeight: Record<RankTier, number> = {
    '9': 1,
    '10': 2,
    'Q': 3,
    'K': 4,
    'A': 5,
    'BOWER_JJ': 6,
  };
  const currentWeight = tierWeight[resolvedTier] || 1;
  const nextTier: RankTier | null =
    currentWeight < RANK_TIER_ORDER.length ? RANK_TIER_ORDER[currentWeight] : null;
  const nextTierInfo = nextTier ? RANK_INFO[nextTier] : null;

  const isIronEarned = currentWeight >= 1;
  const isSilverEarned = currentWeight >= 3;
  const isPrismaticEarned = currentWeight >= 5;

  const myStandingIndex = rankedOnlyEntries.findIndex(
    (e) =>
      (Boolean(currentUsername) && e.username.toLowerCase() === currentUsername.toLowerCase()) ||
      (Boolean(currentUserId) && e.userId === currentUserId)
  );
  const computedRankNumber = myStandingIndex !== -1 ? myStandingIndex + 1 : yourRank;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-amber-500/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 shadow-lg flex-shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-black text-white uppercase tracking-wider">
                  Sovereign Hierarchy
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-[10px] font-black text-amber-300 uppercase tracking-wider">
                  Season 2
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-amber-400 font-bold">
                Official Ranked Ladder — Active Ranked Competitors Only
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Personal Progression Dashboard Strip */}
        <div className="bg-gradient-to-r from-[#11192c] via-[#16213a] to-[#11192c] border-b border-slate-800 px-3.5 py-3 sm:px-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left: Current Rank Badge + Division Title */}
            <div className="flex items-center gap-3.5">
              <RankBadge
                tier={resolvedTier}
                division={resolvedDivision}
                points={resolvedPoints}
                size="md"
                showLabel={false}
              />
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="text-sm sm:text-base font-black tracking-wide"
                    style={{ color: resolvedInfo.color }}
                  >
                    {resolvedDiv.fullRankName}
                  </span>
                  {resolvedDiv.isPromoSeries && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/25 border border-amber-400 text-[10px] font-black text-amber-300 uppercase tracking-wider animate-pulse">
                      🔥 Promo Match Ready
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-300 font-semibold">
                  {resolvedInfo.title} •{' '}
                  <span className="text-amber-300 font-mono font-bold">
                    {resolvedPoints}/100 LP in Div {resolvedDiv.division}
                  </span>
                  {resolvedTier !== 'BOWER_JJ' && (
                    <span className="text-slate-400">
                      {' '}
                      ({resolvedDiv.lpToNextMilestone} LP to{' '}
                      {resolvedDiv.division === 'III'
                        ? 'Div II'
                        : resolvedDiv.division === 'II'
                        ? 'Div I'
                        : nextTierInfo?.name || 'Next Tier'})
                    </span>
                  )}
                </div>

                {/* 3-Division Segmented Progress Bar (Div III: 100 LP | Div II: 100 LP | Div I: 100 LP) */}
                <div className="mt-1.5 flex items-center gap-1.5 w-60 sm:w-72">
                  {(['III', 'II', 'I'] as const).map((divLabel, segIdx) => {
                    const activeIdx = resolvedDiv.divisionNumber - 1; // 0 for III, 1 for II, 2 for I
                    const fillPct =
                      resolvedTier === 'BOWER_JJ' || segIdx < activeIdx
                        ? 100
                        : segIdx > activeIdx
                        ? 0
                        : Math.min(100, Math.max(0, resolvedPoints));
                    const isCurrentSeg = segIdx === activeIdx && resolvedTier !== 'BOWER_JJ';
                    return (
                      <div key={divLabel} className="flex-1 flex flex-col gap-0.5">
                        <div
                          className={`h-2 rounded-full bg-slate-950 border overflow-hidden p-[1px] ${
                            isCurrentSeg ? 'border-amber-400/70' : 'border-slate-700/80'
                          }`}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${fillPct}%`,
                              background: `linear-gradient(90deg, ${resolvedInfo.border}, ${resolvedInfo.color})`,
                              boxShadow: fillPct > 0 ? `0 0 6px ${resolvedInfo.glow}` : 'none',
                            }}
                          />
                        </div>
                        <span
                          className={`text-[8px] font-black text-center uppercase tracking-wider ${
                            isCurrentSeg
                              ? 'text-amber-300'
                              : segIdx < activeIdx
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          Div {divLabel} (100 LP)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Next Promotion Spoils Preview */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between bg-slate-950/70 border border-slate-800 rounded-2xl px-3 py-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>{nextTierInfo ? `Next Tier: ${nextTierInfo.name}` : 'Apex Tier Reached'}</span>
              </div>
              <div className="text-xs font-black text-amber-300 mt-0.5">
                {nextTierInfo
                  ? `+${nextTierInfo.promotionSeals} Wax Seals on Promotion`
                  : '👑 Supreme Bower Immortal'}
              </div>
              <div className="text-[10px] text-cyan-300 font-semibold mt-0.5">
                {myEntry
                  ? `Ranked Record: ${myEntry.wins}W - ${myEntry.losses}L (${myEntry.winRate}%)`
                  : 'Play 1 Ranked Match to place on Leaderboard'}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs: Ranked Standings vs The Sovereign Path */}
        <div className="px-3.5 sm:px-5 pt-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => {
                sounds.playUiClick();
                setActiveTab('standings');
              }}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'standings'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Ranked Standings ({rankedOnlyEntries.length})</span>
            </button>

            <button
              onClick={() => {
                sounds.playUiClick();
                setActiveTab('road');
              }}
              className={`pb-2.5 px-3 text-xs sm:text-sm font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'road'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>The Sovereign Path &amp; Badges</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 mb-2 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-[10px] font-bold text-amber-300">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>Season 2 Live</span>
          </div>
        </div>

        {/* TAB 1: RANKED STANDINGS */}
        {activeTab === 'standings' ? (
          <>
            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-slate-950/60 border-b border-slate-800 text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              <div className="col-span-2 sm:col-span-1 text-center">Rank</div>
              <div className="col-span-4 sm:col-span-4">Competitor</div>
              <div className="col-span-3 sm:col-span-4 text-center">
                <span className="hidden sm:inline">Crest &amp; Division</span>
                <span className="sm:hidden">Crest/LP</span>
              </div>
              <div className="col-span-3 sm:col-span-3 text-right">
                <span className="hidden sm:inline">Ranked Win %</span>
                <span className="sm:hidden">Record</span>
              </div>
            </div>

            {/* Leaderboard Table Rows */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 divide-y divide-slate-800/40">
              {rankedOnlyEntries.length === 0 ? (
                <div className="text-center py-14 text-gray-400 text-sm space-y-2">
                  <Swords className="w-8 h-8 text-amber-400/60 mx-auto" />
                  <div className="font-bold text-white">
                    {isLoading
                      ? 'Loading official Ranked standings...'
                      : 'No Ranked matches recorded yet.'}
                  </div>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Only players who queue into Ranked Solo or Ranked Duo matches appear on the Global Leaderboard.
                  </p>
                </div>
              ) : (
                rankedOnlyEntries.map((entry, idx) => {
                  const isCurrentUser =
                    (Boolean(currentUsername) &&
                      entry.username.toLowerCase() === currentUsername.toLowerCase()) ||
                    (Boolean(currentUserId) && entry.userId === currentUserId);
                  const pos = idx + 1;
                  const isTop1 = pos === 1;
                  const isTop2 = pos === 2;
                  const isTop3 = pos === 3;
                  const entryInfo = RANK_INFO[entry.rankTier] || RANK_INFO['9'];
                  const entryDiv = getRankDivisionInfo(
                    entry.rankTier,
                    entry.rankPoints,
                    entry.rankDivision
                  );

                  return (
                    <div
                      key={entry.userId || `leaderboard_row_${idx}`}
                      className={`grid grid-cols-12 gap-1.5 sm:gap-2 items-center p-2 sm:p-2.5 rounded-2xl transition-all ${
                        isCurrentUser
                          ? 'bg-amber-500/20 border border-amber-400/60 ring-1 ring-amber-400/40'
                          : isTop1
                          ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/5 to-transparent border border-amber-500/40 shadow-sm'
                          : isTop2
                          ? 'bg-gradient-to-r from-slate-400/15 via-slate-400/5 to-transparent border border-slate-400/30'
                          : isTop3
                          ? 'bg-gradient-to-r from-amber-700/15 via-amber-700/5 to-transparent border border-amber-700/30'
                          : 'hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      {/* Rank Position */}
                      <div className="col-span-2 sm:col-span-1 flex items-center justify-center font-black">
                        <TopRankBadge position={pos} />
                      </div>

                      {/* Player Name, Avatar & MMR */}
                      <div className="col-span-4 sm:col-span-4 flex items-center space-x-2 sm:space-x-2.5 min-w-0">
                        <AvatarPortrait avatarId={entry.avatarIcon} size="xs" showRarityGem />
                        <div className="min-w-0 truncate">
                          <div className="font-black text-white text-xs sm:text-sm truncate flex items-center space-x-1 sm:space-x-1.5">
                            <span className="truncate">{entry.username}</span>
                            {isCurrentUser && (
                              <span className="text-[9px] sm:text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full flex-shrink-0">
                                YOU
                              </span>
                            )}
                            {(entry.winStreak || 0) >= 3 && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-orange-500/20 border border-orange-400/50 text-[9px] font-black text-orange-300 flex-shrink-0"
                                title={`${entry.winStreak} Win Hot Streak!`}
                              >
                                <Flame className="w-2.5 h-2.5 fill-orange-400 text-orange-400" />
                                {entry.winStreak}
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] sm:text-[10px] text-gray-400 font-mono flex items-center gap-1.5">
                            <span>MMR {entry.mmr}</span>
                            <span className="hidden sm:inline text-slate-600">•</span>
                            <span className="hidden sm:inline text-slate-400 truncate">
                              {entryInfo.title}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Artistic Rank Badge, Division & LP */}
                      <div className="col-span-3 sm:col-span-4 flex items-center justify-center space-x-1.5 sm:space-x-2.5">
                        <RankBadge
                          tier={entry.rankTier}
                          division={entry.rankDivision}
                          points={entry.rankPoints}
                          size="sm"
                          showLabel={false}
                          showDivisionPips={true}
                        />
                        <div className="text-left leading-tight min-w-0">
                          <div
                            className="text-[10px] sm:text-xs font-black whitespace-nowrap"
                            style={{ color: entryInfo.color }}
                          >
                            {entryInfo.name}{' '}
                            {entry.rankTier !== 'BOWER_JJ' && (
                              <span className="text-amber-300 font-mono">{entryDiv.division}</span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono font-bold text-white">
                            {entry.rankPoints}/100 LP
                          </div>
                        </div>
                      </div>

                      {/* Ranked Win Rate / Ranked Games */}
                      <div className="col-span-3 sm:col-span-3 text-right">
                        <div className="text-[11px] sm:text-xs font-black text-emerald-400">
                          {entry.winRate}% <span className="hidden sm:inline">Win</span>
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-gray-400 whitespace-nowrap font-mono">
                          {entry.wins}W-{entry.losses}L{' '}
                          <span className="hidden sm:inline text-slate-500">
                            ({entry.rankedGames ?? entry.totalGames} ranked)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* TAB 2: THE SOVEREIGN PATH (INTERACTIVE RANKED ROAD & ARTISTIC BADGE SHOWCASE) */
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3">
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-cyan-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>3 Divisions × 100 LP Per Tier</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Climb <strong>Div III (100 LP) ➔ Div II (100 LP) ➔ Div I (100 LP)</strong> in each Rank Tier.
                  Every 100 LP triggers a <strong>Division Promotion Fanfare</strong>, and conquering Division I unleashes a{' '}
                  <strong>Grand Sovereign Tier Ascension</strong>!
                </p>
              </div>
              {onPreviewPromotion && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      sounds.playUiClick();
                      onPreviewPromotion('division');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-400/40 text-[10px] font-black text-amber-300 uppercase tracking-wider transition-all active:scale-95"
                  >
                    ✨ Preview Div Up
                  </button>
                  <button
                    onClick={() => {
                      sounds.playUiClick();
                      onPreviewPromotion('tier');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-md transition-all active:scale-95"
                  >
                    👑 Preview Rank Up
                  </button>
                </div>
              )}
            </div>

            {/* Season Milestone Card Backs Strip */}
            <div className="grid grid-cols-3 gap-2">
              <div
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  isIronEarned
                    ? 'bg-slate-800/90 border-slate-400 shadow-md ring-1 ring-slate-400/30'
                    : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                }`}
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase">Squire &amp; Baron</div>
                <div className="text-xs font-black text-slate-200 mt-0.5">Iron Rim Back</div>
                <div className="text-[10px] font-bold mt-1 text-emerald-400 flex items-center justify-center gap-0.5">
                  {isIronEarned ? (
                    <>
                      <Check className="w-3 h-3" /> Unlocked
                    </>
                  ) : (
                    'Reach Copper Squire'
                  )}
                </div>
              </div>

              <div
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  isSilverEarned
                    ? 'bg-slate-800/90 border-emerald-400/60 shadow-md ring-1 ring-emerald-400/30'
                    : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                }`}
              >
                <div className="text-[10px] font-bold text-emerald-300 uppercase">Queen &amp; King</div>
                <div className="text-xs font-black text-white mt-0.5">Gilded Silver Back</div>
                <div className="text-[10px] font-bold mt-1 text-cyan-300 flex items-center justify-center gap-0.5">
                  {isSilverEarned ? (
                    <>
                      <Check className="w-3 h-3" /> Unlocked
                    </>
                  ) : (
                    'Reach Verdant Q'
                  )}
                </div>
              </div>

              <div
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  isPrismaticEarned
                    ? 'bg-gradient-to-b from-amber-500/20 to-yellow-600/20 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)] ring-1 ring-amber-400'
                    : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                }`}
              >
                <div className="text-[10px] font-bold text-amber-400 uppercase">Ace &amp; Supreme JJ</div>
                <div className="text-xs font-black text-amber-300 mt-0.5">Prismatic Foil ✨</div>
                <div className="text-[10px] font-bold mt-1 text-amber-300 flex items-center justify-center gap-0.5">
                  {isPrismaticEarned ? (
                    <>
                      <Check className="w-3 h-3" /> Apex Unlocked
                    </>
                  ) : (
                    'Reach Astral Ace'
                  )}
                </div>
              </div>
            </div>

            {/* All 6 Artistic Sovereign Tier Cards */}
            <div className="space-y-2.5">
              {RANK_TIER_ORDER.map((tierKey) => {
                const info = RANK_INFO[tierKey];
                const tWeight = tierWeight[tierKey];
                const isCurrent = tierKey === resolvedTier;
                const isUnlocked = currentWeight >= tWeight;

                return (
                  <div
                    key={tierKey}
                    className={`p-3 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-gradient-to-r from-amber-500/20 via-slate-900 to-slate-900 border-amber-400 ring-1 ring-amber-400/50 shadow-lg'
                        : isUnlocked
                        ? 'bg-slate-900/90 border-slate-700/80'
                        : 'bg-slate-950/60 border-slate-800/70 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <RankBadge
                        tier={tierKey}
                        points={isCurrent ? resolvedPoints : isUnlocked ? 100 : 0}
                        size="lg"
                        showLabel={false}
                        showDivisionPips={false}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-sm sm:text-base font-black tracking-wide"
                            style={{ color: info.color }}
                          >
                            {info.name}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold">
                            {info.title}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black uppercase">
                              Current Tier • Div {resolvedDiv.division}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {info.lore}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                            <Award className="w-3 h-3" />
                            {info.rewardSummary}
                          </span>
                          {tierKey !== 'BOWER_JJ' && (
                            <span className="text-[10px] font-mono text-slate-400">
                              3 Divisions: Div III (100 LP) ➔ Div II (100 LP) ➔ Div I (100 LP)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      {isCurrent ? (
                        <div className="text-xs font-black text-amber-400 font-mono">
                          {resolvedPoints}/100 LP
                        </div>
                      ) : isUnlocked ? (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase">
                          <Check className="w-3 h-3" />
                          <span>Conquered</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-bold uppercase">
                          <Lock className="w-3 h-3" />
                          <span>Locked</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer: Your standing benchmark */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>
              Your Ranked Standing:{' '}
              <strong className="text-white">
                {computedRankNumber ? `#${computedRankNumber} Worldwide` : 'Unranked (0 Ranked Matches)'}
              </strong>
            </span>
          </div>
          <span className="text-[11px] text-amber-400 font-bold">
            Top Tier: Supreme Bower (JJ)
          </span>
        </div>
      </div>
    </div>
  );
};
