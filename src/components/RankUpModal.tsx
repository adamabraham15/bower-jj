/**
 * BOWER JJ — Rank Promotion Fanfare Modal
 * Explosive visual celebration when ascending competitive tiers.
 */

import React, { useEffect } from 'react';
import { Sparkles, Trophy, ArrowRight, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { RankTier, RankBadge, RANK_INFO } from './RankBadge';
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
        particleCount: 100,
        spread: 90,
        origin: { y: 0.5 },
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const info = RANK_INFO[newTier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg animate-in zoom-in-95 duration-300">
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-400 rounded-3xl p-6 shadow-2xl text-center space-y-6 overflow-hidden">
        {/* Radiant Background Aura */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${info.color} 0%, transparent 70%)`,
          }}
        />

        {/* Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Rank Promoted!</span>
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-wider">
            Tier Ascension
          </h2>
          <p className="text-xs text-gray-400">
            You conquered your opponents and earned a new competitive rank tier!
          </p>
        </div>

        {/* Tier Transition Display */}
        <div className="flex items-center justify-center space-x-6 py-4">
          <div className="flex flex-col items-center opacity-60 scale-90">
            <RankBadge tier={oldTier} size="md" />
            <span className="text-[11px] font-bold text-gray-400 mt-1 uppercase">
              {oldTier} Rank
            </span>
          </div>

          <div className="text-amber-400 animate-pulse">
            <ArrowRight className="w-8 h-8 stroke-[3]" />
          </div>

          <div className="flex flex-col items-center scale-110 animate-bounce">
            <RankBadge tier={newTier} size="lg" />
            <span
              className="text-xs font-black mt-2 uppercase tracking-wider"
              style={{ color: info.color }}
            >
              {info.name}
            </span>
          </div>
        </div>

        {/* Rank Perks Banner */}
        <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 text-left space-y-2">
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-black uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Demotion Protection Active</span>
          </div>
          <p className="text-xs text-gray-300">
            You are now <strong>{info.title}</strong> with <strong>{newPoints} LP</strong>. You have 1 grace shield protecting your new tier.
          </p>
        </div>

        {/* Claim Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 active:scale-95 transition-all"
        >
          Claim Rank Glory
        </button>
      </div>
    </div>
  );
};
