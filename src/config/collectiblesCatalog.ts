/**
 * BOWER JJ — Collectible Catalog & Shared Progression Metadata
 *
 * Central source of truth shared between authoritative backend and React UI for:
 * - Illustrated Avatars (Common / Rare / Epic / Legendary)
 * - Starter & Unlockable Collectible Card Backs
 * - 10 Card-Back Collections x 5 Card Identities (10, J, Q, K, A = 50 Collectible Cards)
 * - Lossless legacy emoji & legacy card-back alias resolution
 */

export type RarityTier = 'common' | 'rare' | 'epic' | 'legendary';

export type CardIdentity = '10' | 'J' | 'Q' | 'K' | 'A';

export const CARD_IDENTITIES: CardIdentity[] = ['10', 'J', 'Q', 'K', 'A'];

export const CARD_IDENTITY_NAMES: Record<CardIdentity, string> = {
  '10': 'Ten',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
  A: 'Ace',
};

export interface RarityVisualMeta {
  id: RarityTier;
  label: string;
  textClass: string;
  badgeClass: string;
  borderClass: string;
  ringClass: string;
  glowStyle: string;
  gradientClass: string;
  accentHex: string;
}

export const RARITY_META: Record<RarityTier, RarityVisualMeta> = {
  common: {
    id: 'common',
    label: 'Common',
    textClass: 'text-slate-300',
    badgeClass: 'bg-slate-800/90 text-slate-200 border-slate-500/60',
    borderClass: 'border-slate-500/70',
    ringClass: 'ring-slate-400/50',
    glowStyle: '0 0 14px rgba(148, 163, 184, 0.25)',
    gradientClass: 'from-slate-700 via-slate-800 to-slate-900',
    accentHex: '#94a3b8',
  },
  rare: {
    id: 'rare',
    label: 'Rare',
    textClass: 'text-sky-300',
    badgeClass: 'bg-sky-950/90 text-sky-300 border-sky-400/70',
    borderClass: 'border-sky-400/80',
    ringClass: 'ring-sky-400/70',
    glowStyle: '0 0 20px rgba(56, 189, 248, 0.45)',
    gradientClass: 'from-sky-600 via-blue-800 to-slate-950',
    accentHex: '#38bdf8',
  },
  epic: {
    id: 'epic',
    label: 'Epic',
    textClass: 'text-purple-300',
    badgeClass: 'bg-purple-950/90 text-purple-300 border-purple-400/80',
    borderClass: 'border-purple-400/85',
    ringClass: 'ring-purple-400/80',
    glowStyle: '0 0 26px rgba(192, 132, 252, 0.55)',
    gradientClass: 'from-purple-600 via-fuchsia-800 to-slate-950',
    accentHex: '#c084fc',
  },
  legendary: {
    id: 'legendary',
    label: 'Legendary',
    textClass: 'text-amber-300',
    badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-400/90',
    borderClass: 'border-amber-400',
    ringClass: 'ring-amber-400',
    glowStyle: '0 0 34px rgba(251, 191, 36, 0.65)',
    gradientClass: 'from-amber-400 via-orange-600 to-amber-950',
    accentHex: '#fbbf24',
  },
};

export interface AvatarDefinition {
  id: string;
  name: string;
  theme: string;
  titleTag: string;
  rarity: RarityTier;
  imageUrl: string;
  unlockedByDefault: boolean;
  unlockLevel?: number;
  unlockWins?: number;
  unlockCollectionId?: string;
  unlockHint: string;
  legacyEmojiAliases: string[];
}

export const AVATAR_CATALOG: AvatarDefinition[] = [
  // --- COMMON STARTERS (Unlocked by Default) ---
  {
    id: 'the_outlaw',
    name: 'The Outlaw',
    theme: 'Wild West',
    titleTag: 'Frontier Sharp',
    rarity: 'common',
    imageUrl: '/assets/avatars/the_outlaw.webp',
    unlockedByDefault: true,
    unlockHint: 'Starter Avatar',
    legacyEmojiAliases: ['🤠'],
  },
  {
    id: 'elven_trickster',
    name: 'Elven Trickster',
    theme: 'Fantasy Rogue',
    titleTag: 'Verdant Illusionist',
    rarity: 'common',
    imageUrl: '/assets/avatars/elven_trickster.webp',
    unlockedByDefault: true,
    unlockHint: 'Starter Avatar',
    legacyEmojiAliases: ['🧝'],
  },
  {
    id: 'cyber_bot',
    name: 'Cyber Automaton',
    theme: 'Cyberpunk',
    titleTag: 'Brass Croupier',
    rarity: 'common',
    imageUrl: '/assets/avatars/cyber_bot.webp',
    unlockedByDefault: true,
    unlockHint: 'Starter Avatar',
    legacyEmojiAliases: ['🤖'],
  },
  {
    id: 'clever_fox',
    name: 'Aristocrat Fox',
    theme: 'Animal Noble',
    titleTag: 'Sly Tactician',
    rarity: 'common',
    imageUrl: '/assets/avatars/clever_fox.webp',
    unlockedByDefault: true,
    unlockHint: 'Starter Avatar',
    legacyEmojiAliases: ['🦊'],
  },
  {
    id: 'velvet_gentleman',
    name: 'Velvet Sharper',
    theme: 'Noir Trickster',
    titleTag: 'Gilded Gambler',
    rarity: 'common',
    imageUrl: '/assets/avatars/velvet_gentleman.webp',
    unlockedByDefault: true,
    unlockHint: 'Starter Avatar',
    legacyEmojiAliases: ['🎩'],
  },
  {
    id: 'iron_tactician',
    name: 'Iron Vanguard',
    theme: 'Medieval Knight',
    titleTag: 'Steel Bastion',
    rarity: 'common',
    imageUrl: '/assets/avatars/iron_tactician.webp',
    unlockedByDefault: true,
    unlockHint: 'Starter Avatar',
    legacyEmojiAliases: ['🪖', '⚔️'],
  },

  // --- RARE AVATARS ---
  {
    id: 'thunder_knight',
    name: 'Storm Paladin',
    theme: 'Mythic Knight',
    titleTag: 'Tempest Knight',
    rarity: 'rare',
    imageUrl: '/assets/avatars/thunder_knight.webp',
    unlockedByDefault: false,
    unlockLevel: 2,
    unlockHint: 'Reach Player Level 2',
    legacyEmojiAliases: ['⚡', '🔵', '🎯'],
  },
  {
    id: 'void_astronaut',
    name: 'Void Starfarer',
    theme: 'Cosmic Sci-Fi',
    titleTag: 'Nebula Wanderer',
    rarity: 'rare',
    imageUrl: '/assets/avatars/void_astronaut.webp',
    unlockedByDefault: false,
    unlockLevel: 4,
    unlockHint: 'Reach Player Level 4',
    legacyEmojiAliases: ['🧑‍🚀'],
  },
  {
    id: 'crimson_jester',
    name: 'Crimson Harlequin',
    theme: 'Joker & Trickster',
    titleTag: 'Masquerade Ace',
    rarity: 'rare',
    imageUrl: '/assets/avatars/crimson_jester.webp',
    unlockedByDefault: false,
    unlockLevel: 6,
    unlockWins: 10,
    unlockCollectionId: 'wild_west',
    unlockHint: 'Level 6, 10 Wins, or Complete Wild West',
    legacyEmojiAliases: ['🎴', '🔴'],
  },
  {
    id: 'forest_warden',
    name: 'Sylvan Druid',
    theme: 'Abstract Nature',
    titleTag: 'Frost-Root Oracle',
    rarity: 'rare',
    imageUrl: '/assets/avatars/forest_warden.webp',
    unlockedByDefault: false,
    unlockLevel: 8,
    unlockCollectionId: 'frostbite',
    unlockHint: 'Level 8 or Complete Frostbite Collection',
    legacyEmojiAliases: [],
  },

  // --- EPIC AVATARS ---
  {
    id: 'cosmic_emissary',
    name: 'Astral Oracle',
    theme: 'Abstract Cosmic',
    titleTag: 'Void Seer',
    rarity: 'epic',
    imageUrl: '/assets/avatars/cosmic_emissary.webp',
    unlockedByDefault: false,
    unlockLevel: 10,
    unlockWins: 25,
    unlockHint: 'Level 10 or Win 25 Matches',
    legacyEmojiAliases: ['👽'],
  },
  {
    id: 'jade_dragon',
    name: 'Jade Dragon',
    theme: 'Mythical Creature',
    titleTag: 'Dynasty Guardian',
    rarity: 'epic',
    imageUrl: '/assets/avatars/jade_dragon.webp',
    unlockedByDefault: false,
    unlockLevel: 12,
    unlockCollectionId: 'emerald_dynasty',
    unlockHint: 'Level 12 or Complete Emerald Dynasty',
    legacyEmojiAliases: ['🐉'],
  },
  {
    id: 'shadow_assassin',
    name: 'Umbra Wraith',
    theme: 'Dark Fantasy',
    titleTag: 'Shadow Stalker',
    rarity: 'epic',
    imageUrl: '/assets/avatars/shadow_assassin.webp',
    unlockedByDefault: false,
    unlockLevel: 14,
    unlockCollectionId: 'shadow_realm',
    unlockHint: 'Level 14 or Complete Shadow Realm',
    legacyEmojiAliases: ['🥷', '👤'],
  },
  {
    id: 'arcane_archmage',
    name: 'Æther Archmage',
    theme: 'Fantasy Wizard',
    titleTag: 'Runic Spellweaver',
    rarity: 'epic',
    imageUrl: '/assets/avatars/arcane_archmage.webp',
    unlockedByDefault: false,
    unlockLevel: 16,
    unlockCollectionId: 'arcane',
    unlockHint: 'Level 16 or Complete Arcane Collection',
    legacyEmojiAliases: [],
  },

  // --- LEGENDARY AVATARS ---
  {
    id: 'bower_king',
    name: 'Sovereign of Bowers',
    theme: 'Royal Legend',
    titleTag: 'Eternal Monarch',
    rarity: 'legendary',
    imageUrl: '/assets/avatars/bower_king.webp',
    unlockedByDefault: false,
    unlockLevel: 20,
    unlockCollectionId: 'dark_royalty',
    unlockHint: 'Complete Dark Royalty or Reach Level 20',
    legacyEmojiAliases: ['👑'],
  },
  {
    id: 'phoenix_sovereign',
    name: 'Solar Phoenix Empress',
    theme: 'Mythical Legend',
    titleTag: 'Immortal Flame',
    rarity: 'legendary',
    imageUrl: '/assets/avatars/phoenix_sovereign.webp',
    unlockedByDefault: false,
    unlockLevel: 25,
    unlockCollectionId: 'celestial',
    unlockHint: 'Complete Celestial Collection or Reach Level 25',
    legacyEmojiAliases: [],
  },
];

export const DEFAULT_AVATAR_ID = 'the_outlaw';

const AVATAR_BY_ID = new Map<string, AvatarDefinition>(AVATAR_CATALOG.map((a) => [a.id, a]));
const EMOJI_TO_AVATAR_ID = new Map<string, string>();
for (const av of AVATAR_CATALOG) {
  for (const alias of av.legacyEmojiAliases) {
    EMOJI_TO_AVATAR_ID.set(alias, av.id);
  }
}

/**
 * Resolves either a canonical avatar ID or a legacy emoji string into a valid avatar ID.
 */
export function resolveAvatarId(raw?: string | null): string {
  if (!raw) return DEFAULT_AVATAR_ID;
  const trimmed = raw.trim();
  if (AVATAR_BY_ID.has(trimmed)) return trimmed;
  const mapped = EMOJI_TO_AVATAR_ID.get(trimmed);
  if (mapped) return mapped;
  return DEFAULT_AVATAR_ID;
}

export function getAvatarDefinition(raw?: string | null): AvatarDefinition {
  const id = resolveAvatarId(raw);
  return AVATAR_BY_ID.get(id) || AVATAR_CATALOG[0];
}

export const PACK_ARTWORK_URL = '/assets/packs/standard_pack.webp';

export interface CardBackDefinition {
  id: string;
  name: string;
  description: string;
  rarity: RarityTier;
  imageUrl: string;
  isStarter: boolean;
  unlockedByDefault: boolean;
  collectionId?: string;
  accentHex: string;
}

export interface CardCollectionDefinition {
  id: string;
  name: string;
  theme: string;
  description: string;
  rarity: RarityTier;
  cardBackId: string;
  cardBackImageUrl: string;
  accentHex: string;
  cardRarities: Record<CardIdentity, RarityTier>;
}

export interface CollectibleCardDefinition {
  id: string;
  collectionId: string;
  collectionName: string;
  identity: CardIdentity;
  identityName: string;
  name: string;
  rarity: RarityTier;
  imageUrl: string;
  accentHex: string;
}

export const CARD_COLLECTIONS: CardCollectionDefinition[] = [
  {
    id: 'wild_west',
    name: 'Wild West',
    theme: 'Frontier Metal & Leather',
    description: 'Tooled saddle leather, engraved brass plates, and high-noon silver spurs.',
    rarity: 'common',
    cardBackId: 'wild_west',
    cardBackImageUrl: '/assets/card-backs/wild_west.webp',
    accentHex: '#d97706',
    cardRarities: { '10': 'common', J: 'common', Q: 'common', K: 'common', A: 'rare' },
  },
  {
    id: 'frostbite',
    name: 'Frostbite',
    theme: 'Glacial Crystal',
    description: 'Razor-edged glacial ice crystals suffused with boreal sapphire radiance.',
    rarity: 'common',
    cardBackId: 'frostbite',
    cardBackImageUrl: '/assets/card-backs/frostbite.webp',
    accentHex: '#38bdf8',
    cardRarities: { '10': 'common', J: 'common', Q: 'common', K: 'common', A: 'rare' },
  },
  {
    id: 'inferno',
    name: 'Inferno',
    theme: 'Molten Magma & Steel',
    description: 'Blackened volcanic iron split by incandescent rivers of molten gold and ember.',
    rarity: 'common',
    cardBackId: 'inferno',
    cardBackImageUrl: '/assets/card-backs/inferno.webp',
    accentHex: '#f97316',
    cardRarities: { '10': 'common', J: 'common', Q: 'common', K: 'common', A: 'rare' },
  },
  {
    id: 'emerald_dynasty',
    name: 'Emerald Dynasty',
    theme: 'Imperial Jade & Gold',
    description: 'Faceted imperial emeralds framed in filigree gold and carved dynasty scrollwork.',
    rarity: 'rare',
    cardBackId: 'emerald_dynasty',
    cardBackImageUrl: '/assets/card-backs/emerald_dynasty.webp',
    accentHex: '#10b981',
    cardRarities: { '10': 'common', J: 'common', Q: 'rare', K: 'rare', A: 'epic' },
  },
  {
    id: 'arcane',
    name: 'Arcane',
    theme: 'Mystic Runes & Æther',
    description: 'Sacred geometric spell-circles pulsing with violet ætherial sorcery.',
    rarity: 'rare',
    cardBackId: 'arcane',
    cardBackImageUrl: '/assets/card-backs/arcane.webp',
    accentHex: '#a855f7',
    cardRarities: { '10': 'common', J: 'common', Q: 'rare', K: 'rare', A: 'epic' },
  },
  {
    id: 'cybernetic',
    name: 'Cybernetic',
    theme: 'Holographic Neon Matrix',
    description: 'Symmetrical holo-circuitry etched over obsidian chrome with neon magenta arcs.',
    rarity: 'rare',
    cardBackId: 'cybernetic',
    cardBackImageUrl: '/assets/card-backs/cybernetic.webp',
    accentHex: '#06b6d4',
    cardRarities: { '10': 'common', J: 'common', Q: 'rare', K: 'rare', A: 'epic' },
  },
  {
    id: 'shadow_realm',
    name: 'Shadow Realm',
    theme: 'Nocturnal Dark Fantasy',
    description: 'Midnight cathedral tracery shrouded in spectral amethyst mist and obsidian wings.',
    rarity: 'epic',
    cardBackId: 'shadow_realm',
    cardBackImageUrl: '/assets/card-backs/shadow_realm.webp',
    accentHex: '#8b5cf6',
    cardRarities: { '10': 'common', J: 'rare', Q: 'rare', K: 'epic', A: 'epic' },
  },
  {
    id: 'jesters_curse',
    name: "Jester's Curse",
    theme: 'Chaotic Harlequin Foil',
    description: 'Gilded trickster masks, warped diamond lattice, and cursed crimson-violet foil.',
    rarity: 'epic',
    cardBackId: 'jesters_curse',
    cardBackImageUrl: '/assets/card-backs/jesters_curse.webp',
    accentHex: '#ec4899',
    cardRarities: { '10': 'common', J: 'rare', Q: 'rare', K: 'epic', A: 'epic' },
  },
  {
    id: 'dark_royalty',
    name: 'Dark Royalty',
    theme: 'Obsidian Crown & 24k Gold',
    description: 'Sovereign matte-black enamel crowned with intricate 24k royal gold filigree.',
    rarity: 'legendary',
    cardBackId: 'dark_royalty',
    cardBackImageUrl: '/assets/card-backs/dark_royalty.webp',
    accentHex: '#f59e0b',
    cardRarities: { '10': 'rare', J: 'rare', Q: 'epic', K: 'epic', A: 'legendary' },
  },
  {
    id: 'celestial',
    name: 'Celestial',
    theme: 'Astral Nebula & Constellations',
    description: 'A gilded cosmic astrolabe suspended across deep starfields and radiant moons.',
    rarity: 'legendary',
    cardBackId: 'celestial',
    cardBackImageUrl: '/assets/card-backs/celestial.webp',
    accentHex: '#fbbf24',
    cardRarities: { '10': 'rare', J: 'rare', Q: 'epic', K: 'legendary', A: 'legendary' },
  },
];

export const CARD_BACK_CATALOG: CardBackDefinition[] = [
  {
    id: 'classic_blue',
    name: 'Royal Bower Blue',
    description: 'The timeless sapphire linen & burnished gold deck of champions.',
    rarity: 'common',
    imageUrl: '/assets/card-backs/classic_blue.webp',
    isStarter: true,
    unlockedByDefault: true,
    accentHex: '#3b82f6',
  },
  {
    id: 'classic_red',
    name: 'Royal Crimson Velvet',
    description: 'Traditional casino-grade crimson velvet trim with twin gold crests.',
    rarity: 'common',
    imageUrl: '/assets/card-backs/classic_red.webp',
    isStarter: true,
    unlockedByDefault: true,
    accentHex: '#ef4444',
  },
  ...CARD_COLLECTIONS.map((col) => ({
    id: col.cardBackId,
    name: col.name,
    description: col.description,
    rarity: col.rarity,
    imageUrl: col.cardBackImageUrl,
    isStarter: false,
    unlockedByDefault: false,
    collectionId: col.id,
    accentHex: col.accentHex,
  })),
];

export const COLLECTIBLE_CARDS: CollectibleCardDefinition[] = CARD_COLLECTIONS.flatMap((col) =>
  CARD_IDENTITIES.map((identity) => ({
    id: `${col.id}_${identity}`,
    collectionId: col.id,
    collectionName: col.name,
    identity,
    identityName: CARD_IDENTITY_NAMES[identity],
    name: `${CARD_IDENTITY_NAMES[identity]} of ${col.name}`,
    rarity: col.cardRarities[identity],
    imageUrl: `/assets/cards/${col.id}_${identity}.webp`,
    accentHex: col.accentHex,
  }))
);

export const DEFAULT_CARD_BACK_ID = 'classic_blue';

const COLLECTION_BY_ID = new Map(CARD_COLLECTIONS.map((c) => [c.id, c]));
const CARD_BACK_BY_ID = new Map(CARD_BACK_CATALOG.map((b) => [b.id, b]));
const CARD_BY_ID = new Map(COLLECTIBLE_CARDS.map((c) => [c.id, c]));

const LEGACY_CARD_BACK_ALIASES: Record<string, string> = {
  classic_blue: 'classic_blue',
  classic_red: 'classic_red',
  crimson_royal: 'inferno',
  neon_cyber: 'cybernetic',
  golden_bower: 'dark_royalty',
  obsidian_gold: 'dark_royalty',
  midnight_black: 'shadow_realm',
};

export function resolveCardBackId(raw?: string | null): string {
  if (!raw) return DEFAULT_CARD_BACK_ID;
  const trimmed = raw.trim();
  if (CARD_BACK_BY_ID.has(trimmed)) return trimmed;
  if (LEGACY_CARD_BACK_ALIASES[trimmed]) return LEGACY_CARD_BACK_ALIASES[trimmed];
  return DEFAULT_CARD_BACK_ID;
}

export function getCardBackDefinition(raw?: string | null): CardBackDefinition {
  const id = resolveCardBackId(raw);
  return CARD_BACK_BY_ID.get(id) || CARD_BACK_CATALOG[0];
}

export function getCollectionDefinition(id: string): CardCollectionDefinition | undefined {
  return COLLECTION_BY_ID.get(id);
}

export function getCollectibleCardDefinition(id: string): CollectibleCardDefinition | undefined {
  return CARD_BY_ID.get(id);
}

/**
 * Computes which non-default avatars a player qualifies for based on stats, level & completed collections.
 */
export function getEligibleMilestoneAvatars(params: {
  level: number;
  wins: number;
  unlockedCollectionIds: Iterable<string>;
}): AvatarDefinition[] {
  const completedSet = new Set(params.unlockedCollectionIds);
  return AVATAR_CATALOG.filter((av) => {
    if (av.unlockedByDefault) return true;
    if (av.unlockLevel !== undefined && params.level >= av.unlockLevel) return true;
    if (av.unlockWins !== undefined && params.wins >= av.unlockWins) return true;
    if (av.unlockCollectionId && completedSet.has(av.unlockCollectionId)) return true;
    return false;
  });
}

export const BOT_AVATAR_BY_DIFFICULTY: Record<'easy' | 'medium' | 'hard', string[]> = {
  easy: ['iron_tactician', 'clever_fox', 'velvet_gentleman'],
  medium: ['cyber_bot', 'thunder_knight', 'elven_trickster'],
  hard: ['shadow_assassin', 'arcane_archmage', 'bower_king', 'cosmic_emissary'],
};

export const BOT_CARD_BACK_BY_DIFFICULTY: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'classic_red',
  medium: 'cybernetic',
  hard: 'dark_royalty',
};
