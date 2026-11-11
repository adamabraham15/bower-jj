/**
 * BOWER JJ — Game State Machine, Scoring & Loners Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  initializeGame,
  dealNewHand,
  handleBid,
  handleDealerDiscard,
  playCard,
  completeTrick,
  startNextHand,
} from '../game';
import { Player, Card, DEFAULT_RULES, PlayerPosition } from '../types';

function createMockPlayers(): Player[] {
  return [
    { id: 'p0', name: 'You (South)', position: 0, isAI: false, avatarId: 'av1' },
    { id: 'p1', name: 'West (Bot)', position: 1, isAI: true, avatarId: 'av2' },
    { id: 'p2', name: 'North (Partner)', position: 2, isAI: true, avatarId: 'av3' },
    { id: 'p3', name: 'East (Bot)', position: 3, isAI: true, avatarId: 'av4' },
  ];
}

describe('Euchre Game State Machine', () => {
  it('initializes game with 4 players and deals 5 cards each with 4 kitty cards', () => {
    const players = createMockPlayers();
    const game = initializeGame(players, DEFAULT_RULES, 0);

    expect(game.players.length).toBe(4);
    expect(game.dealer).toBe(0);
    expect(game.currentTurn).toBe(1); // Player left of dealer bids first
    expect(game.phase).toBe('bidding_round_1');
    expect(game.upCard).toBeDefined();
    expect(game.kitty.length).toBe(4);

    expect(game.hands[0].length).toBe(5);
    expect(game.hands[1].length).toBe(5);
    expect(game.hands[2].length).toBe(5);
    expect(game.hands[3].length).toBe(5);
  });

  it('rotates dealer clockwise on each new hand', () => {
    const players = createMockPlayers();
    let game = initializeGame(players, DEFAULT_RULES, 0);
    expect(game.dealer).toBe(0);

    // Simulate hand scored
    game = {
      ...game,
      phase: 'hand_scored',
      scores: [1, 0],
    };

    game = startNextHand(game);
    expect(game.dealer).toBe(1); // Next dealer is West (1)
    expect(game.currentTurn).toBe(2); // First bidder is North (2)
  });

  it('handles Round 1 ordering up, dealer pickup and discard', () => {
    const players = createMockPlayers();
    let game = initializeGame(players, DEFAULT_RULES, 0);

    const upCard = game.upCard!;
    // Player 1 (West) orders up the upcard
    game = handleBid(game, {
      player: 1,
      type: 'order_up',
      alone: false,
    });

    expect(game.phase).toBe('dealer_discard');
    expect(game.trumpSuit).toBe(upCard.suit);
    expect(game.callingPlayer).toBe(1);
    expect(game.callingTeam).toBe(1); // Team Red
    expect(game.hands[0].length).toBe(6); // Dealer (Player 0) picked up upcard

    // Dealer (Player 0) discards the upcard or another card
    const cardToDiscard = game.hands[0][0];
    game = handleDealerDiscard(game, cardToDiscard);

    expect(game.phase).toBe('playing');
    expect(game.hands[0].length).toBe(5); // Hand back to 5 cards
    expect(game.currentTurn).toBe(1); // Player left of dealer leads trick 1
  });

  it('forces partner to go alone when ordering up their partner dealer', () => {
    const players = createMockPlayers();
    let game = initializeGame(players, DEFAULT_RULES, 0); // Dealer is Player 0 (South)

    // Player 1 (West) passes
    game = handleBid(game, { player: 1, type: 'pass', alone: false });
    expect(game.currentTurn).toBe(2); // Turn is Player 2 (North, dealer partner)

    // Player 2 orders up dealer Player 0 without explicitly checking alone
    game = handleBid(game, { player: 2, type: 'order_up', alone: false });

    // Under North American Euchre rule, partner ordering up dealer MUST go alone!
    expect(game.isAlone).toBe(true);
    expect(game.alonePlayer).toBe(2); // North is going alone
    expect(game.benchedPlayer).toBe(0); // Dealer South is benched!
    expect(game.phase).toBe('dealer_discard');

    // Dealer discards
    game = handleDealerDiscard(game, game.hands[0][0]);
    expect(game.phase).toBe('playing');
    // First lead is player left of dealer (West, Player 1)
    expect(game.currentTurn).toBe(1);
  });

  it('advances to Round 2 if all 4 players pass in Round 1', () => {
    const players = createMockPlayers();
    let game = initializeGame(players, DEFAULT_RULES, 0);

    // Player 1 passes
    game = handleBid(game, { player: 1, type: 'pass', alone: false });
    expect(game.currentTurn).toBe(2);

    // Player 2 passes
    game = handleBid(game, { player: 2, type: 'pass', alone: false });
    expect(game.currentTurn).toBe(3);

    // Player 3 passes
    game = handleBid(game, { player: 3, type: 'pass', alone: false });
    expect(game.currentTurn).toBe(0);

    // Dealer (Player 0) passes -> Advances to Round 2!
    game = handleBid(game, { player: 0, type: 'pass', alone: false });
    expect(game.phase).toBe('bidding_round_2');
    expect(game.currentTurn).toBe(1); // Player 1 bids first in Round 2
  });

  it('prevents calling turned-down suit in Round 2', () => {
    const players = createMockPlayers();
    let game = initializeGame(players, DEFAULT_RULES, 0);
    const upSuit = game.upCard!.suit;

    // Pass Round 1
    game = handleBid(game, { player: 1, type: 'pass', alone: false });
    game = handleBid(game, { player: 2, type: 'pass', alone: false });
    game = handleBid(game, { player: 3, type: 'pass', alone: false });
    game = handleBid(game, { player: 0, type: 'pass', alone: false });

    // Try calling the turned down suit -> throws error
    expect(() => {
      handleBid(game, { player: 1, type: 'call_trump', suit: upSuit, alone: false });
    }).toThrow();
  });

  it('correctly handles going alone and benches partner', () => {
    const players = createMockPlayers();
    let game = initializeGame(players, DEFAULT_RULES, 0);

    // Player 1 orders up ALONE
    game = handleBid(game, {
      player: 1,
      type: 'order_up',
      alone: true,
    });

    expect(game.isAlone).toBe(true);
    expect(game.alonePlayer).toBe(1);
    expect(game.benchedPlayer).toBe(3); // Player 3 (East, partner of 1) is benched!

    // Dealer discards
    game = handleDealerDiscard(game, game.hands[0][0]);
    expect(game.phase).toBe('playing');
    expect(game.currentTurn).toBe(1); // West leads
  });

  it('correctly scores 4 points for a Loner March (all 5 tricks won)', () => {
    const players = createMockPlayers();
    let game = initializeGame(players, DEFAULT_RULES, 0);

    // Simulate player 0 calling alone in Round 2
    game = {
      ...game,
      phase: 'playing',
      trumpSuit: 'hearts',
      callingPlayer: 0,
      callingTeam: 0,
      isAlone: true,
      alonePlayer: 0,
      benchedPlayer: 2,
      tricksWon: [4, 0], // Player 0's team won 4 tricks prior to this 5th trick
      completedTricks: [
        { leadPlayer: 0, cards: [] },
        { leadPlayer: 0, cards: [] },
        { leadPlayer: 0, cards: [] },
        { leadPlayer: 0, cards: [] },
      ],
      currentTrick: {
        leadPlayer: 0,
        leadSuit: 'hearts',
        cards: [
          { player: 0, card: { id: 'hearts-J', suit: 'hearts', rank: 'J' } }, // Right Bower
          { player: 1, card: { id: 'hearts-9', suit: 'hearts', rank: '9' } },
          { player: 3, card: { id: 'hearts-10', suit: 'hearts', rank: '10' } },
        ],
      },
    };

    // When 5th trick resolves
    const scoredState = completeTrick(game);

    expect(scoredState.phase).toBe('hand_scored');
    expect(scoredState.scores[0]).toBe(4); // 4 points for loner march!
    expect(scoredState.scores[1]).toBe(0);
    expect(scoredState.lastHandResult?.isMarch).toBe(true);
  });

  it('correctly scores 2 points for a Euchre when defenders take 3+ tricks', () => {
    const players = createMockPlayers();
    let game = initializeGame(players, DEFAULT_RULES, 0);

    // Team 0 called, but Team 1 won 3 tricks
    game = {
      ...game,
      phase: 'playing',
      trumpSuit: 'hearts',
      callingPlayer: 0,
      callingTeam: 0,
      isAlone: false,
      tricksWon: [2, 2], // 2 tricks each so far, 5th trick won by Team 1 (Player 1)
      completedTricks: [
        { leadPlayer: 0, cards: [] },
        { leadPlayer: 0, cards: [] },
        { leadPlayer: 0, cards: [] },
        { leadPlayer: 0, cards: [] },
      ],
      currentTrick: {
        leadPlayer: 1,
        leadSuit: 'hearts',
        cards: [
          { player: 1, card: { id: 'hearts-A', suit: 'hearts', rank: 'A' } }, // Winner
          { player: 2, card: { id: 'hearts-K', suit: 'hearts', rank: 'K' } },
          { player: 3, card: { id: 'hearts-Q', suit: 'hearts', rank: 'Q' } },
          { player: 0, card: { id: 'hearts-10', suit: 'hearts', rank: '10' } },
        ],
      },
    };

    const finalState = completeTrick(game);

    expect(finalState.scores[0]).toBe(0);
    expect(finalState.scores[1]).toBe(2); // 2 points to defending team for Euchre!
    expect(finalState.lastHandResult?.isEuchre).toBe(true);
  });

  it('triggers game over when a team reaches the target score', () => {
    const players = createMockPlayers();
    let game = initializeGame(players, { ...DEFAULT_RULES, targetScore: 10 }, 0);

    // Score is 9-8, Team 0 makes their bid to reach 10
    game = {
      ...game,
      phase: 'playing',
      scores: [9, 8],
      trumpSuit: 'hearts',
      callingPlayer: 0,
      callingTeam: 0,
      isAlone: false,
      tricksWon: [2, 2],
      completedTricks: [
        { leadPlayer: 0, cards: [] },
        { leadPlayer: 0, cards: [] },
        { leadPlayer: 0, cards: [] },
        { leadPlayer: 0, cards: [] },
      ],
      currentTrick: {
        leadPlayer: 0,
        leadSuit: 'hearts',
        cards: [
          { player: 0, card: { id: 'hearts-J', suit: 'hearts', rank: 'J' } }, // Right Bower wins
          { player: 1, card: { id: 'hearts-9', suit: 'hearts', rank: '9' } },
          { player: 2, card: { id: 'hearts-10', suit: 'hearts', rank: '10' } },
          { player: 3, card: { id: 'hearts-Q', suit: 'hearts', rank: 'Q' } },
        ],
      },
    };

    const finalState = completeTrick(game);

    expect(finalState.scores[0]).toBe(10);
    expect(finalState.phase).toBe('game_over'); // Match is won!
  });
});
