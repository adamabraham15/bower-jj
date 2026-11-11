/**
 * BOWER JJ — Global Competitive Leaderboard Modal
 * Prestigious ranking table showing Top 50 Euchre Masters.
 */

import React, { useEffect } from 'react';
import { X, Trophy, Medal, Flame, Shield, ArrowUpRight } from 'lucide-react';
import { LeaderboardEntry } from '../../server/types';
import { RankBadge } from './RankBadge';
import { multiplayerClient } from '../services/multiplayerClient';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  yourRank?: number;
  currentUsername: string;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  entries,
  yourRank,
  currentUsername,
}) => {
  useEffect(() => {
    if (isOpen) {
      multiplayerClient.fetchLeaderboard();
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
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          <div className="col-span-2 sm:col-span-1 text-center">Rank</div>
          <div className="col-span-6 sm:col-span-5">Player</div>
          <div className="col-span-4 sm:col-span-3 text-center">Tier & LP</div>
          <div className="hidden sm:block sm:col-span-3 text-right">Win Rate / Games</div>
        </div>

        {/* Leaderboard Table Rows */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 divide-y divide-slate-800/40">
          {entries.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              Loading rankings...
            </div>
          ) : (
            entries.map((entry) => {
              const isCurrentUser = entry.username === currentUsername;
              const isTop1 = entry.rankPosition === 1;
              const isTop2 = entry.rankPosition === 2;
              const isTop3 = entry.rankPosition === 3;

              return (
                <div
                  key={entry.userId}
                  className={`grid grid-cols-12 gap-2 items-center p-2.5 sm:p-3 rounded-2xl transition-all ${
                    isCurrentUser
                      ? 'bg-amber-500/20 border border-amber-400/60 ring-1 ring-amber-400/40'
                      : isTop1
                      ? 'bg-gradient-to-r from-amber-500/15 to-transparent border border-amber-500/30'
                      : 'hover:bg-slate-800/60'
                  }`}
                >
                  {/* Rank Position */}
                  <div className="col-span-2 sm:col-span-1 flex items-center justify-center font-black">
                    {isTop1 ? (
                      <span className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-xs shadow-md">
                        🥇 1
                      </span>
                    ) : isTop2 ? (
                      <span className="w-7 h-7 rounded-full bg-slate-300 text-slate-950 flex items-center justify-center text-xs shadow-md">
                        🥈 2
                      </span>
                    ) : isTop3 ? (
                      <span className="w-7 h-7 rounded-full bg-amber-700 text-white flex items-center justify-center text-xs shadow-md">
                        🥉 3
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">#{entry.rankPosition}</span>
                    )}
                  </div>

                  {/* Player Name & Avatar */}
                  <div className="col-span-6 sm:col-span-5 flex items-center space-x-2.5 truncate">
                    <span className="text-2xl flex-shrink-0">{entry.avatarIcon}</span>
                    <div className="truncate">
                      <div className="font-black text-white text-sm truncate flex items-center space-x-1.5">
                        <span>{entry.username}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        MMR {entry.mmr}
                      </div>
                    </div>
                  </div>

                  {/* Tier & LP */}
                  <div className="col-span-4 sm:col-span-3 flex items-center justify-center space-x-1.5">
                    <RankBadge tier={entry.rankTier} size="sm" />
                    <div className="text-left leading-tight">
                      <div className="text-xs font-black text-white">{entry.rankPoints} LP</div>
                      <div className="text-[9px] text-gray-400 uppercase">{entry.rankTier} Rank</div>
                    </div>
                  </div>

                  {/* Win Rate / Games */}
                  <div className="hidden sm:block sm:col-span-3 text-right">
                    <div className="text-xs font-black text-emerald-400">
                      {entry.winRate}% Win Rate
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {entry.wins}W - {entry.losses}L ({entry.totalGames} played)
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
              Your Standing: <strong className="text-white">#{yourRank || 'Unranked'}</strong>
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
