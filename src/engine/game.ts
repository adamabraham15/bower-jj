/**
 * BOWER JJ — Game State Machine & Rules Engine
 * 
 * Implements pure functional state transitions for Euchre:
 * - Deterministic actions: (state, action) -> nextState
 * - Dealer rotation
 * - Bidding Round 1 & Round 2
 * - Dealer discard
 * - 5-trick play loop with Left/Right Bower logic
 * - "Go Alone" partner benching
 * - March, Euchre, and Loner scoring
 * - Match victory check
 */

import {
  Card,
  Suit,
  PlayerPosition,
  Team,
  Player,
  EuchreGameState,
  EuchreHouseRules,
  DEFAULT_RULES,
  HandScoreResult,
  Trick,
  getPlayerTeam,
  getPlayerPartner,
  getNextPlayer,
  BidDecision,
} from './types';
import {
  createEuchreDeck,
  shuffleDeck,
  getEffectiveSuit,
  isCardPlayLegal,
  getLegalPlays,
  resolveTrickWinner,
  getSameColorSuit,
  formatCardName,
} from './cards';

/**
 * Picks a randomized initial dealer seat (0-3) so starting dealer and first bidder vary each game.
 */
export function pickRandomDealer(): PlayerPosition {
  return Math.floor(Math.random() * 4) as PlayerPosition;
}

/**
 * Returns true when Canadian Loner rules automatically require going alone upon ordering up a partner.
 */
export function isCanadianLonerForced(
  rules: Partial<EuchreHouseRules> | undefined,
  isPartnerOfDealer: boolean
): boolean {
  const allowAloneCalls = rules?.allowAloneCalls ?? true;
  const partnerOrderUpGoesAlone = rules?.partnerOrderUpGoesAlone ?? rules?.canadianLoner ?? true;
  return Boolean(allowAloneCalls && isPartnerOfDealer && partnerOrderUpGoesAlone);
}

/**
 * Determines whether a card in the player's hand tray can currently be tapped.
 * Dealer discards remain interactive even if the partner's alone call benched the dealer for trick play.
 */
export function isHandCardInteractive({
  isDealerDiscardPhase,
  isBenched,
  isYourTurn,
  isLegal,
}: {
  isDealerDiscardPhase: boolean;
  isBenched: boolean;
  isYourTurn: boolean;
  isLegal: boolean;
}): boolean {
  return isDealerDiscardPhase || (!isBenched && isYourTurn && isLegal);
}

/**
 * Initializes a new Euchre game with 4 players.
 */
export function initializeGame(
  players: Player[],
  rules: EuchreHouseRules = DEFAULT_RULES,
  firstDealer: PlayerPosition = pickRandomDealer()
): EuchreGameState {
  if (players.length !== 4) {
    throw new Error('Euchre requires exactly 4 players');
  }

  const initialState: EuchreGameState = {
    players,
    dealer: firstDealer,
    currentTurn: getNextPlayer(firstDealer),
    phase: 'idle',
    deck: [],
    kitty: [],
    hands: {
      0: [],
      1: [],
      2: [],
      3: [],
    },
    isAlone: false,
    currentTrick: {
      leadPlayer: getNextPlayer(firstDealer),
      cards: [],
    },
    completedTricks: [],
    tricksWon: [0, 0],
    scores: [0, 0],
    rules,
    history: ['Game initialized.'],
  };

  return dealNewHand(initialState);
}

/**
 * Deals 5 cards to each player and flips 1 upcard onto the kitty.
 */
export function dealNewHand(state: EuchreGameState, customDeck?: Card[]): EuchreGameState {
  const deck = customDeck ? [...customDeck] : shuffleDeck(createEuchreDeck());

  const hands: Record<PlayerPosition, Card[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
  };

  // Deal 5 cards to each player (20 cards)
  let cardIdx = 0;
  for (let round = 0; round < 5; round++) {
    for (let p = 0; p < 4; p++) {
      const pos = ((state.dealer + 1 + p) % 4) as PlayerPosition;
      hands[pos].push(deck[cardIdx++]);
    }
  }

  // Remaining 4 cards are the kitty; top card is turned up
  const kitty = deck.slice(20);
  const upCard = kitty[0];

  const firstBidder = getNextPlayer(state.dealer);

  return {
    ...state,
    deck,
    kitty,
    upCard,
    hands,
    trumpSuit: undefined,
    callingPlayer: undefined,
    callingTeam: undefined,
    isAlone: false,
    alonePlayer: undefined,
    benchedPlayer: undefined,
    phase: 'bidding_round_1',
    currentTurn: firstBidder,
    currentTrick: {
      leadPlayer: firstBidder,
      cards: [],
    },
    completedTricks: [],
    tricksWon: [0, 0],
    history: [
      ...state.history,
      `--- Hand started. Dealer: ${state.players[state.dealer].name} ---`,
      `Turned-up card is ${formatCardName(upCard)}.`,
    ],
  };
}

/**
 * Handles a bidding decision in Round 1 or Round 2.
 */
export function handleBid(
  state: EuchreGameState,
  decision: BidDecision
): EuchreGameState {
  if (state.currentTurn !== decision.player) {
    throw new Error(`Not player ${decision.player}'s turn to bid`);
  }

  if (state.phase === 'bidding_round_1') {
    return handleRound1Bid(state, decision);
  } else if (state.phase === 'bidding_round_2') {
    return handleRound2Bid(state, decision);
  } else {
    throw new Error(`Cannot bid during phase ${state.phase}`);
  }
}

function handleRound1Bid(state: EuchreGameState, decision: BidDecision): EuchreGameState {
  const upCard = state.upCard;
  if (!upCard) throw new Error('No upcard in Round 1');

  const player = state.players[decision.player];

  if (decision.type === 'pass') {
    const isDealer = decision.player === state.dealer;
    const history = [...state.history, `${player.name} passed.`];

    if (isDealer) {
      // All 4 players passed in Round 1 -> Advance to Round 2
      const firstBidderRound2 = getNextPlayer(state.dealer);
      return {
        ...state,
        phase: 'bidding_round_2',
        currentTurn: firstBidderRound2,
        history: [...history, `${formatCardName(upCard)} turned down. Round 2 bidding begins.`],
      };
    } else {
      // Next player's turn
      return {
        ...state,
        currentTurn: getNextPlayer(decision.player),
        history,
      };
    }
  }

  // Player ordered up or picked up
  const isPartnerOrderingDealer = decision.player === getPlayerPartner(state.dealer);
  const isAlone = (decision.alone || (isPartnerOrderingDealer && state.rules.partnerOrderUpGoesAlone)) && state.rules.allowAloneCalls;
  const callingTeam = getPlayerTeam(decision.player);
  const benchedPlayer = isAlone ? getPlayerPartner(decision.player) : undefined;
  const trumpSuit = upCard.suit;

  const actionText = decision.player === state.dealer
    ? `${player.name} picked up the ${formatCardName(upCard)}`
    : isPartnerOrderingDealer
    ? `${player.name} ordered up partner ${state.players[state.dealer].name} with ${formatCardName(upCard)}`
    : `${player.name} ordered up the ${formatCardName(upCard)}`;
  const aloneText = isAlone
    ? (isPartnerOrderingDealer ? ' and MUST GO ALONE!' : ' and is GOING ALONE!')
    : '.';

  // Dealer picks up the upcard into their hand (dealer now has 6 cards)
  const dealerHand = [...state.hands[state.dealer], upCard];
  const newHands = {
    ...state.hands,
    [state.dealer]: dealerHand,
  };

  return {
    ...state,
    phase: 'dealer_discard',
    trumpSuit,
    callingPlayer: decision.player,
    callingTeam,
    isAlone,
    alonePlayer: isAlone ? decision.player : undefined,
    benchedPlayer,
    hands: newHands,
    currentTurn: state.dealer, // Dealer must now discard
    history: [...state.history, `${actionText}${aloneText}`],
  };
}

function handleRound2Bid(state: EuchreGameState, decision: BidDecision): EuchreGameState {
  const player = state.players[decision.player];
  const upCard = state.upCard;

  if (decision.type === 'pass') {
    const isDealer = decision.player === state.dealer;

    if (isDealer) {
      if (state.rules.stickTheDealer) {
        throw new Error('Dealer cannot pass when Stick The Dealer is enabled');
      }

      // If dealer passes and not stuck, hand is misdealt/passed out -> redeal to next dealer
      const nextDealer = getNextPlayer(state.dealer);
      const nextState: EuchreGameState = {
        ...state,
        dealer: nextDealer,
        history: [...state.history, `${player.name} passed. All passed. Redealing.`],
      };
      return dealNewHand(nextState);
    }

    return {
      ...state,
      currentTurn: getNextPlayer(decision.player),
      history: [...state.history, `${player.name} passed.`],
    };
  }

  // Calling trump in Round 2
  const chosenSuit = decision.suit;
  if (!chosenSuit) {
    throw new Error('Must specify a suit when calling trump in Round 2');
  }

  if (!state.rules.canCallTurnedDownSuit && upCard && chosenSuit === upCard.suit) {
    throw new Error(`Cannot call the turned-down suit (${upCard.suit})`);
  }

  const isAlone = decision.alone && state.rules.allowAloneCalls;
  const callingTeam = getPlayerTeam(decision.player);
  const benchedPlayer = isAlone ? getPlayerPartner(decision.player) : undefined;

  // Determine who leads first trick (dealer's left, skipping if benched)
  let firstLead = getNextPlayer(state.dealer);
  if (benchedPlayer !== undefined && firstLead === benchedPlayer) {
    firstLead = getNextPlayer(firstLead);
  }

  const aloneText = isAlone ? ' and is GOING ALONE!' : '';

  return {
    ...state,
    phase: 'playing',
    trumpSuit: chosenSuit,
    callingPlayer: decision.player,
    callingTeam,
    isAlone,
    alonePlayer: isAlone ? decision.player : undefined,
    benchedPlayer,
    currentTurn: firstLead,
    currentTrick: {
      leadPlayer: firstLead,
      cards: [],
    },
    history: [
      ...state.history,
      `${player.name} called ${chosenSuit.toUpperCase()} as trump${aloneText}.`,
    ],
  };
}

/**
 * Handles the dealer discarding one of their 6 cards.
 */
export function handleDealerDiscard(
  state: EuchreGameState,
  cardToDiscard: Card
): EuchreGameState {
  if (state.phase !== 'dealer_discard') {
    throw new Error('Cannot discard outside dealer_discard phase');
  }

  const dealerHand = state.hands[state.dealer];
  if (dealerHand.length !== 6) {
    throw new Error('Dealer must hold 6 cards before discarding');
  }

  const cardIndex = dealerHand.findIndex(c => c.id === cardToDiscard.id);
  if (cardIndex === -1) {
    throw new Error('Discarded card is not in dealer hand');
  }

  const updatedDealerHand = [
    ...dealerHand.slice(0, cardIndex),
    ...dealerHand.slice(cardIndex + 1),
  ];

  // First lead is player left of dealer, unless benched
  let firstLead = getNextPlayer(state.dealer);
  if (state.benchedPlayer !== undefined && firstLead === state.benchedPlayer) {
    firstLead = getNextPlayer(firstLead);
  }

  return {
    ...state,
    phase: 'playing',
    hands: {
      ...state.hands,
      [state.dealer]: updatedDealerHand,
    },
    currentTurn: firstLead,
    currentTrick: {
      leadPlayer: firstLead,
      cards: [],
    },
    history: [
      ...state.history,
      `${state.players[state.dealer].name} discarded a card. Trick play begins.`,
    ],
  };
}

/**
 * Plays a card into the current trick.
 */
export function playCard(
  state: EuchreGameState,
  player: PlayerPosition,
  card: Card
): EuchreGameState {
  if (state.phase !== 'playing') {
    throw new Error('Cannot play cards outside playing phase');
  }

  if (state.currentTurn !== player) {
    throw new Error(`It is player ${state.currentTurn}'s turn, not player ${player}`);
  }

  if (state.benchedPlayer === player) {
    throw new Error('Benched player cannot play cards');
  }

  const hand = state.hands[player];
  if (!isCardPlayLegal(card, hand, state.currentTrick, state.trumpSuit)) {
    throw new Error(`Illegal card play: ${card.id}`);
  }

  // Remove card from player hand
  const newHand = hand.filter(c => c.id !== card.id);
  const newHands = {
    ...state.hands,
    [player]: newHand,
  };

  // Add card to current trick
  const leadSuit = state.currentTrick.cards.length === 0
    ? getEffectiveSuit(card, state.trumpSuit)
    : state.currentTrick.leadSuit;

  const playedCard = { player, card };
  const updatedTrick: Trick = {
    ...state.currentTrick,
    leadSuit,
    cards: [...state.currentTrick.cards, playedCard],
  };

  const history = [
    ...state.history,
    `${state.players[player].name} played ${formatCardName(card, state.trumpSuit)}.`,
  ];

  // Check if trick is complete
  const expectedCards = state.isAlone ? 3 : 4;
  if (updatedTrick.cards.length === expectedCards) {
    const { winner, winningCard } = resolveTrickWinner(updatedTrick, state.trumpSuit);
    const resolvedTrick: Trick = {
      ...updatedTrick,
      winner: winner as PlayerPosition,
      winningCard,
    };
    const trickWinnerPlayer = state.players[winner as PlayerPosition];
    return {
      ...state,
      hands: newHands,
      currentTrick: resolvedTrick,
      phase: 'trick_resolving',
      history: [
        ...history,
        `Trick won by ${trickWinnerPlayer.name} with ${formatCardName(winningCard, state.trumpSuit)}.`,
      ],
    };
  }

  // Trick still in progress -> advance to next active player
  let nextPlayer = getNextPlayer(player);
  if (state.benchedPlayer !== undefined && nextPlayer === state.benchedPlayer) {
    nextPlayer = getNextPlayer(nextPlayer);
  }

  return {
    ...state,
    hands: newHands,
    currentTrick: updatedTrick,
    currentTurn: nextPlayer,
    history,
  };
}

/**
 * Resolves a completed trick and determines if the hand is finished.
 */
export function completeTrick(state: EuchreGameState): EuchreGameState {
  const currentTrick = state.currentTrick;
  const winner = currentTrick.winner !== undefined
    ? currentTrick.winner
    : resolveTrickWinner(currentTrick, state.trumpSuit).winner;
  const winningCard = currentTrick.winningCard !== undefined
    ? currentTrick.winningCard
    : resolveTrickWinner(currentTrick, state.trumpSuit).winningCard;

  const winningTeam = getPlayerTeam(winner as PlayerPosition);

  const newTricksWon: [number, number] = [
    state.tricksWon[0] + (winningTeam === 0 ? 1 : 0),
    state.tricksWon[1] + (winningTeam === 1 ? 1 : 0),
  ];

  const resolvedTrick: Trick = {
    ...currentTrick,
    winner: winner as PlayerPosition,
    winningCard,
  };

  const updatedCompletedTricks = [...state.completedTricks, resolvedTrick];

  // Check if hand is finished (5 tricks completed)
  if (updatedCompletedTricks.length === 5) {
    return scoreHand({
      ...state,
      currentTrick: resolvedTrick,
      completedTricks: updatedCompletedTricks,
      tricksWon: newTricksWon,
    });
  }

  // Hand continues -> winner leads next trick
  return {
    ...state,
    phase: 'playing',
    currentTrick: {
      leadPlayer: winner as PlayerPosition,
      cards: [],
    },
    completedTricks: updatedCompletedTricks,
    tricksWon: newTricksWon,
    currentTurn: winner as PlayerPosition,
  };
}

/**
 * Calculates score for the finished hand and checks for game win.
 */
export function scoreHand(state: EuchreGameState): EuchreGameState {
  if (state.callingTeam === undefined || state.trumpSuit === undefined) {
    throw new Error('Cannot score hand without calling team and trump');
  }

  const callingTeam = state.callingTeam;
  const defendingTeam: Team = callingTeam === 0 ? 1 : 0;
  const callingTricks = state.tricksWon[callingTeam];
  const defendingTricks = state.tricksWon[defendingTeam];

  let pointsAwarded: [number, number] = [0, 0];
  let isMarch = false;
  let isEuchre = false;
  let message = '';

  if (callingTricks >= 3) {
    if (callingTricks === 5) {
      isMarch = true;
      if (state.isAlone) {
        // Loner March: 4 points!
        pointsAwarded[callingTeam] = 4;
        message = `Team ${callingTeam === 0 ? 'Blue' : 'Red'} called ALONE and swept all 5 tricks for 4 POINTS! 🏆`;
      } else {
        // Regular March: 2 points
        pointsAwarded[callingTeam] = 2;
        message = `Team ${callingTeam === 0 ? 'Blue' : 'Red'} won all 5 tricks (March) for 2 points!`;
      }
    } else {
      // Made bid (3 or 4 tricks): 1 point
      pointsAwarded[callingTeam] = 1;
      message = `Team ${callingTeam === 0 ? 'Blue' : 'Red'} made their bid with ${callingTricks} tricks for 1 point.`;
    }
  } else {
    // EUCHRED! Defending team won 3+ tricks
    isEuchre = true;
    pointsAwarded[defendingTeam] = 2;
    message = `EUCHRED! Team ${defendingTeam === 0 ? 'Blue' : 'Red'} defended successfully and earned 2 points! 🔥`;
  }

  const newScores: [number, number] = [
    state.scores[0] + pointsAwarded[0],
    state.scores[1] + pointsAwarded[1],
  ];

  const handResult: HandScoreResult = {
    callingTeam,
    calledAlone: state.isAlone,
    alonePlayer: state.alonePlayer,
    trumpSuit: state.trumpSuit,
    tricksWon: state.tricksWon,
    pointsAwarded,
    isMarch,
    isEuchre,
    message,
  };

  const isGameOver = newScores[0] >= state.rules.targetScore || newScores[1] >= state.rules.targetScore;
  const nextPhase = isGameOver ? 'game_over' : 'hand_scored';

  return {
    ...state,
    phase: nextPhase,
    scores: newScores,
    lastHandResult: handResult,
    history: [
      ...state.history,
      message,
      `Current score: Team Blue: ${newScores[0]} | Team Red: ${newScores[1]}`,
      isGameOver ? `GAME OVER! Team ${newScores[0] >= state.rules.targetScore ? 'Blue' : 'Red'} WINS!` : '',
    ].filter(Boolean),
  };
}

/**
 * Determines the winning team index (0 = Blue, 1 = Red) for a completed match
 * based on the configured target score, with a score-comparison fallback.
 */
export function getWinningTeam(scores: [number, number], targetScore = 10): Team {
  const team0Reached = scores[0] >= targetScore;
  const team1Reached = scores[1] >= targetScore;
  if (team0Reached && !team1Reached) return 0;
  if (team1Reached && !team0Reached) return 1;
  return scores[0] >= scores[1] ? 0 : 1;
}

/**
 * Starts the next hand after scoring, advancing the dealer clockwise.
 */
export function startNextHand(state: EuchreGameState): EuchreGameState {
  if (state.phase !== 'hand_scored') {
    throw new Error('Can only start next hand when previous hand is scored');
  }

  const nextDealer = getNextPlayer(state.dealer);
  return dealNewHand({
    ...state,
    dealer: nextDealer,
  });
}
