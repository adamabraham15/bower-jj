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
}

export const TrumpBanner: React.FC<TrumpBannerProps> = ({
  trumpSuit,
  callerName,
  callerTeam,
  isAlone,
}) => {
  const isRedSuit = trumpSuit === 'hearts' || trumpSuit === 'diamonds';
  const isBlueTeam = callerTeam === 0;
  const teamLabel = callerTeam === undefined ? undefined : isBlueTeam ? 'Blue' : 'Red';

  return (
    <div
      className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-3 py-1 rounded-full bg-slate-950 border border-amber-400 shadow-md max-w-[46vw] sm:max-w-none"
      title={
        callerName
          ? `Trump: ${trumpSuit.toUpperCase()} — Called by ${callerName}${teamLabel ? ` (Team ${teamLabel})` : ''}`
          : `Trump: ${trumpSuit.toUpperCase()}`
      }
    >
      <span className="hidden md:inline text-[10px] text-amber-400 uppercase font-black tracking-wide">
        TRUMP:
      </span>
      <SuitIcon suit={trumpSuit} className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
      <span
        className={`text-[10px] sm:text-xs font-black uppercase tracking-wider flex-shrink-0 ${
          isRedSuit ? 'text-red-400' : 'text-slate-100'
        }`}
      >
        {trumpSuit}
      </span>

      {callerName && (
        <span
          className={`flex items-center space-x-1 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full border min-w-0 ${
            callerTeam === undefined
              ? 'bg-slate-800 border-slate-700 text-gray-200'
              : isBlueTeam
              ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300'
              : 'bg-red-500/15 border-red-400/50 text-red-300'
          }`}
        >
          {teamLabel && (
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isBlueTeam ? 'bg-cyan-400' : 'bg-red-400'
              }`}
            />
          )}
          <span className="hidden sm:inline flex-shrink-0">by</span>
          <span className="truncate max-w-[64px] sm:max-w-[130px]">{callerName}</span>
          {teamLabel && <span className="hidden sm:inline flex-shrink-0">({teamLabel})</span>}
        </span>
      )}

      {isAlone && (
        <span className="text-[8px] bg-red-600 text-white font-black px-1.5 rounded-sm flex-shrink-0 animate-pulse">
          ALONE
        </span>
      )}
    </div>
  );
};

interface MakerBadgeProps {
  trumpSuit: Suit;
  isBlueTeam: boolean;
}

export const MakerBadge: React.FC<MakerBadgeProps> = ({ trumpSuit, isBlueTeam }) => {
  return (
    <div
      title={`Called Trump (${isBlueTeam ? 'Team Blue' : 'Team Red'})`}
      className={`absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded-full border-2 border-slate-900 text-[9px] font-black flex items-center space-x-0.5 shadow-md ${
        isBlueTeam ? 'bg-cyan-500 text-slate-950' : 'bg-red-500 text-white'
      }`}
    >
      <SuitIcon suit={trumpSuit} className="w-2.5 h-2.5" />
      <span className="hidden sm:inline">CALL</span>
    </div>
  );
};
