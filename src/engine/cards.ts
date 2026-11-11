/**
 * BOWER JJ — Card Rules & Bower Engine
 * 
 * Accurately implements North American Euchre:
 * - 24-card deck (9, 10, J, Q, K, A)
 * - Right Bower (Jack of trump)
 * - Left Bower (Jack of same-color suit)
 * - Effective suit classification (Left Bower becomes Trump suit!)
 * - Trick winner resolution
 * - Legal move validator
 */

import { Card, CardRank, Suit, PlayedCard, Trick } from './types';

export const ALL_SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const ALL_RANKS: CardRank[] = ['9', '10', 'J', 'Q', 'K', 'A'];

/**
 * Returns the suit of the same color.
 * Spades <-> Clubs (Black)
 * Hearts <-> Diamonds (Red)
 */
export function getSameColorSuit(suit: Suit): Suit {
  switch (suit) {
    case 'spades': return 'clubs';
    case 'clubs': return 'spades';
    case 'hearts': return 'diamonds';
    case 'diamonds': return 'hearts';
  }
}

export function isBlackSuit(suit: Suit): boolean {
  return suit === 'spades' || suit === 'clubs';
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

/**
 * Checks if a card is the Right Bower (Jack of Trump).
 */
export function isRightBower(card: Card, trumpSuit?: Suit): boolean {
  if (!trumpSuit) return false;
  return card.rank === 'J' && card.suit === trumpSuit;
}

/**
 * Checks if a card is the Left Bower (Jack of the same-colored suit as Trump).
 */
export function isLeftBower(card: Card, trumpSuit?: Suit): boolean {
  if (!trumpSuit) return false;
  return card.rank === 'J' && card.suit === getSameColorSuit(trumpSuit);
}

/**
 * Checks if a card is either Bower.
 */
export function isBower(card: Card, trumpSuit?: Suit): boolean {
  return isRightBower(card, trumpSuit) || isLeftBower(card, trumpSuit);
}

/**
 * Returns the effective suit of a card during play.
 * CRUCIAL RULE: Left Bower acts as the TRUMP suit, NOT its printed suit!
 */
export function getEffectiveSuit(card: Card, trumpSuit?: Suit): Suit {
  if (trumpSuit && isLeftBower(card, trumpSuit)) {
    return trumpSuit;
  }
  return card.suit;
}

/**
 * Evaluates the numerical strength of a card within the context of a trick.
 * Higher number wins the trick.
 */
export function getCardTrickStrength(card: Card, leadSuit: Suit, trumpSuit?: Suit): number {
  if (isRightBower(card, trumpSuit)) {
    return 1000;
  }
  if (isLeftBower(card, trumpSuit)) {
    return 950;
  }

  const effectiveSuit = getEffectiveSuit(card, trumpSuit);

  // If card is Trump
  if (trumpSuit && effectiveSuit === trumpSuit) {
    switch (card.rank) {
      case 'A': return 800;
      case 'K': return 700;
      case 'Q': return 600;
      case '10': return 500;
      case '9': return 400;
      default: return 0;
    }
  }

  // If card matches the lead suit
  if (effectiveSuit === leadSuit) {
    switch (card.rank) {
      case 'A': return 180;
      case 'K': return 170;
      case 'Q': return 160;
      case 'J': return 150; // Off-color Jack only
      case '10': return 140;
      case '9': return 130;
      default: return 0;
    }
  }

  // Off-suit, non-trump card cannot win
  return 0;
}

/**
 * Creates a standard fresh 24-card Euchre deck.
 */
export function createEuchreDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
      });
    }
  }
  return deck;
}

/**
 * Shuffles an array of cards using Fisher-Yates with crypto random when available.
 */
export function shuffleDeck(cards: Card[]): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Determines whether a specific card is legal to play from a player's hand.
 */
export function isCardPlayLegal(
  card: Card,
  playerHand: Card[],
  trick: Trick,
  trumpSuit?: Suit
): boolean {
  // Card must exist in player's hand
  if (!playerHand.some(c => c.id === card.id)) {
    return false;
  }

  // If leading the trick, any card in hand is legal
  if (trick.cards.length === 0 || !trick.leadSuit) {
    return true;
  }

  const leadSuit = trick.leadSuit;
  const cardEffectiveSuit = getEffectiveSuit(card, trumpSuit);

  // If the card matches the lead suit, it's always legal
  if (cardEffectiveSuit === leadSuit) {
    return true;
  }

  // Player played an off-suit card: Only legal if player has NO cards matching lead suit
  const hasLeadSuit = playerHand.some(c => getEffectiveSuit(c, trumpSuit) === leadSuit);
  return !hasLeadSuit;
}

/**
 * Returns all legally playable cards in a player's hand for the current trick.
 */
export function getLegalPlays(
  playerHand: Card[],
  trick: Trick,
  trumpSuit?: Suit
): Card[] {
  return playerHand.filter(card => isCardPlayLegal(card, playerHand, trick, trumpSuit));
}

/**
 * Resolves the winner of a trick.
 */
export function resolveTrickWinner(trick: Trick, trumpSuit?: Suit): { winner: number; winningCard: Card } {
  if (trick.cards.length === 0) {
    throw new Error('Cannot resolve winner of empty trick');
  }

  const leadCard = trick.cards[0].card;
  const leadSuit = getEffectiveSuit(leadCard, trumpSuit);

  let bestCard: PlayedCard = trick.cards[0];
  let bestStrength = getCardTrickStrength(bestCard.card, leadSuit, trumpSuit);

  for (let i = 1; i < trick.cards.length; i++) {
    const played = trick.cards[i];
    const strength = getCardTrickStrength(played.card, leadSuit, trumpSuit);
    if (strength > bestStrength) {
      bestStrength = strength;
      bestCard = played;
    }
  }

  return {
    winner: bestCard.player,
    winningCard: bestCard.card,
  };
}

/**
 * Formats a card nicely for text display (e.g. "J♥ [Right Bower]")
 */
export function formatCardName(card: Card, trumpSuit?: Suit): string {
  const suitSymbols: Record<Suit, string> = {
    spades: '♠',
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
  };

  const symbol = suitSymbols[card.suit];
  let tag = '';
  if (isRightBower(card, trumpSuit)) {
    tag = ' (Right Bower)';
  } else if (isLeftBower(card, trumpSuit)) {
    tag = ' (Left Bower)';
  }

  return `${card.rank}${symbol}${tag}`;
}

export function getSuitSymbol(suit: Suit): string {
  const symbols: Record<Suit, string> = {
    spades: '♠',
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
  };
  return symbols[suit];
}

export function getSuitColor(suit: Suit): 'red' | 'black' {
  return isRedSuit(suit) ? 'red' : 'black';
}
