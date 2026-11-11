/**
 * BOWER JJ — Multiplayer Server Types & Wire Protocol
 */

import {
  Card,
  Suit,
  PlayerPosition,
  Team,
  AIDifficulty,
  EuchreHouseRules,
  HandScoreResult,
  Trick,
  GamePhase,
} from '../src/engine/types';

export type RankTier = '9' | '10' | 'Q' | 'K' | 'A' | 'BOWER_JJ';

export interface MatchRecord {
  id: string;
  date: number;
  mode: 'ranked_solo' | 'ranked_duo' | 'unranked' | 'private' | 'ai';
  won: boolean;
  score: string; // e.g. "10 - 6"
  lpChange: number;
  mmrChange: number;
  opponentNames: string[];
}

export interface Challenge {
  id: string;
  title: string;
  desc: string;
  target: number;
  current: number;
  xpReward: number;
  completed: boolean;
}

export interface BattlePassState {
  tier: number; // Current unlocked tier (1-30)
  xp: number; // XP within current tier
  tierXpRequired: number; // e.g. 500 XP per tier
  isPremium: boolean;
  claimedFreeTiers: number[];
  claimedPremiumTiers: number[];
}

export interface CosmeticLoadout {
  hat?: string;
  cardBack?: string;
  banner?: string;
  title?: string;
}

export interface FriendSummary {
  userId: string;
  username: string;
  avatarIcon: string;
  rankTier: RankTier;
  rankPoints: number;
  level: number;
  isOnline: boolean;
  status: 'online' | 'in_game' | 'offline';
  roomCode?: string;
}

export interface UserAccount {
  id: string; // e.g. "usr_abc123"
  username: string;
  avatarIcon: string;
  level: number;
  xp: number;
  
  // Competitive Ranking & MMR
  rankTier: RankTier;
  rankPoints: number; // 0 to 100 LP
  mmr: number; // Hidden Elo rating (baseline 1200)
  placementMatchesRemaining: number;
  hasDemotionShield: boolean;

  // Lifetime Stats
  totalGames: number;
  wins: number;
  losses: number;
  tricksWon: number;
  euchres: number;
  marches: number;
  successfulLoners: number;
  winStreak: number;
  bestWinStreak: number;
  abandonments?: number; // Total ranked match abandonments

  // Social & Friends
  friends: string[]; // List of userIds
  friendRequests: { fromUserId: string; fromUsername: string; fromAvatar: string; timestamp: number }[];
  recentPlayers: { userId: string; username: string; avatarIcon: string; timestamp: number }[];

  // Progression & Cosmetics
  battlePass: BattlePassState;
  challenges: Challenge[];
  unlockedCosmetics: {
    hats: string[];
    cardBacks: string[];
    banners: string[];
    titles: string[];
  };
  equippedCosmetics: CosmeticLoadout;
  matchHistory: MatchRecord[];

  createdAt: number;
  lastActive: number;
}

export interface PlayerSlot {
  position: PlayerPosition;
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
  userId?: string;
  username: string;
  avatarIcon: string;
  rankTier?: RankTier;
  connected: boolean;
  isReady: boolean;
  abandoned?: boolean;
}

export interface Room {
  code: string; // 6-character code
  hostUserId: string;
  status: 'lobby' | 'playing' | 'finished';
  rules: EuchreHouseRules;
  slots: (PlayerSlot | null)[]; // 4 seats
  isMatchmade: boolean;
  queueMode?: 'solo' | 'rivals' | 'duo' | 'casual';
  partyLeaderId?: string;
  partyMembers?: string[];
  createdAt: number;
  lastActionAt: number;
  resultsRecorded?: boolean; // Atomic match results flag
  abandonedUserIds?: string[]; // Users who abandoned during this match
}

export interface MatchmakingStats {
  totalMatches: number;
  fourHumans: number;
  threeHumansOneBot: number;
  twoHumansTwoBots: number;
  oneHumanThreeBots: number;
  totalWaitTimeMs: number;
  averageWaitTimeMs: number;
  percentages: {
    fourHumans: number;
    threeHumansOneBot: number;
    twoHumansTwoBots: number;
    oneHumanThreeBots: number;
  };
}

/**
 * Sanitized view of game state sent to a specific player.
 * OPPONENTS' HANDS ARE SCRUBBED FOR 100% ANTI-CHEAT INTEGRITY.
 */
export interface SanitizedGameState {
  phase: GamePhase;
  dealer: PlayerPosition;
  currentTurn: PlayerPosition;
  upCard?: Card;
  trumpSuit?: Suit;
  callingPlayer?: PlayerPosition;
  callingTeam?: Team;
  isAlone: boolean;
  alonePlayer?: PlayerPosition;
  benchedPlayer?: PlayerPosition;
  yourPosition: PlayerPosition;
  yourHand: Card[]; // Only the recipient's cards!
  handCounts: Record<PlayerPosition, number>; // Card counts for other players
  currentTrick: Trick;
  completedTricksCount: number;
  tricksWon: [number, number];
  scores: [number, number];
  lastHandResult?: HandScoreResult;
  history: string[];
  slots: PlayerSlot[];
}

export interface LeaderboardEntry {
  rankPosition: number;
  userId: string;
  username: string;
  avatarIcon: string;
  rankTier: RankTier;
  rankPoints: number;
  mmr: number;
  wins: number;
  losses: number;
  winRate: number;
  totalGames: number;
}

export interface PublicPlayerData {
  id: string;
  username: string;
  avatarIcon: string;
  level: number;
  rankTier: RankTier;
  rankPoints: number;
  totalGames?: number;
  wins?: number;
  losses?: number;
  bestStreak?: number;
  isFriend?: boolean;
  isOnline?: boolean;
  equippedCosmetics?: CosmeticLoadout;
}

// Client -> Server Messages
export type ClientMessage =
  | { type: 'AUTH'; sessionToken?: string; username?: string; avatarIcon?: string; accessToken?: string }
  | { type: 'ROOM_CREATE'; rules?: Partial<EuchreHouseRules>; queueMode?: 'rivals' | 'solo' | 'casual' }
  | { type: 'ROOM_JOIN'; roomCode: string }
  | { type: 'ROOM_FILL_AI'; difficulty?: AIDifficulty }
  | { type: 'ROOM_START' }
  | { type: 'ROOM_LEAVE' }
  | { type: 'QUEUE_ENTER'; mode: 'solo' | 'rivals' | 'duo' | 'casual' }
  | { type: 'QUEUE_LEAVE' }
  | { type: 'GAME_BID'; bidType: 'pass' | 'order_up' | 'pick_up' | 'call_trump'; suit?: Suit; alone: boolean }
  | { type: 'GAME_DISCARD'; cardId: string }
  | { type: 'GAME_PLAY_CARD'; cardId: string }
  | { type: 'GAME_NEXT_HAND' }
  | { type: 'SEND_EMOTE'; text?: string; emoji?: string }
  // Social / Friends
  | { type: 'FRIEND_REQUEST_SEND'; targetUsername: string }
  | { type: 'FRIEND_REQUEST_ACCEPT'; fromUserId: string }
  | { type: 'FRIEND_REQUEST_DECLINE'; fromUserId: string }
  | { type: 'FRIEND_REMOVE'; friendUserId: string }
  | { type: 'GET_FRIENDS' }
  | { type: 'GET_LEADERBOARD' }
  | { type: 'CLAIM_PASS_REWARD'; tier: number; isPremium: boolean }
  | { type: 'EQUIP_COSMETIC'; category: 'hat' | 'cardBack' | 'banner' | 'title'; itemId?: string }
  | { type: 'PARTY_INVITE_SEND'; friendUserId: string; mode?: 'rivals' | 'duo' }
  | { type: 'PARTY_INVITE_ACCEPT'; partyRoomCode: string }
  | { type: 'GET_PROFILE'; targetUserId?: string; targetUsername?: string }
  | { type: 'REPORT_PLAYER'; targetUserId?: string; targetUsername?: string; reason: string }
  | { type: 'ROOM_UPDATE_RULES'; rules: Partial<EuchreHouseRules> }
  | { type: 'ROOM_KICK'; position: PlayerPosition }
  | { type: 'GET_MATCHMAKING_STATS' };

// Server -> Client Messages
export type ServerMessage =
  | { type: 'AUTH_SUCCESS'; sessionToken: string; user: UserAccount }
  | { type: 'ROOM_UPDATE'; room: Room; yourPosition?: PlayerPosition }
  | { type: 'GAME_SYNC'; state: SanitizedGameState }
  | { type: 'QUEUE_UPDATE'; inQueue: boolean; mode?: string; playersFound: number; elapsedSeconds: number }
  | { type: 'EMOTE_BROADCAST'; fromPosition: PlayerPosition; text?: string; emoji?: string }
  | { type: 'DISCONNECT_ALERT'; position: PlayerPosition; username: string; graceRemainingSec: number }
  | { type: 'FRIENDS_LIST'; friends: FriendSummary[]; incomingRequests: UserAccount['friendRequests'] }
  | { type: 'LEADERBOARD_DATA'; entries: LeaderboardEntry[]; yourRank?: number }
  | { type: 'BATTLE_PASS_UPDATE'; battlePass: BattlePassState; challenges: Challenge[] }
  | { type: 'RANK_UPDATE'; oldTier: RankTier; newTier: RankTier; oldPoints: number; newPoints: number; lpChange: number; didRankUp: boolean }
  | { type: 'PARTY_INVITE_RECEIVED'; fromUsername: string; fromAvatar: string; roomCode: string }
  | { type: 'PROFILE_DATA'; profile: PublicPlayerData }
  | { type: 'MATCHMAKING_STATS'; stats: MatchmakingStats }
  | { type: 'NOTICE'; message: string; title?: string }
  | { type: 'ERROR'; message: string };
