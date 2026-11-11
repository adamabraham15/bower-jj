/**
 * BOWER JJ — Authoritative User, Progression, Elo MMR & Social Database
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  UserAccount,
  RankTier,
  MatchRecord,
  Challenge,
  BattlePassState,
  LeaderboardEntry,
  FriendSummary,
  PublicPlayerData,
  MatchmakingStats,
} from './types';

const DB_DIR = path.resolve(process.cwd(), 'server', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

export const TIER_ORDER: RankTier[] = ['9', '10', 'Q', 'K', 'A', 'BOWER_JJ'];

const DEFAULT_CHALLENGES: Challenge[] = [
  {
    id: 'ch_1',
    title: 'Trick Taker',
    desc: 'Win 15 total tricks across any game mode',
    target: 15,
    current: 0,
    xpReward: 300,
    completed: false,
  },
  {
    id: 'ch_2',
    title: 'Euchre Master',
    desc: 'Defend and Euchre the opponents 2 times',
    target: 2,
    current: 0,
    xpReward: 450,
    completed: false,
  },
  {
    id: 'ch_3',
    title: 'March of the Kings',
    desc: 'Score a March (take all 5 tricks in a single hand)',
    target: 1,
    current: 0,
    xpReward: 500,
    completed: false,
  },
  {
    id: 'ch_4',
    title: 'Victorious Bower',
    desc: 'Win 2 full matches',
    target: 2,
    current: 0,
    xpReward: 600,
    completed: false,
  },
];

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

  public getOrCreateUser(
    username: string,
    avatarIcon: string,
    existingToken?: string,
    forcedUserId?: string
  ): { user: UserAccount; sessionToken: string } {
    // If forcedUserId is given (verified Supabase Auth user ID)
    if (forcedUserId && this.data.users[forcedUserId]) {
      const existing = this.data.users[forcedUserId];
      existing.lastActive = Date.now();
      if (username) existing.username = username;
      if (avatarIcon) existing.avatarIcon = avatarIcon;
      const sessionToken = existingToken || `tok_${crypto.randomBytes(16).toString('hex')}`;
      this.data.sessions[sessionToken] = existing.id;
      this.save();
      return { user: existing, sessionToken };
    }

    const existing = this.getUserByToken(existingToken);
    if (existing) {
      existing.user.lastActive = Date.now();
      if (username) existing.user.username = username;
      if (avatarIcon) existing.user.avatarIcon = avatarIcon;
      this.save();
      return existing;
    }

    // Check if user with same username already exists
    if (username && !forcedUserId) {
      const existingUser = this.getUserByUsername(username);
      if (existingUser) {
        const sessionToken = `tok_${crypto.randomBytes(16).toString('hex')}`;
        existingUser.lastActive = Date.now();
        if (avatarIcon) existingUser.avatarIcon = avatarIcon;
        this.data.sessions[sessionToken] = existingUser.id;
        this.save();
        return { user: existingUser, sessionToken };
      }
    }

    const userId = forcedUserId || `usr_${crypto.randomBytes(6).toString('hex')}`;
    const sessionToken = existingToken || `tok_${crypto.randomBytes(16).toString('hex')}`;

    const newUser: UserAccount = {
      id: userId,
      username: username || `Bower_${Math.floor(1000 + Math.random() * 9000)}`,
      avatarIcon: avatarIcon || '🤠',
      level: 1,
      xp: 0,
      
      // Ranked & MMR
      rankTier: '9',
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

      // Progression
      battlePass: {
        tier: 1,
        xp: 0,
        tierXpRequired: 500,
        isPremium: false,
        claimedFreeTiers: [],
        claimedPremiumTiers: [],
      },
      challenges: JSON.parse(JSON.stringify(DEFAULT_CHALLENGES)),
      unlockedCosmetics: {
        hats: ['🤠', '🧢'],
        cardBacks: ['classic_blue', 'classic_red'],
        banners: ['default_navy'],
        titles: ['Recruit'],
      },
      equippedCosmetics: {
        hat: '🤠',
        cardBack: 'classic_blue',
        banner: 'default_navy',
        title: 'Recruit',
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
  } | null {
    const user = this.data.users[userId];
    if (!user) return null;

    const oldTier = user.rankTier;
    const oldPoints = user.rankPoints;

    // Expected score based on Elo formula
    const expected = 1 / (1 + Math.pow(10, (opponentAverageMmr - user.mmr) / 400));
    const actual = isWin ? 1 : 0;
    const kFactor = user.placementMatchesRemaining > 0 ? 40 : 25;
    const mmrDelta = Math.round(kFactor * (actual - expected));
    user.mmr = Math.max(600, user.mmr + mmrDelta);

    if (user.placementMatchesRemaining > 0) {
      user.placementMatchesRemaining--;
    }

    // Opponent-sensitive LP gain/loss calculation
    let lpChange = 0;
    if (isWin) {
      // Base win reward 20 LP
      lpChange = 20 + Math.round((opponentAverageMmr - teamAverageMmr) / 25);
      lpChange = Math.max(12, Math.min(35, lpChange)); // Bound between 12 and 35
    } else if (isTeammateAbandoned) {
      // Loss Mitigation Protection: Teammate abandoned during match
      lpChange = 0;
    } else {
      // Base loss penalty 18 LP
      lpChange = -(18 + Math.round((teamAverageMmr - opponentAverageMmr) / 25));
      lpChange = Math.min(-10, Math.max(-32, lpChange)); // Bound between -10 and -32
    }

    let didRankUp = false;
    let targetPoints = user.rankPoints + lpChange;

    const currentTierIdx = TIER_ORDER.indexOf(user.rankTier);

    if (targetPoints >= 100) {
      // Rank Up!
      if (currentTierIdx < TIER_ORDER.length - 1) {
        user.rankTier = TIER_ORDER[currentTierIdx + 1];
        user.rankPoints = targetPoints - 100;
        user.hasDemotionShield = true;
        didRankUp = true;
      } else {
        // At max tier BOWER_JJ, LP accumulates past 100
        user.rankPoints = targetPoints;
      }
    } else if (targetPoints < 0) {
      // Demotion Check
      if (user.hasDemotionShield) {
        // Shield absorbs the loss once
        user.rankPoints = 0;
        user.hasDemotionShield = false;
      } else if (currentTierIdx > 0) {
        // Demote one tier down with 75 LP
        user.rankTier = TIER_ORDER[currentTierIdx - 1];
        user.rankPoints = 75;
        user.hasDemotionShield = true;
      } else {
        user.rankPoints = 0;
      }
    } else {
      user.rankPoints = targetPoints;
    }

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
   * Authoritative match completion (XP, Battle Pass, Challenges, Lifetime Stats)
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

    user.xp += xpAwarded;

    // Level progression (level * 1000 XP)
    let neededXp = user.level * 1000;
    while (user.xp >= neededXp) {
      user.xp -= neededXp;
      user.level++;
      neededXp = user.level * 1000;
    }

    // Battle Pass Progression
    const passXp = Math.floor(xpAwarded * 0.8);
    user.battlePass.xp += passXp;
    while (user.battlePass.xp >= user.battlePass.tierXpRequired && user.battlePass.tier < 30) {
      user.battlePass.xp -= user.battlePass.tierXpRequired;
      user.battlePass.tier++;
    }

    // Challenges Progress
    user.challenges.forEach(ch => {
      if (ch.completed) return;
      if (ch.id === 'ch_1') ch.current = Math.min(ch.target, ch.current + tricks);
      if (ch.id === 'ch_2') ch.current = Math.min(ch.target, ch.current + euchres);
      if (ch.id === 'ch_3') ch.current = Math.min(ch.target, ch.current + marches);
      if (ch.id === 'ch_4' && isWin) ch.current = Math.min(ch.target, ch.current + 1);

      if (ch.current >= ch.target) {
        ch.completed = true;
        user.xp += ch.xpReward;
        user.battlePass.xp += ch.xpReward;
      }
    });

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

  public acceptFriendRequest(userId: string, fromUserId: string): { success: boolean; error?: string } {
    const user = this.data.users[userId];
    const friend = this.data.users[fromUserId];
    if (!user || !friend) return { success: false, error: 'User not found' };

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
      user.friendRequests = user.friendRequests.filter(r => r.fromUserId !== fromUserId);
      this.save();
    }
    return { success: true };
  }

  public removeFriend(userId: string, friendUserId: string): { success: boolean } {
    const user = this.data.users[userId];
    const friend = this.data.users[friendUserId];
    if (user) {
      user.friends = user.friends.filter(id => id !== friendUserId);
    }
    if (friend) {
      friend.friends = friend.friends.filter(id => id !== userId);
    }
    this.save();
    return { success: true };
  }

  public getFriendsSummary(userId: string, activeConnections: Map<string, any>): FriendSummary[] {
    const user = this.data.users[userId];
    if (!user) return [];

    return user.friends.map(fId => {
      const f = this.data.users[fId];
      if (!f) return null;
      const conn = activeConnections.get(fId);
      const isOnline = !!conn;
      const status = isOnline ? (conn.roomCode ? 'in_game' : 'online') : 'offline';

      return {
        userId: f.id,
        username: f.username,
        avatarIcon: f.avatarIcon,
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
    const allUsers = Object.values(this.data.users);

    allUsers.sort((a, b) => {
      const tierDiff = TIER_ORDER.indexOf(b.rankTier) - TIER_ORDER.indexOf(a.rankTier);
      if (tierDiff !== 0) return tierDiff;
      if (b.rankPoints !== a.rankPoints) return b.rankPoints - a.rankPoints;
      return b.mmr - a.mmr;
    });

    return allUsers.slice(0, limit).map((u, idx) => ({
      rankPosition: idx + 1,
      userId: u.id,
      username: u.username,
      avatarIcon: u.avatarIcon,
      rankTier: u.rankTier,
      rankPoints: u.rankPoints,
      mmr: u.mmr,
      wins: u.wins,
      losses: u.losses,
      totalGames: u.totalGames,
      winRate: u.totalGames > 0 ? Math.round((u.wins / u.totalGames) * 100) : 0,
    }));
  }

  // --- COSMETICS & BATTLE PASS CLAIM ---

  public claimPassReward(userId: string, tier: number, isPremium: boolean): { success: boolean; item?: string } {
    const user = this.data.users[userId];
    if (!user || user.battlePass.tier < tier) return { success: false };

    if (isPremium && !user.battlePass.isPremium) return { success: false };

    if (isPremium) {
      if (user.battlePass.claimedPremiumTiers.includes(tier)) return { success: false };
      user.battlePass.claimedPremiumTiers.push(tier);
    } else {
      if (user.battlePass.claimedFreeTiers.includes(tier)) return { success: false };
      user.battlePass.claimedFreeTiers.push(tier);
    }

    // Award cosmetic based on tier
    let rewardName = '';
    if (tier === 3) {
      user.unlockedCosmetics.hats.push('🎩');
      rewardName = '🎩 Top Hat';
    } else if (tier === 5) {
      user.unlockedCosmetics.cardBacks.push('obsidian_gold');
      rewardName = 'Obsidian Gold Card Back';
    } else if (tier === 10) {
      user.unlockedCosmetics.banners.push('royal_velvet');
      rewardName = 'Royal Velvet Banner';
    } else if (tier === 15) {
      user.unlockedCosmetics.hats.push('👑');
      rewardName = '👑 Crown of Bowers';
    } else if (tier === 20) {
      user.unlockedCosmetics.titles.push('Supreme Bower');
      rewardName = 'Supreme Bower Title';
    }

    this.save();
    return { success: true, item: rewardName };
  }

  public equipCosmetic(
    userId: string,
    category: 'hat' | 'cardBack' | 'banner' | 'title',
    itemId?: string
  ): boolean {
    const user = this.data.users[userId];
    if (!user) return false;

    user.equippedCosmetics[category] = itemId;
    this.save();
    return true;
  }

  public getUserProfile(
    targetUserId?: string,
    targetUsername?: string,
    requestingUserId?: string
  ): PublicPlayerData | null {
    let targetUser: UserAccount | undefined;
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
      avatarIcon: targetUser.avatarIcon,
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
