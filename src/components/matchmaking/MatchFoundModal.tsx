/**
 * BOWER JJ — Match Found Arena Screen & Cinematic Transition
 * High-octane esports pre-match reveal screen featuring AI arena art,
 * 3D glowing "MATCH FOUND" banner, team vs opponents card slide-ins, and ready countdown.
 */

import React, { useEffect, useState, useRef } from 'react';
import { Trophy, Swords, Zap, CheckCircle2 } from 'lucide-react';
import { sounds } from '../../audio/sound';
import { AvatarPortrait } from '../AvatarPortrait';

export interface MatchPlayerPreview {
  name: string;
  avatarId?: string;
  rankTier?: string;
  isBot?: boolean;
}

interface MatchFoundModalProps {
  isOpen: boolean;
  modeTitle?: string;
  yourTeam?: MatchPlayerPreview[];
  opponents?: MatchPlayerPreview[];
  onReady: () => void;
}

export const MatchFoundModal: React.FC<MatchFoundModalProps> = ({
  isOpen,
  modeTitle = 'Ranked Competitive 2v2',
  yourTeam = [
    { name: 'You', avatarId: 'the_outlaw', rankTier: '9' },
    { name: 'Partner', avatarId: 'cyber_bot', rankTier: '9' },
  ],
  opponents = [
    { name: 'Opponent 1', avatarId: 'elven_trickster', rankTier: '9' },
    { name: 'Opponent 2', avatarId: 'crimson_rogue', rankTier: '9' },
  ],
  onReady,
}) => {
  const [countdown, setCountdown] = useState<number>(3);
  const [isClientReady, setIsClientReady] = useState(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!isOpen) return;

    sounds.playMatchFound();
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([60, 40, 100]);
      }
    } catch {}

    setCountdown(3);
    setIsClientReady(false);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onReadyRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Match Found Arena Screen"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none animate-in fade-in duration-300"
    >
      {/* Background Dimmer */}
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" />

      {/* AI Generated Arena Artwork Backdrop with Vignette */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          src="/assets/match_found_bg.jpg"
          alt="Arena Background"
          className="w-full h-full object-cover scale-105 filter brightness-75 contrast-110 animate-pulse duration-[8000ms]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-950/90" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.12)_0%,rgba(0,0,0,0.85)_100%)]" />
      </div>

      {/* Main Arena Content Container */}
      <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center text-center">
        {/* Top Floating Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-500/20 border border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.4)] mb-3 animate-bounce">
          <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-300">
            {modeTitle}
          </span>
        </div>

        {/* 3D Embossed Match Found Header */}
        <div className="relative mb-6">
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-[#fff6d1] via-[#f59e0b] to-[#78350f] drop-shadow-[0_2px_0px_#78350f] drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] drop-shadow-[0_0_25px_rgba(245,158,11,0.6)]">
            MATCH FOUND!
          </h1>
          <p className="text-xs sm:text-sm font-bold text-slate-300 tracking-wide mt-1">
            Opponents assembled • Table prepared • Get ready to deal!
          </p>
        </div>

        {/* Verses Matchup Arena (Your Team vs Opponents) */}
        <div className="w-full grid grid-cols-11 items-center gap-1 sm:gap-2 mb-6">
          {/* Left: Your Team (South + North) */}
          <div className="col-span-5 flex flex-col items-center p-3 sm:p-4 rounded-2xl bg-gradient-to-b from-[#112438]/90 to-[#0c1624]/95 border-2 border-cyan-400/70 shadow-[0_0_25px_rgba(6,182,212,0.25)] relative overflow-hidden animate-in slide-in-from-left duration-500">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-400 to-sky-300" />
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-cyan-300 mb-2">
              YOUR TEAM
            </span>

            <div className="flex items-center justify-center -space-x-3 sm:-space-x-4 mb-2">
              {yourTeam.slice(0, 2).map((player, idx) => (
                <div key={idx} className="relative group">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full ring-2 ring-cyan-400/80 shadow-lg overflow-hidden bg-slate-900">
                    <AvatarPortrait avatarId={player.avatarId || 'the_outlaw'} size="lg" />
                  </div>
                  {player.rankTier && (
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-md bg-cyan-500 text-slate-950 font-black text-[9px] shadow">
                      {player.rankTier}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="text-xs sm:text-sm font-black text-white truncate max-w-full">
              {yourTeam.map((p) => p.name).join(' & ')}
            </div>
            <span className="text-[10px] font-bold text-cyan-400/80 mt-0.5">South & North</span>
          </div>

          {/* Center: Glowing VS Crest */}
          <div className="col-span-1 flex flex-col items-center justify-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.6)] border border-amber-200">
              <span className="text-xs sm:text-sm font-black text-slate-950 italic tracking-tighter">
                VS
              </span>
            </div>
          </div>

          {/* Right: Opponents (West + East) */}
          <div className="col-span-5 flex flex-col items-center p-3 sm:p-4 rounded-2xl bg-gradient-to-b from-[#381119]/90 to-[#240c12]/95 border-2 border-rose-400/70 shadow-[0_0_25px_rgba(244,63,94,0.25)] relative overflow-hidden animate-in slide-in-from-right duration-500">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-400 to-amber-400" />
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-rose-300 mb-2">
              OPPONENTS
            </span>

            <div className="flex items-center justify-center -space-x-3 sm:-space-x-4 mb-2">
              {opponents.slice(0, 2).map((player, idx) => (
                <div key={idx} className="relative group">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full ring-2 ring-rose-400/80 shadow-lg overflow-hidden bg-slate-900">
                    <AvatarPortrait avatarId={player.avatarId || 'crimson_rogue'} size="lg" />
                  </div>
                  {player.rankTier && (
                    <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-md bg-rose-500 text-white font-black text-[9px] shadow">
                      {player.rankTier}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="text-xs sm:text-sm font-black text-white truncate max-w-full">
              {opponents.map((p) => p.name).join(' & ')}
            </div>
            <span className="text-[10px] font-bold text-rose-400/80 mt-0.5">West & East</span>
          </div>
        </div>

        {/* Bottom CTA / Auto-Enter Countdown */}
        <div className="w-full max-w-sm flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              sounds.playUiClick();
              setIsClientReady(true);
              onReady();
            }}
            className="w-full py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:brightness-110 active:scale-95 text-white font-black text-base sm:text-lg tracking-wider shadow-[0_0_30px_rgba(16,185,129,0.4)] border-t border-emerald-300/40 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5 fill-emerald-200 text-slate-950" />
            <span>ENTER ARENA ({countdown}s)</span>
          </button>
          <span className="text-[11px] font-medium text-slate-400">
            Automatically loading table felt in {countdown} seconds...
          </span>
        </div>
      </div>
    </div>
  );
};
