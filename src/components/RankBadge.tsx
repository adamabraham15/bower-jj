/**
 * BOWER JJ — Competitive Rank Badges
 * 6 Prestigious Tiers: 9, 10, Q, K, A, BOWER JJ
 */

import React from 'react';

export type RankTier = '9' | '10' | 'Q' | 'K' | 'A' | 'BOWER_JJ';

interface RankBadgeProps {
  tier: RankTier;
  points?: number; // 0 to 100
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
}

export const RANK_INFO: Record<RankTier, { name: string; title: string; color: string; border: string; glow: string; bg: string }> = {
  '9': {
    name: '9 Rank',
    title: 'Recruit',
    color: '#cd7f32', // Bronze
    border: '#a0522d',
    glow: 'rgba(205, 127, 50, 0.4)',
    bg: 'linear-gradient(135deg, #3d2614, #1a0f08)',
  },
  '10': {
    name: '10 Rank',
    title: 'Challenger',
    color: '#c0c0c0', // Silver
    border: '#e0e0e0',
    glow: 'rgba(192, 192, 192, 0.4)',
    bg: 'linear-gradient(135deg, #374151, #111827)',
  },
  'Q': {
    name: 'Q Rank',
    title: 'Queen Elite',
    color: '#10b981', // Emerald
    border: '#34d399',
    glow: 'rgba(16, 185, 129, 0.45)',
    bg: 'linear-gradient(135deg, #064e3b, #022c22)',
  },
  'K': {
    name: 'K Rank',
    title: 'King Sovereign',
    color: '#ef4444', // Ruby
    border: '#f87171',
    glow: 'rgba(239, 68, 68, 0.45)',
    bg: 'linear-gradient(135deg, #7f1d1d, #450a0a)',
  },
  'A': {
    name: 'A Rank',
    title: 'Ace Master',
    color: '#8b5cf6', // Amethyst / Violet
    border: '#a78bfa',
    glow: 'rgba(139, 92, 246, 0.5)',
    bg: 'linear-gradient(135deg, #4c1d95, #2e1065)',
  },
  'BOWER_JJ': {
    name: 'BOWER JJ',
    title: 'Supreme Bower',
    color: '#fbbf24', // Radiant Gold + Cyan
    border: '#f59e0b',
    glow: 'rgba(251, 191, 36, 0.7)',
    bg: 'linear-gradient(135deg, #b45309, #083344)',
  },
};

export const RankBadge: React.FC<RankBadgeProps> = ({
  tier,
  points = 0,
  size = 'md',
  showLabel = true,
}) => {
  const info = RANK_INFO[tier] || RANK_INFO['9'];

  const sizePixels = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  }[size];

  const fontSize = {
    sm: 11,
    md: 16,
    lg: 22,
    xl: 32,
  }[size];

  return (
    <div className="flex flex-col items-center select-none">
      <div
        className="relative flex items-center justify-center rounded-2xl transition-transform duration-300 hover:scale-105"
        style={{
          width: sizePixels,
          height: sizePixels,
          background: info.bg,
          border: `2px solid ${info.border}`,
          boxShadow: `0 0 16px ${info.glow}, inset 0 1px 2px rgba(255,255,255,0.3)`,
        }}
      >
        {/* Tier symbol / monogram */}
        <span
          className="font-black tracking-tight"
          style={{
            fontSize,
            color: info.color,
            textShadow: `0 0 8px ${info.glow}`,
          }}
        >
          {tier === 'BOWER_JJ' ? 'JJ' : tier}
        </span>

        {tier === 'BOWER_JJ' && (
          <div className="absolute -top-2 text-amber-300 text-xs animate-bounce">
            👑
          </div>
        )}
      </div>

      {showLabel && (
        <div className="mt-1 text-center">
          <div className="text-xs font-bold leading-none" style={{ color: info.color }}>
            {info.name}
          </div>
          {points !== undefined && (
            <div className="text-[10px] text-gray-400 font-mono mt-0.5">
              {tier === 'BOWER_JJ' ? `${points} LP` : `${points}/100`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
