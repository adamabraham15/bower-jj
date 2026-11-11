/**
 * BOWER JJ — Achievements & Trophy Showcase Modal
 */

import React from 'react';
import { X, Award, CheckCircle2, Lock, Sparkles, Trophy, Star } from 'lucide-react';
import { PlayerProfileData } from './ProfileModal';
import { sounds } from '../audio/sound';

export interface AchievementItem {
  id: string;
  title: string;
  desc: string;
  icon: string;
  current: number;
  target: number;
  completed: boolean;
  reward: string;
}

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PlayerProfileData;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  if (!isOpen) return null;

  const achievements: AchievementItem[] = [
    {
      id: 'ach_1',
      title: 'First Trick',
      desc: 'Capture your first trick in any game mode',
      icon: '🎴',
      current: Math.min(1, profile.tricksWon),
      target: 1,
      completed: profile.tricksWon >= 1,
      reward: '+100 XP',
    },
    {
      id: 'ach_2',
      title: 'Right Bower Dominance',
      desc: 'Capture 15 tricks holding the mighty Right Bower',
      icon: '👑',
      current: Math.min(15, profile.tricksWon),
      target: 15,
      completed: profile.tricksWon >= 15,
      reward: '+300 XP • Right Jack Badge',
    },
    {
      id: 'ach_3',
      title: 'Left Bower Deception',
      desc: 'Trump a trick with the same-color Left Bower 8 times',
      icon: '🃏',
      current: Math.min(8, Math.floor(profile.tricksWon * 0.4)),
      target: 8,
      completed: Math.floor(profile.tricksWon * 0.4) >= 8,
      reward: '+350 XP • Left Jack Banner',
    },
    {
      id: 'ach_4',
      title: 'Lone Wolf',
      desc: 'Call Alone and take all 5 tricks for a 4-point sweep',
      icon: '🐺',
      current: Math.min(1, profile.successfulLoners),
      target: 1,
      completed: profile.successfulLoners >= 1,
      reward: '+500 XP • Lone Wolf Title',
    },
    {
      id: 'ach_5',
      title: 'March Conductor',
      desc: 'Achieve 3 Marches (take all 5 tricks in a hand)',
      icon: '⚡',
      current: Math.min(3, profile.marches),
      target: 3,
      completed: profile.marches >= 3,
      reward: '+400 XP',
    },
    {
      id: 'ach_6',
      title: 'The Iron Wall',
      desc: 'Defend and Euchre your opponents 5 times',
      icon: '🛡️',
      current: Math.min(5, profile.euchres),
      target: 5,
      completed: profile.euchres >= 5,
      reward: '+450 XP • Aegis Shield Banner',
    },
    {
      id: 'ach_7',
      title: 'Winning Streak',
      desc: 'Achieve a consecutive win streak of 3 matches',
      icon: '🔥',
      current: Math.min(3, profile.bestStreak),
      target: 3,
      completed: profile.bestStreak >= 3,
      reward: '+300 XP',
    },
    {
      id: 'ach_8',
      title: 'Hot Hands',
      desc: 'Achieve a consecutive win streak of 5 matches',
      icon: '💥',
      current: Math.min(5, profile.bestStreak),
      target: 5,
      completed: profile.bestStreak >= 5,
      reward: '+600 XP • Fire Trail Emote',
    },
    {
      id: 'ach_9',
      title: 'Challenger Ascension',
      desc: 'Advance to Tier 10 Rank in competitive matchmaking',
      icon: '🥈',
      current: profile.rankTier !== '9' ? 1 : 0,
      target: 1,
      completed: profile.rankTier !== '9',
      reward: '+400 XP',
    },
    {
      id: 'ach_10',
      title: 'Queen Elite',
      desc: 'Ascend to the prestigious Queen Elite division',
      icon: '👸',
      current: ['Q', 'K', 'A', 'BOWER_JJ'].includes(profile.rankTier) ? 1 : 0,
      target: 1,
      completed: ['Q', 'K', 'A', 'BOWER_JJ'].includes(profile.rankTier),
      reward: '+600 XP',
    },
    {
      id: 'ach_11',
      title: 'King Sovereign',
      desc: 'Ascend to the King Sovereign tier in competitive play',
      icon: '🤴',
      current: ['K', 'A', 'BOWER_JJ'].includes(profile.rankTier) ? 1 : 0,
      target: 1,
      completed: ['K', 'A', 'BOWER_JJ'].includes(profile.rankTier),
      reward: '+800 XP',
    },
    {
      id: 'ach_12',
      title: 'BOWER JJ Supreme',
      desc: 'Reach the pinnacle of the world rankings: BOWER JJ Tier',
      icon: '🌟',
      current: profile.rankTier === 'BOWER_JJ' ? 1 : 0,
      target: 1,
      completed: profile.rankTier === 'BOWER_JJ',
      reward: '+2000 XP • Pinnacle Apex Crown',
    },
  ];

  const completedCount = achievements.filter(a => a.completed).length;
  const progressPercent = Math.round((completedCount / achievements.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border-2 border-amber-500/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <span>Achievements</span>
                <span className="text-xs bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black">
                  {completedCount} / {achievements.length}
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Unlock trophies and exclusive titles through skill
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Progress Bar */}
        <div className="px-5 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center space-x-3">
          <div className="flex-1">
            <div className="flex justify-between text-xs font-bold text-gray-300 mb-1">
              <span>Career Completion</span>
              <span className="text-amber-400 font-mono">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/80">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Achievements List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {achievements.map(ach => {
            const percent = Math.min(100, Math.round((ach.current / ach.target) * 100));

            return (
              <div
                key={ach.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between space-x-3 ${
                  ach.completed
                    ? 'bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-500/5'
                    : 'bg-slate-800/40 border-slate-800 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-slate-800 border border-slate-700">
                  {ach.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-white text-xs sm:text-sm truncate">
                      {ach.title}
                    </span>
                    {ach.completed && (
                      <span className="text-[9px] font-black bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded-full flex items-center space-x-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>DONE</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">{ach.desc}</p>

                  {/* Progress bar */}
                  <div className="mt-1.5 flex items-center space-x-2">
                    <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          ach.completed ? 'bg-amber-400' : 'bg-slate-600'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono font-bold">
                      {ach.current}/{ach.target}
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-[10px] font-black text-amber-400/90 block">
                    {ach.reward}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
