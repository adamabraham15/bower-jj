/**
 * BOWER JJ — Tactical Card Component
 * Crisp vector SVG suits, guaranteed pixel sizing, and unmistakable visual clarity.
 */

import React from 'react';
import { Card, Suit } from '../engine/types';
import { isRightBower, isLeftBower, getEffectiveSuit } from '../engine/cards';

interface CardViewProps {
  card?: Card; // If undefined, renders card back
  trumpSuit?: Suit;
  isPlayable?: boolean;
  isSelected?: boolean;
  isFacedown?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  rotation?: number; // In degrees, for trick orientation or hand fanning
  elevated?: boolean;
  badge?: string;
  playerTag?: string; // e.g. "You", "West", "Partner", "East"
  cardBackSkin?: string;
}

const CARD_BACK_STYLES: Record<string, { bg: string; border: string; accent: string }> = {
  classic_blue: {
    bg: 'radial-gradient(circle at center, #1e3a8a 0%, #090d16 100%)',
    border: 'border-amber-500/50',
    accent: 'text-amber-300 border-amber-400/70',
  },
  crimson_royal: {
    bg: 'radial-gradient(circle at center, #881337 0%, #2e0505 100%)',
    border: 'border-amber-400/60',
    accent: 'text-amber-300 border-amber-400/80',
  },
  neon_cyber: {
    bg: 'linear-gradient(135deg, #09090b 0%, #1e1b4b 50%, #0369a1 100%)',
    border: 'border-cyan-400/70',
    accent: 'text-cyan-300 border-cyan-400',
  },
  golden_bower: {
    bg: 'radial-gradient(circle at center, #d97706 0%, #78350f 50%, #1c1917 100%)',
    border: 'border-yellow-300',
    accent: 'text-yellow-200 border-yellow-300',
  },
  midnight_black: {
    bg: 'radial-gradient(circle at center, #18181b 0%, #050505 100%)',
    border: 'border-emerald-500/60',
    accent: 'text-emerald-300 border-emerald-400',
  },
};

// Guaranteed Pixel Dimensions (Prevents any CSS purge or 0-width collapse)
const SIZE_CONFIG = {
  sm: {
    w: 64,
    h: 92,
    rankClass: 'text-sm font-black',
    cornerIconClass: 'w-3.5 h-3.5',
    centerIconClass: 'w-7 h-7',
    ribbonClass: 'text-[8px] py-0.5',
    suitLabelClass: 'text-[8px]',
  },
  md: {
    w: 80,
    h: 116,
    rankClass: 'text-base font-black',
    cornerIconClass: 'w-4 h-4',
    centerIconClass: 'w-10 h-10',
    ribbonClass: 'text-[9px] py-0.5',
    suitLabelClass: 'text-[9px]',
  },
  lg: {
    w: 100,
    h: 144,
    rankClass: 'text-lg font-black',
    cornerIconClass: 'w-5 h-5',
    centerIconClass: 'w-12 h-12',
    ribbonClass: 'text-[10px] py-1',
    suitLabelClass: 'text-[10px]',
  },
};

// Crisp Vector SVG Suit Icons
export const SuitIcon: React.FC<{ suit: Suit; className?: string }> = ({ suit, className = 'w-4 h-4' }) => {
  switch (suit) {
    case 'hearts':
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-red-600 drop-shadow-sm flex-shrink-0`}>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case 'diamonds':
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-amber-600 drop-shadow-sm flex-shrink-0`}>
          <path d="M12 2L3.5 12l8.5 10 8.5-10L12 2z" />
        </svg>
      );
    case 'spades':
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-slate-900 drop-shadow-sm flex-shrink-0`}>
          <path d="M12 2C8.2 6.2 4 10.5 4 14.2a5 5 0 0 0 9 3v2.8h-2.5v2h7v-2H15v-2.8a5 5 0 0 0 9-3c0-3.7-4.2-8-8-12.2z" />
        </svg>
      );
    case 'clubs':
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-emerald-800 drop-shadow-sm flex-shrink-0`}>
          <path d="M12 2.5a4 4 0 0 0-3.8 2.7A4 4 0 0 0 4 8.5a4 4 0 0 0 4 4c.4 0 .8-.1 1.2-.2A4 4 0 0 0 11 16.2v2.8H8.5v2h7v-2H13v-2.8a4 4 0 0 0 1.8-3.9c.4.1.8.2 1.2.2a4 4 0 0 0 4-4 4 4 0 0 0-4.2-3.3A4 4 0 0 0 12 2.5z" />
        </svg>
      );
  }
};

export const CardView: React.FC<CardViewProps> = ({
  card,
  trumpSuit,
  isPlayable = true,
  isSelected = false,
  isFacedown = false,
  onClick,
  size = 'md',
  rotation = 0,
  elevated = false,
  badge,
  playerTag,
  cardBackSkin = 'classic_blue',
}) => {
  const cfg = SIZE_CONFIG[size];
  const backStyle = CARD_BACK_STYLES[cardBackSkin] || CARD_BACK_STYLES.classic_blue;

  // Card Back
  if (isFacedown || !card) {
    return (
      <div
        onClick={onClick}
        className={`relative rounded-xl select-none cursor-pointer border-2 ${backStyle.border} shadow-xl transition-transform duration-200 active:scale-95 flex items-center justify-center overflow-hidden flex-shrink-0`}
        style={{
          width: `${cfg.w}px`,
          height: `${cfg.h}px`,
          minWidth: `${cfg.w}px`,
          minHeight: `${cfg.h}px`,
          maxWidth: `${cfg.w}px`,
          maxHeight: `${cfg.h}px`,
          transform: `rotate(${rotation}deg) ${elevated ? 'translateY(-12px)' : ''}`,
          background: backStyle.bg,
          boxShadow: '0 4px 12px rgba(0,0,0,0.6), inset 0 0 10px rgba(245, 158, 11, 0.2)',
        }}
      >
        <div className="absolute inset-1 border border-amber-400/30 rounded-lg flex flex-col items-center justify-center p-1 bg-slate-900/40">
          <div className={`w-7 h-7 rounded-full border-2 ${backStyle.accent} flex items-center justify-center text-xs font-black shadow-inner`}>
            JJ
          </div>
          <div className="text-[9px] font-mono tracking-widest text-amber-400 font-bold mt-1 uppercase">
            Bower
          </div>
        </div>
      </div>
    );
  }

  const isRight = isRightBower(card, trumpSuit);
  const isLeft = isLeftBower(card, trumpSuit);
  const effectiveSuit = getEffectiveSuit(card, trumpSuit);

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitLabel = card.suit.toUpperCase();

  return (
    <div
      className="flex flex-col items-center select-none flex-shrink-0"
      style={{
        width: `${cfg.w}px`,
        minWidth: `${cfg.w}px`,
      }}
    >
      {/* Player Tag */}
      {playerTag && (
        <span className="text-[10px] font-black text-amber-300 bg-slate-900/90 px-2 py-0.5 rounded-full border border-amber-400/50 mb-1 shadow-md whitespace-nowrap">
          {playerTag}
        </span>
      )}

      {/* Card Body */}
      <div
        onClick={isPlayable ? onClick : undefined}
        className={`relative rounded-xl transition-all duration-200 ease-out flex-shrink-0
          ${isPlayable ? 'cursor-pointer hover:-translate-y-2 active:scale-95' : 'opacity-65 cursor-not-allowed'}
          ${isSelected ? '-translate-y-3 ring-4 ring-amber-400 shadow-amber-500/60 scale-105' : ''}
          ${isPlayable && !isSelected ? 'hover:shadow-cyan-500/50 hover:ring-2 hover:ring-cyan-400' : ''}
          border-2 ${isRight ? 'border-amber-400 ring-2 ring-amber-400/60' : isLeft ? 'border-cyan-400 ring-2 ring-cyan-400/60' : 'border-slate-300'}
          bg-gradient-to-b from-white via-slate-50 to-slate-200 shadow-xl overflow-hidden`}
        style={{
          width: `${cfg.w}px`,
          height: `${cfg.h}px`,
          minWidth: `${cfg.w}px`,
          minHeight: `${cfg.h}px`,
          maxWidth: `${cfg.w}px`,
          maxHeight: `${cfg.h}px`,
          transform: `rotate(${rotation}deg) ${elevated ? 'translateY(-14px)' : ''}`,
          boxShadow: isRight
            ? '0 0 20px rgba(245, 158, 11, 0.7), 0 8px 16px rgba(0,0,0,0.5)'
            : isLeft
            ? '0 0 16px rgba(56, 189, 248, 0.7), 0 8px 16px rgba(0,0,0,0.5)'
            : '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        {/* Bower Ribbons */}
        {isRight && (
          <div className={`absolute top-0 right-0 left-0 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black ${cfg.ribbonClass} text-center tracking-wider uppercase z-10 shadow-sm leading-none`}>
            RIGHT BOWER
          </div>
        )}
        {isLeft && (
          <div className={`absolute top-0 right-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-400 text-slate-950 font-black ${cfg.ribbonClass} text-center tracking-wider uppercase z-10 shadow-sm leading-none`}>
            LEFT BOWER
          </div>
        )}
        {badge && !isRight && !isLeft && (
          <div className={`absolute top-0 right-0 left-0 bg-slate-800 text-amber-300 font-bold ${cfg.ribbonClass} text-center tracking-wider uppercase z-10 leading-none`}>
            {badge}
          </div>
        )}

        {/* Top Left Corner */}
        <div className={`absolute top-1 left-1.5 flex flex-col items-center leading-none ${isRight || isLeft || badge ? 'mt-3 sm:mt-3.5' : ''}`}>
          <span className={`${cfg.rankClass} ${isRed ? 'text-red-600' : 'text-slate-950'}`}>
            {card.rank}
          </span>
          <SuitIcon suit={card.suit} className={cfg.cornerIconClass} />
        </div>

        {/* Center Giant Suit Pip & Bower Indicators */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-1">
          <SuitIcon suit={card.suit} className={cfg.centerIconClass} />

          {/* Explicit Suit Label under Pip for 100% Clarity */}
          <span className={`${cfg.suitLabelClass} font-black uppercase tracking-tighter mt-0.5 ${isRed ? 'text-red-700' : 'text-slate-800'}`}>
            {suitLabel}
          </span>

          {/* Left Bower Effective Suit Tag */}
          {isLeft && trumpSuit && (
            <span className="text-[7px] sm:text-[8px] font-black text-cyan-900 bg-cyan-200/95 px-1 rounded-sm mt-0.5 uppercase tracking-tight leading-tight">
              IS {trumpSuit.toUpperCase()}
            </span>
          )}
        </div>

        {/* Bottom Right Corner (Inverted) */}
        <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
          <span className={`${cfg.rankClass} ${isRed ? 'text-red-600' : 'text-slate-950'}`}>
            {card.rank}
          </span>
          <SuitIcon suit={card.suit} className={cfg.cornerIconClass} />
        </div>

        {/* Playable Border Pulse */}
        {isPlayable && (
          <div className="absolute inset-0 border-2 border-emerald-500/50 rounded-xl pointer-events-none" />
        )}
      </div>
    </div>
  );
};
