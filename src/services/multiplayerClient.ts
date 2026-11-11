/**
 * BOWER JJ — Real-Time WebSocket Multiplayer Client Service
 */

import {
  ClientMessage,
  ServerMessage,
  Room,
  SanitizedGameState,
  UserAccount,
  FriendSummary,
  LeaderboardEntry,
  BattlePassState,
  Challenge,
  RankTier,
  PublicPlayerData,
  MatchmakingStats,
} from '../../server/types';
import { PlayerPosition, Suit, AIDifficulty, EuchreHouseRules } from '../engine/types';
import { authService } from './supabaseClient';

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private sessionToken: string | null = null;
  private accessToken: string | null = null;
  private username: string = 'Player';
  private avatarIcon: string = '🤠';
  private serverUrl: string = '';
  private isConnecting: boolean = false;

  private cachedResolvedUrl: string | null = null;

  public async resolveServerUrl(): Promise<string> {
    if (this.cachedResolvedUrl) return this.cachedResolvedUrl;

    // 1. Explicit Vite environment variable
    const envWs = import.meta.env?.VITE_WS_URL;
    if (envWs && !envWs.includes('api.bowerjj.com')) {
      if (envWs.startsWith('ws://') || envWs.startsWith('wss://')) {
        this.cachedResolvedUrl = envWs.endsWith('/ws') ? envWs : `${envWs}/ws`;
        return this.cachedResolvedUrl;
      }
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const proto = isHttps ? 'wss:' : 'ws:';
      this.cachedResolvedUrl = `${proto}//${envWs.replace(/^\/+/, '')}/ws`;
      return this.cachedResolvedUrl;
    }

    // 2. Dynamic browser location
    if (typeof window !== 'undefined' && window.location) {
      const host = window.location.hostname;

      // Local development default (backend runs on 3001)
      if (host === 'localhost' || host === '127.0.0.1') {
        this.cachedResolvedUrl = `ws://${host}:3001/ws`;
        return this.cachedResolvedUrl;
      }

      // If already connected through the Cloudflare tunnel domain
      if (host.endsWith('trycloudflare.com')) {
        this.cachedResolvedUrl = `wss://${window.location.host}/ws`;
        return this.cachedResolvedUrl;
      }
    }

    // 3. Dynamic lookup from Supabase server_registry table!
    try {
      const livePublicUrl = await authService.getLiveServerUrl();
      if (livePublicUrl) {
        const clean = livePublicUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        this.cachedResolvedUrl = `wss://${clean}/ws`;
        return this.cachedResolvedUrl;
      }
    } catch (err) {
      console.warn('Could not fetch server registry from Supabase:', err);
    }

    // 4. Fallback to latest verified public tunnel
    return 'wss://tax-insulin-eligibility-updated.trycloudflare.com/ws';
  }

  // Event Listeners
  private onAuthCallback?: (user: UserAccount, token: string) => void;
  private onRoomCallback?: (room: Room, yourPosition?: PlayerPosition) => void;
  private onGameSyncCallback?: (state: SanitizedGameState) => void;
  private onQueueCallback?: (data: { inQueue: boolean; mode?: string; playersFound: number; elapsedSeconds: number }) => void;
  private onEmoteCallback?: (fromPosition: PlayerPosition, text?: string, emoji?: string) => void;
  private onFriendsCallback?: (friends: FriendSummary[], requests: UserAccount['friendRequests']) => void;
  private onLeaderboardCallback?: (entries: LeaderboardEntry[], yourRank?: number) => void;
  private onBattlePassCallback?: (battlePass: BattlePassState, challenges: Challenge[]) => void;
  private onRankUpdateCallback?: (update: {
    oldTier: RankTier;
    newTier: RankTier;
    oldPoints: number;
    newPoints: number;
    lpChange: number;
    didRankUp: boolean;
  }) => void;
  private onPartyInviteCallback?: (invite: { fromUsername: string; fromAvatar: string; roomCode: string }) => void;
  private onProfileCallback?: (profile: PublicPlayerData) => void;
  private onMatchmakingStatsCallback?: (stats: MatchmakingStats) => void;
  private onNoticeCallback?: (message: string, title?: string) => void;
  private onErrorCallback?: (errorMsg: string) => void;

  constructor() {
    try {
      this.sessionToken = localStorage.getItem('bower_jj_session_token');
    } catch {
      // Ignored
    }
  }

  public setCallbacks(callbacks: {
    onAuth?: (user: UserAccount, token: string) => void;
    onRoom?: (room: Room, yourPosition?: PlayerPosition) => void;
    onGameSync?: (state: SanitizedGameState) => void;
    onQueue?: (data: { inQueue: boolean; mode?: string; playersFound: number; elapsedSeconds: number }) => void;
    onEmote?: (fromPosition: PlayerPosition, text?: string, emoji?: string) => void;
    onFriends?: (friends: FriendSummary[], requests: UserAccount['friendRequests']) => void;
    onLeaderboard?: (entries: LeaderboardEntry[], yourRank?: number) => void;
    onBattlePass?: (battlePass: BattlePassState, challenges: Challenge[]) => void;
    onRankUpdate?: (update: {
      oldTier: RankTier;
      newTier: RankTier;
      oldPoints: number;
      newPoints: number;
      lpChange: number;
      didRankUp: boolean;
    }) => void;
    onPartyInvite?: (invite: { fromUsername: string; fromAvatar: string; roomCode: string }) => void;
    onProfile?: (profile: PublicPlayerData) => void;
    onMatchmakingStats?: (stats: MatchmakingStats) => void;
    onNotice?: (message: string, title?: string) => void;
    onError?: (errorMsg: string) => void;
  }) {
    if (callbacks.onAuth) this.onAuthCallback = callbacks.onAuth;
    if (callbacks.onRoom) this.onRoomCallback = callbacks.onRoom;
    if (callbacks.onGameSync) this.onGameSyncCallback = callbacks.onGameSync;
    if (callbacks.onQueue) this.onQueueCallback = callbacks.onQueue;
    if (callbacks.onEmote) this.onEmoteCallback = callbacks.onEmote;
    if (callbacks.onFriends) this.onFriendsCallback = callbacks.onFriends;
    if (callbacks.onLeaderboard) this.onLeaderboardCallback = callbacks.onLeaderboard;
    if (callbacks.onBattlePass) this.onBattlePassCallback = callbacks.onBattlePass;
    if (callbacks.onRankUpdate) this.onRankUpdateCallback = callbacks.onRankUpdate;
    if (callbacks.onPartyInvite) this.onPartyInviteCallback = callbacks.onPartyInvite;
    if (callbacks.onProfile) this.onProfileCallback = callbacks.onProfile;
    if (callbacks.onMatchmakingStats) this.onMatchmakingStatsCallback = callbacks.onMatchmakingStats;
    if (callbacks.onNotice) this.onNoticeCallback = callbacks.onNotice;
    if (callbacks.onError) this.onErrorCallback = callbacks.onError;
  }

  public async connect(username?: string, avatarIcon?: string, accessToken?: string): Promise<boolean> {
    if (username) this.username = username;
    if (avatarIcon) this.avatarIcon = avatarIcon;
    if (accessToken) this.accessToken = accessToken;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (accessToken && accessToken !== this.accessToken) {
        this.reauthenticate(accessToken, username, avatarIcon);
      }
      return true;
    }

    this.isConnecting = true;
    const resolvedUrl = await this.resolveServerUrl();
    this.serverUrl = resolvedUrl;

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          // Authenticate immediately with authoritative token if available
          this.send({
            type: 'AUTH',
            username: this.username,
            avatarIcon: this.avatarIcon,
            sessionToken: this.sessionToken || undefined,
            accessToken: this.accessToken || undefined,
          });
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const msg: ServerMessage = JSON.parse(event.data);
            this.handleMessage(msg);
          } catch (err) {
            console.error('Failed to parse incoming server message:', err);
          }
        };

        this.ws.onerror = (err) => {
          console.warn('Multiplayer WebSocket error:', err);
          this.cachedResolvedUrl = null;
          this.onErrorCallback?.('Connection error to multiplayer server');
          resolve(false);
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.ws = null;
        };
      } catch (err) {
        this.isConnecting = false;
        resolve(false);
      }
    });
  }

  public reauthenticate(accessToken?: string, username?: string, avatarIcon?: string) {
    if (accessToken) this.accessToken = accessToken;
    if (username) this.username = username;
    if (avatarIcon) this.avatarIcon = avatarIcon;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        type: 'AUTH',
        username: this.username,
        avatarIcon: this.avatarIcon,
        sessionToken: this.sessionToken || undefined,
        accessToken: this.accessToken || undefined,
      });
    }
  }

  private handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'AUTH_SUCCESS':
        this.sessionToken = msg.sessionToken;
        try {
          localStorage.setItem('bower_jj_session_token', msg.sessionToken);
        } catch {}
        this.onAuthCallback?.(msg.user, msg.sessionToken);
        break;

      case 'ROOM_UPDATE':
        this.onRoomCallback?.(msg.room, msg.yourPosition);
        break;

      case 'GAME_SYNC':
        this.onGameSyncCallback?.(msg.state);
        break;

      case 'QUEUE_UPDATE':
        this.onQueueCallback?.(msg);
        break;

      case 'EMOTE_BROADCAST':
        this.onEmoteCallback?.(msg.fromPosition, msg.text, msg.emoji);
        break;

      case 'FRIENDS_LIST':
        this.onFriendsCallback?.(msg.friends, msg.incomingRequests);
        break;

      case 'LEADERBOARD_DATA':
        this.onLeaderboardCallback?.(msg.entries, msg.yourRank);
        break;

      case 'BATTLE_PASS_UPDATE':
        this.onBattlePassCallback?.(msg.battlePass, msg.challenges);
        break;

      case 'RANK_UPDATE':
        this.onRankUpdateCallback?.(msg);
        break;

      case 'PARTY_INVITE_RECEIVED':
        this.onPartyInviteCallback?.(msg);
        break;

      case 'PROFILE_DATA':
        this.onProfileCallback?.(msg.profile);
        break;

      case 'MATCHMAKING_STATS':
        this.onMatchmakingStatsCallback?.(msg.stats);
        break;

      case 'NOTICE':
        this.onNoticeCallback?.(msg.message, msg.title);
        break;

      case 'ERROR':
        this.onErrorCallback?.(msg.message);
        break;
    }
  }

  private send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // --- API Methods ---
  public createRoom(rules?: Partial<EuchreHouseRules>, queueMode?: 'rivals' | 'solo' | 'casual') {
    this.send({ type: 'ROOM_CREATE', rules, queueMode });
  }

  public joinRoom(roomCode: string) {
    this.send({ type: 'ROOM_JOIN', roomCode: roomCode.trim().toUpperCase() });
  }

  public fillWithAI(difficulty: AIDifficulty = 'medium') {
    this.send({ type: 'ROOM_FILL_AI', difficulty });
  }

  public startGame() {
    this.send({ type: 'ROOM_START' });
  }

  public updateRoomRules(rules: Partial<EuchreHouseRules>) {
    this.send({ type: 'ROOM_UPDATE_RULES', rules });
  }

  public kickPlayer(position: PlayerPosition) {
    this.send({ type: 'ROOM_KICK', position });
  }

  public enterQueue(mode: 'solo' | 'rivals' | 'duo' | 'casual' = 'solo') {
    this.send({ type: 'QUEUE_ENTER', mode });
  }

  public leaveQueue() {
    this.send({ type: 'QUEUE_LEAVE' });
  }

  public getMatchmakingStats() {
    this.send({ type: 'GET_MATCHMAKING_STATS' });
  }

  public bid(bidType: 'pass' | 'order_up' | 'pick_up' | 'call_trump', suit?: Suit, alone: boolean = false) {
    this.send({ type: 'GAME_BID', bidType, suit, alone });
  }

  public discard(cardId: string) {
    this.send({ type: 'GAME_DISCARD', cardId });
  }

  public playCard(cardId: string) {
    this.send({ type: 'GAME_PLAY_CARD', cardId });
  }

  public nextHand() {
    this.send({ type: 'GAME_NEXT_HAND' });
  }

  public sendEmote(text?: string, emoji?: string) {
    this.send({ type: 'SEND_EMOTE', text, emoji });
  }

  // Social
  public sendFriendRequest(targetUsername: string) {
    this.send({ type: 'FRIEND_REQUEST_SEND', targetUsername });
  }

  public acceptFriendRequest(fromUserId: string) {
    this.send({ type: 'FRIEND_REQUEST_ACCEPT', fromUserId });
  }

  public declineFriendRequest(fromUserId: string) {
    this.send({ type: 'FRIEND_REQUEST_DECLINE', fromUserId });
  }

  public removeFriend(friendUserId: string) {
    this.send({ type: 'FRIEND_REMOVE', friendUserId });
  }

  public fetchFriends() {
    this.send({ type: 'GET_FRIENDS' });
  }

  public fetchLeaderboard() {
    this.send({ type: 'GET_LEADERBOARD' });
  }

  public claimBattlePassReward(tier: number, isPremium: boolean = false) {
    this.send({ type: 'CLAIM_PASS_REWARD', tier, isPremium });
  }

  public equipCosmetic(category: 'hat' | 'cardBack' | 'banner' | 'title', itemId?: string) {
    this.send({ type: 'EQUIP_COSMETIC', category, itemId });
  }

  public sendPartyInvite(friendUserId: string, mode: 'rivals' | 'duo' = 'rivals') {
    this.send({ type: 'PARTY_INVITE_SEND', friendUserId, mode });
  }

  public acceptPartyInvite(partyRoomCode: string) {
    this.send({ type: 'PARTY_INVITE_ACCEPT', partyRoomCode });
  }

  public fetchProfile(targetUserId?: string, targetUsername?: string) {
    this.send({ type: 'GET_PROFILE', targetUserId, targetUsername });
  }

  public reportPlayer(targetUserId: string | undefined, targetUsername: string | undefined, reason: string) {
    this.send({ type: 'REPORT_PLAYER', targetUserId, targetUsername, reason });
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const multiplayerClient = new MultiplayerClient();
