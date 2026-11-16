/**
 * BOWER JJ — Tactical Card Component
 * Crisp vector SVG suits, guaranteed pixel sizing, and unmistakable visual clarity.
 */

import React, { useState } from 'react';
import { Card, Suit } from '../engine/types';
import { isRightBower, isLeftBower, getEffectiveSuit } from '../engine/cards';
import { getCardBackDefinition, RARITY_META } from '../config/collectiblesCatalog';

interface CardViewProps {
  card?: Card; // If undefined, renders card back
  trumpSuit?: Suit;
  isPlayable?: boolean;
  isSelected?: boolean;
  isFacedown?: boolean;
  onClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  rotation?: number; // In degrees, for trick orientation or hand fanning
  elevated?: boolean;
  badge?: string;
  playerTag?: string; // e.g. "You", "West", "Partner", "East"
  cardBackSkin?: string;
}

// Guaranteed Pixel Dimensions (Prevents any CSS purge or 0-width collapse)
const SIZE_CONFIG = {
  xs: {
    w: 36,
    h: 52,
    rankClass: 'text-[10px] font-black',
    cornerIconClass: 'w-2.5 h-2.5',
    centerIconClass: 'w-4 h-4',
    ribbonClass: 'text-[7px] py-0.5',
    suitLabelClass: 'text-[7px]',
  },
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

// Crisp Vector SVG Suit Icons (Authentic Casino Shapes, Deep Black Spades/Clubs, Crimson Red Hearts/Diamonds)
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
        <svg viewBox="0 0 24 24" className={`${className} fill-red-600 drop-shadow-sm flex-shrink-0`}>
          <path d="M12 2L4 12l8 10 8-10L12 2z" />
        </svg>
      );
    case 'spades':
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-black drop-shadow-sm flex-shrink-0`}>
          <path d="M12 2C8.5 6.5 4 11 4 14.5a4.5 4.5 0 0 0 7.5 3.3L10.5 21h3l-1-3.2A4.5 4.5 0 0 0 20 14.5C20 11 15.5 6.5 12 2z" />
        </svg>
      );
    case 'clubs':
      return (
        <svg viewBox="0 0 24 24" className={`${className} fill-black drop-shadow-sm flex-shrink-0`}>
          <path d="M12 2a4 4 0 0 0-3.5 6A4 4 0 0 0 4.5 12a4 4 0 0 0 4 4c.6 0 1.2-.1 1.7-.4L9.5 21h5l-.7-5.4c.5.3 1.1.4 1.7.4a4 4 0 0 0 4-4 4 4 0 0 0-4-4 4 4 0 0 0-3.5-2z" />
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
  const [backImgFailed, setBackImgFailed] = useState(false);
  const cfg = SIZE_CONFIG[size];
  const backDef = getCardBackDefinition(cardBackSkin);
  const rarityMeta = RARITY_META[backDef.rarity];

  // Card Back
  if (isFacedown || !card) {
    return (
      <div
        onClick={onClick}
        className={`relative ${size === 'xs' ? 'rounded-md border' : 'rounded-xl border-2'} select-none ${
          onClick ? 'cursor-pointer active:scale-95' : ''
        } ${rarityMeta.borderClass} shadow-xl transition-transform duration-200 flex items-center justify-center overflow-hidden flex-shrink-0 bg-slate-950`}
        style={{
          width: `${cfg.w}px`,
          height: `${cfg.h}px`,
          minWidth: `${cfg.w}px`,
          minHeight: `${cfg.h}px`,
          maxWidth: `${cfg.w}px`,
          maxHeight: `${cfg.h}px`,
          ...(rotation !== 0 || elevated
            ? { transform: `rotate(${rotation}deg) ${elevated ? 'translateY(-12px)' : ''}`.trim() }
            : {}),
          boxShadow:
            size === 'xs'
              ? '0 3px 8px rgba(0,0,0,0.65)'
              : `0 6px 16px rgba(0,0,0,0.65), 0 0 12px ${backDef.accentHex}33`,
        }}
        title={`${backDef.name} Card Back`}
      >
        {!backImgFailed ? (
          <img
            src={backDef.imageUrl}
            alt={`${backDef.name} card back`}
            draggable={false}
            onError={() => setBackImgFailed(true)}
            className="w-full h-full object-cover select-none"
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center p-1"
            style={{
              background: `radial-gradient(circle at center, ${backDef.accentHex}44 0%, #090d16 100%)`,
            }}
          >
            <div className="w-6 h-6 rounded-full border border-amber-400/70 flex items-center justify-center text-[10px] font-black text-amber-200">
              JJ
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/15 rounded-[inherit]" />
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
          ${isPlayable ? 'cursor-pointer hover:-translate-y-2 active:scale-95' : 'opacity-60 cursor-not-allowed'}
          ${isSelected ? '-translate-y-3 ring-4 ring-amber-400 shadow-amber-500/60 scale-105' : ''}
          ${isPlayable && !isSelected ? 'hover:shadow-amber-500/30 hover:ring-2 hover:ring-amber-400/70' : ''}
          border-2 ${isRight ? 'border-amber-400 ring-2 ring-amber-400/70' : isLeft ? 'border-amber-300 ring-2 ring-amber-300/60' : 'border-slate-300'}
          bg-gradient-to-b from-white via-stone-50 to-stone-100 shadow-xl overflow-hidden`}
        style={{
          width: `${cfg.w}px`,
          height: `${cfg.h}px`,
          minWidth: `${cfg.w}px`,
          minHeight: `${cfg.h}px`,
          maxWidth: `${cfg.w}px`,
          maxHeight: `${cfg.h}px`,
          ...(rotation !== 0 || elevated
            ? { transform: `rotate(${rotation}deg) ${elevated ? 'translateY(-14px)' : ''}`.trim() }
            : {}),
          boxShadow: isRight
            ? '0 0 20px rgba(245, 158, 11, 0.7), 0 8px 16px rgba(0,0,0,0.5)'
            : isLeft
            ? '0 0 16px rgba(245, 158, 11, 0.45), 0 8px 16px rgba(0,0,0,0.5)'
            : '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        {/* Bower Ribbons */}
        {isRight && (
          <div className={`absolute top-0 right-0 left-0 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black ${cfg.ribbonClass} text-center tracking-wider uppercase z-10 shadow-sm leading-none`}>
            RIGHT BOWER
          </div>
        )}
        {isLeft && (
          <div className={`absolute top-0 right-0 left-0 bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-400 text-slate-950 font-black ${cfg.ribbonClass} text-center tracking-wider uppercase z-10 shadow-sm leading-none`}>
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
          <span className={`${cfg.rankClass} ${isRed ? 'text-red-600' : 'text-black'}`}>
            {card.rank}
          </span>
          <SuitIcon suit={card.suit} className={cfg.cornerIconClass} />
        </div>

        {/* Center Giant Suit Pip & Bower Indicators */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-1">
          <SuitIcon suit={card.suit} className={cfg.centerIconClass} />

          {/* Explicit Suit Label under Pip for 100% Clarity */}
          <span className={`${cfg.suitLabelClass} font-black uppercase tracking-tighter mt-0.5 ${isRed ? 'text-red-600' : 'text-black'}`}>
            {suitLabel}
          </span>

          {/* Left Bower Effective Suit Tag */}
          {isLeft && trumpSuit && (
            <span className="text-[7px] sm:text-[8px] font-black text-slate-950 bg-amber-200/95 px-1 rounded-sm mt-0.5 uppercase tracking-tight leading-tight shadow-sm">
              IS {trumpSuit.toUpperCase()}
            </span>
          )}
        </div>

        {/* Bottom Right Corner (Inverted) */}
        <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180">
          <span className={`${cfg.rankClass} ${isRed ? 'text-red-600' : 'text-black'}`}>
            {card.rank}
          </span>
          <SuitIcon suit={card.suit} className={cfg.cornerIconClass} />
        </div>

        {/* Playable Border Subtle Golden Sheen */}
        {isPlayable && (
          <div className="absolute inset-0 border border-amber-400/30 rounded-xl pointer-events-none" />
        )}
      </div>
    </div>
  );
};
