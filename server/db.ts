/**
 * BOWER JJ — Authoritative User, Progression, Elo MMR & Social Database
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  UserAccount,
  RankTier,
  RankDivision,
  MatchRecord,
  LeaderboardEntry,
  FriendSummary,
  PublicPlayerData,
  MatchmakingStats,
  PlayerCollectionState,
  UnopenedPackItem,
  PackOpenResult,
  DrawnCardResult,
} from './types';
import {
  AVATAR_CATALOG,
  CARD_BACK_CATALOG,
  COLLECTIBLE_CARDS,
  DEFAULT_AVATAR_ID,
  DEFAULT_CARD_BACK_ID,
  WAX_SEALS_CONFIG,
  getCraftCost,
  getAvatarDefinition,
  getCardBackDefinition,
  getEligibleMilestoneAvatars,
  resolveAvatarId,
  resolveCardBackId,
  resolveTableFeltId,
  getTableFeltDefinition,
} from '../src/config/collectiblesCatalog';
import { PROGRESSION_CONFIG, rollPackCards } from './config/progressionConfig';
import { supabaseAdmin } from './auth';

const DB_DIR = path.resolve(process.cwd(), 'server', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

export const TIER_ORDER: RankTier[] = ['9', '10', 'Q', 'K', 'A', 'BOWER_JJ'];

export const DIVISION_ORDER: RankDivision[] = ['III', 'II', 'I', 'APEX'];
export const DIVISION_WEIGHT: Record<RankDivision, number> = {
  III: 1,
  II: 2,
  I: 3,
  APEX: 4,
};

export const PROMOTION_WAX_SEALS: Record<RankTier, number> = {
  '9': 50,
  '10': 75,
  'Q': 125,
  'K': 200,
  'A': 300,
  'BOWER_JJ': 500,
};

export const DIVISION_UP_WAX_SEALS: Record<'II' | 'I', number> = {
  II: 25,
  I: 35,
};

export function normalizeRankDivision(tier: RankTier, division?: string): RankDivision {
  if (tier === 'BOWER_JJ') return 'APEX';
  if (division === 'I' || division === 'II' || division === 'III') return division;
  return 'III';
}

interface DatabaseSchema {
  users: Record<string, UserAccount>; // userId -> UserAccount
  sessions: Record<string, string>; // sessionToken -> userId
  matchmakingStats?: {
    totalMatches: number;
    fourHumans: number;
    threeHumansOneBot: number;
    twoHumansTwoBots: number;
    oneHumanThreeBots: number;
    totalWaitTimeMs: number;
  };
}

class Database {
  private data: DatabaseSchema = {
    users: {},
    sessions: {},
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        if (raw && raw.trim().length > 0) {
          try {
            this.data = JSON.parse(raw);
          } catch {
            // In case of transient lock or read during write
            try {
              const retry = fs.readFileSync(DB_FILE, 'utf-8');
              this.data = JSON.parse(retry);
            } catch (retryErr) {
              console.error('Failed to parse DB, using clean default store:', retryErr);
              this.save();
            }
          }
        } else {
          this.save();
        }
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Failed to load DB, using in-memory store:', err);
    }
  }

  private savePending: boolean = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  public save() {
    if (this.savePending) return;
    this.savePending = true;

    // Coalesce rapid concurrent operations into a single disk write
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.savePending = false;
      this.flushToDisk();
    }, 25);
    if (this.saveTimeout && typeof this.saveTimeout.unref === 'function') {
      this.saveTimeout.unref();
    }
  }

  public flushToDisk() {
    try {
      const payload = JSON.stringify(this.data, null, 2);
      const tmp = `${DB_FILE}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      fs.writeFileSync(tmp, payload, 'utf-8');
      let saved = false;
      for (let attempt = 0; attempt < 3 && !saved; attempt++) {
        try {
          fs.renameSync(tmp, DB_FILE);
          saved = true;
        } catch {
          try {
            fs.copyFileSync(tmp, DB_FILE);
            saved = true;
          } catch {
            // Short backoff on Windows file lock
            const delay = 10 * (attempt + 1);
            const start = Date.now();
            while (Date.now() - start < delay) { /* busy wait */ }
          }
        }
      }
      try { fs.unlinkSync(tmp); } catch {}
    } catch {
      // In-memory state remains safe and persistent in memory
    }
  }

  public getUserByToken(token?: string): { user: UserAccount; sessionToken: string } | null {
    if (!token) return null;
    const userId = this.data.sessions[token];
    if (!userId) return null;
    const user = this.data.users[userId];
    if (!user) return null;
    return { user, sessionToken: token };
  }

  public getUserById(userId: string): UserAccount | null {
    return this.data.users[userId] || null;
  }

  public updateUser(userId: string, updates: Partial<UserAccount>): UserAccount | null {
    const user = this.data.users[userId];
    if (!user) return null;
    Object.assign(user, updates);
    this.save();
    return user;
  }

  public getUserByUsername(username: string): UserAccount | null {
    const clean = username.trim().toLowerCase();
    for (const u of Object.values(this.data.users)) {
      if (u.username.trim().toLowerCase() === clean) {
        return u;
      }
    }
    return null;
  }

  public async getUserByUsernameAsync(username: string): Promise<UserAccount | null> {
    const existing = this.getUserByUsername(username);
    if (existing) return existing;

    if (supabaseAdmin) {
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, username, avatar_icon')
          .ilike('username', username.trim())
          .maybeSingle();

        if (profile) {
          const { user } = this.getOrCreateUser(profile.username, profile.avatar_icon, undefined, profile.id);
          return user;
        }
      } catch (err) {
        // Supabase lookup fallback ignored
      }
    }
    return null;
  }

  public getOrCreateUser(
    username: string,
    avatarIcon: string,
    existingToken?: string,
    forcedUserId?: string
  ): { user: UserAccount; sessionToken: string } {
    const starterAvatars = AVATAR_CATALOG.filter((a) => a.unlockedByDefault).map((a) => a.id);
    const starterCardBacks = CARD_BACK_CATALOG.filter((b) => b.unlockedByDefault).map((b) => b.id);

    // If forcedUserId is given (verified Supabase Auth user ID)
    if (forcedUserId && this.data.users[forcedUserId]) {
      const existing = this.data.users[forcedUserId];
      existing.lastActive = Date.now();
      if (username) existing.username = username;
      if (avatarIcon) existing.avatarIcon = resolveAvatarId(avatarIcon);
      this.ensureProgressionState(existing);
      const sessionToken = existingToken || `tok_${crypto.randomBytes(16).toString('hex')}`;
      this.data.sessions[sessionToken] = existing.id;
      this.save();
      return { user: existing, sessionToken };
    }

    const existing = this.getUserByToken(existingToken);
    if (existing) {
      existing.user.lastActive = Date.now();
      if (username) existing.user.username = username;
      if (avatarIcon) existing.user.avatarIcon = resolveAvatarId(avatarIcon);
      this.ensureProgressionState(existing.user);
      this.save();
      return existing;
    }

    // Check if user with same username already exists
    if (username && !forcedUserId) {
      const existingUser = this.getUserByUsername(username);
      if (existingUser) {
        const sessionToken = `tok_${crypto.randomBytes(16).toString('hex')}`;
        existingUser.lastActive = Date.now();
        if (avatarIcon) existingUser.avatarIcon = resolveAvatarId(avatarIcon);
        this.ensureProgressionState(existingUser);
        this.data.sessions[sessionToken] = existingUser.id;
        this.save();
        return { user: existingUser, sessionToken };
      }
    }

    const userId = forcedUserId || `usr_${crypto.randomBytes(6).toString('hex')}`;
    const sessionToken = existingToken || `tok_${crypto.randomBytes(16).toString('hex')}`;
    const resolvedReq = resolveAvatarId(avatarIcon);
    const initialAvatar = getAvatarDefinition(resolvedReq).unlockedByDefault ? resolvedReq : DEFAULT_AVATAR_ID;

    const initialCollection: PlayerCollectionState = {
      unopenedPacksCount: 0,
      unopenedPacks: [],
      cards: [],
      unlockedCardBacks: [...starterCardBacks],
      unlockedAvatars: [...starterAvatars],
      recentDrops: [],
      dropRates: { ...PROGRESSION_CONFIG.rarityDropRates },
    };

    const newUser: UserAccount = {
      id: userId,
      username: username || `Bower_${Math.floor(1000 + Math.random() * 9000)}`,
      avatarIcon: initialAvatar,
      level: 1,
      xp: 0,
      nextLevelXp: 1000,
      
      // Ranked & MMR
      rankTier: '9',
      rankDivision: 'III',
      rankPoints: 0,
      mmr: 1200,
      placementMatchesRemaining: 5,
      hasDemotionShield: true,

      // Stats
      totalGames: 0,
      wins: 0,
      losses: 0,
      tricksWon: 0,
      euchres: 0,
      marches: 0,
      successfulLoners: 0,
      winStreak: 0,
      bestWinStreak: 0,

      // Social
      friends: [],
      friendRequests: [],
      recentPlayers: [],

      // Progression & Collectibles
      unopenedPacksCount: 0,
      unlockedAvatars: [...starterAvatars],
      unlockedCardBacks: [...starterCardBacks],
      collectionState: initialCollection,
      unlockedCosmetics: {
        hats: [...starterAvatars],
        cardBacks: [...starterCardBacks],
        banners: ['default_navy'],
        titles: ['Recruit'],
      },
      equippedCosmetics: {
        hat: initialAvatar,
        cardBack: DEFAULT_CARD_BACK_ID,
        banner: 'default_navy',
        title: 'Recruit',
        tableFelt: 'midnight_navy',
      },
      matchHistory: [],

      createdAt: Date.now(),
      lastActive: Date.now(),
    };

    this.data.users[userId] = newUser;
    this.data.sessions[sessionToken] = userId;
    this.save();

    return { user: newUser, sessionToken };
  }

  private ensureProgressionState(user: UserAccount): PlayerCollectionState {
    const starterAvatars = AVATAR_CATALOG.filter((a) => a.unlockedByDefault).map((a) => a.id);
    const starterCardBacks = CARD_BACK_CATALOG.filter((b) => b.unlockedByDefault).map((b) => b.id);

    if (!user.collectionState) {
      user.collectionState = {
        unopenedPacksCount: 0,
        unopenedPacks: [],
        cards: [],
        unlockedCardBacks: [...starterCardBacks],
        unlockedAvatars: [...starterAvatars],
        recentDrops: [],
        dropRates: { ...PROGRESSION_CONFIG.rarityDropRates },
      };
    }

    const avSet = new Set([
      ...starterAvatars,
      ...(user.unlockedAvatars || []).map((a) => resolveAvatarId(a)),
      ...user.collectionState.unlockedAvatars.map((a) => resolveAvatarId(a)),
      ...(user.unlockedCosmetics?.hats || []).map((a) => resolveAvatarId(a)),
    ]);
    const cbSet = new Set([
      ...starterCardBacks,
      ...(user.unlockedCardBacks || []).map((c) => resolveCardBackId(c)),
      ...user.collectionState.unlockedCardBacks.map((c) => resolveCardBackId(c)),
      ...(user.unlockedCosmetics?.cardBacks || []).map((c) => resolveCardBackId(c)),
    ]);

    user.avatarIcon = resolveAvatarId(user.avatarIcon);
    user.equippedCosmetics.cardBack = resolveCardBackId(user.equippedCosmetics.cardBack);
    user.unlockedAvatars = Array.from(avSet);
    user.unlockedCardBacks = Array.from(cbSet);
    user.collectionState.unlockedAvatars = [...user.unlockedAvatars];
    user.collectionState.unlockedCardBacks = [...user.unlockedCardBacks];
    user.collectionState.unopenedPacksCount = user.collectionState.unopenedPacks.length;
    user.unopenedPacksCount = user.collectionState.unopenedPacks.length;
    user.waxSeals = user.waxSeals ?? 150;
    user.collectionState.waxSeals = user.waxSeals;
    user.unlockedCosmetics.hats = [...user.unlockedAvatars];
    user.unlockedCosmetics.cardBacks = [...user.unlockedCardBacks];
    return user.collectionState;
  }

  /**
   * Authoritative Elo & Opponent-Sensitive Rank Progression
   */
  public recordRankedMatchResult(
    userId: string,
    isWin: boolean,
    teamAverageMmr: number,
    opponentAverageMmr: number,
    finalScore: string,
    opponentNames: string[],
    isTeammateAbandoned: boolean = false
  ): {
    user: UserAccount;
    oldTier: RankTier;
    newTier: RankTier;
    oldPoints: number;
    newPoints: number;
    lpChange: number;
    didRankUp: boolean;
    mmrChange: number;
    newMmr: number;
    lobbyMmr: number;
    promotionSealsAwarded?: number;
    didDivisionUp?: boolean;
    oldDivision?: RankDivision;
    newDivision?: RankDivision;
  } | null {
    const user = this.data.users[userId];
    if (!user) return null;

    const oldTier = user.rankTier;
    const oldDivision = normalizeRankDivision(oldTier, user.rankDivision);
    const oldPoints = user.rankPoints;
    const preMatchMmr = user.mmr;

    // Expected score based on Elo formula
    const expected = 1 / (1 + Math.pow(10, (opponentAverageMmr - preMatchMmr) / 400));
    let mmrDelta = 0;
    if (isWin) {
      const rawMmrWin = Math.round(18 + 24 * (0.5 - expected));
      mmrDelta = Math.max(6, Math.min(36, rawMmrWin));
    } else if (isTeammateAbandoned) {
      mmrDelta = 0;
    } else {
      const rawMmrLoss = Math.round(-14 + 24 * (0.5 - expected));
      mmrDelta = Math.min(-6, Math.max(-32, rawMmrLoss));
    }
    user.mmr = Math.max(600, preMatchMmr + mmrDelta);

    if (user.placementMatchesRemaining > 0) {
      user.placementMatchesRemaining--;
    }

    // Opponent-sensitive & Lobby MMR-scaled LP gain/loss calculation
    const lobbyMmr = Math.round((teamAverageMmr + opponentAverageMmr) / 2);
    const oppDelta = Math.round((opponentAverageMmr - teamAverageMmr) / 30);
    const lobbyDelta = Math.round((lobbyMmr - preMatchMmr) / 35);
    const prestigeBonus = lobbyMmr >= 1600 ? 4 : lobbyMmr >= 1450 ? 2 : 0;

    let lpChange = 0;
    if (isWin) {
      // Base win is 24 LP; scaled up by higher-rated opponents and higher-tier lobbies
      const rawWin = 24 + oppDelta + lobbyDelta + prestigeBonus;
      lpChange = Math.max(12, Math.min(42, rawWin));
    } else if (isTeammateAbandoned) {
      // Loss Mitigation Protection: Teammate abandoned during match
      lpChange = 0;
    } else {
      // Base loss penalty is -16 LP; softened if playing up in higher MMR lobby, penalized if upset by lower MMR
      const rawLoss = -16 + oppDelta + lobbyDelta + (prestigeBonus > 0 ? 1 : 0);
      lpChange = Math.min(-8, Math.max(-35, rawLoss));
    }

    let didRankUp = false;
    let didDivisionUp = false;
    let promotionSealsAwarded = 0;
    let targetPoints = user.rankPoints + lpChange;

    const currentTierIdx = TIER_ORDER.indexOf(user.rankTier);

    if (targetPoints >= 100) {
      if (user.rankTier === 'BOWER_JJ') {
        // At max tier BOWER_JJ, LP accumulates past 100
        user.rankDivision = 'APEX';
        user.rankPoints = targetPoints;
      } else if (oldDivision === 'III') {
        // Division Promotion: III -> II (100 LP each)
        user.rankDivision = 'II';
        user.rankPoints = targetPoints - 100;
        user.hasDemotionShield = true;
        didDivisionUp = true;
        promotionSealsAwarded = DIVISION_UP_WAX_SEALS['II'];
      } else if (oldDivision === 'II') {
        // Division Promotion: II -> I (100 LP each)
        user.rankDivision = 'I';
        user.rankPoints = targetPoints - 100;
        user.hasDemotionShield = true;
        didDivisionUp = true;
        promotionSealsAwarded = DIVISION_UP_WAX_SEALS['I'];
      } else {
        // Full Rank Tier Promotion from Division I -> Next Tier Division III!
        if (currentTierIdx < TIER_ORDER.length - 1) {
          user.rankTier = TIER_ORDER[currentTierIdx + 1];
          user.rankDivision = user.rankTier === 'BOWER_JJ' ? 'APEX' : 'III';
          user.rankPoints = targetPoints - 100;
          user.hasDemotionShield = true;
          didRankUp = true;
          didDivisionUp = true;
          promotionSealsAwarded = PROMOTION_WAX_SEALS[user.rankTier] || 75;
        } else {
          user.rankPoints = targetPoints;
        }
      }

      if (promotionSealsAwarded > 0) {
        user.waxSeals = (user.waxSeals ?? 150) + promotionSealsAwarded;
        if (user.collectionState) {
          user.collectionState.waxSeals = user.waxSeals;
        }
      }
    } else if (targetPoints < 0) {
      // Demotion Check
      if (user.hasDemotionShield) {
        // Shield absorbs the loss once
        user.rankPoints = 0;
        user.hasDemotionShield = false;
      } else if (oldDivision === 'I') {
        user.rankDivision = 'II';
        user.rankPoints = 75;
        user.hasDemotionShield = true;
      } else if (oldDivision === 'II') {
        user.rankDivision = 'III';
        user.rankPoints = 75;
        user.hasDemotionShield = true;
      } else if (currentTierIdx > 0) {
        // Demote one tier down into Division I with 75 LP
        user.rankTier = TIER_ORDER[currentTierIdx - 1];
        user.rankDivision = 'I';
        user.rankPoints = 75;
        user.hasDemotionShield = true;
      } else {
        user.rankDivision = 'III';
        user.rankPoints = 0;
      }
    } else {
      user.rankDivision = oldDivision;
      user.rankPoints = targetPoints;
    }

    const newDivision = normalizeRankDivision(user.rankTier, user.rankDivision);

    // Record Match History
    const matchRecord: MatchRecord = {
      id: `m_${crypto.randomBytes(4).toString('hex')}`,
      date: Date.now(),
      mode: 'ranked_solo',
      won: isWin,
      score: finalScore,
      lpChange,
      mmrChange: mmrDelta,
      opponentNames,
    };
    user.matchHistory.unshift(matchRecord);
    if (user.matchHistory.length > 20) {
      user.matchHistory.pop();
    }

    this.save();

    return {
      user,
      oldTier,
      newTier: user.rankTier,
      oldPoints,
      newPoints: user.rankPoints,
      lpChange,
      didRankUp,
      mmrChange: mmrDelta,
      newMmr: user.mmr,
      lobbyMmr,
      promotionSealsAwarded,
      didDivisionUp,
      oldDivision,
      newDivision,
    };
  }

  /**
   * Authoritative Penalty for Abandoning a Live Ranked Match.
   * Assesses an immediate match loss, deducts LP, breaks win streak,
   * and tracks abandonment count to protect competitive integrity.
   */
  public recordAbandonment(
    userId: string,
    opponentNames: string[] = ['Opponent 1', 'Opponent 2']
  ): {
    oldTier: RankTier;
    newTier: RankTier;
    oldPoints: number;
    newPoints: number;
    lpChange: number;
  } | null {
    const user = this.data.users[userId];
    if (!user) return null;

    const oldTier = user.rankTier;
    const oldPoints = user.rankPoints;
    const lpChange = -20; // Fixed strict abandonment penalty

    user.losses = (user.losses || 0) + 1;
    user.totalGames = (user.totalGames || 0) + 1;
    user.abandonments = (user.abandonments || 0) + 1;
    user.winStreak = 0;
    user.mmr = Math.max(600, user.mmr - 30);

    const currentTierIdx = TIER_ORDER.indexOf(user.rankTier);
    let targetPoints = user.rankPoints + lpChange;

    if (targetPoints < 0) {
      if (user.hasDemotionShield) {
        user.rankPoints = 0;
        user.hasDemotionShield = false;
      } else if (currentTierIdx > 0) {
        user.rankTier = TIER_ORDER[currentTierIdx - 1];
        user.rankPoints = 75;
      } else {
        user.rankPoints = 0;
      }
    } else {
      user.rankPoints = targetPoints;
    }

    // Record in match history
    const record: MatchRecord = {
      id: `m_aband_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      date: Date.now(),
      mode: 'Ranked Abandonment (Penalty)',
      won: false,
      score: 'Forfeit',
      lpChange,
      opponentNames,
    };
    user.matchHistory = [record, ...(user.matchHistory || [])].slice(0, 30);

    this.save();

    return {
      oldTier,
      newTier: user.rankTier,
      oldPoints,
      newPoints: user.rankPoints,
      lpChange,
    };
  }

  /**
   * Records Matchmaking Team Composition for Telemetry Analytics
   */
  public recordMatchmakingComposition(humanCount: number, waitTimeMs: number = 0) {
    if (!this.data.matchmakingStats) {
      this.data.matchmakingStats = {
        totalMatches: 0,
        fourHumans: 0,
        threeHumansOneBot: 0,
        twoHumansTwoBots: 0,
        oneHumanThreeBots: 0,
        totalWaitTimeMs: 0,
      };
    }

    const s = this.data.matchmakingStats;
    s.totalMatches++;
    s.totalWaitTimeMs += waitTimeMs;

    if (humanCount >= 4) s.fourHumans++;
    else if (humanCount === 3) s.threeHumansOneBot++;
    else if (humanCount === 2) s.twoHumansTwoBots++;
    else s.oneHumanThreeBots++;

    this.save();
  }

  /**
   * Computes Matchmaking Distribution Analytics (Percentages of 4H, 3H+1B, 2H+2B, 1H+3B)
   */
  public getMatchmakingStats(): MatchmakingStats {
    const s = this.data.matchmakingStats || {
      totalMatches: 0,
      fourHumans: 0,
      threeHumansOneBot: 0,
      twoHumansTwoBots: 0,
      oneHumanThreeBots: 0,
      totalWaitTimeMs: 0,
    };

    const total = Math.max(1, s.totalMatches);
    const avgWait = s.totalMatches > 0 ? Math.round(s.totalWaitTimeMs / s.totalMatches) : 0;

    return {
      totalMatches: s.totalMatches,
      fourHumans: s.fourHumans,
      threeHumansOneBot: s.threeHumansOneBot,
      twoHumansTwoBots: s.twoHumansTwoBots,
      oneHumanThreeBots: s.oneHumanThreeBots,
      totalWaitTimeMs: s.totalWaitTimeMs,
      averageWaitTimeMs: avgWait,
      percentages: {
        fourHumans: s.totalMatches > 0 ? Number(((s.fourHumans / total) * 100).toFixed(1)) : 0,
        threeHumansOneBot: s.totalMatches > 0 ? Number(((s.threeHumansOneBot / total) * 100).toFixed(1)) : 0,
        twoHumansTwoBots: s.totalMatches > 0 ? Number(((s.twoHumansTwoBots / total) * 100).toFixed(1)) : 0,
        oneHumanThreeBots: s.totalMatches > 0 ? Number(((s.oneHumanThreeBots / total) * 100).toFixed(1)) : 0,
      },
    };
  }

  /**
   * Authoritative match completion (XP, Level-Up Card Packs, Milestone Avatars, Lifetime Stats)
   */
  public recordMatchCompletion(
    userId: string,
    isWin: boolean,
    tricks: number,
    marches: number,
    euchres: number,
    loners: number
  ): UserAccount | null {
    const user = this.data.users[userId];
    if (!user) return null;
    const colState = this.ensureProgressionState(user);

    user.totalGames++;
    if (isWin) {
      user.wins++;
      user.winStreak++;
      if (user.winStreak > user.bestWinStreak) {
        user.bestWinStreak = user.winStreak;
      }
    } else {
      user.losses++;
      user.winStreak = 0;
    }

    user.tricksWon += tricks;
    user.marches += marches;
    user.euchres += euchres;
    user.successfulLoners += loners;

    // Calculate Authoritative Player XP
    let xpAwarded = 250; // Base completion XP
    if (isWin) xpAwarded += 150;
    xpAwarded += tricks * 25;
    xpAwarded += marches * 75;
    xpAwarded += euchres * 75;
    xpAwarded += loners * 150;

    const oldLevel = user.level;
    user.xp += xpAwarded;

    // Level progression (1000 XP per level)
    while (user.xp >= PROGRESSION_CONFIG.xpPerLevel) {
      user.xp -= PROGRESSION_CONFIG.xpPerLevel;
      user.level++;
    }
    user.nextLevelXp = PROGRESSION_CONFIG.xpPerLevel;

    // Grant exactly 1 unopened card pack per qualifying level-up (idempotent per level)
    for (let lvl = oldLevel + 1; lvl <= user.level; lvl++) {
      const sourceRef = `level_${lvl}`;
      if (!colState.unopenedPacks.some((p) => p.sourceRef === sourceRef)) {
        colState.unopenedPacks.push({
          id: crypto.randomUUID(),
          source: 'level_up',
          sourceRef,
          earnedLevel: lvl,
          earnedAt: Date.now(),
        });
      }
    }

    const completedCols = colState.unlockedCardBacks.filter((cb) => !getCardBackDefinition(cb).isStarter);
    const eligibleAvs = getEligibleMilestoneAvatars({
      level: user.level,
      wins: user.wins,
      unlockedCollectionIds: completedCols,
    });
    for (const av of eligibleAvs) {
      if (!colState.unlockedAvatars.includes(av.id)) {
        colState.unlockedAvatars.push(av.id);
      }
    }

    this.ensureProgressionState(user);
    user.lastActive = Date.now();
    this.save();
    return user;
  }

  // --- SOCIAL & FRIENDS MANAGEMENT ---

  public sendFriendRequest(fromUserId: string, targetUsername: string): { success: boolean; error?: string } {
    const sender = this.data.users[fromUserId];
    if (!sender) return { success: false, error: 'Sender not found' };

    const target = this.getUserByUsername(targetUsername);
    if (!target) return { success: false, error: `Player "${targetUsername}" not found` };
    if (target.id === fromUserId) return { success: false, error: 'You cannot add yourself as a friend' };

    if (!sender.friends) sender.friends = [];
    if (!sender.friendRequests) sender.friendRequests = [];
    if (!target.friends) target.friends = [];
    if (!target.friendRequests) target.friendRequests = [];

    if (sender.friends.includes(target.id)) {
      return { success: false, error: 'Already friends' };
    }

    const alreadySent = target.friendRequests.some(r => r.fromUserId === fromUserId);
    if (alreadySent) {
      return { success: false, error: 'Friend request already sent' };
    }

    target.friendRequests.push({
      fromUserId,
      fromUsername: sender.username,
      fromAvatar: sender.avatarIcon,
      timestamp: Date.now(),
    });

    this.save();
    return { success: true };
  }

  public async sendFriendRequestAsync(fromUserId: string, targetUsername: string): Promise<{ success: boolean; error?: string }> {
    let target = this.getUserByUsername(targetUsername);
    if (!target) {
      await this.getUserByUsernameAsync(targetUsername);
    }
    return this.sendFriendRequest(fromUserId, targetUsername);
  }

  public acceptFriendRequest(userId: string, fromUserId: string): { success: boolean; error?: string } {
    const user = this.data.users[userId];
    const friend = this.data.users[fromUserId];
    if (!user || !friend) return { success: false, error: 'User not found' };

    if (!user.friends) user.friends = [];
    if (!user.friendRequests) user.friendRequests = [];
    if (!friend.friends) friend.friends = [];
    if (!friend.friendRequests) friend.friendRequests = [];

    // Remove request
    user.friendRequests = user.friendRequests.filter(r => r.fromUserId !== fromUserId);

    if (!user.friends.includes(fromUserId)) {
      user.friends.push(fromUserId);
    }
    if (!friend.friends.includes(userId)) {
      friend.friends.push(userId);
    }

    this.save();
    return { success: true };
  }

  public declineFriendRequest(userId: string, fromUserId: string): { success: boolean } {
    const user = this.data.users[userId];
    if (user) {
      if (!user.friendRequests) user.friendRequests = [];
      user.friendRequests = user.friendRequests.filter(r => r.fromUserId !== fromUserId);
      this.save();
    }
    return { success: true };
  }

  public removeFriend(userId: string, friendUserId: string): { success: boolean } {
    const user = this.data.users[userId];
    const friend = this.data.users[friendUserId];
    if (user && user.friends) {
      user.friends = user.friends.filter(id => id !== friendUserId);
    }
    if (friend && friend.friends) {
      friend.friends = friend.friends.filter(id => id !== userId);
    }
    this.save();
    return { success: true };
  }

  public getFriendsSummary(userId: string, activeConnections: Map<string, any>): FriendSummary[] {
    const user = this.data.users[userId];
    if (!user || !user.friends) return [];

    return user.friends.map(fId => {
      const f = this.data.users[fId];
      if (!f) return null;
      const conn = activeConnections.get(fId);
      const isOnline = !!conn;
      const status = isOnline ? (conn.roomCode ? 'in_game' : 'online') : 'offline';

      return {
        userId: f.id,
        username: f.username,
        avatarIcon: resolveAvatarId(f.avatarIcon),
        equippedCardBack: resolveCardBackId(f.equippedCosmetics?.cardBack),
        rankTier: f.rankTier,
        rankPoints: f.rankPoints,
        level: f.level,
        isOnline,
        status,
        roomCode: conn?.roomCode,
      };
    }).filter(Boolean) as FriendSummary[];
  }

  // --- LEADERBOARD ---

  public getLeaderboard(limit = 50): LeaderboardEntry[] {
    const isRankedHistoryEntry = (m: MatchRecord) =>
      m.mode === 'ranked_solo' ||
      m.mode === 'ranked_duo' ||
      m.mode === 'ranked_rivals' ||
      (typeof m.mode === 'string' && m.mode.toLowerCase().includes('ranked'));

    // Strictly include ONLY players who have queued up and participated in Ranked games
    const rankedUsers = Object.values(this.data.users).filter((u) => {
      if (!u.username || u.username.startsWith('Bench_')) return false;
      const rankedMatches = (u.matchHistory || []).filter(isRankedHistoryEntry);
      if (rankedMatches.length > 0) return true;
      if (typeof u.placementMatchesRemaining === 'number' && u.placementMatchesRemaining < 5) return true;
      if ((u.rankPoints || 0) > 0) return true;
      if (u.rankTier && u.rankTier !== '9') return true;
      if (typeof u.mmr === 'number' && u.mmr !== 1200) return true;
      return false;
    });

    rankedUsers.sort((a, b) => {
      const tierDiff = TIER_ORDER.indexOf(b.rankTier) - TIER_ORDER.indexOf(a.rankTier);
      if (tierDiff !== 0) return tierDiff;
      const divA = DIVISION_WEIGHT[normalizeRankDivision(a.rankTier, a.rankDivision)] || 1;
      const divB = DIVISION_WEIGHT[normalizeRankDivision(b.rankTier, b.rankDivision)] || 1;
      if (divB !== divA) return divB - divA;
      if (b.rankPoints !== a.rankPoints) return b.rankPoints - a.rankPoints;
      return (b.mmr || 1200) - (a.mmr || 1200);
    });

    return rankedUsers.slice(0, limit).map((u, idx) => {
      const rankedMatches = (u.matchHistory || []).filter(isRankedHistoryEntry);
      const hasRankedHistory = rankedMatches.length > 0;
      const rWins = hasRankedHistory ? rankedMatches.filter((m) => m.won).length : u.wins;
      const rLosses = hasRankedHistory ? rankedMatches.filter((m) => !m.won).length : u.losses;
      const rTotal = hasRankedHistory ? Math.max(rankedMatches.length, rWins + rLosses) : u.totalGames;
      const winRate = rTotal > 0 ? Math.round((rWins / rTotal) * 100) : 0;

      return {
        rankPosition: idx + 1,
        userId: u.id,
        username: u.username,
        avatarIcon: resolveAvatarId(u.avatarIcon),
        equippedCardBack: resolveCardBackId(u.equippedCosmetics?.cardBack),
        rankTier: u.rankTier,
        rankDivision: normalizeRankDivision(u.rankTier, u.rankDivision),
        rankPoints: u.rankPoints,
        mmr: u.mmr || 1200,
        wins: rWins,
        losses: rLosses,
        totalGames: rTotal,
        rankedGames: rTotal,
        winRate,
        winStreak: u.winStreak || 0,
        bestStreak: u.bestWinStreak || 0,
      };
    });
  }

  // --- COLLECTIBLE CARD PACKS, CARD BACKS & AVATARS ---

  public getCollectionState(userId: string): PlayerCollectionState {
    const user = this.data.users[userId];
    if (!user) {
      return {
        unopenedPacksCount: 0,
        unopenedPacks: [],
        cards: [],
        unlockedCardBacks: CARD_BACK_CATALOG.filter((b) => b.unlockedByDefault).map((b) => b.id),
        unlockedAvatars: AVATAR_CATALOG.filter((a) => a.unlockedByDefault).map((a) => a.id),
        recentDrops: [],
        dropRates: { ...PROGRESSION_CONFIG.rarityDropRates },
      };
    }
    return this.ensureProgressionState(user);
  }

  public grantLevelUpPacksForTest(userId: string, newLevel: number): number {
    const user = this.data.users[userId];
    if (!user) return 0;
    const colState = this.ensureProgressionState(user);
    const oldLevel = user.level;
    user.level = Math.max(oldLevel, newLevel);
    let awarded = 0;
    for (let lvl = oldLevel + 1; lvl <= user.level; lvl++) {
      const sourceRef = `level_${lvl}`;
      if (!colState.unopenedPacks.some((p) => p.sourceRef === sourceRef)) {
        colState.unopenedPacks.push({
          id: crypto.randomUUID(),
          source: 'level_up',
          sourceRef,
          earnedLevel: lvl,
          earnedAt: Date.now(),
        });
        awarded++;
      }
    }
    this.ensureProgressionState(user);
    this.save();
    return awarded;
  }

  public openCardPack(
    userId: string,
    packId?: string,
    rng: () => number = Math.random
  ): { success: boolean; error?: string; result?: PackOpenResult } {
    const user = this.data.users[userId];
    if (!user) return { success: false, error: 'User not found.' };
    const colState = this.ensureProgressionState(user);

    const idx = packId
      ? colState.unopenedPacks.findIndex((p) => p.id === packId)
      : colState.unopenedPacks.length > 0
        ? 0
        : -1;
    let pack: UnopenedPackItem;
    if (idx === -1) {
      const uLower = (user.username || '').trim().toLowerCase();
      if (uLower === 'brojo' || uLower === 'turkeysub' || Boolean((user as any).isAdmin)) {
        pack = {
          id: `unlimited_on_the_fly_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          source: 'admin_grant',
          sourceRef: `unlimited_refill_${Date.now()}`,
          earnedLevel: 99,
          earnedAt: Date.now(),
        };
      } else {
        return { success: false, error: 'No unopened card packs available.' };
      }
    } else {
      pack = colState.unopenedPacks.splice(idx, 1)[0];
    }
    const openedAt = Date.now();
    const drawnDefs = rollPackCards(PROGRESSION_CONFIG, rng);
    const drawnResults: DrawnCardResult[] = [];
    const affectedCollections = new Set<string>();
    let packDustAwarded = 0;

    for (const card of drawnDefs) {
      affectedCollections.add(card.collectionId);
      const existing = colState.cards.find((c) => c.cardId === card.id);
      const wasDuplicate = Boolean(existing && existing.quantity > 0);
      let dustAwarded = 0;
      if (wasDuplicate) {
        dustAwarded = WAX_SEALS_CONFIG.duplicateSeals[card.rarity] || 10;
        packDustAwarded += dustAwarded;
      }
      if (existing) {
        existing.quantity += 1;
        existing.lastAcquiredAt = openedAt;
      } else {
        colState.cards.push({
          cardId: card.id,
          collectionId: card.collectionId,
          identity: card.identity,
          rarity: card.rarity,
          quantity: 1,
          firstAcquiredAt: openedAt,
          lastAcquiredAt: openedAt,
        });
      }
      const qty = colState.cards.find((c) => c.cardId === card.id)!.quantity;
      drawnResults.push({
        cardId: card.id,
        collectionId: card.collectionId,
        collectionName: card.collectionName,
        identity: card.identity,
        name: card.name,
        rarity: card.rarity,
        imageUrl: card.imageUrl,
        wasDuplicate,
        newQuantity: qty,
        dustAwarded: wasDuplicate ? dustAwarded : undefined,
      });
    }

    user.waxSeals = (user.waxSeals ?? 150) + packDustAwarded;
    colState.waxSeals = user.waxSeals;

    const newlyUnlockedCardBacks: string[] = [];
    for (const colId of affectedCollections) {
      const ownedIdentities = new Set(
        colState.cards.filter((c) => c.collectionId === colId && c.quantity > 0).map((c) => c.identity)
      );
      if (ownedIdentities.size >= 5 && !colState.unlockedCardBacks.includes(colId)) {
        colState.unlockedCardBacks.push(colId);
        newlyUnlockedCardBacks.push(colId);
      }
    }

    const completedCols = colState.unlockedCardBacks.filter((cb) => !getCardBackDefinition(cb).isStarter);
    const eligibleAvs = getEligibleMilestoneAvatars({
      level: user.level,
      wins: user.wins,
      unlockedCollectionIds: completedCols,
    });
    const newlyUnlockedAvatars: string[] = [];
    for (const av of eligibleAvs) {
      if (!colState.unlockedAvatars.includes(av.id)) {
        colState.unlockedAvatars.push(av.id);
        newlyUnlockedAvatars.push(av.id);
      }
    }

    colState.recentDrops.unshift({
      packId: pack.id,
      openedAt,
      source: pack.source,
      earnedLevel: pack.earnedLevel,
      cards: drawnResults.map((c) => ({
        cardId: c.cardId,
        collectionId: c.collectionId,
        identity: c.identity,
        rarity: c.rarity,
        wasDuplicate: c.wasDuplicate,
      })),
    });
    if (colState.recentDrops.length > 10) {
      colState.recentDrops = colState.recentDrops.slice(0, 10);
    }

    this.ensureProgressionState(user);
    this.save();

    return {
      success: true,
      result: {
        packId: pack.id,
        openedAt,
        cards: drawnResults,
        newlyUnlockedCardBacks,
        newlyUnlockedAvatars,
        waxSealsAwarded: packDustAwarded,
        totalWaxSeals: user.waxSeals,
        remainingUnopenedPacks: colState.unopenedPacksCount,
        collectionState: colState,
      },
    };
  }

  public craftCard(
    userId: string,
    cardId: string
  ): {
    success: boolean;
    error?: string;
    cardId?: string;
    waxSeals?: number;
    newlyUnlockedCardBacks?: string[];
    newlyUnlockedAvatars?: string[];
    collectionState?: PlayerCollectionState;
  } {
    const user = this.data.users[userId];
    if (!user) return { success: false, error: 'User not found.' };
    const colState = this.ensureProgressionState(user);

    const cardDef = COLLECTIBLE_CARDS.find((c) => c.id === cardId);
    if (!cardDef) return { success: false, error: `Card ${cardId} not found in catalog.` };

    const cost = getCraftCost(cardDef.rarity);
    const balance = user.waxSeals ?? 150;
    if (balance < cost) {
      return {
        success: false,
        error: `Insufficient Wax Seals (Dust). Required: ${cost}, Current balance: ${balance}.`,
      };
    }

    user.waxSeals = balance - cost;
    colState.waxSeals = user.waxSeals;

    const existing = colState.cards.find((c) => c.cardId === cardId);
    const now = Date.now();
    if (existing) {
      existing.quantity += 1;
      existing.lastAcquiredAt = now;
    } else {
      colState.cards.push({
        cardId: cardDef.id,
        collectionId: cardDef.collectionId,
        identity: cardDef.identity,
        rarity: cardDef.rarity,
        quantity: 1,
        firstAcquiredAt: now,
        lastAcquiredAt: now,
      });
    }

    const newlyUnlockedCardBacks: string[] = [];
    const ownedIdentities = new Set(
      colState.cards.filter((c) => c.collectionId === cardDef.collectionId && c.quantity > 0).map((c) => c.identity)
    );
    if (ownedIdentities.size >= 5 && !colState.unlockedCardBacks.includes(cardDef.collectionId)) {
      colState.unlockedCardBacks.push(cardDef.collectionId);
      newlyUnlockedCardBacks.push(cardDef.collectionId);
    }

    const completedCols = colState.unlockedCardBacks.filter((cb) => !getCardBackDefinition(cb).isStarter);
    const eligibleAvs = getEligibleMilestoneAvatars({
      level: user.level,
      wins: user.wins,
      unlockedCollectionIds: completedCols,
    });
    const newlyUnlockedAvatars: string[] = [];
    for (const av of eligibleAvs) {
      if (!colState.unlockedAvatars.includes(av.id)) {
        colState.unlockedAvatars.push(av.id);
        newlyUnlockedAvatars.push(av.id);
      }
    }

    this.ensureProgressionState(user);
    this.save();

    return {
      success: true,
      cardId: cardDef.id,
      waxSeals: user.waxSeals,
      newlyUnlockedCardBacks,
      newlyUnlockedAvatars,
      collectionState: colState,
    };
  }

  public equipAvatar(userId: string, avatarId: string): { success: boolean; error?: string; avatarId?: string } {
    const user = this.data.users[userId];
    if (!user) return { success: false, error: 'User not found.' };
    const colState = this.ensureProgressionState(user);
    const canonical = resolveAvatarId(avatarId);
    const def = getAvatarDefinition(canonical);
    if (!def.unlockedByDefault && !colState.unlockedAvatars.includes(canonical)) {
      return { success: false, error: 'Avatar is locked. Unlock it to equip.' };
    }
    user.avatarIcon = canonical;
    user.equippedCosmetics.hat = canonical;
    this.save();
    return { success: true, avatarId: canonical };
  }

  public equipCardBack(userId: string, cardBackId: string): { success: boolean; error?: string; cardBackId?: string } {
    const user = this.data.users[userId];
    if (!user) return { success: false, error: 'User not found.' };
    const colState = this.ensureProgressionState(user);
    const canonical = resolveCardBackId(cardBackId);
    const def = getCardBackDefinition(canonical);
    if (!def.unlockedByDefault && !colState.unlockedCardBacks.includes(canonical)) {
      return { success: false, error: 'Complete this collection to unlock its card back.' };
    }
    user.equippedCosmetics.cardBack = canonical;
    this.save();
    return { success: true, cardBackId: canonical };
  }

  public equipCosmetic(
    userId: string,
    category: 'hat' | 'cardBack' | 'banner' | 'title' | 'tableFelt',
    itemId?: string
  ): boolean {
    const user = this.data.users[userId];
    if (!user) return false;
    if (category === 'hat' && itemId) {
      return this.equipAvatar(userId, itemId).success;
    }
    if (category === 'cardBack' && itemId) {
      return this.equipCardBack(userId, itemId).success;
    }
    if (category === 'tableFelt' && itemId) {
      const canonical = resolveTableFeltId(itemId);
      const def = getTableFeltDefinition(canonical);
      if (!def.unlockedByDefault && def.collectionId) {
        const hasCardBack = (user.unlockedCosmetics?.cardBacks || []).includes(def.collectionId);
        if (!hasCardBack) {
          return false;
        }
      }
      if (!user.equippedCosmetics) {
        user.equippedCosmetics = { hat: 'the_outlaw', cardBack: 'classic_blue' };
      }
      user.equippedCosmetics.tableFelt = canonical;
      this.save();
      return true;
    }

    if (!user.equippedCosmetics) {
      user.equippedCosmetics = { hat: 'the_outlaw', cardBack: 'classic_blue' };
    }
    user.equippedCosmetics[category] = itemId;
    this.save();
    return true;
  }

  public getUserProfile(
    targetUserId?: string,
    targetUsername?: string,
    requestingUserId?: string
  ): PublicPlayerData | null {
    let targetUser: UserAccount | null | undefined;
    if (targetUserId) {
      targetUser = this.getUserById(targetUserId);
    }
    if (!targetUser && targetUsername) {
      targetUser = this.getUserByUsername(targetUsername);
    }
    if (!targetUser) return null;

    const requestingUser = requestingUserId ? this.getUserById(requestingUserId) : null;
    const isFriend = requestingUser ? requestingUser.friends.includes(targetUser.id) : false;
    const isOnline = Object.values(this.data.sessions).includes(targetUser.id);

    return {
      id: targetUser.id,
      username: targetUser.username,
      avatarIcon: resolveAvatarId(targetUser.avatarIcon),
      equippedCardBack: resolveCardBackId(targetUser.equippedCosmetics?.cardBack),
      level: targetUser.level,
      rankTier: targetUser.rankTier,
      rankPoints: targetUser.rankPoints,
      totalGames: targetUser.totalGames,
      wins: targetUser.wins,
      losses: targetUser.losses,
      bestStreak: targetUser.bestWinStreak,
      isFriend,
      isOnline,
      equippedCosmetics: targetUser.equippedCosmetics,
    };
  }

  public recordReport(
    reportingUserId: string,
    target: string,
    reason: string
  ): void {
    console.log(`[REPORT AUDIT] User ${reportingUserId} reported ${target} for: "${reason}" at ${new Date().toISOString()}`);
  }
}

export const db = new Database();
