/**
 * BOWER JJ — Sovereign Hierarchy Competitive Rank Badges (Season 2)
 * 6 Prestigious Euchre Tiers (9, 10, Q, K, A, BOWER_JJ) × 3 Sub-Divisions (III, II, I)
 * Features bespoke illustrated emblems, custom SVG heraldic frames, division gems & promo series indicators.
 */

import React from 'react';

export type RankTier = '9' | '10' | 'Q' | 'K' | 'A' | 'BOWER_JJ';
export type RankDivision = 'III' | 'II' | 'I' | 'APEX' | 'MASTER' | 'GRANDMASTER' | 'CHALLENGER';
export type ApexDivision = 'MASTER' | 'GRANDMASTER' | 'CHALLENGER';

export interface ApexTierMeta {
  division: ApexDivision;
  name: string;
  compactName: string;
  minLp: number;
  nextLp: number | null;
  color: string;
  accentColor: string;
  border: string;
  glow: string;
  crestGradient: string;
  icon: string;
}

export const APEX_TIER_CONFIG: Record<ApexDivision, ApexTierMeta> = {
  MASTER: {
    division: 'MASTER',
    name: 'JJ Master',
    compactName: 'Master',
    minLp: 0,
    nextLp: 250,
    color: '#c084fc',
    accentColor: '#e879f9',
    border: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.75)',
    crestGradient: 'from-purple-600 via-violet-500 to-indigo-500',
    icon: '🔮',
  },
  GRANDMASTER: {
    division: 'GRANDMASTER',
    name: 'JJ Grandmaster',
    compactName: 'Grandmaster',
    minLp: 250,
    nextLp: 500,
    color: '#f87171',
    accentColor: '#fb7185',
    border: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.8)',
    crestGradient: 'from-rose-600 via-red-500 to-amber-500',
    icon: '⚔️',
  },
  CHALLENGER: {
    division: 'CHALLENGER',
    name: 'JJ Challenger',
    compactName: 'Challenger',
    minLp: 500,
    nextLp: null,
    color: '#fbbf24',
    accentColor: '#22d3ee',
    border: '#f59e0b',
    glow: 'rgba(251, 191, 36, 0.9)',
    crestGradient: 'from-amber-500 via-yellow-300 to-cyan-400',
    icon: '👑',
  },
};

export interface RankTierMetadata {
  tier: RankTier;
  weight: number;
  name: string;
  shortName: string;
  monogram: string;
  title: string;
  suitSymbol: string;
  lore: string;
  rewardSummary: string;
  promotionSeals: number;
  imageUrl: string;
  color: string;
  accentColor: string;
  border: string;
  glow: string;
  bg: string;
  badgeShape: 'shield' | 'winged' | 'medallion' | 'royal_crest' | 'octagon' | 'apex_reliquary';
}

export interface RankDivisionInfo {
  division: RankDivision;
  divisionNumber: 1 | 2 | 3 | 4;
  starsFilled: 1 | 2 | 3;
  nextMilestoneLp: number;
  lpToNextMilestone: number;
  lpToNextTier: number;
  divisionProgressPercent: number;
  isPromoSeries: boolean;
  fullRankName: string;
  compactRankName: string;
}

export const RANK_TIER_ORDER: RankTier[] = ['9', '10', 'Q', 'K', 'A', 'BOWER_JJ'];

export const RANK_INFO: Record<RankTier, RankTierMetadata> = {
  '9': {
    tier: '9',
    weight: 1,
    name: 'Copper Squire',
    shortName: 'Squire',
    monogram: 'S',
    title: 'Tavern Trickster',
    suitSymbol: '♠',
    lore: 'Forged in candlelit backroom tables where initiates earn their spurs in copper and blood.',
    rewardSummary: 'Starter Crest • Iron Rim Card Back',
    promotionSeals: 50,
    imageUrl: '/assets/ranks/rank_tier_squire.jpg',
    color: '#e08a44',
    accentColor: '#fbbf24',
    border: '#c26d2d',
    glow: 'rgba(224, 138, 68, 0.5)',
    bg: 'linear-gradient(145deg, #432310 0%, #1c0d06 60%, #0f0704 100%)',
    badgeShape: 'shield',
  },
  '10': {
    tier: '10',
    weight: 2,
    name: 'Silver Baron',
    shortName: 'Baron',
    monogram: 'B',
    title: 'Table Enforcer',
    suitSymbol: '♣',
    lore: 'Cold Damascus steel and frost-cut diamonds for noble tacticians who punish weak trump calls.',
    rewardSummary: '+75 Wax Seals • Iron Rim Card Back',
    promotionSeals: 75,
    imageUrl: '/assets/ranks/rank_tier_baron.jpg',
    color: '#e2e8f0',
    accentColor: '#38bdf8',
    border: '#94a3b8',
    glow: 'rgba(56, 189, 248, 0.45)',
    bg: 'linear-gradient(145deg, #1e293b 0%, #0f172a 60%, #090d16 100%)',
    badgeShape: 'winged',
  },
  'Q': {
    tier: 'Q',
    weight: 3,
    name: 'Verdant Queen',
    shortName: 'Q Rank',
    monogram: 'Q',
    title: 'Velvet Sovereign',
    suitSymbol: '♥',
    lore: 'Crowned in faceted emerald and rose-gold filigree. Masters of partner signaling and tempo.',
    rewardSummary: '+125 Wax Seals • Gilded Silver Card Back',
    promotionSeals: 125,
    imageUrl: '/assets/ranks/rank_tier_q.jpg',
    color: '#34d399',
    accentColor: '#f472b6',
    border: '#10b981',
    glow: 'rgba(16, 185, 129, 0.55)',
    bg: 'linear-gradient(145deg, #064e3b 0%, #022c22 65%, #071714 100%)',
    badgeShape: 'medallion',
  },
  'K': {
    tier: 'K',
    weight: 4,
    name: 'Crimson King',
    shortName: 'K Rank',
    monogram: 'K',
    title: 'High-Stakes Monarch',
    suitSymbol: '♦',
    lore: 'Imperial blood-ruby coat of arms. Ruthless callers who bait the Left Bower and sweep marches.',
    rewardSummary: '+200 Wax Seals • Gilded Silver Card Back',
    promotionSeals: 200,
    imageUrl: '/assets/ranks/rank_tier_k.jpg',
    color: '#f87171',
    accentColor: '#fbbf24',
    border: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.6)',
    bg: 'linear-gradient(145deg, #7f1d1d 0%, #450a0a 65%, #1f0505 100%)',
    badgeShape: 'royal_crest',
  },
  'A': {
    tier: 'A',
    weight: 5,
    name: 'Astral Ace',
    shortName: 'A Rank',
    monogram: 'A',
    title: 'Grandmaster of Trump',
    suitSymbol: '♠',
    lore: 'Starlight platinum and void amethyst. Elite card counters whose loners bend the lobby.',
    rewardSummary: '+300 Wax Seals • Prismatic Foil Card Back',
    promotionSeals: 300,
    imageUrl: '/assets/ranks/rank_tier_a.jpg',
    color: '#c084fc',
    accentColor: '#e879f9',
    border: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.65)',
    bg: 'linear-gradient(145deg, #4c1d95 0%, #2e1065 65%, #13072e 100%)',
    badgeShape: 'octagon',
  },
  'BOWER_JJ': {
    tier: 'BOWER_JJ',
    weight: 6,
    name: 'Supreme Bower',
    shortName: 'BOWER JJ',
    monogram: 'JJ',
    title: 'Immortal Right & Left Bower',
    suitSymbol: '👑',
    lore: 'The apex pantheon of Euchre legends. Twin golden Knaves commanding both Bowers.',
    rewardSummary: '+500 Wax Seals • Prismatic Foil & Apex Crown',
    promotionSeals: 500,
    imageUrl: '/assets/ranks/rank_tier_bower_jj.jpg',
    color: '#fbbf24',
    accentColor: '#22d3ee',
    border: '#f59e0b',
    glow: 'rgba(251, 191, 36, 0.8)',
    bg: 'linear-gradient(135deg, #78350f 0%, #0f172a 50%, #083344 100%)',
    badgeShape: 'apex_reliquary',
  },
};

export function getRankDivisionInfo(
  tier: RankTier,
  points: number = 0,
  explicitDivision?: RankDivision
): RankDivisionInfo {
  const safeTier: RankTier = RANK_INFO[tier] ? tier : '9';
  const info = RANK_INFO[safeTier];

  if (safeTier === 'BOWER_JJ') {
    const rawPoints = Math.max(0, points || 0);
    let apexDiv: ApexDivision = 'MASTER';
    if (rawPoints >= 500 || explicitDivision === 'CHALLENGER') {
      apexDiv = 'CHALLENGER';
    } else if (rawPoints >= 250 || explicitDivision === 'GRANDMASTER') {
      apexDiv = 'GRANDMASTER';
    } else {
      apexDiv = 'MASTER';
    }

    const meta = APEX_TIER_CONFIG[apexDiv];

    if (apexDiv === 'CHALLENGER') {
      return {
        division: 'CHALLENGER',
        divisionNumber: 4,
        starsFilled: 3,
        nextMilestoneLp: rawPoints,
        lpToNextMilestone: 0,
        lpToNextTier: 0,
        divisionProgressPercent: 100,
        isPromoSeries: false,
        fullRankName: meta.name,
        compactRankName: meta.compactName,
      };
    } else if (apexDiv === 'GRANDMASTER') {
      const nextMilestoneLp = 500;
      const lpToNextMilestone = Math.max(0, nextMilestoneLp - rawPoints);
      const divisionProgressPercent = Math.min(100, Math.max(0, ((rawPoints - 250) / 250) * 100));
      return {
        division: 'GRANDMASTER',
        divisionNumber: 4,
        starsFilled: 2,
        nextMilestoneLp,
        lpToNextMilestone,
        lpToNextTier: lpToNextMilestone,
        divisionProgressPercent,
        isPromoSeries: lpToNextMilestone <= 40,
        fullRankName: meta.name,
        compactRankName: meta.compactName,
      };
    } else {
      // MASTER
      const nextMilestoneLp = 250;
      const lpToNextMilestone = Math.max(0, nextMilestoneLp - rawPoints);
      const divisionProgressPercent = Math.min(100, Math.max(0, (rawPoints / 250) * 100));
      return {
        division: 'MASTER',
        divisionNumber: 4,
        starsFilled: 1,
        nextMilestoneLp,
        lpToNextMilestone,
        lpToNextTier: lpToNextMilestone,
        divisionProgressPercent,
        isPromoSeries: lpToNextMilestone <= 40,
        fullRankName: meta.name,
        compactRankName: meta.compactName,
      };
    }
  }

  const clampedPoints = Math.min(100, Math.max(0, points || 0));

  // Each division (III -> II -> I) requires 100 LP (0 to 100 LP per division)
  const division: 'III' | 'II' | 'I' =
    explicitDivision === 'I' || explicitDivision === 'II' || explicitDivision === 'III'
      ? explicitDivision
      : 'III';

  const divisionNumber: 1 | 2 | 3 = division === 'I' ? 3 : division === 'II' ? 2 : 1;
  const starsFilled: 1 | 2 | 3 = divisionNumber;
  const nextMilestoneLp = 100;
  const divisionProgressPercent = clampedPoints;
  const lpToNextMilestone = Math.max(0, 100 - clampedPoints);
  const lpToNextTier = (3 - divisionNumber) * 100 + lpToNextMilestone;
  const isPromoSeries = clampedPoints >= 76;

  return {
    division,
    divisionNumber,
    starsFilled,
    nextMilestoneLp,
    lpToNextMilestone,
    lpToNextTier,
    divisionProgressPercent,
    isPromoSeries,
    fullRankName: `${info.name} • Div ${division}`,
    compactRankName: `${info.name} ${division}`,
  };
}

interface RankBadgeProps {
  tier: RankTier;
  division?: RankDivision;
  points?: number; // 0 to 100 LP within current division
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  showDivisionPips?: boolean;
  animateGlow?: boolean;
}

export const RankBadge: React.FC<RankBadgeProps> = ({
  tier,
  division,
  points,
  size = 'md',
  showLabel = true,
  showDivisionPips = true,
  animateGlow = true,
}) => {
  const safeTier: RankTier = RANK_INFO[tier] ? tier : '9';
  const info = RANK_INFO[safeTier];
  const divInfo = getRankDivisionInfo(safeTier, points ?? 0, division);

  const sizePixels = {
    xs: 26,
    sm: 36,
    md: 54,
    lg: 76,
    xl: 112,
  }[size];

  const fontSize = {
    xs: 9,
    sm: 12,
    md: 17,
    lg: 24,
    xl: 34,
  }[size];

  const isApex = safeTier === 'BOWER_JJ';
  const apexMeta = isApex
    ? APEX_TIER_CONFIG[divInfo.division as ApexDivision] || APEX_TIER_CONFIG.MASTER
    : null;
  const isHighTier = safeTier === 'K' || safeTier === 'A' || safeTier === 'BOWER_JJ';
  const lpPercent = isApex ? divInfo.divisionProgressPercent : Math.min(100, Math.max(0, points ?? 0));

  // SVG progress ring geometry
  const ringRadius = (sizePixels - 4) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference - (lpPercent / 100) * ringCircumference;

  return (
    <div className="inline-flex flex-col items-center select-none group">
      <div
        className={`relative flex items-center justify-center transition-all duration-300 ${
          animateGlow ? 'group-hover:scale-105' : ''
        }`}
        style={{
          width: sizePixels,
          height: sizePixels,
        }}
      >
        {/* Outer Ambient Aura for High Tiers */}
        {isHighTier && size !== 'xs' && (
          <div
            className={`absolute -inset-1 rounded-full blur-md pointer-events-none opacity-60 ${
              animateGlow ? 'animate-pulse' : ''
            }`}
            style={{
              background: isApex && apexMeta
                ? `radial-gradient(circle, ${apexMeta.glow} 0%, transparent 70%)`
                : info.glow,
            }}
          />
        )}

        {/* Heraldic Medallion Container */}
        <div
          className="relative w-full h-full rounded-2xl overflow-hidden flex items-center justify-center shadow-xl"
          style={{
            background: info.bg,
            border: `${size === 'xs' || size === 'sm' ? 1.5 : 2}px solid ${
              isApex && apexMeta ? apexMeta.border : info.border
            }`,
            boxShadow: `0 0 ${size === 'xl' ? 24 : 14}px ${
              isApex && apexMeta ? apexMeta.glow : info.glow
            }, inset 0 1px 3px rgba(255,255,255,0.35)`,
          }}
        >
          {/* Illustrated Emblem Artwork Layer */}
          <img
            src={info.imageUrl}
            alt={info.name}
            className="absolute inset-0 w-full h-full object-cover scale-110 transition-transform duration-500 group-hover:scale-125"
            loading="lazy"
            onError={(e) => {
              // Hide img gracefully if offline/test so vector heraldry fallback shines underneath
              (e.currentTarget as HTMLImageElement).style.opacity = '0';
            }}
          />

          {/* Subtle Vignette & Metallic Sheen Overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 50% 45%, transparent 35%, rgba(2,6,23,0.65) 100%)',
            }}
          />
          <div className="absolute -top-1/2 -left-1/2 w-full h-[200%] bg-gradient-to-r from-transparent via-white/15 to-transparent rotate-[30deg] pointer-events-none" />

          {/* Corner Heraldic Filigree Accents (Vector SVG) */}
          {size !== 'xs' && (
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full pointer-events-none opacity-55"
            >
              <polygon
                points="50,3 95,25 95,75 50,97 5,75 5,25"
                fill="none"
                stroke={isApex && apexMeta ? apexMeta.accentColor : info.accentColor}
                strokeWidth="1.5"
                strokeDasharray={isApex ? '4 2' : 'none'}
              />
            </svg>
          )}

          {/* Crisp Monogram Badge Tag (Bottom-Right Corner on sm/md or Subtle Center Fallback) */}
          <span
            className="sr-only"
          >
            {safeTier === 'BOWER_JJ' ? 'JJ' : safeTier}
          </span>
        </div>

        {/* Radial LP Progress Ring Overlay (when points supplied on md/lg/xl) */}
        {points !== undefined && size !== 'xs' && size !== 'sm' && (
          <svg
            width={sizePixels + 6}
            height={sizePixels + 6}
            className="absolute -inset-[3px] -rotate-90 pointer-events-none"
          >
            <circle
              cx={(sizePixels + 6) / 2}
              cy={(sizePixels + 6) / 2}
              r={ringRadius + 1.5}
              fill="none"
              stroke="rgba(15, 23, 42, 0.7)"
              strokeWidth="2.5"
            />
            <circle
              cx={(sizePixels + 6) / 2}
              cy={(sizePixels + 6) / 2}
              r={ringRadius + 1.5}
              fill="none"
              stroke={isApex && apexMeta ? apexMeta.color : divInfo.isPromoSeries ? '#fbbf24' : info.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringDashOffset}
              style={{
                filter: `drop-shadow(0 0 4px ${isApex && apexMeta ? apexMeta.glow : info.glow})`,
                transition: 'stroke-dashoffset 0.6s ease-out',
              }}
            />
          </svg>
        )}

        {/* Apex Crown Floating Crest */}
        {isApex && apexMeta && size !== 'xs' && (
          <div
            className={`absolute -top-2.5 z-20 px-2 py-0.2 rounded-full bg-gradient-to-r ${apexMeta.crestGradient} text-slate-950 font-black text-[8px] uppercase tracking-tighter shadow-md border border-white/80 flex items-center gap-0.5`}
          >
            <span>{apexMeta.icon}</span>
            <span>{apexMeta.compactName}</span>
          </div>
        )}

        {/* Sub-Division Roman Numeral & Star Pips Pill */}
        {showDivisionPips && size !== 'xs' && (
          <div
            className="absolute -bottom-2 z-20 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-950/95 border shadow-md"
            style={{
              borderColor: isApex && apexMeta ? apexMeta.border : info.border,
              boxShadow: `0 2px 6px rgba(0,0,0,0.85), 0 0 6px ${isApex && apexMeta ? apexMeta.glow : info.glow}`,
            }}
          >
            <span
              className="font-black leading-none tracking-tight"
              style={{
                fontSize: size === 'sm' ? 8 : size === 'md' ? 9 : 10,
                color: isApex && apexMeta ? apexMeta.color : info.color,
              }}
            >
              {isApex && apexMeta ? `JJ • ${apexMeta.compactName}` : `${info.monogram}•${divInfo.division}`}
            </span>
            {size !== 'sm' && !isApex && (
              <span className="flex items-center gap-[1.5px] ml-0.5">
                {[1, 2, 3].map((pip) => (
                  <span
                    key={pip}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      pip <= divInfo.starsFilled
                        ? 'scale-100'
                        : 'bg-slate-700 opacity-50 scale-75'
                    }`}
                    style={
                      pip <= divInfo.starsFilled
                        ? {
                            backgroundColor: info.accentColor,
                            boxShadow: `0 0 4px ${info.accentColor}`,
                          }
                        : undefined
                    }
                  />
                ))}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Label & LP / Promo Status Below Badge */}
      {showLabel && (
        <div className={`${showDivisionPips && size !== 'xs' ? 'mt-2.5' : 'mt-1'} text-center`}>
          <div
            className="text-xs font-black leading-tight tracking-wide flex items-center justify-center gap-1"
            style={{ color: isApex && apexMeta ? apexMeta.color : info.color }}
          >
            <span>{isApex && apexMeta ? apexMeta.name : info.name}</span>
            {!isApex && points !== undefined && (
              <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800/90 border border-slate-700 text-amber-300 font-mono">
                {divInfo.division}
              </span>
            )}
          </div>
          <div className="text-[9px] text-slate-400 font-semibold leading-tight mt-0.5">
            {info.title}
          </div>
          {points !== undefined && (
            <div className="mt-0.5 flex flex-col items-center">
              <div
                className="text-[10px] font-mono font-bold"
                style={{ color: isApex && apexMeta ? apexMeta.color : '#e2e8f0' }}
              >
                {isApex ? `${points} LP` : `${points}/100 LP`}
              </div>
              {divInfo.isPromoSeries && !isApex && (
                <div className="mt-0.5 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-500/20 border border-amber-400/50 text-[8px] font-black text-amber-300 uppercase tracking-wider animate-pulse">
                  <span>🔥 Promo Series</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
