/**
 * BOWER JJ — Global Competitive Leaderboard Modal
 * Prestigious ranking table showing Top 50 Euchre Masters.
 */

import React, { useEffect, useState } from 'react';
import { X, Trophy, Medal, Flame, Shield, ArrowUpRight, Crown, Star } from 'lucide-react';
import { LeaderboardEntry } from '../../server/types';
import { RankBadge } from './RankBadge';
import { AvatarPortrait } from './AvatarPortrait';
import { multiplayerClient } from '../services/multiplayerClient';
import { authService } from '../services/supabaseClient';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  yourRank?: number;
  currentUsername: string;
  currentUserId?: string;
}

export const TopRankBadge: React.FC<{ position: number }> = ({ position }) => {
  if (position === 1) {
    return (
      <div className="relative flex items-center justify-center flex-shrink-0 pt-1">
        {/* Crown Accent */}
        <div className="absolute -top-2.5 z-10 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-bounce duration-1000">
          <Crown className="w-4 h-4 text-amber-300 fill-amber-300" />
        </div>
        {/* Gold Medal Badge */}
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
        {/* Silver Star Accent */}
        <div className="absolute -top-2 z-10 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          <Star className="w-3.5 h-3.5 text-slate-100 fill-slate-200" />
        </div>
        {/* Silver Medal Badge */}
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
        {/* Bronze Star Accent */}
        <div className="absolute -top-2 z-10 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-400" />
        </div>
        {/* Bronze Medal Badge */}
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
}) => {
  const [localEntries, setLocalEntries] = useState<LeaderboardEntry[]>(entries);
  const [isLoading, setIsLoading] = useState<boolean>(entries.length === 0);

  useEffect(() => {
    if (entries.length > 0) {
      setLocalEntries(entries);
      setIsLoading(false);
    }
  }, [entries]);

  useEffect(() => {
    if (isOpen) {
      multiplayerClient.fetchLeaderboard();

      // Query Supabase database directly for authoritative instant leaderboard
      authService.getLeaderboard().then((dbEntries) => {
        if (dbEntries && dbEntries.length > 0) {
          setLocalEntries(dbEntries);
          setIsLoading(false);
        }
      }).catch(() => {
        setIsLoading(false);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-amber-500/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 shadow-lg">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <span>Competitive Leaderboard</span>
              </h2>
              <p className="text-xs text-amber-400 font-bold">
                Season 1 — Bower JJ World Rankings
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

        {/* Column Headers */}
        <div className="grid grid-cols-12 gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          <div className="col-span-2 sm:col-span-1 text-center">Rank</div>
          <div className="col-span-4 sm:col-span-5">Player</div>
          <div className="col-span-3 sm:col-span-3 text-center">
            <span className="hidden sm:inline">Tier & LP</span>
            <span className="sm:hidden">Rank/LP</span>
          </div>
          <div className="col-span-3 sm:col-span-3 text-right">
            <span className="hidden sm:inline">Win Rate / Games</span>
            <span className="sm:hidden">Win %</span>
          </div>
        </div>

        {/* Leaderboard Table Rows */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 divide-y divide-slate-800/40">
          {localEntries.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {isLoading ? 'Loading rankings from Supabase...' : 'No rankings recorded yet for Season 1.'}
            </div>
          ) : (
            localEntries.map((entry, idx) => {
              const isCurrentUser =
                (Boolean(currentUsername) && entry.username.toLowerCase() === currentUsername.toLowerCase()) ||
                (Boolean(currentUserId) && entry.userId === currentUserId);
              const pos = entry.rankPosition ?? (entry as any).rank ?? (idx + 1);
              const isTop1 = pos === 1;
              const isTop2 = pos === 2;
              const isTop3 = pos === 3;

              return (
                <div
                  key={entry.userId || `leaderboard_row_${idx}`}
                  className={`grid grid-cols-12 gap-1.5 sm:gap-2 items-center p-2 sm:p-3 rounded-2xl transition-all ${
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

                  {/* Player Name & Avatar */}
                  <div className="col-span-4 sm:col-span-5 flex items-center space-x-1.5 sm:space-x-2.5 min-w-0">
                    <AvatarPortrait avatarId={entry.avatarIcon} size="xs" showRarityGem />
                    <div className="min-w-0 truncate">
                      <div className="font-black text-white text-xs sm:text-sm truncate flex items-center space-x-1 sm:space-x-1.5">
                        <span className="truncate">{entry.username}</span>
                        {isCurrentUser && (
                          <span className="text-[9px] sm:text-[10px] bg-amber-400 text-slate-950 font-black px-1 sm:px-1.5 py-0.2 rounded-full flex-shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-gray-400 font-mono">
                        MMR {entry.mmr}
                      </div>
                    </div>
                  </div>

                  {/* Tier & LP */}
                  <div className="col-span-3 sm:col-span-3 flex items-center justify-center space-x-1 sm:space-x-1.5">
                    <RankBadge tier={entry.rankTier} points={entry.rankPoints} size="sm" showLabel={false} />
                    <div className="text-left leading-tight">
                      <div className="text-[11px] sm:text-xs font-black text-white">{entry.rankPoints} LP</div>
                      <div className="text-[8px] sm:text-[9px] text-gray-400 uppercase">
                        {entry.rankTier} <span className="hidden sm:inline">Rank</span>
                      </div>
                    </div>
                  </div>

                  {/* Win Rate / Games */}
                  <div className="col-span-3 sm:col-span-3 text-right">
                    <div className="text-[11px] sm:text-xs font-black text-emerald-400">
                      {entry.winRate}% <span className="hidden sm:inline">Win Rate</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-gray-400 whitespace-nowrap">
                      {entry.wins}W-{entry.losses}L{' '}
                      <span className="hidden sm:inline">({entry.totalGames} played)</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Your standing benchmark */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>
              Your Standing:{' '}
              <strong className="text-white">
                #{yourRank || (
                  localEntries.findIndex(e =>
                    (Boolean(currentUsername) && e.username.toLowerCase() === currentUsername.toLowerCase()) ||
                    (Boolean(currentUserId) && e.userId === currentUserId)
                  ) !== -1
                    ? localEntries.findIndex(e =>
                        (Boolean(currentUsername) && e.username.toLowerCase() === currentUsername.toLowerCase()) ||
                        (Boolean(currentUserId) && e.userId === currentUserId)
                      ) + 1
                    : 'Unranked'
                )}
              </strong>
            </span>
          </div>
          <div className="flex items-center space-x-1 text-amber-400 font-bold">
            <Flame className="w-4 h-4" />
            <span>Win ranked games to climb!</span>
          </div>
        </div>
      </div>
    </div>
  );
};
