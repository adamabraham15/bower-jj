/**
 * BOWER JJ — Core Types
 * Pure TypeScript definitions for North American Euchre.
 */

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type CardRank = '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string; // e.g. "hearts-J", "spades-A"
  suit: Suit;
  rank: CardRank;
}

export type PlayerPosition = 0 | 1 | 2 | 3;
// 0: South (Human / Primary player)
// 1: West (Opponent 1)
// 2: North (Partner)
// 3: East (Opponent 2)

export type Team = 0 | 1;
// Team 0: South (0) + North (2) - Team Blue
// Team 1: West (1) + East (3) - Team Red

export function getPlayerTeam(pos: PlayerPosition): Team {
  return pos % 2 === 0 ? 0 : 1;
}

export function getPlayerPartner(pos: PlayerPosition): PlayerPosition {
  return ((pos + 2) % 4) as PlayerPosition;
}

export function getNextPlayer(pos: PlayerPosition): PlayerPosition {
  return ((pos + 1) % 4) as PlayerPosition;
}

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface Player {
  id: string;
  name: string;
  position: PlayerPosition;
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
  avatarId: string;
  rankPoints?: number;
  rankTier?: string;
}

export type GamePhase =
  | 'idle'
  | 'dealing'
  | 'bidding_round_1' // deciding on turned-up card
  | 'dealer_discard'  // dealer picking up upcard and discarding 1 card
  | 'bidding_round_2' // turned-up card turned down, naming any of 3 remaining suits
  | 'playing'         // tricks 1 to 5
  | 'trick_resolving' // trick completed, cards displayed before clearing
  | 'hand_scored'     // hand finished, scores updated
  | 'game_over';      // 10 points reached

export interface BidDecision {
  player: PlayerPosition;
  type: 'pass' | 'order_up' | 'pick_up' | 'call_trump';
  suit?: Suit;
  alone: boolean;
}

export interface PlayedCard {
  player: PlayerPosition;
  card: Card;
}

export interface Trick {
  leadPlayer: PlayerPosition;
  leadSuit?: Suit;
  cards: PlayedCard[];
  winner?: PlayerPosition;
  winningCard?: Card;
}

export interface HandScoreResult {
  callingTeam: Team;
  calledAlone: boolean;
  alonePlayer?: PlayerPosition;
  trumpSuit: Suit;
  tricksWon: [number, number]; // [Team 0 tricks, Team 1 tricks]
  pointsAwarded: [number, number]; // [Team 0 pts, Team 1 pts]
  isMarch: boolean;
  isEuchre: boolean;
  message: string;
}

export interface EuchreHouseRules {
  targetScore: number;          // Default: 10
  stickTheDealer: boolean;      // Default: true (recommended for online play)
  allowAloneCalls: boolean;     // Default: true
  canCallTurnedDownSuit: boolean; // Default: false (cannot call turned-down suit in Round 2)
  partnerOrderUpGoesAlone: boolean; // Default: true (partner ordering up dealer forces alone)
  canadianLoner?: boolean;      // Canadian Loner alias
}

export const DEFAULT_RULES: EuchreHouseRules = {
  targetScore: 10,
  stickTheDealer: true,
  allowAloneCalls: true,
  canCallTurnedDownSuit: false,
  partnerOrderUpGoesAlone: true,
  canadianLoner: true,
};

export interface EuchreGameState {
  players: Player[];
  dealer: PlayerPosition;
  currentTurn: PlayerPosition;
  phase: GamePhase;
  deck: Card[];
  kitty: Card[];
  upCard?: Card;
  hands: Record<PlayerPosition, Card[]>;
  trumpSuit?: Suit;
  callingPlayer?: PlayerPosition;
  callingTeam?: Team;
  isAlone: boolean;
  alonePlayer?: PlayerPosition;
  benchedPlayer?: PlayerPosition; // Partner of alone player sitting out
  currentTrick: Trick;
  completedTricks: Trick[];
  tricksWon: [number, number]; // [Team 0, Team 1]
  scores: [number, number];    // [Team 0, Team 1]
  lastHandResult?: HandScoreResult;
  rules: EuchreHouseRules;
  history: string[];
}
