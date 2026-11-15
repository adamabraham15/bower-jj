import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { getAvatarDefinition, RARITY_META } from '../config/collectiblesCatalog';

export type AvatarPortraitSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarPortraitProps {
  avatarId?: string | null;
  size?: AvatarPortraitSize;
  shape?: 'rounded' | 'circle';
  className?: string;
  showRarityRing?: boolean;
  showRarityGem?: boolean;
  locked?: boolean;
  alt?: string;
}

const SIZE_CLASSES: Record<AvatarPortraitSize, string> = {
  xs: 'w-7 h-7 rounded-lg',
  sm: 'w-9 h-9 rounded-xl',
  md: 'w-12 h-12 rounded-xl',
  lg: 'w-16 h-16 rounded-2xl',
  xl: 'w-24 h-24 rounded-2xl',
};

const CIRCLE_SIZE_CLASSES: Record<AvatarPortraitSize, string> = {
  xs: 'w-7 h-7 rounded-full',
  sm: 'w-9 h-9 rounded-full',
  md: 'w-12 h-12 rounded-full',
  lg: 'w-16 h-16 rounded-full',
  xl: 'w-24 h-24 rounded-full',
};

export const AvatarPortrait: React.FC<AvatarPortraitProps> = ({
  avatarId,
  size = 'md',
  shape = 'rounded',
  className = '',
  showRarityRing = true,
  showRarityGem = false,
  locked = false,
  alt,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const avatar = getAvatarDefinition(avatarId);
  const rarity = RARITY_META[avatar.rarity];
  const sizeCls = shape === 'circle' ? CIRCLE_SIZE_CLASSES[size] : SIZE_CLASSES[size];

  const initials = avatar.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden flex-shrink-0 select-none bg-gradient-to-br ${rarity.gradientClass} ${sizeCls} ${
        showRarityRing ? `border-2 ${rarity.borderClass}` : 'border border-slate-700/70'
      } ${className}`}
      style={
        showRarityRing && !locked && (avatar.rarity === 'legendary' || avatar.rarity === 'epic' || avatar.rarity === 'rare')
          ? { boxShadow: rarity.glowStyle }
          : undefined
      }
      title={`${avatar.name} (${rarity.label})`}
    >
      {!imgFailed ? (
        <img
          src={avatar.imageUrl}
          alt={alt || avatar.name}
          loading="lazy"
          draggable={false}
          onError={() => setImgFailed(true)}
          className={`w-full h-full object-cover object-top transition-transform duration-300 ${
            locked ? 'grayscale brightness-50 contrast-110' : ''
          }`}
        />
      ) : (
        <span className="font-black text-xs tracking-wider text-amber-100 drop-shadow">
          {initials}
        </span>
      )}

      {/* Subtle top specular rim */}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/15 rounded-[inherit]" />

      {/* Legendary metallic shimmer corner accent */}
      {showRarityGem && !locked && avatar.rarity !== 'common' && (
        <span
          className="pointer-events-none absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-slate-950 shadow-md"
          style={{ backgroundColor: rarity.accentHex }}
        />
      )}

      {/* Locked overlay */}
      {locked && (
        <div className="absolute inset-0 bg-slate-950/45 flex items-center justify-center">
          <div className="p-1.5 rounded-full bg-slate-950/80 border border-slate-700/80 shadow-lg">
            <Lock className="w-3.5 h-3.5 text-slate-300" />
          </div>
        </div>
      )}
    </div>
  );
};

export default AvatarPortrait;
