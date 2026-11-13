/**
 * BOWER JJ — Post-Match Rewards, Accolades & Social Screen
 * Epic Fortnite / Brawl Stars victory & defeat progression breakdown.
 */

import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Zap,
  Flame,
  Award,
  UserPlus,
  RotateCcw,
  Home,
  Check,
  Crown,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { RankBadge, RankTier } from './RankBadge';
import { sounds } from '../audio/sound';
import { multiplayerClient } from '../services/multiplayerClient';

interface MatchPlayer {
  id: string;
  name: string;
  avatarIcon: string;
  isAI: boolean;
  position: number;
  rankTier?: RankTier;
}

interface PostMatchModalProps {
  isOpen: boolean;
  isVictory: boolean;
  finalScore: [number, number];
  tricksWon: number;
  marches: number;
  euchres: number;
  loners: number;
  lpDelta?: number;
  oldTier?: RankTier;
  newTier?: RankTier;
  currentPoints?: number;
  xpEarned?: number;
  playerLevel: number;
  playerXp: number;
  nextLevelXp: number;
  players: MatchPlayer[];
  yourPosition: number;
  onPlayAgain: () => void;
  onExit: () => void;
}

export const PostMatchModal: React.FC<PostMatchModalProps> = ({
  isOpen,
  isVictory,
  finalScore,
  tricksWon,
  marches,
  euchres,
  loners,
  lpDelta = 22,
  oldTier = '9',
  newTier = '9',
  currentPoints = 45,
  xpEarned = 450,
  playerLevel,
  playerXp,
  nextLevelXp,
  players,
  yourPosition,
  onPlayAgain,
  onExit,
}) => {
  const [animatedXp, setAnimatedXp] = useState(0);
  const [invitedPlayerIds, setInvitedPlayerIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    if (isVictory) {
      sounds.playVictoryFanfare();
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.5 },
      });
    }

    // Animate XP bar increment
    let cur = 0;
    const step = Math.ceil(xpEarned / 20);
    const interval = setInterval(() => {
      cur += step;
      if (cur >= xpEarned) {
        cur = xpEarned;
        clearInterval(interval);
      }
      setAnimatedXp(cur);
    }, 40);

    return () => clearInterval(interval);
  }, [isOpen, isVictory, xpEarned]);

  if (!isOpen) return null;

  const handleSendFriendRequest = (player: MatchPlayer) => {
    sounds.playUiClick();
    if (player.isAI) return;
    multiplayerClient.sendFriendRequest(player.name);
    setInvitedPlayerIds(prev => [...prev, player.id]);
  };

  const yourTeam = yourPosition % 2 === 0 ? 0 : 1;
  const oppTeam = yourTeam === 0 ? 1 : 0;
  const yourTeamScore = finalScore[yourTeam];
  const oppTeamScore = finalScore[oppTeam];

  const xpProgressPercent = Math.min(100, Math.round((playerXp / nextLevelXp) * 100));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-lg animate-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-500/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Banner Glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full pointer-events-none opacity-20"
          style={{
            background: isVictory
              ? 'radial-gradient(circle, #f59e0b 0%, transparent 70%)'
              : 'radial-gradient(circle, #ef4444 0%, transparent 70%)',
          }}
        />

        {/* Header Title */}
        <div className="p-5 text-center space-y-1 border-b border-slate-800 bg-slate-950/60">
          <div className="text-4xl animate-bounce">
            {isVictory ? '👑' : '💀'}
          </div>
          <h2
            className={`text-2xl sm:text-3xl font-black uppercase tracking-wider ${
              isVictory ? 'text-amber-400 drop-shadow-md' : 'text-red-400'
            }`}
          >
            {isVictory ? 'VICTORY!' : 'DEFEAT'}
          </h2>
          <div className="flex items-center justify-center space-x-3 text-xs font-bold text-gray-400">
            <span>Score:</span>
            <span className="font-mono text-base font-black text-white">
              <span className={isVictory ? 'text-emerald-400' : 'text-gray-400'}>{yourTeamScore}</span>
              {' - '}
              <span className={!isVictory ? 'text-red-400' : 'text-gray-400'}>{oppTeamScore}</span>
            </span>
          </div>
        </div>

        {/* Scrollable Stats & Progression Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* 1. Competitive LP & MMR Delta */}
          {lpDelta !== undefined && lpDelta !== 0 ? (
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <RankBadge tier={newTier} size="md" />
                <div>
                  <div className="text-xs font-black text-white uppercase tracking-wider">
                    Ranked Progression
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {currentPoints} / 100 LP ({newTier} Tier)
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`text-base font-black font-mono flex items-center justify-end space-x-1 ${
                    isVictory ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  <span>{lpDelta > 0 ? `+${lpDelta}` : `-${Math.abs(lpDelta)}`} LP</span>
                </span>
                <span className="text-[10px] text-gray-500 block">Opponent-Sensitive</span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-gray-400 font-bold">Match Type:</span>
              <span className="text-cyan-300 font-black">Private / Practice (No Rank Risk)</span>
            </div>
          )}

          {/* 2. XP & Player Level Progress */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-amber-400 flex items-center space-x-1">
                <Zap className="w-3.5 h-3.5 fill-amber-400" />
                <span>Level {playerLevel}</span>
              </span>
              <span className="text-white font-mono">+{animatedXp} XP Earned</span>
            </div>

            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${xpProgressPercent}%` }}
              />
            </div>
          </div>

          {/* 3. Match Accolades Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-gray-400 block font-bold">Tricks Won</span>
              <span className="text-base font-black text-white font-mono">{tricksWon}</span>
            </div>
            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-gray-400 block font-bold">Marches</span>
              <span className="text-base font-black text-amber-400 font-mono">{marches}</span>
            </div>
            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-gray-400 block font-bold">Euchres</span>
              <span className="text-base font-black text-red-400 font-mono">{euchres}</span>
            </div>
            <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-gray-400 block font-bold">Alone Sweeps</span>
              <span className="text-base font-black text-cyan-400 font-mono">{loners}</span>
            </div>
          </div>

          {/* 4. Player Roster & Social Friend Invites */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase text-gray-400 block tracking-wider">
              Match Players
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {players.map(p => {
                const isYou = p.position === yourPosition;
                const isTeammate = p.position % 2 === yourPosition % 2;
                const isInvited = invitedPlayerIds.includes(p.id);

                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      isTeammate
                        ? 'bg-blue-950/40 border-blue-500/30 text-blue-200'
                        : 'bg-red-950/40 border-red-500/30 text-red-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="text-lg flex-shrink-0">{p.avatarIcon}</span>
                      <div className="truncate">
                        <div className="font-bold text-white text-xs truncate flex items-center space-x-1">
                          <span>{p.name}</span>
                          {isYou && (
                            <span className="text-[8px] bg-amber-400 text-slate-950 px-1 rounded font-black">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-gray-400">
                          {isTeammate ? 'Teammate' : 'Opponent'}
                        </div>
                      </div>
                    </div>

                    {!isYou && !p.isAI && (
                      <button
                        onClick={() => handleSendFriendRequest(p)}
                        disabled={isInvited}
                        className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                          isInvited
                            ? 'bg-emerald-600/30 text-emerald-400'
                            : 'bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white'
                        }`}
                        title="Add Friend"
                      >
                        {isInvited ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex space-x-3">
          <button
            onClick={() => {
              sounds.playUiClick();
              onExit();
            }}
            className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-gray-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Main Menu</span>
          </button>

          <button
            onClick={() => {
              sounds.playVictoryFanfare();
              onPlayAgain();
            }}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center space-x-1.5 active:scale-95 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
