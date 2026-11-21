/**
 * BOWER JJ — Division Promotion & Sovereign Tier Ascension Fanfare Modal (Season 2)
 *
 * Features TWO distinct celebratory animation sequences:
 * 1. DIVISION UP ANIMATION (III -> II -> I, 100 LP each):
 *    - Animated 3-Division Star Track with energy beam & star ignition shockwave.
 *    - Focused tier-colored confetti fountain & Division Wax Seal Spoils (+25 / +35 Seals).
 * 2. ELABORATE RANK-TO-RANK TIER ASCENSION (e.g. Copper IX -> Silver X):
 *    - Multi-stage cinematic transformation (Charging Old Crest -> Shockwave Eruption -> Forging New Sovereign Crest).
 *    - Rotating conic god-rays, twin counter-rotating arcane SVG heraldic rings, and 3-salvo dual-cannon confetti storm.
 */

import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Award, Star, Crown, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  RankTier,
  RankDivision,
  RankBadge,
  RANK_INFO,
  getRankDivisionInfo,
} from './RankBadge';
import { sounds } from '../audio/sound';

interface RankUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  oldTier: RankTier;
  newTier: RankTier;
  oldDivision?: RankDivision;
  newDivision?: RankDivision;
  newPoints: number;
  promotionSealsAwarded?: number;
}

export const RankUpModal: React.FC<RankUpModalProps> = ({
  isOpen,
  onClose,
  oldTier,
  newTier,
  oldDivision,
  newDivision,
  newPoints,
  promotionSealsAwarded,
}) => {
  const isTierAscension =
    oldTier !== newTier ||
    (newTier === 'BOWER_JJ' && oldDivision !== newDivision && (newDivision === 'GRANDMASTER' || newDivision === 'CHALLENGER'));
  const resolvedOldDiv: RankDivision =
    oldDivision || (isTierAscension ? (newTier === 'BOWER_JJ' ? 'MASTER' : 'I') : 'III');
  const resolvedNewDiv: RankDivision =
    newDivision || (newTier === 'BOWER_JJ' ? (newPoints >= 500 ? 'CHALLENGER' : newPoints >= 250 ? 'GRANDMASTER' : 'MASTER') : isTierAscension ? 'III' : 'II');

  const [animStage, setAnimStage] = useState<'charge' | 'reveal'>('charge');
  const [starIgnited, setStarIgnited] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setAnimStage('charge');
      setStarIgnited(false);
      return;
    }

    const oldInfo = RANK_INFO[oldTier] || RANK_INFO['9'];
    const newInfo = RANK_INFO[newTier] || RANK_INFO['9'];

    if (isTierAscension) {
      // =======================================================================
      // ELABORATE MULTI-STAGE RANK-TO-RANK TIER ASCENSION CHOREOGRAPHY
      // =======================================================================
      setAnimStage('charge');
      sounds.playTrickWin();

      // Stage 1: Initial charge burst
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.55 },
        colors: [oldInfo.color, '#fbbf24', '#ffffff'],
      });

      // Stage 2 (650ms): Shockwave Eruption & New Tier Reveal + Dual Side Cannons
      const revealTimer = setTimeout(() => {
        setAnimStage('reveal');
        sounds.playVictoryFanfare();

        // Left Cannon
        confetti({
          particleCount: 85,
          angle: 60,
          spread: 65,
          origin: { x: 0.08, y: 0.65 },
          colors: [newInfo.color, newInfo.accentColor, '#fbbf24', '#ffffff'],
        });
        // Right Cannon
        confetti({
          particleCount: 85,
          angle: 120,
          spread: 65,
          origin: { x: 0.92, y: 0.65 },
          colors: [newInfo.color, newInfo.accentColor, '#fbbf24', '#ffffff'],
        });
      }, 650);

      // Stage 3 (1250ms): Grand Overhead Golden Crown Shower
      const finaleTimer = setTimeout(() => {
        confetti({
          particleCount: 110,
          spread: 135,
          startVelocity: 45,
          origin: { x: 0.5, y: 0.25 },
          colors: [newInfo.color, '#fbbf24', '#fef08a', newInfo.accentColor],
        });
      }, 1250);

      return () => {
        clearTimeout(revealTimer);
        clearTimeout(finaleTimer);
      };
    } else {
      // =======================================================================
      // DIVISION UP (III -> II or II -> I) CHOREOGRAPHY
      // =======================================================================
      setAnimStage('reveal');
      sounds.playVictoryFanfare();

      confetti({
        particleCount: 65,
        spread: 80,
        origin: { y: 0.55 },
        colors: [newInfo.color, newInfo.accentColor, '#fbbf24'],
      });

      const starTimer = setTimeout(() => {
        setStarIgnited(true);
        sounds.playTrickWin();
      }, 380);

      return () => clearTimeout(starTimer);
    }
  }, [isOpen, isTierAscension, oldTier, newTier]);

  if (!isOpen) return null;

  const oldInfo = RANK_INFO[oldTier] || RANK_INFO['9'];
  const info = RANK_INFO[newTier] || RANK_INFO['9'];
  const divInfo = getRankDivisionInfo(newTier, newPoints, resolvedNewDiv);
  const sealsEarned =
    promotionSealsAwarded ??
    (isTierAscension
      ? info.promotionSeals
      : resolvedNewDiv === 'I'
      ? 35
      : 25);

  // ===========================================================================
  // RENDER MODE 1: DIVISION PROMOTION (III -> II or II -> I within same Tier)
  // ===========================================================================
  if (!isTierAscension) {
    const divisions: ('III' | 'II' | 'I')[] = ['III', 'II', 'I'];
    const newDivIdx = divisions.indexOf(resolvedNewDiv as any);

    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in zoom-in-95 duration-200">
        <div
          className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 rounded-3xl p-6 shadow-2xl text-center space-y-5 overflow-hidden border-2"
          style={{
            borderColor: info.border,
            boxShadow: `0 0 40px ${info.glow}`,
          }}
        >
          {/* Ambient Division Glow */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 35%, ${info.color} 0%, transparent 70%)`,
            }}
          />

          {/* Header Pill */}
          <div className="space-y-1.5 relative z-10">
            <div
              className="inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full border text-xs font-black uppercase tracking-wider"
              style={{
                backgroundColor: `${info.color}20`,
                borderColor: info.border,
                color: info.color,
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Division Promoted!</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider">
              {info.name} • Div {resolvedNewDiv}
            </h2>
            <p className="text-xs text-slate-300 font-semibold">
              You conquered 100 LP in Division {resolvedOldDiv} and advanced to{' '}
              <strong style={{ color: info.color }}>Division {resolvedNewDiv}</strong>!
            </p>
          </div>

          {/* Center Crest with Shockwave Ring */}
          <div className="relative py-2 flex flex-col items-center justify-center z-10">
            {starIgnited && (
              <div
                className="absolute w-28 h-28 rounded-full border-2 animate-ping opacity-30 pointer-events-none"
                style={{ borderColor: info.color }}
              />
            )}
            <div className="transition-transform duration-500 scale-110">
              <RankBadge
                tier={newTier}
                division={resolvedNewDiv}
                points={newPoints}
                size="xl"
                showLabel={false}
              />
            </div>

            {/* Animated 3-Division Star Ignition Track (Div III -> Div II -> Div I) */}
            <div className="mt-5 flex items-center justify-center gap-3 bg-slate-950/90 border border-slate-800 px-5 py-2.5 rounded-2xl shadow-inner">
              {divisions.map((divLabel, idx) => {
                const isReached = idx <= newDivIdx;
                const isJustUnlocked = idx === newDivIdx;
                return (
                  <React.Fragment key={divLabel}>
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-500 ${
                          isJustUnlocked && starIgnited
                            ? 'scale-125 ring-2 ring-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.9)]'
                            : isReached
                            ? 'scale-100'
                            : 'opacity-40 bg-slate-900 border-slate-800'
                        }`}
                        style={
                          isReached
                            ? {
                                background: info.bg,
                                borderColor: isJustUnlocked ? '#fbbf24' : info.border,
                              }
                            : undefined
                        }
                      >
                        <Star
                          className={`w-4 h-4 transition-all duration-500 ${
                            isReached
                              ? 'text-amber-300 fill-amber-300'
                              : 'text-slate-600'
                          }`}
                        />
                      </div>
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider ${
                          isJustUnlocked
                            ? 'text-amber-300'
                            : isReached
                            ? 'text-white'
                            : 'text-slate-500'
                        }`}
                      >
                        Div {divLabel}
                      </span>
                    </div>
                    {idx < 2 && (
                      <div className="w-8 h-1 rounded-full bg-slate-800 overflow-hidden mb-3">
                        <div
                          className="h-full transition-all duration-700"
                          style={{
                            width: idx < newDivIdx && starIgnited ? '100%' : '0%',
                            backgroundColor: info.color,
                          }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Division Rewards & Next Goal */}
          <div className="space-y-2 relative z-10 text-left">
            <div className="bg-amber-500/15 rounded-2xl p-3 border border-amber-400/40 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-amber-300 uppercase tracking-wider">
                    Division Up Reward
                  </div>
                  <div className="text-xs text-white font-bold">
                    +{sealsEarned} Wax Seals • {newPoints}/100 LP Carryover
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                Claimed
              </span>
            </div>

            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex items-center space-x-2.5 text-xs text-slate-300">
              <Flame className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                {resolvedNewDiv === 'I'
                  ? `Final Division of ${info.name}! Earn 100 LP in Division I to ascend to the next Sovereign Rank Tier!`
                  : `Earn 100 LP in Division II to reach Division I of ${info.name}!`}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="relative z-10 w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 active:scale-95 transition-all"
          >
            Continue Climb
          </button>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER MODE 2: ELABORATE RANK-TO-RANK SOVEREIGN TIER ASCENSION
  // ===========================================================================
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/92 backdrop-blur-xl animate-in fade-in duration-300">
      {/* Full-Screen Rotating Conic God-Rays */}
      <div
        className="pointer-events-none fixed inset-0 opacity-25 animate-spin"
        style={{
          animationDuration: '18s',
          background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, ${info.color} 45deg, transparent 90deg, #fbbf24 180deg, transparent 225deg, ${info.accentColor} 315deg, transparent 360deg)`,
        }}
      />

      <div
        className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-[#0b101e] to-slate-950 border-2 border-amber-400 rounded-3xl p-6 sm:p-7 shadow-[0_0_70px_rgba(251,191,36,0.45)] text-center space-y-5 overflow-hidden"
      >
        {/* Radiant Inner Halo */}
        <div
          className="absolute inset-0 opacity-35 pointer-events-none transition-all duration-700"
          style={{
            background: `radial-gradient(circle at 50% 38%, ${
              animStage === 'charge' ? oldInfo.color : info.color
            } 0%, transparent 68%)`,
          }}
        />

        {/* Counter-Rotating Arcane Heraldic Rings (SVG) */}
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 w-64 h-64 opacity-30">
          <svg viewBox="0 0 200 200" className="w-full h-full animate-spin" style={{ animationDuration: '14s' }}>
            <circle
              cx="100"
              cy="100"
              r="88"
              fill="none"
              stroke={info.color}
              strokeWidth="1.5"
              strokeDasharray="10 6 2 6"
            />
            <polygon
              points="100,14 174,57 174,143 100,186 26,143 26,57"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1"
              opacity="0.6"
            />
          </svg>
        </div>

        {/* Grand Header */}
        <div className="space-y-1 relative z-10">
          <div className="inline-flex items-center space-x-2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500/30 via-yellow-400/30 to-amber-500/30 border border-amber-300 text-amber-200 text-xs font-black uppercase tracking-widest shadow-lg">
            <Crown className="w-4 h-4 text-amber-300 fill-amber-300 animate-bounce" />
            <span>Sovereign Tier Ascension</span>
            <Crown className="w-4 h-4 text-amber-300 fill-amber-300 animate-bounce" />
          </div>
          <h2
            className="text-3xl sm:text-4xl font-black uppercase tracking-wider drop-shadow-[0_2px_12px_rgba(251,191,36,0.5)] transition-all duration-500"
            style={{ color: animStage === 'charge' ? oldInfo.color : '#ffffff' }}
          >
            {animStage === 'charge' ? 'Ascending...' : info.name}
          </h2>
          <p className="text-xs sm:text-sm font-bold text-amber-300">
            {animStage === 'charge'
              ? `Breaking through ${oldInfo.name} • Division I`
              : `New Sovereign Title Unlocked: “${info.title}”`}
          </p>
        </div>

        {/* Multi-Stage Crest Transformation Showcase */}
        <div className="relative py-5 flex items-center justify-center min-h-[160px] z-10">
          {animStage === 'charge' ? (
            /* Stage 1: Old Crest Charging with Energy */
            <div className="flex flex-col items-center animate-pulse scale-110">
              <RankBadge
                tier={oldTier}
                division="I"
                points={100}
                size="xl"
                showLabel={false}
              />
              <span className="mt-3 text-xs font-black text-amber-300 uppercase tracking-widest">
                100 / 100 LP — Forging New Crest...
              </span>
            </div>
          ) : (
            /* Stage 2: Shockwave Eruption & New Tier Reveal */
            <div className="flex items-center justify-center space-x-5 sm:space-x-7 animate-in zoom-in-75 duration-500">
              {/* Previous Tier Crest (Faded on Left) */}
              <div className="flex flex-col items-center opacity-55 scale-90">
                <RankBadge
                  tier={oldTier}
                  division="I"
                  size="md"
                  showLabel={false}
                  showDivisionPips={false}
                />
                <span className="text-[10px] font-bold text-slate-400 mt-1.5">
                  {oldInfo.name} I
                </span>
              </div>

              <div className="flex flex-col items-center text-amber-400">
                <ArrowRight className="w-8 h-8 stroke-[3] animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-300">
                  Promoted
                </span>
              </div>

              {/* New Sovereign Crest (Hero Centerpiece) */}
              <div className="relative flex flex-col items-center scale-110">
                <div
                  className="absolute -inset-3 rounded-full blur-xl opacity-75 animate-pulse pointer-events-none"
                  style={{ background: info.glow }}
                />
                <RankBadge
                  tier={newTier}
                  division={resolvedNewDiv}
                  points={newPoints}
                  size="xl"
                  showLabel={false}
                />
                <span
                  className="text-sm font-black mt-3 tracking-wide drop-shadow"
                  style={{ color: info.color }}
                >
                  {divInfo.fullRankName}
                </span>
                <span className="text-[11px] font-mono font-bold text-amber-200">
                  {newPoints} / 100 LP
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Grand Ascension Spoils & Demotion Protection */}
        <div className="space-y-2.5 relative z-10 text-left">
          <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 rounded-2xl p-3.5 border border-amber-400/60 flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/25 border border-amber-300 flex items-center justify-center text-amber-300 shadow">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
                  Sovereign Ascension Chest
                </div>
                <div className="text-xs sm:text-sm text-white font-black">
                  {info.rewardSummary}
                </div>
              </div>
            </div>
            <span className="text-xs font-black text-slate-950 bg-amber-400 px-2.5 py-1 rounded-full shadow">
              UNLOCKED
            </span>
          </div>

          <div className="bg-slate-900/90 rounded-2xl p-3.5 border border-slate-700/80 space-y-1">
            <div className="flex items-center space-x-2 text-cyan-300 text-xs font-black uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Tier Demotion Protection Shield Active</span>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              {info.lore} You now begin in <strong>{divInfo.fullRankName}</strong> with a grace shield protecting your new rank!
            </p>
          </div>
        </div>

        {/* Claim Button */}
        <button
          onClick={onClose}
          className="relative z-10 w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 hover:from-amber-300 hover:to-yellow-200 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/30 active:scale-95 transition-all"
        >
          Claim Sovereign Glory
        </button>
      </div>
    </div>
  );
};
