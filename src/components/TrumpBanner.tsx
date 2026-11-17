/**
 * BOWER JJ — Shared Trump Suit & Maker UI Indicators
 * Displays the active trump suit, the player/team that called it, and alone status.
 */

import React from 'react';
import { Suit, Team } from '../engine/types';
import { SuitIcon } from './CardView';

interface TrumpBannerProps {
  trumpSuit: Suit;
  callerName?: string;
  callerTeam?: Team;
  isAlone?: boolean;
  isUserTeam?: boolean;
}

export const TrumpBanner: React.FC<TrumpBannerProps> = ({
  trumpSuit,
  callerName,
  callerTeam,
  isAlone,
  isUserTeam,
}) => {
  const isRedSuit = trumpSuit === 'hearts' || trumpSuit === 'diamonds';
  const isTeam = isUserTeam !== undefined ? isUserTeam : callerTeam === 0;
  const teamLabel = callerTeam === undefined ? undefined : isTeam ? 'Your Team' : 'Opponents';

  return (
    <div
      className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-slate-950/95 border-2 border-amber-400/90 shadow-[0_0_15px_rgba(245,158,11,0.3)] min-w-0 flex-shrink"
      title={
        callerName
          ? `Trump: ${trumpSuit.toUpperCase()} — Called by ${callerName}${teamLabel ? ` (${teamLabel})` : ''}`
          : `Trump: ${trumpSuit.toUpperCase()}`
      }
    >
      <span className="hidden md:inline text-xs text-amber-400 uppercase font-black tracking-wider">
        TRUMP:
      </span>
      <SuitIcon suit={trumpSuit} className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
      <span
        className={`text-xs sm:text-sm font-black uppercase tracking-wider flex-shrink-0 ${
          isRedSuit ? 'text-red-400' : trumpSuit === 'clubs' ? 'text-emerald-400' : 'text-slate-100'
        }`}
      >
        {trumpSuit}
      </span>

      {callerName && (
        <span
          className={`flex items-center space-x-1 text-[10px] sm:text-xs font-black px-2 sm:px-2.5 py-0.5 rounded-full border shadow-sm min-w-0 flex-shrink ${
            callerTeam === undefined
              ? 'bg-slate-800 border-slate-700 text-gray-200'
              : isTeam
              ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-200'
              : 'bg-rose-500/20 border-rose-400/70 text-rose-200'
          }`}
        >
          {teamLabel && (
            <span
              className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${
                isTeam ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]' : 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]'
              }`}
            />
          )}
          <span className="text-[10px] sm:text-xs text-slate-400 font-bold hidden sm:inline flex-shrink-0">by</span>
          <span className="truncate max-w-[80px] sm:max-w-[140px]">{callerName}</span>
          {teamLabel && <span className="hidden sm:inline text-[10px] sm:text-xs text-slate-400 font-semibold flex-shrink-0">({teamLabel})</span>}
        </span>
      )}

      {isAlone && (
        <span className="text-[9px] sm:text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full flex-shrink-0 shadow-sm animate-pulse tracking-wide">
          ALONE
        </span>
      )}
    </div>
  );
};

interface MakerBadgeProps {
  trumpSuit: Suit;
  isBlueTeam?: boolean;
  isUserTeam?: boolean;
}

export const MakerBadge: React.FC<MakerBadgeProps> = ({ trumpSuit, isBlueTeam, isUserTeam }) => {
  const isTeam = isUserTeam !== undefined ? isUserTeam : Boolean(isBlueTeam);
  return (
    <div
      title={`Called Trump (${isTeam ? 'Your Team' : 'Opponents'})`}
      className={`absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded-full border-2 border-slate-900 text-[9px] font-black flex items-center space-x-0.5 shadow-md ${
        isTeam ? 'bg-cyan-500 text-slate-950' : 'bg-rose-500 text-white'
      }`}
    >
      <SuitIcon suit={trumpSuit} className="w-2.5 h-2.5" />
      <span className="hidden sm:inline">CALL</span>
    </div>
  );
};
