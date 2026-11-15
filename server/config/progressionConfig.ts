/**
 * BOWER JJ — Server-Side Progression & Drop Rate Configuration
 *
 * All card pack generation, rarity balancing weights, and XP thresholds
 * are centralized here and validated exclusively server-side.
 */

import {
  COLLECTIBLE_CARDS,
  CollectibleCardDefinition,
  RarityTier,
} from '../../src/config/collectiblesCatalog';

export interface RarityDropRates {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
}

export interface ProgressionConfig {
  xpPerLevel: number;
  cardsPerPack: number;
  rarityDropRates: RarityDropRates;
}

export const PROGRESSION_CONFIG: ProgressionConfig = {
  xpPerLevel: 1000,
  cardsPerPack: 5,
  rarityDropRates: {
    common: 65,
    rare: 23,
    epic: 10,
    legendary: 2,
  },
};

const RARITY_ORDER: RarityTier[] = ['common', 'rare', 'epic', 'legendary'];

const CARDS_BY_RARITY: Record<RarityTier, CollectibleCardDefinition[]> = {
  common: COLLECTIBLE_CARDS.filter((c) => c.rarity === 'common'),
  rare: COLLECTIBLE_CARDS.filter((c) => c.rarity === 'rare'),
  epic: COLLECTIBLE_CARDS.filter((c) => c.rarity === 'epic'),
  legendary: COLLECTIBLE_CARDS.filter((c) => c.rarity === 'legendary'),
};

/**
 * Selects a rarity tier using configurable weighted probability.
 */
export function rollRarity(
  rates: RarityDropRates = PROGRESSION_CONFIG.rarityDropRates,
  rng: () => number = Math.random
): RarityTier {
  const totalWeight = RARITY_ORDER.reduce((sum, r) => sum + Math.max(0, rates[r] || 0), 0);
  if (totalWeight <= 0) return 'common';

  let cursor = rng() * totalWeight;
  for (const tier of RARITY_ORDER) {
    const w = Math.max(0, rates[tier] || 0);
    if (cursor < w) return tier;
    cursor -= w;
  }
  return 'common';
}

/**
 * Draws a single collectible card from the pool matching the rolled rarity.
 */
export function rollSingleCard(
  config: ProgressionConfig = PROGRESSION_CONFIG,
  rng: () => number = Math.random
): CollectibleCardDefinition {
  const rolledRarity = rollRarity(config.rarityDropRates, rng);
  const candidates = CARDS_BY_RARITY[rolledRarity];
  if (candidates.length === 0) {
    const fallbackIdx = Math.floor(rng() * COLLECTIBLE_CARDS.length) % COLLECTIBLE_CARDS.length;
    return COLLECTIBLE_CARDS[fallbackIdx];
  }
  const idx = Math.floor(rng() * candidates.length) % candidates.length;
  return candidates[idx];
}

/**
 * Generates an authoritative 5-card booster pack roll (duplicates allowed).
 */
export function rollPackCards(
  config: ProgressionConfig = PROGRESSION_CONFIG,
  rng: () => number = Math.random
): CollectibleCardDefinition[] {
  const cards: CollectibleCardDefinition[] = [];
  for (let i = 0; i < config.cardsPerPack; i++) {
    cards.push(rollSingleCard(config, rng));
  }
  return cards;
}
