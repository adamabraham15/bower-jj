/**
 * BOWER JJ — AI Unit Tests for Easy, Medium, and Hard
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateHandStrength,
  decideRound1Bid,
  decideRound2Bid,
  decideDealerDiscard,
  decideCardPlay,
} from '../ai';
import { Card, EuchreGameState, DEFAULT_RULES, Player } from '../types';
import { initializeGame, handleBid } from '../game';
import { isCardPlayLegal } from '../cards';

function createMockState(): EuchreGameState {
  const players: Player[] = [
    { id: 'p0', name: 'South', position: 0, isAI: false, avatarId: 'av1' },
    { id: 'p1', name: 'West', position: 1, isAI: true, aiDifficulty: 'medium', avatarId: 'av2' },
    { id: 'p2', name: 'North', position: 2, isAI: true, aiDifficulty: 'medium', avatarId: 'av3' },
    { id: 'p3', name: 'East', position: 3, isAI: true, aiDifficulty: 'medium', avatarId: 'av4' },
  ];
  return initializeGame(players, DEFAULT_RULES, 0);
}

describe('AI Decision Engines (Easy, Medium, Hard)', () => {
  it('correctly values Bowers higher than non-trump Aces in hand evaluation', () => {
    const handWithBowers: Card[] = [
      { id: 'hearts-J', suit: 'hearts', rank: 'J' }, // Right Bower
      { id: 'diamonds-J', suit: 'diamonds', rank: 'J' }, // Left Bower
      { id: 'hearts-A', suit: 'hearts', rank: 'A' }, // Trump Ace
      { id: 'spades-A', suit: 'spades', rank: 'A' }, // Side Ace
      { id: 'clubs-9', suit: 'clubs', rank: '9' },
    ];

    const evalResult = evaluateHandStrength(handWithBowers, 'hearts', false);
    expect(evalResult.hasRight).toBe(true);
    expect(evalResult.hasLeft).toBe(true);
    expect(evalResult.trumpCount).toBe(3);
    expect(evalResult.score).toBeGreaterThan(10.0);
  });

  it('Easy AI only orders up if holding 4+ trumps', () => {
    let state = createMockState();
    state = {
      ...state,
      upCard: { id: 'hearts-K', suit: 'hearts', rank: 'K' },
      hands: {
        ...state.hands,
        1: [
          { id: 'hearts-9', suit: 'hearts', rank: '9' },
          { id: 'hearts-10', suit: 'hearts', rank: '10' },
          { id: 'spades-A', suit: 'spades', rank: 'A' },
          { id: 'spades-K', suit: 'spades', rank: 'K' },
          { id: 'clubs-Q', suit: 'clubs', rank: 'Q' },
        ],
      },
    };

    const easyBid = decideRound1Bid(state, 1, 'easy');
    expect(easyBid.type).toBe('pass'); // Only 2 trumps -> passes

    // Give Easy AI 4 trumps
    state.hands[1] = [
      { id: 'hearts-9', suit: 'hearts', rank: '9' },
      { id: 'hearts-10', suit: 'hearts', rank: '10' },
      { id: 'hearts-Q', suit: 'hearts', rank: 'Q' },
      { id: 'hearts-A', suit: 'hearts', rank: 'A' },
      { id: 'spades-A', suit: 'spades', rank: 'A' },
    ];

    const easyBid4 = decideRound1Bid(state, 1, 'easy');
    expect(easyBid4.type).toBe('order_up');
  });

  it('Hard AI detects loner hand and calls alone in Round 1 or Round 2', () => {
    let state = createMockState();
    state = {
      ...state,
      upCard: { id: 'hearts-10', suit: 'hearts', rank: '10' },
      hands: {
        ...state.hands,
        1: [
          { id: 'hearts-J', suit: 'hearts', rank: 'J' }, // Right Bower
          { id: 'diamonds-J', suit: 'diamonds', rank: 'J' }, // Left Bower
          { id: 'hearts-A', suit: 'hearts', rank: 'A' }, // Trump Ace
          { id: 'hearts-K', suit: 'hearts', rank: 'K' }, // Trump King
          { id: 'spades-A', suit: 'spades', rank: 'A' }, // Side Ace
        ],
      },
    };

    const hardBid = decideRound1Bid(state, 1, 'hard');
    expect(hardBid.type).toBe('order_up');
    expect(hardBid.alone).toBe(true); // Powerhouse hand triggers Go Alone!
  });

  it('Medium and Hard AI discard singleton off-suits to create void for trumping', () => {
    const dealerHand6: Card[] = [
      { id: 'hearts-J', suit: 'hearts', rank: 'J' }, // Right
      { id: 'hearts-A', suit: 'hearts', rank: 'A' }, // Trump A
      { id: 'hearts-10', suit: 'hearts', rank: '10' }, // Trump 10
      { id: 'spades-9', suit: 'spades', rank: '9' }, // Spades singleton!
      { id: 'clubs-10', suit: 'clubs', rank: '10' }, // Clubs doubleton
      { id: 'clubs-K', suit: 'clubs', rank: 'K' }, // Clubs doubleton
    ];

    const discarded = decideDealerDiscard(dealerHand6, 'hearts', 'hard');
    // Spades 9 is a singleton off-suit non-Ace, creating a void suit!
    expect(discarded.id).toBe('spades-9');
  });

  it('AI card play never violates legal play rules', () => {
    let state = createMockState();
    state = {
      ...state,
      phase: 'playing',
      trumpSuit: 'hearts',
      currentTrick: {
        leadPlayer: 0,
        leadSuit: 'clubs',
        cards: [
          { player: 0, card: { id: 'clubs-A', suit: 'clubs', rank: 'A' } },
        ],
      },
      hands: {
        ...state.hands,
        1: [
          { id: 'clubs-9', suit: 'clubs', rank: '9' }, // Has club! Must follow
          { id: 'hearts-J', suit: 'hearts', rank: 'J' },
          { id: 'spades-A', suit: 'spades', rank: 'A' },
        ],
      },
    };

    const played = decideCardPlay(state, 1, 'hard');
    expect(isCardPlayLegal(played, state.hands[1], state.currentTrick, 'hearts')).toBe(true);
    expect(played.id).toBe('clubs-9'); // Forced to follow suit
  });
});
