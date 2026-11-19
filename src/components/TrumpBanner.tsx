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
      className="flex items-center space-x-1 sm:space-x-1.5 px-2 xs:px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-slate-950/95 border-2 border-amber-400/90 shadow-[0_0_15px_rgba(245,158,11,0.3)] min-w-0 flex-shrink max-w-full overflow-hidden"
      title={
        callerName
          ? `Trump: ${trumpSuit.toUpperCase()} — Called by ${callerName}${teamLabel ? ` (${teamLabel})` : ''}`
          : `Trump: ${trumpSuit.toUpperCase()}`
      }
    >
      <span className="text-[9px] xs:text-[10px] sm:text-xs text-amber-400 uppercase font-black tracking-wider flex-shrink-0">
        TRUMP:
      </span>
      <SuitIcon
        suit={trumpSuit}
        className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 flex-shrink-0"
        overrideColor={trumpSuit === 'spades' ? '#e2e8f0' : undefined}
      />
      <span
        className={`hidden md:inline text-[10px] sm:text-xs font-black uppercase tracking-wider flex-shrink-0 ${
          isRedSuit ? 'text-red-400' : trumpSuit === 'clubs' ? 'text-emerald-400' : 'text-slate-100'
        }`}
      >
        {trumpSuit}
      </span>

      {callerName && (
        <span
          className={`flex items-center space-x-1 text-[9px] sm:text-[11px] font-black px-1.5 sm:px-2 py-0.5 rounded-full border shadow-sm flex-shrink-0 ${
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
          <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold flex-shrink-0">by</span>
          <span className="truncate max-w-[80px] xs:max-w-[100px] sm:max-w-[140px] md:max-w-[170px]">{callerName}</span>
          {teamLabel && <span className="hidden md:inline text-[9px] sm:text-[10px] text-slate-400 font-semibold flex-shrink-0">({teamLabel})</span>}
        </span>
      )}

      {isAlone && (
        <span className="text-[7px] sm:text-[8px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded-full flex-shrink-0 shadow-sm animate-pulse tracking-wide">
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

export interface TableCenterTrumpProps {
  trumpSuit: Suit;
  callerName?: string;
  callerTeam?: Team;
  isAlone?: boolean;
  isUserTeam?: boolean;
  leadSuit?: Suit;
  isTrickResolving?: boolean;
}

/**
 * Centered table felt emblem displaying ONLY the Trump suit symbol in the middle of the table arena.
 * Pure symbol design with no text labels, ensuring full visibility even when 3 or 4 cards are played.
 */
export const TableCenterTrump: React.FC<TableCenterTrumpProps> = ({
  trumpSuit,
  isTrickResolving,
}) => {
  if (isTrickResolving) return null;

  return (
    <div
      data-testid="table-center-trump"
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-10 flex items-center justify-center transition-all duration-200"
    >
      <div
        title={`Trump: ${trumpSuit.toUpperCase()}`}
        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-950/95 border-2 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] flex items-center justify-center backdrop-blur-xs transition-transform duration-150"
      >
        <SuitIcon
          suit={trumpSuit}
          className="w-5 h-5 sm:w-5.5 sm:h-5.5 drop-shadow-sm"
          overrideColor={trumpSuit === 'spades' ? '#f8fafc' : undefined}
        />
      </div>
    </div>
  );
};
