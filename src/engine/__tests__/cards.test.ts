/**
 * BOWER JJ — Card & Bower Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  isRightBower,
  isLeftBower,
  isBower,
  getSameColorSuit,
  getEffectiveSuit,
  getCardTrickStrength,
  isCardPlayLegal,
  resolveTrickWinner,
  createEuchreDeck,
} from '../cards';
import { Card, Trick } from '../types';

describe('Card & Bower Rules', () => {
  it('correctly maps same-color suits', () => {
    expect(getSameColorSuit('spades')).toBe('clubs');
    expect(getSameColorSuit('clubs')).toBe('spades');
    expect(getSameColorSuit('hearts')).toBe('diamonds');
    expect(getSameColorSuit('diamonds')).toBe('hearts');
  });

  it('correctly identifies Right and Left Bowers for all 4 suits', () => {
    const jackHearts: Card = { id: 'hearts-J', suit: 'hearts', rank: 'J' };
    const jackDiamonds: Card = { id: 'diamonds-J', suit: 'diamonds', rank: 'J' };
    const jackSpades: Card = { id: 'spades-J', suit: 'spades', rank: 'J' };
    const jackClubs: Card = { id: 'clubs-J', suit: 'clubs', rank: 'J' };

    // When Hearts is Trump:
    expect(isRightBower(jackHearts, 'hearts')).toBe(true);
    expect(isLeftBower(jackDiamonds, 'hearts')).toBe(true);
    expect(isBower(jackHearts, 'hearts')).toBe(true);
    expect(isBower(jackDiamonds, 'hearts')).toBe(true);
    expect(isBower(jackSpades, 'hearts')).toBe(false);
    expect(isBower(jackClubs, 'hearts')).toBe(false);

    // When Spades is Trump:
    expect(isRightBower(jackSpades, 'spades')).toBe(true);
    expect(isLeftBower(jackClubs, 'spades')).toBe(true);
    expect(isRightBower(jackClubs, 'spades')).toBe(false);
    expect(isLeftBower(jackSpades, 'spades')).toBe(false);

    // When Clubs is Trump:
    expect(isRightBower(jackClubs, 'clubs')).toBe(true);
    expect(isLeftBower(jackSpades, 'clubs')).toBe(true);

    // When Diamonds is Trump:
    expect(isRightBower(jackDiamonds, 'diamonds')).toBe(true);
    expect(isLeftBower(jackHearts, 'diamonds')).toBe(true);
  });

  it('treats Left Bower as Trump suit, NOT its printed suit', () => {
    const jackDiamonds: Card = { id: 'diamonds-J', suit: 'diamonds', rank: 'J' };
    // Hearts is Trump -> Jack of Diamonds effective suit is HEARTS
    expect(getEffectiveSuit(jackDiamonds, 'hearts')).toBe('hearts');

    // Spades is Trump -> Jack of Diamonds effective suit remains DIAMONDS
    expect(getEffectiveSuit(jackDiamonds, 'spades')).toBe('diamonds');
  });

  it('enforces exact card hierarchy in trump suit', () => {
    const trump = 'hearts';
    const rightBower: Card = { id: 'hearts-J', suit: 'hearts', rank: 'J' };
    const leftBower: Card = { id: 'diamonds-J', suit: 'diamonds', rank: 'J' };
    const aceTrump: Card = { id: 'hearts-A', suit: 'hearts', rank: 'A' };
    const kingTrump: Card = { id: 'hearts-K', suit: 'hearts', rank: 'K' };
    const queenTrump: Card = { id: 'hearts-Q', suit: 'hearts', rank: 'Q' };
    const tenTrump: Card = { id: 'hearts-10', suit: 'hearts', rank: '10' };
    const nineTrump: Card = { id: 'hearts-9', suit: 'hearts', rank: '9' };
    const offAce: Card = { id: 'spades-A', suit: 'spades', rank: 'A' };

    const strRight = getCardTrickStrength(rightBower, 'hearts', trump);
    const strLeft = getCardTrickStrength(leftBower, 'hearts', trump);
    const strAce = getCardTrickStrength(aceTrump, 'hearts', trump);
    const strKing = getCardTrickStrength(kingTrump, 'hearts', trump);
    const strQueen = getCardTrickStrength(queenTrump, 'hearts', trump);
    const strTen = getCardTrickStrength(tenTrump, 'hearts', trump);
    const strNine = getCardTrickStrength(nineTrump, 'hearts', trump);
    const strOffAce = getCardTrickStrength(offAce, 'hearts', trump);

    expect(strRight).toBeGreaterThan(strLeft);
    expect(strLeft).toBeGreaterThan(strAce);
    expect(strAce).toBeGreaterThan(strKing);
    expect(strKing).toBeGreaterThan(strQueen);
    expect(strQueen).toBeGreaterThan(strTen);
    expect(strTen).toBeGreaterThan(strNine);
    expect(strNine).toBeGreaterThan(strOffAce); // Lowest trump beats off-suit Ace!
  });

  it('enforces following suit when trump is led and player holds Left Bower', () => {
    const trump = 'hearts';
    const jackDiamonds: Card = { id: 'diamonds-J', suit: 'diamonds', rank: 'J' }; // Left Bower!
    const nineSpades: Card = { id: 'spades-9', suit: 'spades', rank: '9' };

    const hand: Card[] = [jackDiamonds, nineSpades];

    // Trump (Hearts) led
    const trick: Trick = {
      leadPlayer: 1,
      leadSuit: 'hearts',
      cards: [{ player: 1, card: { id: 'hearts-K', suit: 'hearts', rank: 'K' } }],
    };

    // Jack of Diamonds is a Heart, so player CANNOT play 9 of Spades (renege)!
    expect(isCardPlayLegal(nineSpades, hand, trick, trump)).toBe(false);
    // Playing the Left Bower is legal
    expect(isCardPlayLegal(jackDiamonds, hand, trick, trump)).toBe(true);
  });

  it('does NOT force Left Bower to follow suit when its original printed suit is led', () => {
    const trump = 'hearts';
    const jackDiamonds: Card = { id: 'diamonds-J', suit: 'diamonds', rank: 'J' }; // Left Bower (is a Heart)
    const nineSpades: Card = { id: 'spades-9', suit: 'spades', rank: '9' };

    // Diamonds led
    const trick: Trick = {
      leadPlayer: 1,
      leadSuit: 'diamonds',
      cards: [{ player: 1, card: { id: 'diamonds-K', suit: 'diamonds', rank: 'K' } }],
    };

    const hand: Card[] = [jackDiamonds, nineSpades];
    // Player has NO diamonds (Jack of Diamonds is a Heart, not a Diamond)!
    // So player is void in Diamonds and can legally play either card!
    expect(isCardPlayLegal(nineSpades, hand, trick, trump)).toBe(true);
    expect(isCardPlayLegal(jackDiamonds, hand, trick, trump)).toBe(true); // Trumping in!
  });

  it('resolves trick winners accurately', () => {
    const trump = 'spades';
    // Trick: Lead Queen of Hearts, followed by King of Hearts, Ace of Hearts, and 9 of Spades (trump)
    const trick: Trick = {
      leadPlayer: 0,
      leadSuit: 'hearts',
      cards: [
        { player: 0, card: { id: 'hearts-Q', suit: 'hearts', rank: 'Q' } },
        { player: 1, card: { id: 'hearts-K', suit: 'hearts', rank: 'K' } },
        { player: 2, card: { id: 'hearts-A', suit: 'hearts', rank: 'A' } },
        { player: 3, card: { id: 'spades-9', suit: 'spades', rank: '9' } }, // Trumped!
      ],
    };

    const result = resolveTrickWinner(trick, trump);
    expect(result.winner).toBe(3); // 9 of Spades wins over Ace of Hearts!
    expect(result.winningCard.id).toBe('spades-9');
  });

  it('creates deck of exactly 24 cards', () => {
    const deck = createEuchreDeck();
    expect(deck.length).toBe(24);
  });
});
