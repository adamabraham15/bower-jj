import React from 'react';
import { Card, GamePhase } from '../engine/types';
import { formatCardName } from '../engine/cards';
import { AvatarPortrait } from './AvatarPortrait';
import { CardView, SuitIcon } from './CardView';

/**
 * Returns true when a player seat is actively making a turn decision
 * (calling trump in Round 1/2, discarding as dealer, or playing a card).
 */
export function isActiveDecisionPhase(phase: GamePhase): boolean {
  return (
    phase === 'bidding_round_1' ||
    phase === 'bidding_round_2' ||
    phase === 'dealer_discard' ||
    phase === 'playing'
  );
}

/**
 * Prominent pill badge placed cleanly above the current dealer's table avatar.
 */
export const DealerAvatarBadge: React.FC = () => (
  <div
    title="Current Dealer"
    className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 px-1.5 py-0.5 rounded-full bg-amber-400 border-2 border-slate-900 text-slate-950 font-black text-[8px] sm:text-[9px] leading-none tracking-wider shadow-lg shadow-amber-500/30 uppercase whitespace-nowrap"
  >
    DEALER
  </div>
);

interface ModalDealerBannerProps {
  dealerName: string;
  dealerAvatar?: string;
  isSelfDealer: boolean;
  isPartnerDealer: boolean;
}

/**
 * Displays who currently holds the deal right inside Round 1 / Round 2 bidding overlays,
 * since the modal backdrop can obscure table badges on smaller viewports.
 */
export const ModalDealerBanner: React.FC<ModalDealerBannerProps> = ({
  dealerName,
  dealerAvatar,
  isSelfDealer,
  isPartnerDealer,
}) => {
  const containerTheme = isSelfDealer
    ? 'bg-amber-500/15 border-amber-400/60 text-amber-100'
    : isPartnerDealer
    ? 'bg-emerald-500/10 border-emerald-400/50 text-emerald-100'
    : 'bg-rose-500/10 border-rose-400/50 text-rose-100';

  const relationTheme = isSelfDealer
    ? 'bg-amber-400/20 text-amber-300'
    : isPartnerDealer
    ? 'bg-emerald-400/20 text-emerald-300'
    : 'bg-rose-400/20 text-rose-300';

  return (
    <div
      className={`w-full px-3 py-2 rounded-2xl border flex items-center justify-between gap-2 text-xs ${containerTheme}`}
    >
      <div className="flex items-center space-x-2 min-w-0">
        <span className="px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wider flex-shrink-0 shadow-sm">
          Dealer
        </span>
        {dealerAvatar && <AvatarPortrait avatarId={dealerAvatar} size="xs" className="flex-shrink-0" />}
        <span className="font-bold truncate">{isSelfDealer ? 'You' : dealerName}</span>
      </div>
      <span
        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${relationTheme}`}
      >
        {isSelfDealer ? 'You Deal' : isPartnerDealer ? 'Partner' : 'Opponent'}
      </span>
    </div>
  );
};

interface GoAloneControlProps {
  allowAloneCalls: boolean;
  checked: boolean;
  forcedCanadianLoner?: boolean;
  onChange: (checked: boolean) => void;
  pointsLabel?: string;
}

/**
 * Shared Go Alone toggle used in bidding overlays. Automatically checks and locks the checkbox
 * with an explanation banner when Canadian Loner forces going alone on a partner order-up.
 */
export const GoAloneControl: React.FC<GoAloneControlProps> = ({
  allowAloneCalls,
  checked,
  forcedCanadianLoner = false,
  onChange,
  pointsLabel = ' (+4 Pts)',
}) => {
  if (!allowAloneCalls) return null;

  return (
    <div className="w-full flex flex-col items-center space-y-2">
      {forcedCanadianLoner && (
        <div className="w-full p-2.5 bg-amber-500/15 border border-amber-400/60 rounded-xl text-[11px] text-amber-200 text-center font-bold leading-snug">
          🇨🇦 Canadian Loner: Ordering up your partner automatically means you{' '}
          <strong className="text-amber-300">Go Alone!</strong> Your partner sits this hand out.
        </div>
      )}

      <label
        className={`flex items-center justify-center space-x-2 px-3 py-1.5 rounded-xl border transition-colors ${
          forcedCanadianLoner
            ? 'bg-amber-500/15 border-amber-400/70 cursor-not-allowed'
            : 'bg-slate-800/80 border-slate-700 hover:border-amber-400 cursor-pointer'
        }`}
      >
        <input
          type="checkbox"
          checked={forcedCanadianLoner || checked}
          disabled={forcedCanadianLoner}
          onChange={e => onChange(e.target.checked)}
          className="rounded text-amber-500 accent-amber-400 focus:ring-0 disabled:opacity-100"
        />
        <span className="text-xs font-bold text-amber-300">Go Alone! 🚀{pointsLabel}</span>
        {forcedCanadianLoner && (
          <span className="text-[9px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md">
            Auto
          </span>
        )}
      </label>
    </div>
  );
};

/**
 * Flashing amber turn indicator placed next to the player whose turn it is to bid or play.
 */
export const TurnActiveDot: React.FC = () => (
  <span title="Active Turn" className="relative inline-flex h-2 w-2 flex-shrink-0">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-90" />
    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 shadow-sm shadow-amber-400/80" />
  </span>
);

interface CenterKittyDisplayProps {
  phase: GamePhase;
  upCard?: Card;
  canCallTurnedDownSuit?: boolean;
}

/**
 * Displays either the active Turned-Up Card (Round 1) or the Turned-Down Card (Round 2)
 * in the center of the table felt.
 */
export const CenterKittyDisplay: React.FC<CenterKittyDisplayProps> = ({
  phase,
  upCard,
  canCallTurnedDownSuit = false,
}) => {
  if (!upCard) return null;

  if (phase === 'bidding_round_1') {
    return (
      <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
        <span className="text-[11px] text-amber-300 font-black uppercase mb-1.5 tracking-wider bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-amber-500/40">
          Turned-Up Card
        </span>
        <CardView card={upCard} size="md" isPlayable={false} />
        <span className="mt-1 text-[10px] font-bold text-amber-200/90 bg-slate-950/85 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase">
          {formatCardName(upCard)} • {upCard.suit.toUpperCase()}
        </span>
      </div>
    );
  }

  if (phase === 'bidding_round_2') {
    return (
      <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        <span className="text-[11px] text-rose-300 font-black uppercase mb-1.5 tracking-wider bg-slate-900/90 px-2.5 py-0.5 rounded-full border border-rose-500/50 shadow-md">
          Turned Down
        </span>
        <CardView card={upCard} size="md" isPlayable={false} badge="TURNED DOWN" />
        <span className="mt-1.5 text-[10px] font-bold text-rose-200/90 bg-slate-950/85 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
          {formatCardName(upCard)}
          {!canCallTurnedDownSuit ? ' • Suit Blocked' : ' • Passed'}
        </span>
      </div>
    );
  }

  return null;
};

interface TurnedDownNoticeChipProps {
  upCard?: Card;
  canCallTurnedDownSuit?: boolean;
}

/**
 * Compact banner inside Round 2 bidding modals showing which card was turned down in Round 1.
 */
export const TurnedDownNoticeChip: React.FC<TurnedDownNoticeChipProps> = ({
  upCard,
  canCallTurnedDownSuit = false,
}) => {
  if (!upCard) return null;

  return (
    <div className="w-full px-3 py-1.5 rounded-xl bg-rose-950/50 border border-rose-500/40 flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center space-x-1.5 min-w-0">
        <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 flex-shrink-0">
          Turned Down:
        </span>
        <SuitIcon suit={upCard.suit} className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-black text-white truncate">{formatCardName(upCard)}</span>
      </div>
      {!canCallTurnedDownSuit && (
        <span className="text-[9px] font-bold uppercase tracking-wide text-rose-300/90 flex-shrink-0">
          Blocked
        </span>
      )}
    </div>
  );
};

interface DealerDeckStackProps {
  relativePos: 'top' | 'left' | 'right' | 'bottom';
  cardBackSkin?: string;
  inline?: boolean;
}

const DEALER_DECK_POSITION_CLASSES: Record<'top' | 'left' | 'right' | 'bottom', string> = {
  top: 'left-full ml-4 sm:ml-5 top-1/2 -translate-y-1/2',
  bottom: 'left-full ml-4 sm:ml-5 top-1/2 -translate-y-1/2',
  left: 'top-full mt-1.5 sm:mt-2 left-1/2 -translate-x-1/2',
  right: 'top-full mt-1.5 sm:mt-2 left-1/2 -translate-x-1/2',
};

/**
 * Renders the remaining facedown kitty deck next to the current dealer seat so the deck
 * physically moves around the table with the deal without overlapping badges or side hands.
 */
export const DealerDeckStack: React.FC<DealerDeckStackProps> = ({
  relativePos,
  cardBackSkin = 'classic_blue',
  inline = false,
}) => (
  <div
    title="Dealer's Kitty Deck"
    className={`pointer-events-none ${
      inline ? 'relative flex-shrink-0' : `absolute ${DEALER_DECK_POSITION_CLASSES[relativePos]}`
    } flex flex-col items-center z-10 animate-in fade-in zoom-in-95 duration-200 scale-90 sm:scale-100`}
  >
    <div className="relative w-[40px] h-[56px] flex items-end justify-start">
      <div className="absolute top-0 left-1 opacity-75">
        <CardView isFacedown size="xs" cardBackSkin={cardBackSkin} />
      </div>
      <div className="absolute top-0.5 left-0.5 opacity-90">
        <CardView isFacedown size="xs" cardBackSkin={cardBackSkin} />
      </div>
      <div className="relative z-10 top-1 left-0">
        <CardView isFacedown size="xs" cardBackSkin={cardBackSkin} />
      </div>
    </div>
    <span className="mt-0.5 px-1.5 py-0.5 rounded-full bg-slate-900/95 border border-amber-400/60 text-[8px] font-black text-amber-300 tracking-wider uppercase shadow-md whitespace-nowrap">
      DECK
    </span>
  </div>
);

interface LeadSuitBadgeProps {
  leadSuit: Card['suit'];
  showFollowHint?: boolean;
}

/**
 * High-contrast Lead Suit indicator displayed cleanly above the active trick cards.
 */
export const LeadSuitBadge: React.FC<LeadSuitBadgeProps> = ({
  leadSuit,
  showFollowHint = false,
}) => (
  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-1.5 bg-slate-900/95 border border-slate-600/80 px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
    <span className="text-[10px] text-gray-400 font-bold uppercase">Lead:</span>
    <SuitIcon suit={leadSuit} className="w-3.5 h-3.5" />
    <span
      className={`text-[11px] font-black uppercase ${
        leadSuit === 'hearts' || leadSuit === 'diamonds'
          ? 'text-red-400'
          : leadSuit === 'clubs'
          ? 'text-emerald-400'
          : 'text-white'
      }`}
    >
      {leadSuit}
    </span>
    {showFollowHint && (
      <span className="text-[9px] text-gray-400 hidden sm:inline">(Follow suit!)</span>
    )}
  </div>
);

export interface TrickProgressInfo {
  currentTrick: number;
  totalTricks: number;
  completedTricks: number;
  team1Tricks: number;
  team2Tricks: number;
  isBiddingOrDiscard: boolean;
  isHandComplete: boolean;
}

/**
 * Computes current trick progress (1..5) and team tricks won for the active hand.
 */
export function computeTrickProgress(
  tricksWon: [number, number] | number[],
  phase: GamePhase
): TrickProgressInfo {
  const team1Tricks = Math.max(0, Number(tricksWon?.[0] ?? 0));
  const team2Tricks = Math.max(0, Number(tricksWon?.[1] ?? 0));
  const completedTricks = Math.min(5, team1Tricks + team2Tricks);
  const isBiddingOrDiscard =
    phase === 'dealing' ||
    phase === 'bidding_round_1' ||
    phase === 'bidding_round_2' ||
    phase === 'dealer_discard';
  const isHandComplete =
    phase === 'hand_scored' || phase === 'game_over' || completedTricks >= 5;
  const currentTrick = isHandComplete ? 5 : Math.min(5, Math.max(1, completedTricks + 1));

  return {
    currentTrick,
    totalTricks: 5,
    completedTricks,
    team1Tricks,
    team2Tricks,
    isBiddingOrDiscard,
    isHandComplete,
  };
}

interface TrickProgressStripProps {
  tricksWon: [number, number] | number[];
  phase: GamePhase;
  yourTeam?: 0 | 1;
}

/**
 * Compact, high-visibility trick counter strip designed for mobile and desktop gameplay.
 * Positioned directly beneath the top header bar so it never overlaps cards, avatars, or controls.
 */
export const TrickProgressStrip: React.FC<TrickProgressStripProps> = ({
  tricksWon,
  phase,
  yourTeam = 0,
}) => {
  const {
    currentTrick,
    totalTricks,
    completedTricks,
    team1Tricks,
    team2Tricks,
    isBiddingOrDiscard,
    isHandComplete,
  } = computeTrickProgress(tricksWon, phase);

  return (
    <div
      role="status"
      aria-label={`Trick ${currentTrick} of ${totalTricks}. Team 1: ${team1Tricks} tricks, Team 2: ${team2Tricks} tricks`}
      className="w-full px-2.5 sm:px-4 py-1 bg-slate-900/90 border-b border-slate-800/90 flex items-center justify-between gap-1.5 sm:gap-3 z-25 flex-shrink-0 text-[10px] sm:text-xs select-none"
    >
      {/* Team 1 (Blue) Tricks Won */}
      <div
        className={`flex items-center space-x-1 sm:space-x-1.5 px-2 py-0.5 rounded-full border transition-all ${
          yourTeam === 0
            ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-200'
            : 'bg-slate-950/80 border-cyan-500/30 text-cyan-300'
        }`}
      >
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-cyan-400 flex-shrink-0" />
        <span className="font-bold whitespace-nowrap">
          <span className="sm:hidden">Team 1: </span>
          <span className="hidden sm:inline">Team 1 (Blue): </span>
          <strong className="font-black text-white">{team1Tricks}</strong>{' '}
          {team1Tricks === 1 ? 'trick' : 'tricks'}
        </span>
      </div>

      {/* Center: Trick X of 5 + Pips */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-amber-500/35 shadow-inner">
        <span className="font-black text-amber-300 tracking-wide uppercase whitespace-nowrap">
          Trick {currentTrick} of {totalTricks}
        </span>
        {isBiddingOrDiscard ? (
          <span className="hidden xs:inline text-[9px] font-bold text-gray-400 uppercase">
            • Bidding
          </span>
        ) : (
          <div className="flex items-center space-x-0.5 sm:space-x-1" aria-hidden="true">
            {Array.from({ length: totalTricks }).map((_, idx) => {
              const trickIndex = idx + 1;
              const isCompleted = trickIndex <= completedTricks;
              const isCurrent = !isHandComplete && trickIndex === currentTrick;
              return (
                <span
                  key={idx}
                  className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all ${
                    isCompleted
                      ? 'bg-emerald-400 shadow-xs shadow-emerald-400/70'
                      : isCurrent
                      ? 'bg-amber-400 ring-2 ring-amber-400/40 animate-pulse'
                      : 'bg-slate-700'
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Team 2 (Red) Tricks Won */}
      <div
        className={`flex items-center space-x-1 sm:space-x-1.5 px-2 py-0.5 rounded-full border transition-all ${
          yourTeam === 1
            ? 'bg-red-950/80 border-red-500/40 text-red-200'
            : 'bg-slate-950/80 border-red-500/30 text-red-300'
        }`}
      >
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-400 flex-shrink-0" />
        <span className="font-bold whitespace-nowrap">
          <span className="sm:hidden">Team 2: </span>
          <span className="hidden sm:inline">Team 2 (Red): </span>
          <strong className="font-black text-white">{team2Tricks}</strong>{' '}
          {team2Tricks === 1 ? 'trick' : 'tricks'}
        </span>
      </div>
    </div>
  );
};
