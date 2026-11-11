/**
 * BOWER JJ — Seasonal Battle Pass (Bower Pass) Modal
 * Fortnite / Brawl Stars inspired dual-track progression with challenges.
 */

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Lock,
  CheckCircle2,
  Gift,
  Flame,
  Award,
  Crown,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BattlePassState, Challenge } from '../../server/types';
import { multiplayerClient } from '../services/multiplayerClient';
import { sounds } from '../audio/sound';

interface BowerPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  battlePass?: BattlePassState;
  challenges?: Challenge[];
}

interface PassReward {
  tier: number;
  freeReward: { title: string; icon: string; claimed?: boolean };
  premiumReward: { title: string; icon: string; claimed?: boolean };
}

const PASS_REWARDS: PassReward[] = [
  {
    tier: 1,
    freeReward: { title: '🤠 Outlaw Hat', icon: '🤠' },
    premiumReward: { title: '🔥 Flame Trail Banner', icon: '🔥' },
  },
  {
    tier: 2,
    freeReward: { title: '👏 Nice Hand Emote', icon: '👏' },
    premiumReward: { title: '💎 500 Bonus XP', icon: '💎' },
  },
  {
    tier: 3,
    freeReward: { title: '🎩 Top Hat', icon: '🎩' },
    premiumReward: { title: '⚡ Cyber Grid Banner', icon: '⚡' },
  },
  {
    tier: 4,
    freeReward: { title: '🥈 Silver Chip', icon: '🥈' },
    premiumReward: { title: '🚀 Rocket Emote', icon: '🚀' },
  },
  {
    tier: 5,
    freeReward: { title: '🃏 Royal Blue Card Back', icon: '🃏' },
    premiumReward: { title: '✨ Obsidian Gold Card Back', icon: '✨' },
  },
  {
    tier: 6,
    freeReward: { title: '🧢 Streetwear Cap', icon: '🧢' },
    premiumReward: { title: '🧙 Wizard Hat', icon: '🧙' },
  },
  {
    tier: 7,
    freeReward: { title: '🌟 Trick Master Title', icon: '🌟' },
    premiumReward: { title: '🌌 Cosmic Nebula Banner', icon: '🌌' },
  },
  {
    tier: 8,
    freeReward: { title: '💯 1000 Bonus XP', icon: '💯' },
    premiumReward: { title: '🪖 Viking Helm', icon: '🪖' },
  },
  {
    tier: 9,
    freeReward: { title: '🦊 Fox Avatar', icon: '🦊' },
    premiumReward: { title: '🛡️ Aegis Card Back', icon: '🛡️' },
  },
  {
    tier: 10,
    freeReward: { title: '👑 Crown of Bowers', icon: '👑' },
    premiumReward: { title: '🏆 Supreme Champion Title', icon: '🏆' },
  },
];

export const BowerPassModal: React.FC<BowerPassModalProps> = ({
  isOpen,
  onClose,
  battlePass,
  challenges = [],
}) => {
  const [activeTab, setActiveTab] = useState<'rewards' | 'challenges'>('rewards');

  if (!isOpen) return null;

  const currentTier = battlePass?.tier || 1;
  const currentXp = battlePass?.xp || 0;
  const xpNeeded = battlePass?.tierXpRequired || 500;
  const progressPercent = Math.min(100, Math.round((currentXp / xpNeeded) * 100));

  const handleClaim = (tier: number, isPremium: boolean) => {
    multiplayerClient.claimBattlePassReward(tier, isPremium);
    sounds.playVictoryFanfare();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-yellow-500/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Banner Header */}
        <div className="relative p-5 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-700 text-slate-950 overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-950/20 border border-slate-950/30 flex items-center justify-center text-3xl shadow-inner">
                🎫
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider">
                    Bower Pass
                  </h2>
                  <span className="text-[10px] font-black uppercase bg-slate-950 text-amber-300 px-2 py-0.5 rounded-full">
                    Season 1
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-900">
                  Return of the Jack — Unlock exclusive cards, hats, and titles
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-950/20 text-slate-950 hover:bg-slate-950/40 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Tier Progress Bar */}
          <div className="relative z-10 mt-4 bg-slate-950/30 rounded-2xl p-3 border border-slate-950/20">
            <div className="flex items-center justify-between text-xs font-black mb-1.5">
              <span>Tier {currentTier} of 10</span>
              <span>
                {currentXp} / {xpNeeded} XP
              </span>
            </div>
            <div className="w-full h-3 bg-slate-950/50 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-yellow-300 to-amber-200 rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 space-x-2">
          <button
            onClick={() => setActiveTab('rewards')}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'rewards'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>Pass Rewards</span>
          </button>
          <button
            onClick={() => setActiveTab('challenges')}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'challenges'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Daily Challenges ({challenges.filter(c => c.completed).length}/{challenges.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'rewards' ? (
            <div className="space-y-3">
              {PASS_REWARDS.map(reward => {
                const isUnlocked = currentTier >= reward.tier;
                const isFreeClaimed = battlePass?.claimedFreeTiers.includes(reward.tier);
                const isPremiumClaimed = battlePass?.claimedPremiumTiers.includes(reward.tier);

                return (
                  <div
                    key={reward.tier}
                    className={`rounded-2xl border p-3 flex items-center justify-between transition-all ${
                      isUnlocked
                        ? 'bg-slate-800/90 border-amber-500/50 shadow-md'
                        : 'bg-slate-800/30 border-slate-800 opacity-60'
                    }`}
                  >
                    {/* Tier Number */}
                    <div className="flex items-center space-x-3 w-1/4">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                          isUnlocked
                            ? 'bg-amber-400 text-slate-950 shadow-lg'
                            : 'bg-slate-800 text-gray-500 border border-slate-700'
                        }`}
                      >
                        {reward.tier}
                      </div>
                      <div className="hidden sm:block">
                        <div className="text-xs font-black text-white">Tier {reward.tier}</div>
                        <div className="text-[10px] text-gray-400">
                          {isUnlocked ? 'Unlocked!' : 'Locked'}
                        </div>
                      </div>
                    </div>

                    {/* Free Track Reward */}
                    <div className="flex-1 flex items-center justify-center space-x-2 px-2">
                      <span className="text-2xl">{reward.freeReward.icon}</span>
                      <div className="text-left">
                        <div className="text-[10px] uppercase font-bold text-gray-400">Free</div>
                        <div className="text-xs font-bold text-white truncate max-w-[120px] sm:max-w-none">
                          {reward.freeReward.title}
                        </div>
                      </div>
                    </div>

                    {/* Claim Button */}
                    <div className="w-1/4 flex justify-end">
                      {isFreeClaimed ? (
                        <span className="flex items-center space-x-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                          <Check className="w-3.5 h-3.5" />
                          <span>Claimed</span>
                        </span>
                      ) : isUnlocked ? (
                        <button
                          onClick={() => handleClaim(reward.tier, false)}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md active:scale-95 transition-transform"
                        >
                          Claim
                        </button>
                      ) : (
                        <div className="flex items-center space-x-1 text-xs text-gray-500 bg-slate-800/80 px-2.5 py-1 rounded-lg">
                          <Lock className="w-3 h-3" />
                          <span>Locked</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* CHALLENGES TAB */
            <div className="space-y-3">
              {challenges.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No active challenges. Check back tomorrow!
                </div>
              ) : (
                challenges.map(ch => {
                  const percent = Math.min(100, Math.round((ch.current / ch.target) * 100));

                  return (
                    <div
                      key={ch.id}
                      className={`rounded-2xl border p-4 transition-all ${
                        ch.completed
                          ? 'bg-emerald-950/20 border-emerald-500/40'
                          : 'bg-slate-800/80 border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-black text-white text-sm flex items-center space-x-2">
                            <span>{ch.title}</span>
                            {ch.completed && (
                              <span className="text-[10px] font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full flex items-center space-x-1">
                                <Check className="w-3 h-3" />
                                <span>COMPLETE</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{ch.desc}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black text-amber-400">
                            +{ch.xpReward} XP
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700/60 mt-2">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            ch.completed
                              ? 'bg-emerald-400'
                              : 'bg-gradient-to-r from-amber-400 to-yellow-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-400 text-right mt-1 font-bold">
                        {ch.current} / {ch.target}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
