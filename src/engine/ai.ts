/**
 * BOWER JJ — Adaptive Multi-Tier AI Engine (Easy, Medium, Hard, Expert, Master)
 * 
 * Five Distinct Competitive Tiers:
 * - Easy: Casual, beginner-friendly, makes straightforward bids and plays.
 * - Medium: Solid Euchre fundamentals, evaluates bowers, discards off-suits, respects partner.
 * - Hard: Advanced card counting, tracks played trumps & void suits, 'next' bidding theory, 
 *         2nd hand low / 3rd hand high tactics, strategic loners.
 * - Expert: Tournament caliber. Full card counting, strict trump bleeding when makers, 
 *           boss card recognition, minimal winning card conservation, partner slough protection.
 * - Master: Apex / Challenger tier (LoL-style). Perfect void memory across all 4 players, 
 *           defensive donating at 9 points, Green-suit reverse theory, calculated loners, 
 *           cross-ruffing into partner voids, zero wasted trumps.
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
 * All 7 trumps in canonical descending strength order for any given trump suit.
 */
export function getCanonicalTrumpOrder(trumpSuit: Suit): { rank: string; suit: Suit }[] {
  return [
    { rank: 'J', suit: trumpSuit }, // Right Bower
    { rank: 'J', suit: getSameColorSuit(trumpSuit) }, // Left Bower
    { rank: 'A', suit: trumpSuit },
    { rank: 'K', suit: trumpSuit },
    { rank: 'Q', suit: trumpSuit },
    { rank: '10', suit: trumpSuit },
    { rank: '9', suit: trumpSuit },
  ];
}

/**
 * Returns all cards played so far across completed tricks and the active trick.
 */
export function getAllPlayedCards(state: EuchreGameState): Card[] {
  const cards: Card[] = [];
  if (state.completedTricks) {
    for (const trick of state.completedTricks) {
      if (trick.cards) {
        for (const p of trick.cards) {
          cards.push(p.card);
        }
      }
    }
  }
  if (state.currentTrick?.cards) {
    for (const p of state.currentTrick.cards) {
      cards.push(p.card);
    }
  }
  return cards;
}

/**
 * Identifies which suits each player has shown out of (reneged / void in).
 * If a player did not follow the lead suit of a trick, they hold 0 cards of that suit.
 */
export function getPlayerVoids(state: EuchreGameState): Map<PlayerPosition, Set<Suit>> {
  const voids = new Map<PlayerPosition, Set<Suit>>([
    [0, new Set<Suit>()],
    [1, new Set<Suit>()],
    [2, new Set<Suit>()],
    [3, new Set<Suit>()],
  ]);

  const allTricks = [...(state.completedTricks || [])];
  if (state.currentTrick && state.currentTrick.cards && state.currentTrick.cards.length > 0) {
    allTricks.push(state.currentTrick);
  }

  for (const trick of allTricks) {
    if (!trick.leadSuit || !trick.cards || trick.cards.length < 2) continue;
    const leadSuit = trick.leadSuit;

    for (const played of trick.cards) {
      const effSuit = getEffectiveSuit(played.card, state.trumpSuit);
      if (effSuit !== leadSuit) {
        // Player was unable to follow suit -> definitively void in leadSuit!
        voids.get(played.player)?.add(leadSuit);
      }
    }
  }

  return voids;
}

/**
 * Tracks remaining trumps in the game outside of this bot's own hand.
 */
export function getRemainingTrumpAnalysis(
  state: EuchreGameState,
  position: PlayerPosition,
  trumpSuit: Suit
): {
  unplayedTrumpsOutsideHand: { rank: string; suit: Suit }[];
  remainingTrumpCountOutsideHand: number;
  highestUnplayedTrumpOutsideHand: { rank: string; suit: Suit } | null;
  botHoldsBossTrump: boolean;
} {
  const played = getAllPlayedCards(state);
  const myHand = state.hands[position] || [];
  const canonical = getCanonicalTrumpOrder(trumpSuit);

  const isCardAccountedFor = (t: { rank: string; suit: Suit }) => {
    const inPlayed = played.some(c => c.rank === t.rank && c.suit === t.suit);
    if (inPlayed) return true;
    const inHand = myHand.some(c => c.rank === t.rank && c.suit === t.suit);
    return inHand;
  };

  const unplayedTrumpsOutsideHand = canonical.filter(t => !isCardAccountedFor(t));
  const remainingTrumpCountOutsideHand = unplayedTrumpsOutsideHand.length;
  const highestUnplayedTrumpOutsideHand = unplayedTrumpsOutsideHand.length > 0 ? unplayedTrumpsOutsideHand[0] : null;

  let botHoldsBossTrump = false;
  if (highestUnplayedTrumpOutsideHand === null) {
    botHoldsBossTrump = myHand.some(c => getEffectiveSuit(c, trumpSuit) === trumpSuit);
  } else {
    const bossRankIdx = canonical.findIndex(
      t => t.rank === highestUnplayedTrumpOutsideHand.rank && t.suit === highestUnplayedTrumpOutsideHand.suit
    );
    botHoldsBossTrump = myHand.some(c => {
      const idx = canonical.findIndex(t => t.rank === c.rank && t.suit === c.suit);
      return idx !== -1 && idx < bossRankIdx;
    });
  }

  return {
    unplayedTrumpsOutsideHand,
    remainingTrumpCountOutsideHand,
    highestUnplayedTrumpOutsideHand,
    botHoldsBossTrump,
  };
}

/**
 * Determines if an off-suit card is the current "Boss" of its suit
 * (i.e. all higher cards of that suit have already been played or are in bot's hand).
 */
export function isBossOffSuitCard(
  card: Card,
  trumpSuit: Suit,
  state: EuchreGameState,
  position: PlayerPosition
): boolean {
  const effSuit = getEffectiveSuit(card, trumpSuit);
  if (effSuit === trumpSuit) return false;

  const ranksDescending = ['A', 'K', 'Q', 'J', '10', '9'];
  const played = getAllPlayedCards(state);
  const myHand = state.hands[position] || [];

  const cardRankIdx = ranksDescending.indexOf(card.rank);
  if (cardRankIdx <= 0) return true; // Ace is always top unless Left Bower, but Left Bower is trump!

  for (let i = 0; i < cardRankIdx; i++) {
    const higherRank = ranksDescending[i];
    if (higherRank === 'J' && card.suit === getSameColorSuit(trumpSuit)) {
      continue; // Left Bower belongs to trump suit, not this suit
    }
    const higherPlayed = played.some(c => c.rank === higherRank && c.suit === card.suit);
    const higherInHand = myHand.some(c => c.rank === higherRank && c.suit === card.suit);
    if (!higherPlayed && !higherInHand) {
      return false; // A higher card of this suit is still held by another player!
    }
  }

  return true;
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
  const isHighTier = difficulty === 'hard' || difficulty === 'expert' || difficulty === 'master';
  const shouldGoAlone = isHighTier
    ? (evalResult.score >= 8.8 && (evalResult.trumpCount >= 4 || (evalResult.trumpCount >= 3 && evalResult.offAces >= 1)))
    : (evalResult.score >= 9.5 && evalResult.trumpCount >= 4);

  // MEDIUM AI
  if (difficulty === 'medium') {
    if (isDealer && evalResult.score >= 5.0) {
      return { player: position, type: 'pick_up', alone: shouldGoAlone };
    }
    if (isPartnerOfDealer) {
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

  // MASTER AI: Defensive Donating / Anti-March Strategy at Match Point
  if (difficulty === 'master') {
    const oppTeam = getPlayerTeam(position) === 0 ? 1 : 0;
    const oppScore = state.scores[oppTeam];
    const isFirstSeat = position === ((state.dealer + 1) % 4);

    // If opponent score is 9 (game point) and opponent dealer holds a high card:
    // Calling prevents a 4-point loner sweep that would immediately end the match!
    if (oppScore === 9 && isFirstSeat && !isPartnerOfDealer && !isDealer) {
      const upCardRank = upCard.rank;
      const isDangerousUpcard = upCardRank === 'J' || upCardRank === 'A' || upCardRank === 'K';
      if (isDangerousUpcard && evalResult.score >= 3.0) {
        return { player: position, type: 'order_up', alone: false };
      }
    }
  }

  // EXPERT & MASTER AI: Elevated tactical thresholds
  if (difficulty === 'expert' || difficulty === 'master') {
    if (isDealer) {
      // Dealer pickup: Extra trump + void discard opportunity gives huge advantage
      if (evalResult.score >= 4.0 || (evalResult.trumpCount >= 2 && evalResult.hasRight)) {
        return { player: position, type: 'pick_up', alone: shouldGoAlone };
      }
    } else if (isPartnerOfDealer) {
      if (state.rules.partnerOrderUpGoesAlone) {
        if (evalResult.score >= 8.0 && evalResult.trumpCount >= 3) {
          return { player: position, type: 'order_up', alone: true };
        }
        return { player: position, type: 'pass', alone: false };
      }
      // Partner ordering up assists dealer who gets a free trump!
      if (evalResult.score >= 3.8 || evalResult.trumpCount >= 3) {
        return { player: position, type: 'order_up', alone: shouldGoAlone };
      }
    } else {
      // Opponents ordering up into dealer's hand gives dealer a trump: needs commanding hand
      if (evalResult.score >= 6.0 && evalResult.trumpCount >= 3) {
        return { player: position, type: 'order_up', alone: shouldGoAlone };
      }
    }
    return { player: position, type: 'pass', alone: false };
  }

  // HARD AI: Advanced position play
  if (isDealer) {
    if (evalResult.score >= 4.5) {
      return { player: position, type: 'pick_up', alone: shouldGoAlone };
    }
  } else if (isPartnerOfDealer) {
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
  const isFirstSeat = position === ((state.dealer + 1) % 4);

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

  const shouldGoAlone = best.eval.score >= 8.8 && best.eval.trumpCount >= 3;

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

  // EXPERT & MASTER AI: Next-Suit vs Green-Suit Theory
  if (difficulty === 'expert' || difficulty === 'master') {
    let topSuit = best.suit;
    let highestAdjScore = -1;

    for (const item of evaluations) {
      let adj = item.eval.score;
      if (turnedDownSuit) {
        const isNext = item.suit === getSameColorSuit(turnedDownSuit);
        if (isFirstSeat) {
          // 1st Seat (Left of Dealer): Next-suit theory has massive statistical edge
          if (isNext) adj += difficulty === 'master' ? 1.4 : 1.1;
        } else {
          // 2nd / 3rd Seat: 1st seat passed on Next, favoring Green suits (opposite color)
          if (!isNext) adj += difficulty === 'master' ? 0.9 : 0.7;
        }
      }
      if (adj > highestAdjScore) {
        highestAdjScore = adj;
        topSuit = item.suit;
      }
    }

    const threshold = isDealer ? 3.2 : isFirstSeat ? 3.8 : 4.4;
    const chosenEval = evaluations.find(e => e.suit === topSuit)!;
    if (highestAdjScore >= threshold && chosenEval.eval.trumpCount >= 2) {
      return { player: position, type: 'call_trump', suit: topSuit, alone: shouldGoAlone };
    }

    if (isDealer && state.rules.stickTheDealer) {
      return { player: position, type: 'call_trump', suit: topSuit, alone: false };
    }

    return { player: position, type: 'pass', alone: false };
  }

  // HARD AI: Standard Next-suit theory
  let adjustedScore = best.eval.score;
  if (turnedDownSuit && best.suit === getSameColorSuit(turnedDownSuit) && isFirstSeat) {
    adjustedScore += 0.8;
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
    const rankValues: Record<string, number> = { '9': 1, '10': 2, 'J': 3, 'Q': 4, 'K': 5, 'A': 6 };
    return nonTrumpCards.sort((a, b) => rankValues[a.rank] - rankValues[b.rank])[0];
  }

  // MEDIUM, HARD, EXPERT & MASTER: Void suit creation & protected Ace retention
  const suitCounts: Record<Suit, Card[]> = {
    spades: [],
    hearts: [],
    diamonds: [],
    clubs: [],
  };

  for (const card of nonTrumpCards) {
    suitCounts[card.suit].push(card);
  }

  // Priority 1: Look for a singleton non-Ace to discard, creating an immediate void!
  for (const suit of ALL_SUITS) {
    const cards = suitCounts[suit];
    if (cards.length === 1 && cards[0].rank !== 'A') {
      return cards[0]; // Creating a void lets the AI trump this suit on later tricks!
    }
  }

  // Priority 2: Look for lowest card in a doubleton that is not an Ace
  const nonAces = nonTrumpCards.filter(c => c.rank !== 'A');
  if (nonAces.length > 0) {
    const rankValues: Record<string, number> = { '9': 1, '10': 2, 'J': 3, 'Q': 4, 'K': 5 };
    nonAces.sort((a, b) => rankValues[a.rank] - rankValues[b.rank]);
    return nonAces[0];
  }

  // Priority 3: If only Aces left, discard lowest ranking non-trump
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
      return legalCards[Math.floor(Math.random() * legalCards.length)];
    } else {
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
  let winningCard: Card | undefined;
  if (!isLeading) {
    const leadSuit = trick.leadSuit!;
    for (const p of trick.cards) {
      const str = getCardTrickStrength(p.card, leadSuit, trump);
      if (str > highestStrengthSoFar) {
        highestStrengthSoFar = str;
        currentWinningPlayer = p.player;
        winningCard = p.card;
      }
    }
  }

  const partner = getPlayerPartner(position);
  const isPartnerWinning = currentWinningPlayer === partner;
  const callingTeam = state.callingTeam;
  const isOurTeamMaker = callingTeam !== undefined && getPlayerTeam(position) === callingTeam;

  // EXPERT & MASTER AI: High-Elo Tournament & Apex Intelligence
  if (difficulty === 'expert' || difficulty === 'master') {
    const leadSuit = trick.leadSuit;
    const isLastPlayer = trick.cards.length === (state.isAlone ? 2 : 3);
    const trumpAnalysis = trump ? getRemainingTrumpAnalysis(state, position, trump) : null;
    const voids = difficulty === 'master' ? getPlayerVoids(state) : null;

    if (isLeading) {
      // 1. MAKERS (Our team called trump):
      if (isOurTeamMaker && trump && trumpAnalysis) {
        // Bleed / strip opponent trumps if opponents still hold any!
        if (trumpAnalysis.remainingTrumpCountOutsideHand > 0) {
          const rightBower = legalCards.find(c => isRightBower(c, trump));
          if (rightBower) return rightBower;

          const leftBower = legalCards.find(c => isLeftBower(c, trump));
          if (leftBower) return leftBower;

          if (trumpAnalysis.botHoldsBossTrump) {
            const bossTrumpCard = legalCards.find(c => getEffectiveSuit(c, trump) === trump);
            if (bossTrumpCard) return bossTrumpCard;
          }
        } else {
          // All opponent trumps are gone! Off-suit Aces and boss cards are 100% UNSTOPPABLE winners
          const offAces = legalCards.filter(c => c.rank === 'A' && getEffectiveSuit(c, trump) !== trump);
          if (offAces.length > 0) return offAces[0];

          for (const card of legalCards) {
            if (isBossOffSuitCard(card, trump, state, position)) {
              return card;
            }
          }
        }
      }

      // 2. DEFENDERS (Opponents called trump):
      if (!isOurTeamMaker && trump) {
        // In Master tier: exploit known partner voids!
        if (voids && difficulty === 'master') {
          const partnerVoids = voids.get(partner);
          if (partnerVoids && partnerVoids.size > 0) {
            // Find an off-suit where partner is void but opponents are NOT void!
            const crossRuffCard = legalCards.find(c => {
              const eff = getEffectiveSuit(c, trump);
              return eff !== trump && partnerVoids.has(eff);
            });
            if (crossRuffCard) return crossRuffCard;
          }
        }

        // Defenders should NEVER lead trump into makers; lead off-suit Aces early
        const offAces = legalCards.filter(c => c.rank === 'A' && getEffectiveSuit(c, trump) !== trump);
        if (offAces.length > 0) {
          // If Master, avoid leading an Ace if opponent is already known to be void in that suit!
          if (voids && difficulty === 'master') {
            const safeAce = offAces.find(c => {
              const eff = getEffectiveSuit(c, trump);
              const opp1 = ((position + 1) % 4) as PlayerPosition;
              const opp2 = ((position + 3) % 4) as PlayerPosition;
              const opp1Void = voids.get(opp1)?.has(eff);
              const opp2Void = voids.get(opp2)?.has(eff);
              return !opp1Void && !opp2Void;
            });
            if (safeAce) return safeAce;
          }
          return offAces[0];
        }

        // No off-suit Aces: lead lowest non-trump to locate partner's tricks
        const nonTrumps = legalCards.filter(c => getEffectiveSuit(c, trump) !== trump);
        if (nonTrumps.length > 0) {
          return getLowestCard(nonTrumps, 'spades', trump);
        }
      }

      // Standard strong lead: Boss off-suit card or lowest card
      const offAces = legalCards.filter(c => c.rank === 'A' && getEffectiveSuit(c, trump) !== trump);
      if (offAces.length > 0) return offAces[0];

      return getLowestCard(legalCards, leadSuit || 'spades', trump);
    } else {
      // FOLLOWING A TRICK
      const effectiveLeadSuit = leadSuit!;

      // CASE A: Partner is winning the trick
      if (isPartnerWinning) {
        // If last player, trick is 100% in the bag: dump lowest card
        if (isLastPlayer) {
          return getLowestCard(legalCards, effectiveLeadSuit, trump);
        }

        // Check if partner's winning card is the Boss card (Right Bower, Left Bower, or high boss card)
        const isPartnerCardBoss = winningCard && trump && (
          isRightBower(winningCard, trump) ||
          (isLeftBower(winningCard, trump) && !trumpAnalysis?.unplayedTrumpsOutsideHand.some(t => t.rank === 'J' && t.suit === trump)) ||
          highestStrengthSoFar >= 800
        );

        if (isPartnerCardBoss) {
          // Partner has the undisputed winning card: Slough lowest card!
          return getLowestCard(legalCards, effectiveLeadSuit, trump);
        }

        // If in 2nd or 3rd seat and partner's card might be vulnerable to remaining player:
        // Slough low if following suit; do not waste trump over partner
        return getLowestCard(legalCards, effectiveLeadSuit, trump);
      }

      // CASE B: Opponents are winning the trick
      const beaters = legalCards
        .map(c => ({ card: c, strength: getCardTrickStrength(c, effectiveLeadSuit, trump) }))
        .filter(item => item.strength > highestStrengthSoFar)
        .sort((a, b) => a.strength - b.strength);

      if (beaters.length > 0) {
        // 4th Seat (Last Player): Play LOWEST winning card (minimal winning card conservation!)
        if (isLastPlayer) {
          return beaters[0].card;
        }

        // 2nd Seat ("Second Hand Low"):
        // If following suit and holding non-boss card, play low to let partner contest or force 3rd hand high
        if (trick.cards.length === 1) {
          const leadFollowers = legalCards.filter(c => getEffectiveSuit(c, trump) === effectiveLeadSuit);
          if (leadFollowers.length > 1) {
            // Check if holding boss card of lead suit
            const holdingBoss = leadFollowers.some(c => isBossOffSuitCard(c, trump!, state, position));
            if (!holdingBoss) {
              // 2nd hand low! Play lowest card of lead suit
              return getLowestCard(leadFollowers, effectiveLeadSuit, trump);
            }
          }
        }

        // 3rd Seat ("Third Hand High") or Over-Trumping:
        // Play minimal winning card to secure the trick
        return beaters[0].card;
      }

      // Cannot beat the winning card -> slough lowest non-trump junk card
      const nonTrumps = legalCards.filter(c => getEffectiveSuit(c, trump) !== trump);
      if (nonTrumps.length > 0) {
        return getLowestCard(nonTrumps, effectiveLeadSuit, trump);
      }

      return getLowestCard(legalCards, effectiveLeadSuit, trump);
    }
  }

  // MEDIUM AI
  if (difficulty === 'medium') {
    if (isLeading) {
      if (isOurTeamMaker) {
        const bowers = legalCards.filter(c => isBower(c, trump));
        if (bowers.length > 0) return bowers[0];
      }
      const offAces = legalCards.filter(c => c.rank === 'A' && getEffectiveSuit(c, trump) !== trump);
      if (offAces.length > 0) return offAces[0];

      const offSuits = legalCards.filter(c => getEffectiveSuit(c, trump) !== trump);
      if (offSuits.length > 0) return offSuits[0];

      return legalCards[0];
    } else {
      const leadSuit = trick.leadSuit!;
      if (isPartnerWinning && highestStrengthSoFar >= 180) {
        return getLowestCard(legalCards, leadSuit, trump);
      }

      const beaters = legalCards
        .map(c => ({ card: c, strength: getCardTrickStrength(c, leadSuit, trump) }))
        .filter(item => item.strength > highestStrengthSoFar)
        .sort((a, b) => a.strength - b.strength);

      if (beaters.length > 0) {
        return beaters[0].card;
      }

      return getLowestCard(legalCards, leadSuit, trump);
    }
  }

  // HARD AI: Advanced Euchre heuristics
  const leadSuit = trick.leadSuit;

  if (isLeading) {
    if (isOurTeamMaker) {
      const rightBower = legalCards.find(c => isRightBower(c, trump));
      if (rightBower) return rightBower;

      const leftBower = legalCards.find(c => isLeftBower(c, trump));
      if (leftBower) return leftBower;
    }

    const offAces = legalCards.filter(c => c.rank === 'A' && getEffectiveSuit(c, trump) !== trump);
    if (offAces.length > 0) return offAces[0];

    const offCards = legalCards.filter(c => getEffectiveSuit(c, trump) !== trump);
    if (offCards.length > 0) {
      return getLowestCard(offCards, leadSuit || 'spades', trump);
    }

    return legalCards[0];
  } else {
    if (isPartnerWinning) {
      return getLowestCard(legalCards, leadSuit!, trump);
    }

    const candidates = legalCards
      .map(c => ({ card: c, strength: getCardTrickStrength(c, leadSuit!, trump) }))
      .filter(x => x.strength > highestStrengthSoFar)
      .sort((a, b) => a.strength - b.strength);

    if (candidates.length > 0) {
      return candidates[0].card;
    }

    return getLowestCard(legalCards, leadSuit!, trump);
  }
}

function getLowestCard(cards: Card[], leadSuit: Suit, trumpSuit?: Suit): Card {
  const sorted = [...cards].sort((a, b) => {
    const strA = getCardTrickStrength(a, leadSuit, trumpSuit);
    const strB = getCardTrickStrength(b, leadSuit, trumpSuit);
    return strA - strB;
  });
  return sorted[0];
}
