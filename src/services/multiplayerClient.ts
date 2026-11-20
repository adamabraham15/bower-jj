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
  PlayerCollectionState,
  PackOpenResult,
  RankTier,
  PublicPlayerData,
  MatchmakingStats,
} from '../../server/types';
import { PlayerPosition, Suit, AIDifficulty, EuchreHouseRules } from '../engine/types';
import { resolveAvatarId } from '../config/collectiblesCatalog';
import { authService } from './supabaseClient';

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private sessionToken: string | null = null;
  private accessToken: string | null = null;
  private lastSentAccessToken: string | null = null;
  private userId: string | null = null;
  private username: string = 'Player';
  private avatarIcon: string = 'the_outlaw';
  private serverUrl: string = '';
  private isConnecting: boolean = false;
  private reconnectTimer: any = null;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 8;

  private currentRoom: Room | null = null;
  private myPosition: PlayerPosition | null = null;
  private cachedResolvedUrl: string | null = null;
  private isAuthenticated: boolean = false;
  private isReauthenticating: boolean = false;
  private authResolvers: Array<(success: boolean) => void> = [];

  private resolvePendingAuth(success: boolean) {
    const resolvers = [...this.authResolvers];
    this.authResolvers = [];
    resolvers.forEach(r => r(success));
  }

  public clearCachedServerUrl(): void {
    this.cachedResolvedUrl = null;
  }

  public async resolveServerUrl(forceFresh: boolean = false): Promise<string> {
    if (!forceFresh && this.cachedResolvedUrl) return this.cachedResolvedUrl;

    // 1. Dynamic browser location for local development or direct tunnel browsing
    if (typeof window !== 'undefined' && window.location) {
      const host = window.location.hostname;

      // Local development default (backend runs on 3001)
      if (host === 'localhost' || host === '127.0.0.1') {
        this.cachedResolvedUrl = `ws://${host}:3001/ws`;
        return this.cachedResolvedUrl;
      }

      // If app is being browsed directly through the Cloudflare tunnel domain
      if (host.endsWith('trycloudflare.com')) {
        this.cachedResolvedUrl = `wss://${window.location.host}/ws`;
        return this.cachedResolvedUrl;
      }
    }

    // 2. Primary Source of Truth: Dynamic lookup from Supabase server_registry table!
    // The self-healing tunnel supervisor keeps this updated with the active live WAN tunnel URL.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const livePublicUrl = await Promise.race([
          authService.getLiveServerUrl(),
          new Promise<null>((r) => setTimeout(() => r(null), 3000)),
        ]);
        if (livePublicUrl) {
          const clean = livePublicUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
          this.cachedResolvedUrl = `wss://${clean}/ws`;
          console.log(`[MultiplayerClient] Connected to authoritative live edge tunnel: ${this.cachedResolvedUrl}`);
          return this.cachedResolvedUrl;
        }
      } catch (err) {
        console.warn(`[MultiplayerClient] Attempt ${attempt} could not query server registry from Supabase:`, err);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }

    // 3. Environment variable fallback (Only if a dedicated custom non-ephemeral domain is provided)
    const envWs = import.meta.env?.VITE_WS_URL;
    if (envWs && !envWs.includes('trycloudflare.com')) {
      if (envWs.startsWith('ws://') || envWs.startsWith('wss://')) {
        this.cachedResolvedUrl = envWs.endsWith('/ws') ? envWs : `${envWs}/ws`;
        return this.cachedResolvedUrl;
      }
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
      const proto = isHttps ? 'wss:' : 'ws:';
      this.cachedResolvedUrl = `${proto}//${envWs.replace(/^\/+/, '')}/ws`;
      return this.cachedResolvedUrl;
    }

    // 4. Default WAN fallback
    return 'wss://occasionally-conflicts-pad-exercises.trycloudflare.com/ws';
  }

  // Multi-subscriber listener sets to prevent child modals from clobbering App.tsx listeners
  private authListeners = new Set<(user: UserAccount, token: string) => void>();
  private userSyncListeners = new Set<(user: UserAccount) => void>();
  private roomListeners = new Set<(room: Room, yourPosition?: PlayerPosition) => void>();
  private gameSyncListeners = new Set<(state: SanitizedGameState) => void>();
  private queueListeners = new Set<(data: { inQueue: boolean; mode?: string; playersFound: number; elapsedSeconds: number }) => void>();
  private emoteListeners = new Set<(fromPosition: PlayerPosition, text?: string, emoji?: string) => void>();
  private friendsListeners = new Set<(friends: FriendSummary[], requests: UserAccount['friendRequests']) => void>();
  private leaderboardListeners = new Set<(entries: LeaderboardEntry[], yourRank?: number) => void>();
  private collectionListeners = new Set<(collection: PlayerCollectionState) => void>();
  private packOpenedListeners = new Set<(result: PackOpenResult) => void>();
  private cardCraftedListeners = new Set<(data: { success: boolean; cardId: string; waxSeals: number; collectionState: PlayerCollectionState }) => void>();
  private packEarnedListeners = new Set<(info: { count: number; totalUnopened: number; reason: string; level?: number; unlockedAvatars?: string[] }) => void>();
  private rankUpdateListeners = new Set<(update: {
    oldTier: RankTier;
    newTier: RankTier;
    oldPoints: number;
    newPoints: number;
    lpChange: number;
    didRankUp: boolean;
    didDivisionUp?: boolean;
    oldDivision?: string;
    newDivision?: string;
    promotionSealsAwarded?: number;
    mmrChange?: number;
    newMmr?: number;
    lobbyMmr?: number;
    lobbyRankLabel?: string;
  }) => void>();
  private partyInviteListeners = new Set<(invite: { fromUsername: string; fromAvatar: string; roomCode: string; mode?: string; expiresAt?: number }) => void>();
  private profileListeners = new Set<(profile: PublicPlayerData) => void>();
  private matchmakingStatsListeners = new Set<(stats: MatchmakingStats) => void>();
  private noticeListeners = new Set<(message: string, title?: string) => void>();
  private errorListeners = new Set<(errorMsg: string) => void>();

  // Presence auto-refresh tracking
  private presenceInterval: any = null;
  private focusHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;

  // Outgoing message queue for requests made while connecting
  private pendingMessages: ClientMessage[] = [];
  private pendingJoinCode: string | null = null;
  private isPendingPartyCreate: boolean = false;

  constructor() {
    try {
      this.sessionToken = localStorage.getItem('bower_jj_session_token');
    } catch {
      // Ignored
    }
  }

  public setCallbacks(callbacks: {
    onAuth?: (user: UserAccount, token: string) => void;
    onUserSync?: (user: UserAccount) => void;
    onRoom?: (room: Room, yourPosition?: PlayerPosition) => void;
    onGameSync?: (state: SanitizedGameState) => void;
    onQueue?: (data: { inQueue: boolean; mode?: string; playersFound: number; elapsedSeconds: number }) => void;
    onEmote?: (fromPosition: PlayerPosition, text?: string, emoji?: string) => void;
    onFriends?: (friends: FriendSummary[], requests: UserAccount['friendRequests']) => void;
    onLeaderboard?: (entries: LeaderboardEntry[], yourRank?: number) => void;
    onCollection?: (collection: PlayerCollectionState) => void;
    onPackOpened?: (result: PackOpenResult) => void;
    onCardCrafted?: (data: { success: boolean; cardId: string; waxSeals: number; collectionState: PlayerCollectionState }) => void;
    onPackEarned?: (info: { count: number; totalUnopened: number; reason: string; level?: number; unlockedAvatars?: string[] }) => void;
    onRankUpdate?: (update: {
      oldTier: RankTier;
      newTier: RankTier;
      oldPoints: number;
      newPoints: number;
      lpChange: number;
      didRankUp: boolean;
      didDivisionUp?: boolean;
      oldDivision?: string;
      newDivision?: string;
      promotionSealsAwarded?: number;
      mmrChange?: number;
      newMmr?: number;
      lobbyMmr?: number;
      lobbyRankLabel?: string;
    }) => void;
    onPartyInvite?: (invite: { fromUsername: string; fromAvatar: string; roomCode: string; mode?: string; expiresAt?: number }) => void;
    onProfile?: (profile: PublicPlayerData) => void;
    onMatchmakingStats?: (stats: MatchmakingStats) => void;
    onNotice?: (message: string, title?: string) => void;
    onError?: (errorMsg: string) => void;
  }): () => void {
    if (callbacks.onAuth) this.authListeners.add(callbacks.onAuth);
    if (callbacks.onUserSync) this.userSyncListeners.add(callbacks.onUserSync);
    if (callbacks.onRoom) this.roomListeners.add(callbacks.onRoom);
    if (callbacks.onGameSync) this.gameSyncListeners.add(callbacks.onGameSync);
    if (callbacks.onQueue) this.queueListeners.add(callbacks.onQueue);
    if (callbacks.onEmote) this.emoteListeners.add(callbacks.onEmote);
    if (callbacks.onFriends) this.friendsListeners.add(callbacks.onFriends);
    if (callbacks.onLeaderboard) this.leaderboardListeners.add(callbacks.onLeaderboard);
    if (callbacks.onCollection) this.collectionListeners.add(callbacks.onCollection);
    if (callbacks.onPackOpened) this.packOpenedListeners.add(callbacks.onPackOpened);
    if (callbacks.onCardCrafted) this.cardCraftedListeners.add(callbacks.onCardCrafted);
    if (callbacks.onPackEarned) this.packEarnedListeners.add(callbacks.onPackEarned);
    if (callbacks.onRankUpdate) this.rankUpdateListeners.add(callbacks.onRankUpdate);
    if (callbacks.onPartyInvite) this.partyInviteListeners.add(callbacks.onPartyInvite);
    if (callbacks.onProfile) this.profileListeners.add(callbacks.onProfile);
    if (callbacks.onMatchmakingStats) this.matchmakingStatsListeners.add(callbacks.onMatchmakingStats);
    if (callbacks.onNotice) this.noticeListeners.add(callbacks.onNotice);
    if (callbacks.onError) this.errorListeners.add(callbacks.onError);

    return () => {
      if (callbacks.onAuth) this.authListeners.delete(callbacks.onAuth);
      if (callbacks.onUserSync) this.userSyncListeners.delete(callbacks.onUserSync);
      if (callbacks.onRoom) this.roomListeners.delete(callbacks.onRoom);
      if (callbacks.onGameSync) this.gameSyncListeners.delete(callbacks.onGameSync);
      if (callbacks.onQueue) this.queueListeners.delete(callbacks.onQueue);
      if (callbacks.onEmote) this.emoteListeners.delete(callbacks.onEmote);
      if (callbacks.onFriends) this.friendsListeners.delete(callbacks.onFriends);
      if (callbacks.onLeaderboard) this.leaderboardListeners.delete(callbacks.onLeaderboard);
      if (callbacks.onCollection) this.collectionListeners.delete(callbacks.onCollection);
      if (callbacks.onPackOpened) this.packOpenedListeners.delete(callbacks.onPackOpened);
      if (callbacks.onCardCrafted) this.cardCraftedListeners.delete(callbacks.onCardCrafted);
      if (callbacks.onPackEarned) this.packEarnedListeners.delete(callbacks.onPackEarned);
      if (callbacks.onRankUpdate) this.rankUpdateListeners.delete(callbacks.onRankUpdate);
      if (callbacks.onPartyInvite) this.partyInviteListeners.delete(callbacks.onPartyInvite);
      if (callbacks.onProfile) this.profileListeners.delete(callbacks.onProfile);
      if (callbacks.onMatchmakingStats) this.matchmakingStatsListeners.delete(callbacks.onMatchmakingStats);
      if (callbacks.onNotice) this.noticeListeners.delete(callbacks.onNotice);
      if (callbacks.onError) this.errorListeners.delete(callbacks.onError);
    };
  }

  public startPresenceAutoRefresh(intervalMs: number = 6000): () => void {
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }

    const refresh = () => {
      if (this.isConnected() && this.isAuthed()) {
        this.fetchFriends();
      }
    };

    this.presenceInterval = setInterval(refresh, intervalMs);

    if (typeof window !== 'undefined' && !this.focusHandler) {
      this.focusHandler = () => {
        if (this.isConnected() && this.isAuthed()) {
          this.fetchFriends();
          this.fetchCollectionState();
        }
      };
      window.addEventListener('focus', this.focusHandler);
    }

    if (typeof document !== 'undefined' && !this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible' && this.isConnected() && this.isAuthed()) {
          this.fetchFriends();
          this.fetchCollectionState();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    return () => this.stopPresenceAutoRefresh();
  }

  public stopPresenceAutoRefresh(): void {
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
    if (typeof window !== 'undefined' && this.focusHandler) {
      window.removeEventListener('focus', this.focusHandler);
      this.focusHandler = null;
    }
    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  public async connect(
    username?: string,
    avatarIcon?: string,
    accessToken?: string,
    forceFresh: boolean = false
  ): Promise<boolean> {
    const tokenUpgraded = Boolean(accessToken && accessToken !== this.lastSentAccessToken);
    if (username) this.username = username;
    if (avatarIcon) this.avatarIcon = avatarIcon;
    if (accessToken) this.accessToken = accessToken;

    if (!accessToken) {
      try {
        const freshToken = await authService.getFreshAccessToken();
        if (freshToken) this.accessToken = freshToken;
      } catch {}
    }

    if (!forceFresh && this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (tokenUpgraded || (this.accessToken && this.accessToken !== this.lastSentAccessToken)) {
        return this.reauthenticate(this.accessToken || accessToken, username, avatarIcon);
      }
      if (this.isAuthenticated && !this.isReauthenticating) {
        return true;
      }
    }

    if (!forceFresh && (this.isConnecting || (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)))) {
      return new Promise<boolean>((resolve) => {
        this.authResolvers.push(resolve);
        setTimeout(() => resolve(this.isAuthenticated && !this.isReauthenticating), 7000);
      });
    }

    if (forceFresh && this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.isAuthenticated = false;
    this.isConnecting = true;
    const resolvedUrl = await this.resolveServerUrl(forceFresh);
    this.serverUrl = resolvedUrl;

    return new Promise((resolve) => {
      this.authResolvers.push(resolve);
      const safetyTimer = setTimeout(() => {
        this.resolvePendingAuth(this.isAuthenticated);
      }, 8000);

      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          // Authenticate immediately with authoritative token if available
          this.lastSentAccessToken = this.accessToken || null;
          this.send({
            type: 'AUTH',
            username: this.username,
            avatarIcon: this.avatarIcon,
            sessionToken: this.sessionToken || undefined,
            accessToken: this.accessToken || undefined,
          });
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
          this.isAuthenticated = false;
          this.errorListeners.forEach(cb => {
            try { cb('Connection error to multiplayer server'); } catch (e) { console.error(e); }
          });
          clearTimeout(safetyTimer);
          this.resolvePendingAuth(false);
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.isAuthenticated = false;
          this.ws = null;
          this.cachedResolvedUrl = null;
          clearTimeout(safetyTimer);
          this.resolvePendingAuth(false);
          this.scheduleAutoReconnect();
        };
      } catch (err) {
        this.isConnecting = false;
        this.isAuthenticated = false;
        this.cachedResolvedUrl = null;
        clearTimeout(safetyTimer);
        this.resolvePendingAuth(false);
        this.scheduleAutoReconnect();
      }
    });
  }

  private scheduleAutoReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[MultiplayerClient] Max auto-reconnect attempts reached.');
      return;
    }
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 6000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log(`[MultiplayerClient] Attempting background auto-reconnect #${this.reconnectAttempts}...`);
      this.connect(this.username, this.avatarIcon, this.accessToken || undefined, true);
    }, delay);
  }

  public reauthenticate(accessToken?: string, username?: string, avatarIcon?: string): Promise<boolean> {
    if (accessToken) this.accessToken = accessToken;
    if (username) this.username = username;
    if (avatarIcon) this.avatarIcon = avatarIcon;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.isReauthenticating = true;
      this.lastSentAccessToken = this.accessToken || null;
      this.send({
        type: 'AUTH',
        username: this.username,
        avatarIcon: this.avatarIcon,
        sessionToken: this.sessionToken || undefined,
        accessToken: this.accessToken || undefined,
      });
      return new Promise<boolean>((resolve) => {
        this.authResolvers.push(resolve);
        setTimeout(() => {
          this.isReauthenticating = false;
          resolve(this.isAuthenticated);
        }, 7000);
      });
    }
    return this.connect(username, avatarIcon, accessToken, false);
  }

  private flushPendingMessages() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isAuthenticated || this.isReauthenticating) return;
    const queued = [...this.pendingMessages];
    this.pendingMessages = [];
    for (const msg of queued) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {
        console.warn('Failed to dispatch queued message:', err);
      }
    }
  }

  private handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'AUTH_SUCCESS':
        this.isAuthenticated = true;
        this.isReauthenticating = false;
        if (msg.sessionToken) {
          this.sessionToken = msg.sessionToken;
          try {
            localStorage.setItem('bower_jj_session_token', msg.sessionToken);
          } catch {}
        }
        this.userId = msg.user.id;
        this.username = msg.user.username;
        this.avatarIcon = msg.user.avatarIcon;
        this.authListeners.forEach(cb => {
          try { cb(msg.user, msg.sessionToken); } catch (err) { console.error(err); }
        });
        this.flushPendingMessages();
        this.resolvePendingAuth(true);

        // If accessToken changed while reauthenticating, upgrade session immediately
        if (this.accessToken && this.accessToken !== this.lastSentAccessToken) {
          this.reauthenticate(this.accessToken, this.username, this.avatarIcon);
        }
        break;

      case 'USER_SYNC':
        this.userId = msg.user.id;
        this.username = msg.user.username;
        this.avatarIcon = msg.user.avatarIcon;
        this.userSyncListeners.forEach(cb => {
          try { cb(msg.user); } catch (err) { console.error(err); }
        });
        break;

      case 'ROOM_UPDATE': {
        this.pendingJoinCode = null;
        this.isPendingPartyCreate = false;
        this.currentRoom = msg.room;
        if (msg.yourPosition !== undefined) {
          this.myPosition = msg.yourPosition;
        } else if (this.userId) {
          const myIdx = msg.room.slots.findIndex(s => s && s.userId === this.userId);
          if (myIdx !== -1) this.myPosition = myIdx as PlayerPosition;
        } else {
          const myIdx = msg.room.slots.findIndex(s => s && s.username === this.username);
          if (myIdx !== -1) this.myPosition = myIdx as PlayerPosition;
        }
        this.roomListeners.forEach(cb => {
          try { cb(msg.room, this.myPosition ?? undefined); } catch (err) { console.error(err); }
        });
        break;
      }

      case 'GAME_SYNC':
        this.gameSyncListeners.forEach(cb => {
          try { cb(msg.state); } catch (err) { console.error(err); }
        });
        break;

      case 'QUEUE_UPDATE':
        this.queueListeners.forEach(cb => {
          try { cb(msg); } catch (err) { console.error(err); }
        });
        break;

      case 'EMOTE_BROADCAST':
        this.emoteListeners.forEach(cb => {
          try { cb(msg.fromPosition, msg.text, msg.emoji); } catch (err) { console.error(err); }
        });
        break;

      case 'FRIENDS_LIST':
        this.friendsListeners.forEach(cb => {
          try { cb(msg.friends, msg.incomingRequests); } catch (err) { console.error(err); }
        });
        break;

      case 'LEADERBOARD_DATA':
        this.leaderboardListeners.forEach(cb => {
          try { cb(msg.entries, msg.yourRank); } catch (err) { console.error(err); }
        });
        break;

      case 'COLLECTION_STATE':
        this.collectionListeners.forEach(cb => {
          try { cb(msg.collection); } catch (err) { console.error(err); }
        });
        break;

      case 'PACK_OPENED':
        this.packOpenedListeners.forEach(cb => {
          try { cb(msg.result); } catch (err) { console.error(err); }
        });
        break;

      case 'CARD_CRAFTED':
        this.cardCraftedListeners.forEach(cb => {
          try { cb(msg); } catch (err) { console.error(err); }
        });
        break;

      case 'PACK_EARNED':
        this.packEarnedListeners.forEach(cb => {
          try { cb(msg); } catch (err) { console.error(err); }
        });
        break;

      case 'RANK_UPDATE':
        this.rankUpdateListeners.forEach(cb => {
          try { cb(msg); } catch (err) { console.error(err); }
        });
        break;

      case 'PARTY_INVITE_RECEIVED':
        this.partyInviteListeners.forEach(cb => {
          try { cb(msg); } catch (err) { console.error(err); }
        });
        break;

      case 'PROFILE_DATA':
        this.profileListeners.forEach(cb => {
          try { cb(msg.profile); } catch (err) { console.error(err); }
        });
        break;

      case 'MATCHMAKING_STATS':
        this.matchmakingStatsListeners.forEach(cb => {
          try { cb(msg.stats); } catch (err) { console.error(err); }
        });
        break;

      case 'NOTICE':
        this.noticeListeners.forEach(cb => {
          try { cb(msg.message, msg.title); } catch (err) { console.error(err); }
        });
        break;

      case 'ERROR':
        this.pendingJoinCode = null;
        this.isPendingPartyCreate = false;
        if (this.isReauthenticating) {
          this.isReauthenticating = false;
          this.resolvePendingAuth(false);
        }
        this.errorListeners.forEach(cb => {
          try { cb(msg.message); } catch (err) { console.error(err); }
        });
        break;
    }
  }

  private send(msg: ClientMessage) {
    if (msg.type === 'AUTH') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isAuthenticated && !this.isReauthenticating) {
      this.ws.send(JSON.stringify(msg));
    } else {
      // Buffer outgoing messages while connecting/authenticating
      this.pendingMessages.push(msg);
    }
  }

  private prepareRoomJoin(roomCode: string): string {
    const code = roomCode.trim().toUpperCase();
    if (this.currentRoom && this.currentRoom.code !== code) {
      this.leaveRoom();
    } else if (this.currentRoom && this.currentRoom.status !== 'lobby') {
      this.currentRoom = null;
      this.myPosition = null;
    }
    this.pendingJoinCode = code;
    if (typeof window !== 'undefined' && typeof WebSocket !== 'undefined' && !this.isConnected() && !this.isConnecting) {
      this.connect();
    }
    return code;
  }

  // --- API Methods ---
  public createRoom(
    rules?: Partial<EuchreHouseRules>,
    queueMode?: 'rivals' | 'solo' | 'casual' | 'custom' | 'duo',
    autoFillAI?: boolean,
    difficulty?: AIDifficulty
  ) {
    if (this.currentRoom && this.currentRoom.status !== 'lobby') {
      this.currentRoom = null;
      this.myPosition = null;
    }
    this.send({ type: 'ROOM_CREATE', rules, queueMode, autoFillAI, difficulty });
  }

  public joinRoom(roomCode: string) {
    const code = this.prepareRoomJoin(roomCode);
    this.send({ type: 'ROOM_JOIN', roomCode: code });
  }

  public fillWithAI(difficulty: AIDifficulty = 'medium') {
    this.send({ type: 'ROOM_FILL_AI', difficulty });
  }

  public startGame() {
    this.send({ type: 'ROOM_START' });
  }

  public returnRoomToLobby(mode?: 'custom' | 'rivals') {
    this.isPendingPartyCreate = true;
    if (this.currentRoom) {
      this.currentRoom = { ...this.currentRoom, status: 'lobby' };
    }
    this.send({ type: 'ROOM_RETURN_TO_LOBBY', mode });
  }

  public setAvatarIcon(avatarIcon: string) {
    this.avatarIcon = avatarIcon;
  }

  public updateRoomRules(rules: Partial<EuchreHouseRules>) {
    this.send({ type: 'ROOM_UPDATE_RULES', rules });
  }

  public updateRoomMode(mode: 'rivals' | 'custom' | 'solo' | 'duo' | 'casual') {
    this.send({ type: 'ROOM_UPDATE_MODE', mode });
  }

  public kickPlayer(position: PlayerPosition) {
    this.send({ type: 'ROOM_KICK', position });
  }

  public switchSeat(targetPosition: PlayerPosition) {
    this.send({ type: 'ROOM_SWITCH_SEAT', targetPosition });
  }

  public leaveRoom() {
    this.send({ type: 'ROOM_LEAVE' });
    this.currentRoom = null;
    this.myPosition = null;
    this.pendingJoinCode = null;
    this.isPendingPartyCreate = false;
  }

  public forfeitGame() {
    this.send({ type: 'GAME_FORFEIT' });
    this.currentRoom = null;
    this.myPosition = null;
    this.pendingJoinCode = null;
    this.isPendingPartyCreate = false;
  }

  public isPendingJoin(): boolean {
    return this.pendingJoinCode !== null || this.isPendingPartyCreate;
  }

  public getPendingJoinCode(): string | null {
    return this.pendingJoinCode;
  }

  public isAuthed(): boolean {
    return this.isAuthenticated && !this.isReauthenticating;
  }

  public async waitForAuth(timeoutMs: number = 6000): Promise<boolean> {
    if (this.isAuthenticated && !this.isReauthenticating) return true;
    return new Promise((resolve) => {
      this.authResolvers.push(resolve);
      setTimeout(() => resolve(this.isAuthenticated && !this.isReauthenticating), timeoutMs);
    });
  }

  public hasActiveRoom(): boolean {
    return (this.currentRoom !== null && this.currentRoom.status === 'lobby') || this.pendingJoinCode !== null || this.isPendingPartyCreate;
  }

  public isHost(): boolean {
    if (!this.currentRoom) return false;
    if (this.userId) return this.currentRoom.hostUserId === this.userId;
    return this.currentRoom.slots[0]?.username === this.username;
  }

  public getCurrentRoom(): Room | null {
    return this.currentRoom;
  }

  public getCurrentRoomCode(): string | null {
    return this.currentRoom?.code || null;
  }

  public getMyPosition(): PlayerPosition | null {
    return this.myPosition;
  }

  public getUserId(): string | null {
    return this.userId;
  }

  public getUsername(): string {
    return this.username;
  }

  public enterQueue(
    mode: 'solo' | 'rivals' | 'duo' | 'casual' = 'solo',
    duoPreference?: 'teammates' | 'opponents' | 'random'
  ) {
    if (this.currentRoom && this.currentRoom.status === 'playing') {
      console.warn('[MultiplayerClient] Attempted to enter queue while active in playing match. Ignoring.');
      return;
    }
    this.send({ type: 'QUEUE_ENTER', mode, duoPreference });
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

  public fetchCollectionState() {
    this.send({ type: 'GET_COLLECTION_STATE' });
  }

  public openCardPack(packId?: string) {
    this.send({ type: 'OPEN_CARD_PACK', packId });
  }

  public craftCard(cardId: string) {
    this.send({ type: 'CRAFT_CARD', cardId });
  }

  public equipAvatar(avatarId: string) {
    this.avatarIcon = resolveAvatarId(avatarId);
    this.send({ type: 'EQUIP_AVATAR', avatarId: this.avatarIcon });
  }

  public equipCardBack(cardBackId: string) {
    this.send({ type: 'EQUIP_CARD_BACK', cardBackId });
  }

  public equipCosmetic(category: 'hat' | 'cardBack' | 'banner' | 'title' | 'tableFelt', itemId?: string) {
    if (category === 'hat' && itemId) {
      this.avatarIcon = resolveAvatarId(itemId);
    }
    this.send({ type: 'EQUIP_COSMETIC', category, itemId });
  }

  public equipTableFelt(feltId: string) {
    this.equipCosmetic('tableFelt', feltId);
  }

  public sendPartyInvite(friendUserId?: string, mode: 'rivals' | 'custom' | 'duo' = 'rivals', friendUsername?: string) {
    if (!this.currentRoom || this.currentRoom.status !== 'lobby') {
      this.isPendingPartyCreate = true;
    }
    this.send({ type: 'PARTY_INVITE_SEND', friendUserId, friendUsername, mode });
  }

  public acceptPartyInvite(partyRoomCode: string) {
    const code = this.prepareRoomJoin(partyRoomCode);
    this.send({ type: 'PARTY_INVITE_ACCEPT', partyRoomCode: code });
  }

  public declinePartyInvite(partyRoomCode: string) {
    this.send({ type: 'PARTY_INVITE_DECLINE', partyRoomCode: partyRoomCode.trim().toUpperCase() });
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

  public async recordAiMatchResult(payload: {
    matchId: string;
    won: boolean;
    userScore: number;
    oppScore: number;
    tricksWon: number;
    euchres: number;
    marches: number;
    successfulLoners: number;
    opponentNames?: string[];
  }): Promise<{ ok: boolean; user?: UserAccount; packsAwarded?: number } | null> {
    try {
      const token = this.accessToken || (await authService.getFreshAccessToken());
      if (!token) return null;

      const wsUrl = await this.resolveServerUrl();
      if (!wsUrl) return null;
      const httpUrl = wsUrl
        .replace(/^wss:/i, 'https:')
        .replace(/^ws:/i, 'http:')
        .replace(/\/ws$/i, '/api/ai-match');

      const res = await fetch(httpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (data?.user) {
        this.userSyncListeners.forEach(cb => {
          try { cb(data.user); } catch (e) { console.error(e); }
        });
      }
      return data;
    } catch {
      return null;
    }
  }
}

export const multiplayerClient = new MultiplayerClient();
