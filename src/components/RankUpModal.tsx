/**
 * BOWER JJ — Sovereign Hierarchy Rank Promotion Fanfare Modal (Season 2)
 * Explosive visual celebration when ascending competitive tiers, showcasing
 * bespoke heraldic emblems and Promotion Wax Seal Spoils.
 */

import React, { useEffect } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { RankTier, RankBadge, RANK_INFO, getRankDivisionInfo } from './RankBadge';
import { sounds } from '../audio/sound';

interface RankUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  oldTier: RankTier;
  newTier: RankTier;
  newPoints: number;
}

export const RankUpModal: React.FC<RankUpModalProps> = ({
  isOpen,
  onClose,
  oldTier,
  newTier,
  newPoints,
}) => {
  useEffect(() => {
    if (isOpen) {
      sounds.playVictoryFanfare();
      confetti({
        particleCount: 110,
        spread: 95,
        origin: { y: 0.5 },
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const oldInfo = RANK_INFO[oldTier] || RANK_INFO['9'];
  const info = RANK_INFO[newTier] || RANK_INFO['9'];
  const divInfo = getRankDivisionInfo(newTier, newPoints);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in zoom-in-95 duration-300">
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-400 rounded-3xl p-6 shadow-2xl text-center space-y-5 overflow-hidden">
        {/* Radiant Background Aura */}
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${info.color} 0%, transparent 70%)`,
          }}
        />

        {/* Header */}
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sovereign Promotion!</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider">
            {info.name}
          </h2>
          <p className="text-xs font-bold text-amber-300">
            Title Unlocked: &ldquo;{info.title}&rdquo;
          </p>
        </div>

        {/* Tier Transition Display */}
        <div className="flex items-center justify-center space-x-5 py-3 relative z-10">
          <div className="flex flex-col items-center opacity-60 scale-90">
            <RankBadge tier={oldTier} size="md" showLabel={false} showDivisionPips={false} />
            <span className="text-[11px] font-bold text-gray-400 mt-1.5">
              {oldInfo.name}
            </span>
          </div>

          <div className="text-amber-400 animate-pulse">
            <ArrowRight className="w-8 h-8 stroke-[3]" />
          </div>

          <div className="flex flex-col items-center scale-110">
            <RankBadge tier={newTier} points={newPoints} size="xl" showLabel={false} />
            <span
              className="text-xs font-black mt-3 tracking-wide"
              style={{ color: info.color }}
            >
              {divInfo.fullRankName} ({newPoints} LP)
            </span>
          </div>
        </div>

        {/* Promotion Spoils & Demotion Shield */}
        <div className="space-y-2.5 relative z-10">
          <div className="bg-amber-500/15 rounded-2xl p-3.5 border border-amber-400/40 text-left flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
                  Promotion Spoils Claimed
                </div>
                <div className="text-xs text-white font-bold">
                  +{info.promotionSeals} Wax Seals (Crafting Dust)
                </div>
              </div>
            </div>
            <span className="text-xs font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              Granted
            </span>
          </div>

          <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/80 text-left space-y-1">
            <div className="flex items-center space-x-2 text-cyan-300 text-xs font-black uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Demotion Protection Shield Active</span>
            </div>
            <p className="text-[11px] text-gray-300">
              {info.lore} Your new tier is protected by a 1-game grace shield.
            </p>
          </div>
        </div>

        {/* Claim Button */}
        <button
          onClick={onClose}
          className="relative z-10 w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 active:scale-95 transition-all"
        >
          Claim Sovereign Glory
        </button>
      </div>
    </div>
  );
};
