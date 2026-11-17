/**
 * BOWER JJ — Main Application Orchestrator
 * Supports Offline AI Games & Live Authoritative WebSockets Multiplayer.
 */

import React, { useState, useEffect, useRef } from 'react';
import { MainMenu } from './components/MainMenu';
import { GameTable } from './components/GameTable';
import { MultiplayerGameTable } from './components/MultiplayerGameTable';
import { TutorialModal } from './components/TutorialModal';
import { RulesCompendium } from './components/RulesCompendium';
import { ProfileModal, PlayerProfileData, MatchHistoryItem } from './components/ProfileModal';
import { MatchmakingModal, QueueType } from './components/MatchmakingModal';
import { FriendsModal } from './components/FriendsModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { CollectionModal } from './components/CollectionModal';
import { PackOpeningModal } from './components/PackOpeningModal';
import { AvatarPortrait } from './components/AvatarPortrait';
import { RankUpModal } from './components/RankUpModal';
import { GameLobbyModal, LobbyGameMode } from './components/GameLobbyModal';
import { AchievementsModal } from './components/AchievementsModal';
import { AuthModal } from './components/AuthModal';
import { AccountActivationModal, AccountActivationState } from './components/AccountActivationModal';
import { EmoteWheel } from './components/EmoteWheel';
import { RankTier } from './components/RankBadge';
import { LiveSiteTracker } from './components/LiveSiteTracker';
import { presenceTracker } from './services/presenceTracker';
import { authService } from './services/supabaseClient';
import {
  getCapturedAuthRedirect,
  clearCapturedAuthRedirect,
  cleanAuthParamsFromBrowserUrl,
} from './services/authCallback';
import {
  Player,
  EuchreGameState,
  AIDifficulty,
  EuchreHouseRules,
  DEFAULT_RULES,
} from './engine/types';
import { initializeGame, pickRandomDealer, getWinningTeam } from './engine/game';
import { sounds } from './audio/sound';
import { multiplayerClient } from './services/multiplayerClient';
import {
  SanitizedGameState,
  FriendSummary,
  LeaderboardEntry,
  PlayerCollectionState,
  PackOpenResult,
  UserAccount,
} from '../server/types';
import {
  resolveAvatarId,
  resolveCardBackId,
  BOT_AVATAR_BY_DIFFICULTY,
  BOT_CARD_BACK_BY_DIFFICULTY,
  pickRandomBotNames,
} from './config/collectiblesCatalog';

const STORAGE_KEY = 'bower_jj_player_profile';

function formatMatchMode(mode?: string): string {
  switch (mode) {
    case 'ranked_solo':
      return 'Ranked Solo';
    case 'ranked_rivals':
    case 'rivals':
      return 'Friendly Rivalry';
    case 'ranked_duo':
    case 'duo':
      return 'Ranked Duo';
    case 'unranked':
    case 'custom':
    case 'casual':
    case 'private':
      return 'Custom Match';
    case 'offline_ai':
    case 'ai':
      return 'Casual AI';
    default:
      return mode || 'Ranked Solo';
  }
}

export function createGuestProfile(): PlayerProfileData {
  let guestNum = '';
  try {
    const cachedNum = sessionStorage.getItem('bower_jj_guest_suffix');
    if (cachedNum) {
      guestNum = cachedNum;
    } else {
      guestNum = String(Math.floor(1000 + Math.random() * 9000));
      sessionStorage.setItem('bower_jj_guest_suffix', guestNum);
    }
  } catch {
    guestNum = String(Math.floor(1000 + Math.random() * 9000));
  }

  return {
    username: `Guest ${guestNum}`,
    playerId: `GUEST-${guestNum}`,
    avatarIcon: 'the_outlaw',
    level: 1,
    xp: 0,
    nextLevelXp: 1000,
    rankTier: '9',
    rankPoints: 0,
    totalGames: 0,
    wins: 0,
    losses: 0,
    tricksWon: 0,
    euchres: 0,
    marches: 0,
    successfulLoners: 0,
    currentStreak: 0,
    bestStreak: 0,
    favTrumpSuit: 'hearts',
    equippedCosmetics: {
      hat: 'the_outlaw',
      cardBack: 'classic_blue',
      banner: 'default_navy',
      title: 'Recruit',
    },
  };
}

export function extractInviteCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Search parameters (?join=ABC123 or ?room=ABC123)
    const searchParams = new URLSearchParams(window.location.search);
    const codeFromSearch = searchParams.get('join') || searchParams.get('room');
    if (codeFromSearch && /^[A-Za-z0-9]{6}$/.test(codeFromSearch.trim())) {
      return codeFromSearch.trim().toUpperCase();
    }

    // 2. Hash query parameters (#/?join=ABC123, #join=ABC123, or #room=ABC123)
    if (window.location.hash) {
      const hashStr = window.location.hash.replace(/^#\/?/, '');
      const queryIdx = hashStr.indexOf('?');
      if (queryIdx !== -1) {
        const hashParams = new URLSearchParams(hashStr.substring(queryIdx));
        const code = hashParams.get('join') || hashParams.get('room');
        if (code && /^[A-Za-z0-9]{6}$/.test(code.trim())) {
          return code.trim().toUpperCase();
        }
      }
      const hashParams = new URLSearchParams(hashStr);
      const codeFromHash = hashParams.get('join') || hashParams.get('room');
      if (codeFromHash && /^[A-Za-z0-9]{6}$/.test(codeFromHash.trim())) {
        return codeFromHash.trim().toUpperCase();
      }
      if (/^[A-Za-z0-9]{6}$/.test(hashStr.trim())) {
        return hashStr.trim().toUpperCase();
      }
    }

    // 3. Fallback regex match across whole href
    const match = window.location.href.match(/[\?&#](?:join|room)=([A-Za-z0-9]{6})/i);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  } catch (e) {
    console.warn('Failed parsing invite code from URL:', e);
  }

  return null;
}

export function normalizeXpProgress(
  rawXp?: number,
  rawLevel?: number
): { xp: number; level: number; nextLevelXp: number } {
  const safeXp = Math.max(0, Math.floor(typeof rawXp === 'number' ? rawXp : 0));
  const safeLevel = Math.max(1, Math.floor(typeof rawLevel === 'number' ? rawLevel : 1));
  if (safeXp >= 1000) {
    return {
      xp: safeXp % 1000,
      level: Math.floor(safeXp / 1000) + 1,
      nextLevelXp: 1000,
    };
  }
  return {
    xp: safeXp,
    level: safeLevel,
    nextLevelXp: 1000,
  };
}

export const App: React.FC = () => {
  const [profile, setProfile] = useState<PlayerProfileData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return createGuestProfile();
      const parsed = JSON.parse(saved) as PlayerProfileData;
      // If cached profile is the legacy shared BowerKing default, purge and create unique guest
      if (parsed.username === 'BowerKing' || parsed.playerId === 'JJ-7892') {
        localStorage.removeItem(STORAGE_KEY);
        return createGuestProfile();
      }
      const norm = normalizeXpProgress(parsed.xp, parsed.level);
      const normAvatar = resolveAvatarId(parsed.avatarIcon);
      const normCardBack = resolveCardBackId(parsed.equippedCosmetics?.cardBack);
      return {
        ...parsed,
        avatarIcon: normAvatar,
        equippedCosmetics: {
          ...(parsed.equippedCosmetics || {}),
          hat: normAvatar,
          cardBack: normCardBack,
        },
        xp: norm.xp,
        level: norm.level,
        nextLevelXp: norm.nextLevelXp,
      };
    } catch {
      return createGuestProfile();
    }
  });

  const [currentView, setCurrentView] = useState<'menu' | 'ai_game' | 'multiplayer_game'>('menu');
  const currentViewRef = useRef(currentView);
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  const [activeGameState, setActiveGameState] = useState<EuchreGameState | null>(null);
  const [multiplayerState, setMultiplayerState] = useState<SanitizedGameState | null>(null);

  // Dedicated Live Site Tracker View (Direct route: /tracker or ?tracker)
  const [isTrackerView, setIsTrackerView] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return path.startsWith('/tracker') || search.includes('tracker') || hash.includes('tracker');
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      const search = window.location.search.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      setIsTrackerView(path.startsWith('/tracker') || search.includes('tracker') || hash.includes('tracker'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Initialize and synchronize real-time presence tracking
  useEffect(() => {
    presenceTracker.startPlayerTracking({
      playerId: profile.playerId,
      username: profile.username,
      rankTier: profile.rankTier,
      activity: 'Main Menu',
    });
  }, []);

  useEffect(() => {
    presenceTracker.updateState({
      playerId: profile.playerId,
      username: profile.username,
      rankTier: profile.rankTier,
    });
  }, [profile.playerId, profile.username, profile.rankTier]);

  // Dynamic presence tracking across all game modes, queues, and views
  useEffect(() => {
    if (isTrackerView) {
      presenceTracker.updateState({ activity: 'Viewing Live Tracker' });
      return;
    }
    if (currentView === 'menu') {
      if (multiplayerState && multiplayerState.phase !== 'game_over') {
        presenceTracker.updateState({ activity: 'Main Menu (Match in Progress)' });
      } else {
        presenceTracker.updateState({ activity: 'Main Menu' });
      }
    } else if (currentView === 'ai_game') {
      presenceTracker.updateState({ activity: 'Playing vs Bots' });
    } else if (currentView === 'multiplayer_game') {
      presenceTracker.updateState({ activity: 'In 2v2 Ranked Match' });
    }
  }, [currentView, isTrackerView, multiplayerState]);

  // Modals
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [collectionInitialTab, setCollectionInitialTab] = useState<'packs' | 'collections' | 'avatars'>('packs');
  const [isPackOpeningOpen, setIsPackOpeningOpen] = useState(false);
  const [isOpeningPack, setIsOpeningPack] = useState(false);
  const [pendingPackResult, setPendingPackResult] = useState<PackOpenResult | null>(null);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [matchmakingQueue, setMatchmakingQueue] = useState<QueueType | null>(null);
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);
  const [lobbyInitialMode, setLobbyInitialMode] = useState<LobbyGameMode>('custom');
  const [isEmoteWheelOpen, setIsEmoteWheelOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(() => sounds.getMuted());
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<string | undefined>();
  const [authModalInitialTab, setAuthModalInitialTab] = useState<'login' | 'register'>('register');
  const [authModalInitialEmail, setAuthModalInitialEmail] = useState<string | undefined>();
  const [activationState, setActivationState] = useState<AccountActivationState | null>(null);
  const [authUser, setAuthUser] = useState<any | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const authUserRef = useRef<any | null>(null);
  const pendingSignupActivationRef = useRef<boolean>(false);

  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

  // Smoothly crossfade background music between Lobby and Active Gameplay scenes
  useEffect(() => {
    sounds.setMusicScene(currentView === 'menu' ? 'lobby' : 'game');
  }, [currentView]);

  // Sync mute state with SoundEngine preferences
  useEffect(() => {
    return sounds.subscribe(prefs => {
      setIsMuted(prefs.sfxMuted && !prefs.musicEnabled);
    });
  }, []);

  const [lastMatchRankUpdate, setLastMatchRankUpdate] = useState<{
    oldTier: RankTier;
    newTier: RankTier;
    oldPoints: number;
    newPoints: number;
    lpChange: number;
  } | null>(null);

  // Live Multiplayer & Social State
  const [friendsList, setFriendsList] = useState<FriendSummary[]>([]);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<UserAccount['friendRequests']>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [userRankPosition, setUserRankPosition] = useState<number | undefined>();
  const [collectionState, setCollectionState] = useState<PlayerCollectionState | undefined>();
  const lastRecordedGameOverRoomRef = useRef<string | null>(null);

  // Rank Promotion Fanfare Modal
  const [rankUpData, setRankUpData] = useState<{
    oldTier: RankTier;
    newTier: RankTier;
    newPoints: number;
  } | null>(null);

  // Notice Toast & Party Invite Toast
  const [notice, setNotice] = useState<{ message: string; title?: string } | null>(null);
  const noticeTimerRef = React.useRef<any>(null);

  const showToast = (message: string, title?: string, durationMs: number = 3800) => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    setNotice({ message, title });
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
    }, durationMs);
  };

  const [partyInvite, setPartyInvite] = useState<{
    fromUsername: string;
    fromAvatar: string;
    roomCode: string;
    mode?: string;
    expiresAt?: number;
  } | null>(null);

  // Auto-expire incoming party invite prompt when its 30s expiration window passes
  useEffect(() => {
    if (!partyInvite) return;
    const expiryMs = partyInvite.expiresAt
      ? Math.max(1000, partyInvite.expiresAt - Date.now())
      : 30000;
    const timer = setTimeout(() => {
      setPartyInvite(null);
    }, expiryMs);
    return () => clearTimeout(timer);
  }, [partyInvite]);

  // Active emotes on table: position -> emote
  const [activeEmotes, setActiveEmotes] = useState<Record<number, { text?: string; emoji?: string }>>({});

  // Synchronize full authoritative profile, lifetime statistics, and match history
  const syncAuthoritativeProfile = (userId: string) => {
    multiplayerClient.fetchCollectionState();
    authService.fetchFullProfile(userId).then(sync => {
      if (sync) {
        setProfile(prev => {
          const normXp = normalizeXpProgress(sync.xp?.xp ?? prev.xp, sync.xp?.level ?? prev.level);
          const hatIcon = sync.cosmetics?.equipped_hat;
          const profileAvatar = sync.profile?.avatar_icon;
          const resolvedAvatar = resolveAvatarId(
            profileAvatar || hatIcon || prev.avatarIcon
          );
          const resolvedCardBack = resolveCardBackId(
            sync.cosmetics?.equipped_card_back || prev.equippedCosmetics?.cardBack
          );

          return {
            ...prev,
            username: sync.profile?.username || prev.username,
            playerId: sync.profile?.id || userId,
            avatarIcon: resolvedAvatar,
            level: normXp.level,
            xp: normXp.xp,
            nextLevelXp: normXp.nextLevelXp,
            rankTier: (sync.rank?.rank_tier as RankTier) || prev.rankTier,
            rankPoints: sync.rank?.rank_points ?? prev.rankPoints,
            wins: sync.statistics?.wins ?? prev.wins,
            losses: sync.statistics?.losses ?? prev.losses,
            totalGames: sync.statistics?.total_games ?? prev.totalGames,
            tricksWon: sync.statistics?.tricks_won ?? prev.tricksWon,
            euchres: sync.statistics?.euchres ?? prev.euchres,
            marches: sync.statistics?.marches ?? prev.marches,
            successfulLoners: sync.statistics?.successful_loners ?? prev.successfulLoners,
            currentStreak: sync.statistics?.current_streak ?? prev.currentStreak,
            bestStreak: sync.statistics?.best_streak ?? prev.bestStreak,
            favTrumpSuit: sync.statistics?.favorite_suit || prev.favTrumpSuit,
            equippedCosmetics: {
              hat: resolvedAvatar,
              cardBack: resolvedCardBack,
              banner: sync.cosmetics?.equipped_banner || prev.equippedCosmetics?.banner || 'default_navy',
              title: sync.cosmetics?.equipped_title || prev.equippedCosmetics?.title || 'Recruit',
            },
          };
        });
      }
    });

    authService.fetchMatchHistory(userId, 50).then(history => {
      if (history && history.length > 0) {
        const mapped: MatchHistoryItem[] = history.map((h: any) => ({
          id: h.id,
          date: new Date(h.created_at).getTime(),
          mode: formatMatchMode(h.mode),
          won: Boolean(h.won),
          score: h.score || '10 - 7',
          lpChange: h.lp_change ?? (h.won ? 20 : -15),
          opponentNames: Array.isArray(h.opponent_names) && h.opponent_names.length > 0 ? h.opponent_names : ['Opponents'],
        }));
        setProfile(prev => {
          const localOnlyAi = (prev.recentMatches || []).filter(m => m.id.startsWith('match_ai_'));
          const combined = [...mapped, ...localOnlyAi].sort((a, b) => b.date - a.date).slice(0, 50);
          return { ...prev, recentMatches: combined };
        });
      }
    });
  };

  // Apply authoritative server user snapshot (AUTH_SUCCESS / USER_SYNC) without stale React closure bugs
  const applyAuthoritativeUser = (user: UserAccount) => {
    const activeAuthId = authUserRef.current?.id;
    const isVerifiedUser = Boolean(activeAuthId && user.id === activeAuthId);

    setProfile(prev => {
      const prevHasSavedUuid = Boolean(
        prev.playerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prev.playerId)
      );
      const isMismatchedUnauthedHandshake = Boolean(
        !activeAuthId && prevHasSavedUuid && user.id !== prev.playerId && (user.totalGames || 0) === 0
      );
      const keepPrevRank = Boolean((activeAuthId && !isVerifiedUser) || isMismatchedUnauthedHandshake);
      const keepNonZeroStats = Boolean(
        (isVerifiedUser || prev.playerId === user.id) &&
          (user.totalGames || 0) === 0 &&
          (user.rankPoints || 0) === 0 &&
          prev.totalGames > 0
      );

      const resolvedPlayerId = activeAuthId || (keepPrevRank ? prev.playerId : user.id) || prev.playerId;
      const resolvedRankTier: RankTier =
        keepPrevRank || (keepNonZeroStats && prev.rankTier !== '9')
          ? prev.rankTier
          : ((user.rankTier as RankTier) || prev.rankTier);
      const resolvedRankPoints =
        keepPrevRank || (keepNonZeroStats && prev.rankPoints > 0 && user.rankPoints === 0)
          ? prev.rankPoints
          : (typeof user.rankPoints === 'number' ? user.rankPoints : prev.rankPoints);
      const resolvedWins =
        keepPrevRank || (keepNonZeroStats && prev.wins > 0 && user.wins === 0)
          ? prev.wins
          : (typeof user.wins === 'number' ? user.wins : prev.wins);
      const resolvedLosses =
        keepPrevRank || (keepNonZeroStats && prev.losses > 0 && user.losses === 0)
          ? prev.losses
          : (typeof user.losses === 'number' ? user.losses : prev.losses);
      const resolvedTotalGames =
        keepPrevRank || (keepNonZeroStats && prev.totalGames > 0 && user.totalGames === 0)
          ? prev.totalGames
          : (typeof user.totalGames === 'number' ? user.totalGames : prev.totalGames);

      let mergedMatches = prev.recentMatches || [];
      if (Array.isArray(user.matchHistory) && user.matchHistory.length > 0 && !keepPrevRank) {
        const mappedServer: MatchHistoryItem[] = user.matchHistory.map(m => ({
          id: m.id,
          date: m.date,
          mode: formatMatchMode(m.mode),
          won: Boolean(m.won),
          score: m.score || '10 - 7',
          lpChange: m.lpChange ?? 0,
          opponentNames: Array.isArray(m.opponentNames) && m.opponentNames.length > 0 ? m.opponentNames : ['Opponents'],
        }));
        const localOnlyAi = mergedMatches.filter(m => m.id.startsWith('match_ai_'));
        mergedMatches = [...mappedServer, ...localOnlyAi].sort((a, b) => b.date - a.date).slice(0, 50);
      }

      const rawLevel =
        !keepPrevRank && (isVerifiedUser || !activeAuthId) && typeof user.level === 'number' ? user.level : prev.level;
      const rawXp =
        !keepPrevRank && (isVerifiedUser || !activeAuthId) && typeof user.xp === 'number' ? user.xp : prev.xp;
      const normXp = normalizeXpProgress(rawXp, rawLevel);

      const resolvedAvatar = keepPrevRank
        ? prev.avatarIcon
        : resolveAvatarId(user.avatarIcon || user.equippedCosmetics?.hat || prev.avatarIcon);
      const resolvedCardBack = keepPrevRank
        ? resolveCardBackId(prev.equippedCosmetics?.cardBack)
        : resolveCardBackId(user.equippedCosmetics?.cardBack || prev.equippedCosmetics?.cardBack);

      return {
        ...prev,
        username: keepPrevRank ? prev.username : (user.username || prev.username),
        avatarIcon: resolvedAvatar,
        playerId: resolvedPlayerId,
        level: normXp.level,
        xp: normXp.xp,
        nextLevelXp: normXp.nextLevelXp,
        rankTier: resolvedRankTier,
        rankPoints: resolvedRankPoints,
        wins: resolvedWins,
        losses: resolvedLosses,
        totalGames: resolvedTotalGames,
        tricksWon: typeof user.tricksWon === 'number' && !keepPrevRank ? user.tricksWon : prev.tricksWon,
        euchres: typeof user.euchres === 'number' && !keepPrevRank ? user.euchres : prev.euchres,
        marches: typeof user.marches === 'number' && !keepPrevRank ? user.marches : prev.marches,
        successfulLoners: typeof user.successfulLoners === 'number' && !keepPrevRank ? user.successfulLoners : prev.successfulLoners,
        currentStreak: typeof user.winStreak === 'number' && !keepPrevRank ? user.winStreak : prev.currentStreak,
        bestStreak: typeof user.bestWinStreak === 'number' && !keepPrevRank ? user.bestWinStreak : prev.bestStreak,
        equippedCosmetics: !keepPrevRank && user.equippedCosmetics
          ? {
              hat: resolvedAvatar,
              cardBack: resolvedCardBack,
              banner: user.equippedCosmetics.banner || prev.equippedCosmetics?.banner || 'default_navy',
              title: user.equippedCosmetics.title || prev.equippedCosmetics?.title || 'Recruit',
            }
          : prev.equippedCosmetics,
        recentMatches: mergedMatches,
      };
    });

    if (user.collectionState) {
      setCollectionState(user.collectionState);
    }
  };

  // 1. Restore Supabase Authentication Session, Handle Confirmation Redirects & Listen to Auth Events
  useEffect(() => {
    const authRedirect = getCapturedAuthRedirect();
    const isReturningFromAuthLink = authRedirect.kind !== 'none';

    const showActivatedModal = (user: any) => {
      sounds.playVictoryFanfare();
      setIsAuthOpen(false);
      setActivationState({
        status: 'activated',
        username: user?.user_metadata?.username,
        email: user?.email,
      });
      clearCapturedAuthRedirect();
      cleanAuthParamsFromBrowserUrl();
      pendingSignupActivationRef.current = false;
    };

    if (authRedirect.kind === 'signup_confirmed' || authRedirect.kind === 'pkce_code') {
      pendingSignupActivationRef.current = true;
    }

    if (authRedirect.kind === 'token_hash' && authRedirect.tokenHash) {
      setActivationState({ status: 'verifying' });
      cleanAuthParamsFromBrowserUrl();
      authService
        .verifyTokenHash(authRedirect.tokenHash, authRedirect.otpType === 'email' ? 'email' : 'signup')
        .then(async ({ user, session, error }) => {
          clearCapturedAuthRedirect();
          if (user) {
            showActivatedModal(user);
            if (session?.access_token) {
              authUserRef.current = user;
              setAuthUser(user);
              setAuthToken(session.access_token);
              syncAuthoritativeProfile(user.id);
              multiplayerClient.reauthenticate(
                session.access_token,
                user.user_metadata?.username || profile.username,
                user.user_metadata?.avatar_icon || profile.avatarIcon
              );
            }
            return;
          }

          const existingSession = await authService.getSession();
          if (existingSession?.user) {
            showActivatedModal(existingSession.user);
            return;
          }

          setActivationState({
            status: 'link_used_or_expired',
            errorMessage: error || undefined,
          });
        });
    } else if (authRedirect.kind === 'link_error') {
      cleanAuthParamsFromBrowserUrl();
      clearCapturedAuthRedirect();
      authService.getSession().then((session) => {
        if (session?.user && session.access_token) {
          authUserRef.current = session.user;
          setAuthUser(session.user);
          setAuthToken(session.access_token);
          syncAuthoritativeProfile(session.user.id);
          multiplayerClient.connect(
            session.user.user_metadata?.username || profile.username,
            session.user.user_metadata?.avatar_icon || profile.avatarIcon,
            session.access_token
          );
          showActivatedModal(session.user);
        } else {
          setActivationState({
            status: 'link_used_or_expired',
            errorMessage: authRedirect.errorDescription,
          });
        }
      });
    } else {
      authService.getSession().then((session) => {
        if (session?.user && session.access_token) {
          authUserRef.current = session.user;
          setAuthUser(session.user);
          setAuthToken(session.access_token);
          syncAuthoritativeProfile(session.user.id);

          // Reconnect/authenticate with verified access token
          multiplayerClient.connect(
            session.user.user_metadata?.username || profile.username,
            session.user.user_metadata?.avatar_icon || profile.avatarIcon,
            session.access_token
          );

          if (pendingSignupActivationRef.current || authRedirect.kind === 'signup_confirmed') {
            showActivatedModal(session.user);
          }
        } else if (!isReturningFromAuthLink) {
          // Unauthenticated visitor: prompt new players to register or sign in (skip if joining via direct invite or tracker view)
          try {
            const isDirectInvite = Boolean(extractInviteCodeFromUrl());
            const isTrackerView = typeof window !== 'undefined' && window.location.hash.startsWith('#tracker');
            if (!isDirectInvite && !isTrackerView) {
              setTimeout(() => {
                setAuthModalInitialTab('register');
                setAuthModalReason('Welcome to BOWER JJ! Create your free account or sign in to start playing.');
                setIsAuthOpen(true);
              }, 400);
            }
          } catch {}
        }
      });
    }

    const unsubscribe = authService.onAuthStateChange((session, user) => {
      if (session && user) {
        authUserRef.current = user;
        setAuthUser(user);
        setAuthToken(session.access_token);
        try {
          localStorage.setItem('bower_jj_tutorial_seen', 'true');
        } catch {}
        setIsTutorialOpen(false);
        syncAuthoritativeProfile(user.id);
        multiplayerClient.reauthenticate(
          session.access_token,
          user.user_metadata?.username || profile.username,
          user.user_metadata?.avatar_icon || profile.avatarIcon
        );
        if (pendingSignupActivationRef.current) {
          showActivatedModal(user);
        }
      } else {
        authUserRef.current = null;
        setAuthUser(null);
        setAuthToken(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Connect to Multiplayer Server on startup
  useEffect(() => {
    multiplayerClient.connect(profile.username, profile.avatarIcon);

    const unsubscribe = multiplayerClient.setCallbacks({
      onAuth: (user) => {
        applyAuthoritativeUser(user);
      },
      onUserSync: (user) => {
        applyAuthoritativeUser(user);
      },
      onRoom: (room) => {
        // When receiving a lobby room update (invite accept, invite link, code), bring player directly into the unified lobby
        if (room.status === 'lobby') {
          setLobbyInitialMode(room.queueMode === 'rivals' ? 'rivals' : 'custom');
          setIsFriendsOpen(false);
          setMatchmakingQueue(null);
          setMultiplayerState(null);
          setCurrentView('menu');
          setIsLobbyOpen(true);
        }
      },
      onGameSync: (serverGameState) => {
        if (serverGameState.phase !== 'game_over') {
          setLastMatchRankUpdate(null);
        } else {
          try {
            sessionStorage.removeItem('bower_match_minimized');
          } catch {}
        }
        setMultiplayerState(serverGameState);

        // Keep player on menu if they explicitly minimized, otherwise bring them to game table
        const wasMinimized = typeof window !== 'undefined' && sessionStorage.getItem('bower_match_minimized') === 'true';
        if (!wasMinimized || currentViewRef.current === 'multiplayer_game') {
          setCurrentView('multiplayer_game');
        }
        setIsLobbyOpen(false);
        setMatchmakingQueue(null);

        // Refresh authoritative profile & match history upon game over (server persists Postgres transactionally)
        const gameKey = serverGameState.roomId || `${serverGameState.roomCode || 'mp'}_${serverGameState.scores.join('-')}`;
        if (serverGameState.phase === 'game_over' && lastRecordedGameOverRoomRef.current !== gameKey) {
          lastRecordedGameOverRoomRef.current = gameKey;
          const activeUid = authUserRef.current?.id;
          if (activeUid) {
            setTimeout(() => syncAuthoritativeProfile(activeUid), 500);
          } else {
            const myTeam = serverGameState.yourPosition % 2;
            const oppTeam = (serverGameState.yourPosition + 1) % 2;
            const myScore = serverGameState.scores[myTeam] || 0;
            const oppScore = serverGameState.scores[oppTeam] || 0;
            const targetScore = serverGameState.rules?.targetScore ?? 10;
            const winningTeam = serverGameState.winningTeam ?? getWinningTeam(serverGameState.scores, targetScore);
            const won = winningTeam === myTeam;
            const isRanked =
              Boolean(serverGameState.isMatchmade) &&
              (serverGameState.queueMode === 'solo' || serverGameState.queueMode === 'duo');
            const oppSlots = serverGameState.slots.filter(s => s.position % 2 !== myTeam);
            const oppNames = oppSlots.map(s => s.username || `Player ${s.position}`);
            const modeLabel = formatMatchMode(
              isRanked
                ? (serverGameState.queueMode === 'duo' ? 'ranked_duo' : 'ranked_solo')
                : (serverGameState.queueMode === 'rivals' ? 'ranked_rivals' : 'custom')
            );

            const mpMatchItem: MatchHistoryItem = {
              id: `match_${gameKey}_${Date.now()}`,
              date: Date.now(),
              mode: modeLabel,
              won,
              score: `${myScore} - ${oppScore}`,
              lpChange: isRanked ? (won ? 24 : -16) : 0,
              opponentNames: oppNames.length > 0 ? oppNames : ['Opponents'],
            };

            setProfile(prev => ({
              ...prev,
              wins: won ? prev.wins + 1 : prev.wins,
              losses: won ? prev.losses : prev.losses + 1,
              totalGames: prev.totalGames + 1,
              recentMatches: [mpMatchItem, ...(prev.recentMatches || [])].slice(0, 50),
            }));
          }
        }
      },
      onEmote: (fromPos, text, emoji) => {
        setActiveEmotes(prev => ({
          ...prev,
          [fromPos]: { text, emoji },
        }));
        setTimeout(() => {
          setActiveEmotes(prev => {
            const next = { ...prev };
            delete next[fromPos];
            return next;
          });
        }, 3500);
      },
      onFriends: (friends, requests) => {
        setFriendsList(friends);
        setIncomingFriendRequests(requests);
      },
      onLeaderboard: (entries, rank) => {
        setLeaderboardEntries(entries);
        setUserRankPosition(rank);
      },
      onCollection: (cs) => {
        setCollectionState(cs);
      },
      onPackOpened: (result) => {
        setIsOpeningPack(false);
        setPendingPackResult(result);
        if (result.collectionState) {
          setCollectionState(result.collectionState);
        }
        if (authUserRef.current?.id) {
          syncAuthoritativeProfile(authUserRef.current.id);
        }
      },
      onPackEarned: (info) => {
        sounds.playVictoryFanfare();
        showToast(
          info.level
            ? `Level ${info.level} reached! +${info.count} Collectible Card Pack added to your vault!`
            : `+${info.count} Collectible Card Pack added to your vault!`,
          'Level Up Reward!'
        );
        multiplayerClient.fetchCollectionState();
      },
      onRankUpdate: (update) => {
        setLastMatchRankUpdate(update);
        setProfile(prev => ({
          ...prev,
          rankTier: update.newTier,
          rankPoints: update.newPoints,
        }));

        if (authUserRef.current?.id) {
          setTimeout(() => syncAuthoritativeProfile(authUserRef.current.id), 350);
        }

        if (update.didRankUp) {
          setRankUpData({
            oldTier: update.oldTier,
            newTier: update.newTier,
            newPoints: update.newPoints,
          });
        }
      },
      onPartyInvite: (invite) => {
        setPartyInvite(invite);
        sounds.playTrickWin();
      },
      onNotice: (message, title) => {
        showToast(message, title);
      },
      onError: (msg) => {
        setIsOpeningPack(false);
        console.warn('Multiplayer notice:', msg);
        if (msg && !msg.includes('Connection error')) {
          showToast(msg, 'Notice');
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Save profile changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (err) {
      console.warn('Could not save profile to localStorage', err);
    }
  }, [profile]);

  // Handle URL invitation auto-join (e.g. ?join=AB12CD, #join=AB12CD, #/AB12CD)
  const handledJoinCodeRef = React.useRef<string | null>(null);

  useEffect(() => {
    const code = extractInviteCodeFromUrl();
    if (!code || handledJoinCodeRef.current === code) return;
    handledJoinCodeRef.current = code;

    // Immediately clean URL parameters so back button and page refresh stay clean
    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } catch {}

    // Open Game Lobby modal immediately
    setLobbyInitialMode('custom');
    setIsLobbyOpen(true);
    setMatchmakingQueue(null);

    // Connect and queue room join
    multiplayerClient.connect(profile.username, profile.avatarIcon);
    multiplayerClient.joinRoom(code);
  }, []);

  const handleTutorialComplete = () => {
    try {
      localStorage.setItem('bower_jj_tutorial_seen', 'true');
    } catch {}
    setIsTutorialOpen(false);
  };

  const handleAuthDismissOrContinue = () => {
    setIsAuthOpen(false);
  };

  const handleOpenMatchmaking = (queue: QueueType) => {
    if (queue === 'private') {
      setLobbyInitialMode('custom');
      setIsLobbyOpen(true);
      return;
    }
    if (!authUser && (queue === 'ranked_solo' || queue === 'ranked_duo')) {
      setAuthModalInitialTab('register');
      setAuthModalReason('Ranked Competitive matches record your MMR and Global Leaderboard rank. Please create an account or sign in to play Ranked!');
      setIsAuthOpen(true);
      return;
    }
    setMatchmakingQueue(queue);
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    sounds.setMuted(nextMuted);
  };

  const handleLogout = async () => {
    sounds.playUiClick();
    await authService.logout();
    setAuthUser(null);
    setAuthToken(null);
    const guestProfile = createGuestProfile();
    setProfile(guestProfile);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    showToast('You have been signed out. Active in offline guest mode.', 'Signed Out');
  };

  // Launch Local AI Match
  const handleStartAIMatch = (difficulty: AIDifficulty, rules: EuchreHouseRules) => {
    setActiveGameState(null);
    const botAvatars = BOT_AVATAR_BY_DIFFICULTY[difficulty];
    const botCardBack = BOT_CARD_BACK_BY_DIFFICULTY[difficulty];
    const [botNameWest, botNamePartner, botNameEast] = pickRandomBotNames(3, [profile.username]);
    const players: Player[] = [
      {
        id: 'p0',
        name: profile.username,
        position: 0,
        isAI: false,
        avatarId: resolveAvatarId(profile.avatarIcon),
        cardBack: resolveCardBackId(profile.equippedCosmetics?.cardBack),
        rankTier: profile.rankTier,
      },
      {
        id: 'p1',
        name: botNameWest,
        position: 1,
        isAI: true,
        aiDifficulty: difficulty,
        avatarId: botAvatars[0],
        cardBack: botCardBack,
      },
      {
        id: 'p2',
        name: botNamePartner,
        position: 2,
        isAI: true,
        aiDifficulty: difficulty,
        avatarId: botAvatars[1 % botAvatars.length],
        cardBack: botCardBack,
      },
      {
        id: 'p3',
        name: botNameEast,
        position: 3,
        isAI: true,
        aiDifficulty: difficulty,
        avatarId: botAvatars[2 % botAvatars.length],
        cardBack: botCardBack,
      },
    ];

    const initialGame = initializeGame(players, rules, pickRandomDealer());
    setActiveGameState(initialGame);
    setCurrentView('ai_game');
    presenceTracker.updateState({ activity: 'Playing vs Bots' });
  };

  // Handle AI Match Completion (Offline stats & progression)
  const handleAIMatchComplete = (
    won: boolean,
    userScore: number,
    oppScore: number,
    stats?: { tricksWon?: number; euchres?: number; marches?: number; successfulLoners?: number }
  ) => {
    const oppNames =
      activeGameState?.players
        ? [activeGameState.players[1]?.name, activeGameState.players[3]?.name].filter(Boolean)
        : ['EuchreBot West', 'EuchreBot East'];

    setProfile(prev => {
      const nextWins = won ? prev.wins + 1 : prev.wins;
      const nextLosses = won ? prev.losses : prev.losses + 1;
      const nextGames = prev.totalGames + 1;
      const earnedXp = won ? 150 : 50;
      const baseNorm = normalizeXpProgress(prev.xp, prev.level);
      const combinedXp = baseNorm.xp + earnedXp;
      const levelsGained = Math.floor(combinedXp / 1000);
      const nextLevel = baseNorm.level + levelsGained;
      const totalXp = combinedXp % 1000;
      const nextLevelXp = 1000;
      const currentStreak = won ? prev.currentStreak + 1 : 0;
      const bestStreak = Math.max(prev.bestStreak, currentStreak);
      const tricksWon = prev.tricksWon + (stats?.tricksWon || 0);
      const euchres = prev.euchres + (stats?.euchres || 0);
      const marches = prev.marches + (stats?.marches || 0);
      const successfulLoners = prev.successfulLoners + (stats?.successfulLoners || 0);

      const aiMatchItem: MatchHistoryItem = {
        id: `match_ai_${Date.now()}`,
        date: Date.now(),
        mode: 'Casual AI',
        won,
        score: `${userScore} - ${oppScore}`,
        lpChange: 0,
        opponentNames: oppNames,
      };

      return {
        ...prev,
        wins: nextWins,
        losses: nextLosses,
        totalGames: nextGames,
        level: nextLevel,
        xp: totalXp,
        nextLevelXp,
        currentStreak,
        bestStreak,
        tricksWon,
        euchres,
        marches,
        successfulLoners,
        recentMatches: [aiMatchItem, ...(prev.recentMatches || [])].slice(0, 30),
      };
    });

    if (authUser?.id) {
      const matchId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      multiplayerClient
        .recordAiMatchResult({
          matchId,
          won,
          userScore,
          oppScore,
          tricksWon: stats?.tricksWon || 0,
          euchres: stats?.euchres || 0,
          marches: stats?.marches || 0,
          successfulLoners: stats?.successfulLoners || 0,
          opponentNames: oppNames,
        })
        .then(async (serverRes) => {
          if (serverRes?.ok && serverRes.user) {
            if ((serverRes.packsAwarded || 0) > 0) {
              sounds.playVictoryFanfare();
              showToast(
                `Level ${serverRes.user.level} reached! +${serverRes.packsAwarded} Collectible Card Pack${serverRes.packsAwarded === 1 ? '' : 's'} added to your vault!`,
                'Level Up Reward!'
              );
              multiplayerClient.fetchCollectionState();
            }
            return;
          }

          const updated = await authService.recordOfflineMatch(authUser.id, won, {
            tricksWon: stats?.tricksWon,
            euchres: stats?.euchres,
            marches: stats?.marches,
            successfulLoners: stats?.successfulLoners,
            score: `${userScore} - ${oppScore}`,
          });
          if (updated) {
            syncAuthoritativeProfile(authUser.id);
          }
        });
    }

    showToast(
      won ? `Victory! Match won ${userScore}-${oppScore}. +150 XP earned.` : `Match finished ${userScore}-${oppScore}. +50 XP earned.`,
      won ? 'Match Won!' : 'Match Finished'
    );
  };

  // Send an Emote
  const handleSendEmote = (emote: { text?: string; emoji?: string }) => {
    if (currentView === 'multiplayer_game') {
      multiplayerClient.sendEmote(emote.text, emote.emoji);
    }

    const pos = multiplayerState ? multiplayerState.yourPosition : 0;
    setActiveEmotes(prev => ({
      ...prev,
      [pos]: emote,
    }));

    setTimeout(() => {
      setActiveEmotes(prev => {
        const next = { ...prev };
        delete next[pos];
        return next;
      });
    }, 3500);

    // AI bot reaction in local games
    if (currentView === 'ai_game' && Math.random() > 0.4) {
      setTimeout(() => {
        const botResponses = ['👏', '🔥', 'Nice!', 'Good luck!', 'Let’s go!'];
        const randomResp = botResponses[Math.floor(Math.random() * botResponses.length)];
        const randomBot = Math.floor(Math.random() * 3) + 1;
        setActiveEmotes(prev => ({
          ...prev,
          [randomBot]: { text: randomResp },
        }));
        setTimeout(() => {
          setActiveEmotes(prev => {
            const next = { ...prev };
            delete next[randomBot];
            return next;
          });
        }, 3000);
      }, 1200);
    }
  };

  const handleUpdateAvatar = (avatar: string) => {
    const canonical = resolveAvatarId(avatar);
    setProfile(p => ({
      ...p,
      avatarIcon: canonical,
      equippedCosmetics: {
        ...(p.equippedCosmetics || {}),
        hat: canonical,
      },
    }));
    multiplayerClient.equipAvatar(canonical);
    if (authUserRef.current?.id) {
      authService.updateUserAvatar(authUserRef.current.id, canonical);
    }
  };

  const handleUpdateUsername = (name: string) => {
    setProfile(p => ({ ...p, username: name }));
    multiplayerClient.connect(name, profile.avatarIcon);
  };

  const handleUpdateCosmetic = (category: 'hat' | 'cardBack' | 'banner' | 'title' | 'tableFelt', id: string) => {
    if (category === 'hat') {
      handleUpdateAvatar(id);
      return;
    }
    const finalId = category === 'cardBack' ? resolveCardBackId(id) : id;
    setProfile(prev => ({
      ...prev,
      equippedCosmetics: {
        ...(prev.equippedCosmetics || {}),
        [category]: finalId,
      },
    }));
    if (category === 'cardBack') {
      multiplayerClient.equipCardBack(finalId);
    } else {
      multiplayerClient.equipCosmetic(category as any, finalId);
    }
    if (authUserRef.current?.id) {
      authService.updateUserCosmetic(authUserRef.current.id, category, finalId);
    }
    try {
      localStorage.setItem(`bower_jj_${category}`, finalId);
    } catch {}
  };

  const handleUpdateWaxSeals = (newBalance: number) => {
    setProfile(prev => ({
      ...prev,
      waxSeals: newBalance,
    }));
    try {
      localStorage.setItem('bower_jj_wax_seals', String(newBalance));
    } catch {}
  };

  // Dedicated Live Site Traffic & Online User Tracker
  if (isTrackerView) {
    return (
      <LiveSiteTracker
        onBackToGame={() => {
          setIsTrackerView(false);
          try {
            window.history.pushState({}, '', '/');
          } catch {}
          presenceTracker.updateState({ activity: 'Main Menu' });
        }}
      />
    );
  }

  return (
    <div className="relative w-full min-h-[100dvh] bg-slate-950 font-sans">
      {/* Toast Notice */}
      {notice && (
        <div
          onClick={() => {
            if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
            setNotice(null);
          }}
          className="fixed left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-2xl animate-in slide-in-from-top-4 flex items-center space-x-2 cursor-pointer transition-all active:scale-95 group"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
          title="Click to dismiss"
        >
          <span>✨</span>
          <span>{notice.message}</span>
          <span className="text-[10px] ml-1.5 opacity-60 group-hover:opacity-100 font-bold">✕</span>
        </div>
      )}

      {/* Party Invite Prompt */}
      {partyInvite && (
        <div className="fixed bottom-6 right-6 z-[100] p-4 rounded-3xl bg-slate-900 border-2 border-cyan-400 shadow-2xl animate-in slide-in-from-bottom-4 max-w-xs space-y-2">
          <div className="flex items-center space-x-2.5">
            <AvatarPortrait avatarId={partyInvite.fromAvatar} size="sm" />
            <div>
              <div className="text-xs font-black text-white">{partyInvite.fromUsername}</div>
              <div className="text-[10px] text-cyan-300">
                {partyInvite.mode === 'rivals' ? 'Challenged you to Friendly Rivalry match!' : 'Invited you to Custom Game lobby!'}
              </div>
            </div>
          </div>
          <div className="flex space-x-2 pt-1">
            <button
              onClick={() => {
                const code = partyInvite.roomCode;
                const mode: LobbyGameMode = partyInvite.mode === 'rivals' ? 'rivals' : 'custom';
                setIsFriendsOpen(false);
                setMatchmakingQueue(null);
                setMultiplayerState(null);
                setCurrentView('menu');
                setLobbyInitialMode(mode);
                multiplayerClient.acceptPartyInvite(code);
                setIsLobbyOpen(true);
                setPartyInvite(null);
              }}
              className="flex-1 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-md"
            >
              Accept Challenge
            </button>
            <button
              onClick={() => {
                multiplayerClient.declinePartyInvite(partyInvite.roomCode);
                setPartyInvite(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-bold"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Main Views */}
      {currentView === 'ai_game' && activeGameState ? (
        <GameTable
          key={`ai_game_${activeGameState.dealer}_${activeGameState.players.map((p) => p.name).join('_')}`}
          initialState={activeGameState}
          profile={profile}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenTutorial={() => setIsTutorialOpen(true)}
          onOpenEmotes={() => setIsEmoteWheelOpen(true)}
          activeEmotes={activeEmotes}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onExitGame={() => {
            if (authUser?.id) syncAuthoritativeProfile(authUser.id);
            setActiveGameState(null);
            setCurrentView('menu');
            presenceTracker.updateState({ activity: 'Main Menu' });
          }}
          onMatchComplete={handleAIMatchComplete}
        />
      ) : currentView === 'multiplayer_game' && multiplayerState ? (
        <MultiplayerGameTable
          serverState={multiplayerState}
          profile={profile}
          lastRankUpdate={lastMatchRankUpdate}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenTutorial={() => setIsTutorialOpen(true)}
          onOpenEmotes={() => setIsEmoteWheelOpen(true)}
          activeEmotes={activeEmotes}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onPlayAgain={() => {
            const qMode = multiplayerState.queueMode;
            if (qMode === 'custom' || qMode === 'rivals') {
              const targetLobbyMode: LobbyGameMode = qMode === 'rivals' ? 'rivals' : 'custom';
              setLobbyInitialMode(targetLobbyMode);
              multiplayerClient.returnRoomToLobby(targetLobbyMode);
              setMultiplayerState(null);
              setCurrentView('menu');
              setIsLobbyOpen(true);
            } else {
              multiplayerClient.leaveRoom();
              multiplayerClient.leaveQueue();
              setMultiplayerState(null);
              setCurrentView('menu');
              const nextQueue: QueueType =
                qMode === 'duo'
                  ? 'ranked_duo'
                  : qMode === 'casual'
                  ? 'unranked'
                  : 'ranked_solo';
              setMatchmakingQueue(nextQueue);
            }
            if (authUser?.id) {
              syncAuthoritativeProfile(authUser.id);
            }
          }}
          onExitGame={(forfeit = false) => {
            if (forfeit) {
              try {
                sessionStorage.removeItem('bower_match_minimized');
              } catch {}
              multiplayerClient.leaveRoom();
              multiplayerClient.leaveQueue();
              setMultiplayerState(null);
              setCurrentView('menu');
              presenceTracker.updateState({ activity: 'Main Menu' });
              if (authUser?.id) {
                syncAuthoritativeProfile(authUser.id);
              }
            } else {
              try {
                sessionStorage.setItem('bower_match_minimized', 'true');
              } catch {}
              setCurrentView('menu');
              presenceTracker.updateState({ activity: 'Main Menu (Match in Progress)' });
            }
          }}
        />
      ) : (
        <MainMenu
          profile={profile}
          activeRankedMatch={multiplayerState}
          onRejoinMatch={() => {
            try {
              sessionStorage.removeItem('bower_match_minimized');
            } catch {}
            setCurrentView('multiplayer_game');
            presenceTracker.updateState({ activity: 'In 2v2 Ranked Match' });
          }}
          onForfeitActiveMatch={() => {
            try {
              sessionStorage.removeItem('bower_match_minimized');
            } catch {}
            multiplayerClient.leaveRoom();
            multiplayerClient.leaveQueue();
            setMultiplayerState(null);
            setCurrentView('menu');
            presenceTracker.updateState({ activity: 'Main Menu' });
            if (authUser?.id) {
              syncAuthoritativeProfile(authUser.id);
            }
          }}
          onStartAIMatch={handleStartAIMatch}
          onOpenMatchmaking={handleOpenMatchmaking}
          onOpenTutorial={() => {
            presenceTracker.updateState({ activity: 'Playing Tutorial' });
            setIsTutorialOpen(true);
          }}
          onOpenRules={() => {
            presenceTracker.updateState({ activity: 'Reading Rulebook' });
            setIsRulesOpen(true);
          }}
          onOpenProfile={() => {
            presenceTracker.updateState({ activity: 'Viewing Profile' });
            if (authUser?.id) syncAuthoritativeProfile(authUser.id);
            setIsProfileOpen(true);
          }}
          onOpenFriends={() => {
            if (!authUser) {
              setAuthModalInitialTab('register');
              setAuthModalReason('Friends list, parties, and social features require an account! Create an account or sign in to connect.');
              setIsAuthOpen(true);
              return;
            }
            presenceTracker.updateState({ activity: 'Checking Friends' });
            multiplayerClient.fetchFriends();
            setIsFriendsOpen(true);
          }}
          onOpenLeaderboard={() => {
            presenceTracker.updateState({ activity: 'Viewing World Rankings' });
            if (authUser?.id) syncAuthoritativeProfile(authUser.id);
            authService.getLeaderboard().then(entries => setLeaderboardEntries(entries));
            multiplayerClient.fetchLeaderboard();
            setIsLeaderboardOpen(true);
          }}
          unopenedPacksCount={collectionState?.unopenedPacksCount ?? 0}
          onOpenCollection={(tab = 'packs') => {
            presenceTracker.updateState({ activity: 'Browsing Vault & Decks' });
            setCollectionInitialTab(tab);
            multiplayerClient.fetchCollectionState();
            setIsCollectionOpen(true);
          }}
          onOpenPackOpener={() => {
            presenceTracker.updateState({ activity: 'Tearing Card Packs' });
            setPendingPackResult(null);
            setIsOpeningPack(false);
            multiplayerClient.fetchCollectionState();
            setIsPackOpeningOpen(true);
          }}
          onOpenRivalryInvite={() => {
            setLobbyInitialMode('rivals');
            setIsLobbyOpen(true);
          }}
          onOpenAchievements={() => setIsAchievementsOpen(true)}
          pendingRequestsCount={incomingFriendRequests.length}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          isAuthenticated={Boolean(authUser)}
          onOpenAuth={(tab = 'register', reason) => {
            setAuthModalInitialTab(tab);
            setAuthModalReason(reason);
            setIsAuthOpen(true);
          }}
          onLogout={handleLogout}
          onOpenTracker={() => {
            setIsTrackerView(true);
            try {
              window.history.pushState({}, '', '/tracker');
            } catch {}
          }}
        />
      )}

      {/* Overlays & Modals */}
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onComplete={handleTutorialComplete}
      />

      <RulesCompendium
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        onUpdateAvatar={handleUpdateAvatar}
        onUpdateUsername={handleUpdateUsername}
        onUpdateCosmetic={handleUpdateCosmetic}
        unlockedAvatars={collectionState?.unlockedAvatars}
        unlockedCardBacks={collectionState?.unlockedCardBacks}
        onOpenCollection={() => {
          setIsProfileOpen(false);
          setCollectionInitialTab('packs');
          multiplayerClient.fetchCollectionState();
          setIsCollectionOpen(true);
        }}
      />

      <FriendsModal
        isOpen={isFriendsOpen}
        onClose={() => setIsFriendsOpen(false)}
        friends={friendsList}
        incomingRequests={incomingFriendRequests}
        isAuthenticated={Boolean(authUser)}
        onOpenAuth={(tab, reason) => {
          setAuthModalInitialTab(tab || 'register');
          if (reason) setAuthModalReason(reason);
          setIsAuthOpen(true);
        }}
        onInviteToParty={() => {
          showToast('Invited friend to party!');
          setIsFriendsOpen(false);
          setLobbyInitialMode('rivals');
          setIsLobbyOpen(true);
        }}
      />

      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        entries={leaderboardEntries}
        yourRank={userRankPosition}
        currentUsername={profile.username}
        currentUserId={authUser?.id || profile.playerId}
        currentRankTier={profile.rankTier}
      />

      <CollectionModal
        isOpen={isCollectionOpen}
        onClose={() => setIsCollectionOpen(false)}
        initialTab={collectionInitialTab}
        collectionState={collectionState}
        equippedAvatarId={resolveAvatarId(profile.avatarIcon)}
        equippedCardBackId={resolveCardBackId(profile.equippedCosmetics?.cardBack)}
        equippedTableFeltId={profile.equippedCosmetics?.tableFelt || 'midnight_navy'}
        waxSealsBalance={profile.waxSeals ?? 150}
        playerLevel={profile.level}
        playerWins={profile.wins}
        onOpenPackModal={() => {
          setIsCollectionOpen(false);
          setPendingPackResult(null);
          setIsOpeningPack(false);
          setIsPackOpeningOpen(true);
        }}
        onEquipAvatar={handleUpdateAvatar}
        onEquipCardBack={(cardBackId) => handleUpdateCosmetic('cardBack', cardBackId)}
        onEquipTableFelt={(feltId) => handleUpdateCosmetic('tableFelt', feltId)}
        onUpdateWaxSeals={handleUpdateWaxSeals}
      />

      <PackOpeningModal
        isOpen={isPackOpeningOpen}
        onClose={() => {
          setIsPackOpeningOpen(false);
          setPendingPackResult(null);
          setIsOpeningPack(false);
        }}
        unopenedCount={collectionState?.unopenedPacksCount ?? 0}
        isOpening={isOpeningPack}
        packResult={pendingPackResult}
        currentWaxSeals={profile.waxSeals ?? 150}
        onRequestOpenPack={() => {
          setIsOpeningPack(true);
          multiplayerClient.openCardPack();
        }}
        onResetPackResult={() => {
          setPendingPackResult(null);
          setIsOpeningPack(false);
        }}
        onEquipCardBack={(cardBackId) => handleUpdateCosmetic('cardBack', cardBackId)}
        onEquipTableFelt={(feltId) => handleUpdateCosmetic('tableFelt', feltId)}
        onUpdateWaxSeals={handleUpdateWaxSeals}
        onOpenCollection={() => {
          setCollectionInitialTab('collections');
          multiplayerClient.fetchCollectionState();
          setIsCollectionOpen(true);
        }}
      />

      <GameLobbyModal
        isOpen={isLobbyOpen}
        onClose={() => setIsLobbyOpen(false)}
        friends={friendsList}
        userRank={profile.rankTier}
        userPoints={profile.rankPoints}
        initialMode={lobbyInitialMode}
        onMatchFound={() => {
          setIsLobbyOpen(false);
        }}
      />

      {rankUpData && (
        <RankUpModal
          isOpen={true}
          onClose={() => setRankUpData(null)}
          oldTier={rankUpData.oldTier}
          newTier={rankUpData.newTier}
          newPoints={rankUpData.newPoints}
        />
      )}

      {matchmakingQueue && (
        <MatchmakingModal
          isOpen={true}
          queueType={matchmakingQueue}
          userRank={profile.rankTier}
          userPoints={profile.rankPoints}
          friends={friendsList}
          onClose={() => setMatchmakingQueue(null)}
          onMatchFound={() => {
            setMatchmakingQueue(null);
          }}
        />
      )}

      <AchievementsModal
        isOpen={isAchievementsOpen}
        onClose={() => setIsAchievementsOpen(false)}
        profile={profile}
      />

      <EmoteWheel
        isOpen={isEmoteWheelOpen}
        onClose={() => setIsEmoteWheelOpen(false)}
        onSendEmote={handleSendEmote}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* Account Activation Status Screen */}
      <AccountActivationModal
        activation={activationState}
        onClose={() => setActivationState(null)}
        onOpenSignIn={(prefillEmail) => {
          setActivationState(null);
          setAuthModalInitialTab('login');
          setAuthModalInitialEmail(prefillEmail);
          setAuthModalReason('Sign in below with your email and password to enter your activated account.');
          setIsAuthOpen(true);
        }}
      />

      {/* Cloud Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={handleAuthDismissOrContinue}
        initialTab={authModalInitialTab}
        initialEmail={authModalInitialEmail}
        reason={authModalReason}
        onAuthSuccess={(user, token) => {
          setAuthUser(user);
          if (token) setAuthToken(token);
          if (user?.id) syncAuthoritativeProfile(user.id);
          setIsAuthOpen(false);
          showToast(`Signed in as ${user.user_metadata?.username || user.email}. Cloud sync active.`, 'Welcome Back!');
          const hasSeenTutorial = localStorage.getItem('bower_jj_tutorial_seen');
          if (!hasSeenTutorial) {
            setTimeout(() => setIsTutorialOpen(true), 400);
          }
        }}
        onSignupActivated={(user, token) => {
          setAuthUser(user);
          if (token) setAuthToken(token);
          if (user?.id) syncAuthoritativeProfile(user.id);
          setIsAuthOpen(false);
          showToast(`Account created for ${user?.user_metadata?.username}! Welcome to BOWER JJ.`, 'Account Created!');
          const hasSeenTutorial = localStorage.getItem('bower_jj_tutorial_seen');
          if (!hasSeenTutorial) {
            setTimeout(() => setIsTutorialOpen(true), 400);
          }
        }}
        onContinueAsGuest={() => {
          handleAuthDismissOrContinue();
          showToast('Playing as guest. Create an account anytime to unlock ranked play and friends!', 'Guest Mode');
        }}
      />
    </div>
  );
};
export default App;
