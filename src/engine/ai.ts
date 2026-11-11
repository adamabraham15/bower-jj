/**
 * BOWER JJ — AI Engine
 * 
 * Three Distinct Difficulties:
 * - Easy: Casual, beginner-friendly, makes straightforward bids and plays.
 * - Medium: Solid Euchre fundamentals, evaluates bowers, discards off-suits, respects partner.
 * - Hard: Advanced card counting, tracks played trumps & void suits, 'next' bidding theory, 
 *         2nd hand low / 3rd hand high tactics, strategic loners.
 */

import {
  Card,
  Suit,
  PlayerPosition,
  EuchreGameState,
  BidDecision,
  Trick,
  getPlayerTeam,
  getPlayerPartner,
  AIDifficulty,
} from './types';
import {
  ALL_SUITS,
  getEffectiveSuit,
  isRightBower,
  isLeftBower,
  isBower,
  getLegalPlays,
  getCardTrickStrength,
  getSameColorSuit,
  resolveTrickWinner,
} from './cards';

/**
 * Calculates heuristic bidding score for a prospective trump suit.
 */
export function evaluateHandStrength(
  hand: Card[],
  candidateTrump: Suit,
  isDealerPickingUp: boolean = false
): { score: number; trumpCount: number; hasRight: boolean; hasLeft: boolean; offAces: number } {
  let score = 0;
  let trumpCount = 0;
  let hasRight = false;
  let hasLeft = false;
  let offAces = 0;

  for (const card of hand) {
    if (isRightBower(card, candidateTrump)) {
      score += 4.0;
      trumpCount++;
      hasRight = true;
    } else if (isLeftBower(card, candidateTrump)) {
      score += 3.5;
      trumpCount++;
      hasLeft = true;
    } else if (card.suit === candidateTrump) {
      trumpCount++;
      switch (card.rank) {
        case 'A': score += 2.5; break;
        case 'K': score += 1.8; break;
        case 'Q': score += 1.4; break;
        case '10': score += 1.0; break;
        case '9': score += 0.8; break;
      }
    } else {
      // Off-suit card
      if (card.rank === 'A') {
        score += 1.5;
        offAces++;
      } else if (card.rank === 'K') {
        score += 0.4;
      }
    }
  }

  if (isDealerPickingUp) {
    // Picking up the upcard gives an extra trump and chance to discard junk
    score += 1.5;
  }

  return { score, trumpCount, hasRight, hasLeft, offAces };
}

/**
 * AI decision for Round 1 bidding (ordering up the upcard).
 */
export function decideRound1Bid(
  state: EuchreGameState,
  position: PlayerPosition,
  difficulty: AIDifficulty = 'medium'
): BidDecision {
  const upCard = state.upCard;
  if (!upCard) throw new Error('No upcard in Round 1');

  const hand = state.hands[position];
  const trump = upCard.suit;
  const isDealer = position === state.dealer;
  const isPartnerOfDealer = position === getPlayerPartner(state.dealer);

  const evalResult = evaluateHandStrength(hand, trump, isDealer);

  // EASY AI: Only bids if 4+ trumps
  if (difficulty === 'easy') {
    if (evalResult.trumpCount >= 4) {
      return {
        player: position,
        type: isDealer ? 'pick_up' : 'order_up',
        alone: false,
      };
    }
    return { player: position, type: 'pass', alone: false };
  }

  // Check for Going Alone: Right Bower + (Left or Ace) + 3+ trumps + high score
  const canGoAlone = evalResult.hasRight && (evalResult.hasLeft || evalResult.score >= 8.5) && evalResult.trumpCount >= 3;
  const shouldGoAlone = difficulty === 'hard'
    ? (evalResult.score >= 9.0 && (evalResult.trumpCount >= 4 || (evalResult.trumpCount >= 3 && evalResult.offAces >= 1)))
    : (evalResult.score >= 9.5 && evalResult.trumpCount >= 4);

  // MEDIUM AI
  if (difficulty === 'medium') {
    if (isDealer && evalResult.score >= 5.0) {
      return { player: position, type: 'pick_up', alone: shouldGoAlone };
    }
    if (isPartnerOfDealer) {
      // If ordering partner forces alone, partner must hold a true loner hand to order up
      if (state.rules.partnerOrderUpGoesAlone) {
        if (evalResult.score >= 8.5 && evalResult.trumpCount >= 3) {
          return { player: position, type: 'order_up', alone: true };
        }
        return { player: position, type: 'pass', alone: false };
      }
      if (evalResult.score >= 4.5) {
        return { player: position, type: 'order_up', alone: shouldGoAlone };
      }
    }
    if (!isDealer && !isPartnerOfDealer && evalResult.score >= 6.0) {
      return { player: position, type: 'order_up', alone: shouldGoAlone };
    }
    return { player: position, type: 'pass', alone: false };
  }

  // HARD AI: Advanced position play
  // If dealer: picks up with 4.5+ score
  if (isDealer) {
    if (evalResult.score >= 4.5) {
      return { player: position, type: 'pick_up', alone: shouldGoAlone };
    }
  } else if (isPartnerOfDealer) {
    // When ordering partner forces alone, only order up if holding an exceptional solo hand
    if (state.rules.partnerOrderUpGoesAlone) {
      if (evalResult.score >= 8.0 && evalResult.trumpCount >= 3) {
        return { player: position, type: 'order_up', alone: true };
      }
      return { player: position, type: 'pass', alone: false };
    }
    if (evalResult.score >= 4.0 || evalResult.trumpCount >= 3) {
      return { player: position, type: 'order_up', alone: shouldGoAlone };
    }
  } else {
    // Opponent ordering up into dealer's hand gives dealer a trump! Must be stronger
    if (evalResult.score >= 6.2 && evalResult.trumpCount >= 3) {
      return { player: position, type: 'order_up', alone: shouldGoAlone };
    }
  }

  return { player: position, type: 'pass', alone: false };
}

/**
 * AI decision for Round 2 bidding (naming a new trump suit).
 */
export function decideRound2Bid(
  state: EuchreGameState,
  position: PlayerPosition,
  difficulty: AIDifficulty = 'medium'
): BidDecision {
  const upCard = state.upCard;
  const turnedDownSuit = upCard?.suit;
  const hand = state.hands[position];
  const isDealer = position === state.dealer;

  const validSuits = ALL_SUITS.filter(s => s !== turnedDownSuit);

  // Evaluate all 3 eligible suits
  const evaluations = validSuits.map(suit => ({
    suit,
    eval: evaluateHandStrength(hand, suit, false),
  }));

  // Sort descending by score
  evaluations.sort((a, b) => b.eval.score - a.eval.score);
  const best = evaluations[0];

  // EASY AI
  if (difficulty === 'easy') {
    if (best.eval.trumpCount >= 3 && best.eval.score >= 5.0) {
      return { player: position, type: 'call_trump', suit: best.suit, alone: false };
    }
    if (isDealer && state.rules.stickTheDealer) {
      return { player: position, type: 'call_trump', suit: best.suit, alone: false };
    }
    return { player: position, type: 'pass', alone: false };
  }

  const shouldGoAlone = best.eval.score >= 9.0 && best.eval.trumpCount >= 3;

  // MEDIUM AI
  if (difficulty === 'medium') {
    if (best.eval.score >= 5.2 && best.eval.trumpCount >= 2) {
      return { player: position, type: 'call_trump', suit: best.suit, alone: shouldGoAlone };
    }
    if (isDealer && state.rules.stickTheDealer) {
      return { player: position, type: 'call_trump', suit: best.suit, alone: shouldGoAlone };
    }
    return { player: position, type: 'pass', alone: false };
  }

  // HARD AI: Incorporates "Next-Suit Theory"
  // If player is left of dealer (seat after dealer passed Round 1), dealer and partner turned down turnedDownSuit.
  // The same-color suit ("Next") is statistically favored because cards of that color were not in dealer's hand!
  let adjustedScore = best.eval.score;
  if (turnedDownSuit && best.suit === getSameColorSuit(turnedDownSuit)) {
    adjustedScore += 0.8; // Next-suit bonus
  }

  const threshold = isDealer ? 3.5 : 4.8;
  if (adjustedScore >= threshold && best.eval.trumpCount >= 2) {
    return { player: position, type: 'call_trump', suit: best.suit, alone: shouldGoAlone };
  }

  if (isDealer && state.rules.stickTheDealer) {
    return { player: position, type: 'call_trump', suit: best.suit, alone: false };
  }

  return { player: position, type: 'pass', alone: false };
}

/**
 * AI decision for Dealer Discard (choosing 1 of 6 cards to discard).
 */
export function decideDealerDiscard(
  hand: Card[], // Contains 6 cards
  trumpSuit: Suit,
  difficulty: AIDifficulty = 'medium'
): Card {
  if (hand.length !== 6) {
    throw new Error('Dealer must have 6 cards to discard');
  }

  // Never discard Right or Left Bower
  const nonBowers = hand.filter(c => !isBower(c, trumpSuit));

  // Count non-trump cards by suit to find singletons (void opportunities)
  const nonTrumpCards = nonBowers.filter(c => getEffectiveSuit(c, trumpSuit) !== trumpSuit);

  if (nonTrumpCards.length === 0) {
    // Entire hand is trump! Discard lowest trump (e.g. 9 or 10 of trump)
    const trumpOrder = ['9', '10', 'Q', 'K', 'A'];
    for (const rank of trumpOrder) {
      const match = nonBowers.find(c => c.rank === rank && c.suit === trumpSuit);
      if (match) return match;
    }
    return nonBowers[0];
  }

  if (difficulty === 'easy') {
    // Just pick the lowest non-trump card
    const rankValues: Record<string, number> = { '9': 1, '10': 2, 'J': 3, 'Q': 4, 'K': 5, 'A': 6 };
    return nonTrumpCards.sort((a, b) => rankValues[a.rank] - rankValues[b.rank])[0];
  }

  // MEDIUM & HARD: Void suit creation
  // Group non-trump cards by suit
  const suitCounts: Record<Suit, Card[]> = {
    spades: [],
    hearts: [],
    diamonds: [],
    clubs: [],
  };

  for (const card of nonTrumpCards) {
    suitCounts[card.suit].push(card);
  }

  // Look for a singleton non-Ace to discard, creating a void!
  for (const suit of ALL_SUITS) {
    const cards = suitCounts[suit];
    if (cards.length === 1 && cards[0].rank !== 'A') {
      return cards[0]; // Creating a void lets the AI trump this suit on later tricks!
    }
  }

  // Look for lowest card in a doubleton that is not an Ace
  const nonAces = nonTrumpCards.filter(c => c.rank !== 'A');
  if (nonAces.length > 0) {
    const rankValues: Record<string, number> = { '9': 1, '10': 2, 'J': 3, 'Q': 4, 'K': 5 };
    nonAces.sort((a, b) => rankValues[a.rank] - rankValues[b.rank]);
    return nonAces[0];
  }

  // If only Aces left, discard lowest ranking non-trump
  return nonTrumpCards[0];
}

/**
 * AI decision for playing a card in a trick.
 */
export function decideCardPlay(
  state: EuchreGameState,
  position: PlayerPosition,
  difficulty: AIDifficulty = 'medium'
): Card {
  const hand = state.hands[position];
  const trump = state.trumpSuit;
  const trick = state.currentTrick;
  const legalCards = getLegalPlays(hand, trick, trump);

  if (legalCards.length === 0) {
    throw new Error(`No legal plays for player ${position}`);
  }

  if (legalCards.length === 1) {
    return legalCards[0];
  }

  const isLeading = trick.cards.length === 0 || !trick.leadSuit;

  // EASY AI: Basic heuristic
  if (difficulty === 'easy') {
    if (isLeading) {
      // Lead highest card or random
      return legalCards[Math.floor(Math.random() * legalCards.length)];
    } else {
      // Try to win if possible, otherwise throw lowest
      const leadSuit = trick.leadSuit!;
      const winningCards = legalCards.filter(c => {
        const str = getCardTrickStrength(c, leadSuit, trump);
        return trick.cards.every(p => getCardTrickStrength(p.card, leadSuit, trump) < str);
      });
      if (winningCards.length > 0) {
        return winningCards[0];
      }
      return legalCards[0];
    }
  }

  // Determine current trick winner so far
  let currentWinningPlayer: PlayerPosition | undefined;
  let highestStrengthSoFar = -1;
  if (!isLeading) {
    const leadSuit = trick.leadSuit!;
    for (const p of trick.cards) {
      const str = getCardTrickStrength(p.card, leadSuit, trump);
      if (str > highestStrengthSoFar) {
        highestStrengthSoFar = str;
        currentWinningPlayer = p.player;
      }
    }
  }

  const partner = getPlayerPartner(position);
  const isPartnerWinning = currentWinningPlayer === partner;

  // MEDIUM AI
  if (difficulty === 'medium') {
    if (isLeading) {
      // If we are calling team and have Bower, lead it to pull trumps
      const callingTeam = state.callingTeam;
      const isOurTeamMaker = callingTeam !== undefined && getPlayerTeam(position) === callingTeam;
      if (isOurTeamMaker) {
        const bowers = legalCards.filter(c => isBower(c, trump));
        if (bowers.length > 0) return bowers[0];
      }
      // Lead off-suit Ace
      const offAces = legalCards.filter(c => c.rank === 'A' && getEffectiveSuit(c, trump) !== trump);
      if (offAces.length > 0) return offAces[0];

      // Otherwise lead lowest off-suit
      const offSuits = legalCards.filter(c => getEffectiveSuit(c, trump) !== trump);
      if (offSuits.length > 0) return offSuits[0];

      return legalCards[0];
    } else {
      const leadSuit = trick.leadSuit!;

      // If partner is already winning with a strong card, throw junk
      if (isPartnerWinning && highestStrengthSoFar >= 180) {
        // Partner is winning! Slough lowest legal card
        return getLowestCard(legalCards, leadSuit, trump);
      }

      // Try to beat the highest card with the LOWEST winning card
      const beaters = legalCards
        .map(c => ({ card: c, strength: getCardTrickStrength(c, leadSuit, trump) }))
        .filter(item => item.strength > highestStrengthSoFar)
        .sort((a, b) => a.strength - b.strength);

      if (beaters.length > 0) {
        return beaters[0].card; // Lowest card that still takes the trick!
      }

      // Cannot win trick -> throw away lowest value card
      return getLowestCard(legalCards, leadSuit, trump);
    }
  }

  // HARD AI: Advanced Euchre heuristics
  const leadSuit = trick.leadSuit;

  if (isLeading) {
    const callingTeam = state.callingTeam;
    const isOurTeamMaker = callingTeam !== undefined && getPlayerTeam(position) === callingTeam;

    if (isOurTeamMaker) {
      // Makers: If we hold high trump (Right or Left Bower), lead it to strip opponent trumps!
      const rightBower = legalCards.find(c => isRightBower(c, trump));
      if (rightBower) return rightBower;

      const leftBower = legalCards.find(c => isLeftBower(c, trump));
      if (leftBower) return leftBower;
    }

    // Lead off-suit Aces (great trick takers early)
    const offAces = legalCards.filter(c => c.rank === 'A' && getEffectiveSuit(c, trump) !== trump);
    if (offAces.length > 0) return offAces[0];

    // If defending and partner called, or if we have no high trumps, lead low off-suit
    const offCards = legalCards.filter(c => getEffectiveSuit(c, trump) !== trump);
    if (offCards.length > 0) {
      return getLowestCard(offCards, leadSuit || 'spades', trump);
    }

    return legalCards[0];
  } else {
    // Following trick
    // 1. If partner is winning trick:
    if (isPartnerWinning) {
      // Don't trump or overtake partner's high trick!
      // Slough off-suit non-trump junk to keep trumps in reserve
      return getLowestCard(legalCards, leadSuit!, trump);
    }

    // 2. Opponents are winning:
    // Can we win the trick?
    const candidates = legalCards
      .map(c => ({ card: c, strength: getCardTrickStrength(c, leadSuit!, trump) }))
      .filter(x => x.strength > highestStrengthSoFar)
      .sort((a, b) => a.strength - b.strength);

    if (candidates.length > 0) {
      // We can win. Check position in trick:
      // If 4th player (last to play in trick): play minimal winning card to guarantee winning!
      const isLastPlayer = trick.cards.length === (state.isAlone ? 2 : 3);
      if (isLastPlayer) {
        return candidates[0].card;
      }

      // If 2nd or 3rd seat: play winning card
      return candidates[0].card;
    }

    // Cannot win: discard lowest non-trump card
    return getLowestCard(legalCards, leadSuit!, trump);
  }
}

function getLowestCard(cards: Card[], leadSuit: Suit, trumpSuit?: Suit): Card {
  // Sort by trick strength ascending
  const sorted = [...cards].sort((a, b) => {
    const strA = getCardTrickStrength(a, leadSuit, trumpSuit);
    const strB = getCardTrickStrength(b, leadSuit, trumpSuit);
    return strA - strB;
  });
  return sorted[0];
}
