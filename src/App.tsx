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
import { BowerPassModal } from './components/BowerPassModal';
import { RankUpModal } from './components/RankUpModal';
import { GameLobbyModal, LobbyGameMode } from './components/GameLobbyModal';
import { AchievementsModal } from './components/AchievementsModal';
import { AuthModal } from './components/AuthModal';
import { EmoteWheel } from './components/EmoteWheel';
import { RankTier } from './components/RankBadge';
import { authService } from './services/supabaseClient';
import {
  Player,
  EuchreGameState,
  AIDifficulty,
  EuchreHouseRules,
  DEFAULT_RULES,
} from './engine/types';
import { initializeGame } from './engine/game';
import { sounds } from './audio/sound';
import { multiplayerClient } from './services/multiplayerClient';
import {
  SanitizedGameState,
  FriendSummary,
  LeaderboardEntry,
  BattlePassState,
  Challenge,
  UserAccount,
} from '../server/types';

const STORAGE_KEY = 'bower_jj_player_profile';

const DEFAULT_PROFILE: PlayerProfileData = {
  username: 'BowerKing',
  playerId: 'JJ-7892',
  avatarIcon: '🤠',
  level: 1,
  xp: 350,
  nextLevelXp: 1000,
  rankTier: '9',
  rankPoints: 45,
  totalGames: 12,
  wins: 9,
  losses: 3,
  tricksWon: 44,
  euchres: 8,
  marches: 6,
  successfulLoners: 2,
  currentStreak: 3,
  bestStreak: 5,
  favTrumpSuit: 'hearts',
};

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

export const App: React.FC = () => {
  const [profile, setProfile] = useState<PlayerProfileData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const [currentView, setCurrentView] = useState<'menu' | 'ai_game' | 'multiplayer_game'>('menu');
  const [activeGameState, setActiveGameState] = useState<EuchreGameState | null>(null);
  const [multiplayerState, setMultiplayerState] = useState<SanitizedGameState | null>(null);

  // Modals
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isBowerPassOpen, setIsBowerPassOpen] = useState(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [matchmakingQueue, setMatchmakingQueue] = useState<QueueType | null>(null);
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);
  const [lobbyInitialMode, setLobbyInitialMode] = useState<LobbyGameMode>('custom');
  const [isEmoteWheelOpen, setIsEmoteWheelOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState<string | undefined>();
  const [authModalInitialTab, setAuthModalInitialTab] = useState<'login' | 'register'>('register');
  const [authUser, setAuthUser] = useState<any | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Live Multiplayer & Social State
  const [friendsList, setFriendsList] = useState<FriendSummary[]>([]);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<UserAccount['friendRequests']>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [userRankPosition, setUserRankPosition] = useState<number | undefined>();
  const [battlePassState, setBattlePassState] = useState<BattlePassState | undefined>();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
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
  } | null>(null);

  // Active emotes on table: position -> emote
  const [activeEmotes, setActiveEmotes] = useState<Record<number, { text?: string; emoji?: string }>>({});

  // Synchronize full authoritative profile, lifetime statistics, and match history
  const syncAuthoritativeProfile = (userId: string) => {
    authService.fetchFullProfile(userId).then(sync => {
      if (sync) {
        setProfile(prev => ({
          ...prev,
          username: sync.profile?.username || prev.username,
          playerId: sync.profile?.id || userId,
          avatarIcon: sync.profile?.avatar_icon || prev.avatarIcon,
          level: sync.xp?.level ?? prev.level,
          xp: sync.xp?.xp ?? prev.xp,
          nextLevelXp: sync.xp?.next_level_xp ?? prev.nextLevelXp,
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
        }));
      }
    });

    authService.fetchMatchHistory(userId).then(history => {
      if (history && history.length > 0) {
        const mapped = history.map((h: any) => ({
          id: h.id,
          date: new Date(h.created_at).getTime(),
          mode: h.mode === 'ranked_solo' ? 'Ranked Solo' : h.mode === 'offline_ai' ? 'Casual AI' : h.mode,
          won: Boolean(h.won),
          score: h.score || '10 - 7',
          lpChange: h.lp_change ?? (h.won ? 20 : -15),
          opponentNames: Array.isArray(h.opponent_names) ? h.opponent_names : ['Opponents'],
        }));
        setProfile(prev => ({ ...prev, recentMatches: mapped }));
      }
    });
  };

  // 1. Restore Supabase Authentication Session & Listen to Auth Events
  useEffect(() => {
    authService.getSession().then((session) => {
      if (session?.user && session.access_token) {
        setAuthUser(session.user);
        setAuthToken(session.access_token);
        syncAuthoritativeProfile(session.user.id);

        // Reconnect/authenticate with verified access token
        multiplayerClient.connect(
          session.user.user_metadata?.username || profile.username,
          session.user.user_metadata?.avatar_icon || profile.avatarIcon,
          session.access_token
        );
      } else {
        // Unauthenticated visitor: prompt new players to register or sign in (skip if joining via direct invite)
        try {
          const hasPrompted = localStorage.getItem('bower_jj_auth_prompted');
          const isDirectInvite = Boolean(extractInviteCodeFromUrl());
          if (!hasPrompted && !isDirectInvite) {
            setTimeout(() => {
              setAuthModalInitialTab('register');
              setAuthModalReason('Create a free account or sign in to track your competitive rank, battle pass, and match history!');
              setIsAuthOpen(true);
            }, 600);
          }
        } catch {}
      }
    });

    const unsubscribe = authService.onAuthStateChange((session, user) => {
      if (session && user) {
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
      } else {
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

    multiplayerClient.setCallbacks({
      onAuth: (user) => {
        setProfile(prev => {
          const resolvedPlayerId = authUser?.id || user.id || prev.playerId;
          const resolvedRankTier = (authUser?.id && prev.rankTier !== '9')
            ? prev.rankTier
            : ((user.rankTier as RankTier) || prev.rankTier);
          const resolvedRankPoints = (authUser?.id && prev.rankPoints > 0 && user.rankPoints === 0)
            ? prev.rankPoints
            : (typeof user.rankPoints === 'number' ? user.rankPoints : prev.rankPoints);
          const resolvedWins = (authUser?.id && prev.wins > 0 && user.wins === 0)
            ? prev.wins
            : (typeof user.wins === 'number' ? user.wins : prev.wins);
          const resolvedLosses = (authUser?.id && prev.losses > 0 && user.losses === 0)
            ? prev.losses
            : (typeof user.losses === 'number' ? user.losses : prev.losses);
          const resolvedTotalGames = (authUser?.id && prev.totalGames > 0 && user.totalGames === 0)
            ? prev.totalGames
            : (typeof user.totalGames === 'number' ? user.totalGames : prev.totalGames);

          return {
            ...prev,
            username: user.username || prev.username,
            avatarIcon: user.avatarIcon || prev.avatarIcon,
            playerId: resolvedPlayerId,
            level: (authUser?.id && prev.level > user.level) ? prev.level : (user.level || prev.level),
            xp: (authUser?.id && prev.xp > user.xp) ? prev.xp : (typeof user.xp === 'number' ? user.xp : prev.xp),
            rankTier: resolvedRankTier,
            rankPoints: resolvedRankPoints,
            wins: resolvedWins,
            losses: resolvedLosses,
            totalGames: resolvedTotalGames,
            tricksWon: typeof user.tricksWon === 'number' && user.tricksWon > 0 ? user.tricksWon : prev.tricksWon,
            euchres: typeof user.euchres === 'number' && user.euchres > 0 ? user.euchres : prev.euchres,
            marches: typeof user.marches === 'number' && user.marches > 0 ? user.marches : prev.marches,
            successfulLoners: typeof user.successfulLoners === 'number' && user.successfulLoners > 0 ? user.successfulLoners : prev.successfulLoners,
            currentStreak: typeof user.winStreak === 'number' ? user.winStreak : prev.currentStreak,
            bestStreak: typeof user.bestWinStreak === 'number' ? user.bestWinStreak : prev.bestStreak,
          };
        });
        if (user.battlePass) setBattlePassState(user.battlePass);
        if (user.challenges) setChallenges(user.challenges);
      },
      onRoom: (room) => {
        // When receiving a room update while on menu, bring player into the unified lobby!
        if (room.status === 'lobby') {
          setLobbyInitialMode(room.queueMode === 'rivals' ? 'rivals' : 'custom');
          setIsLobbyOpen(true);
          setMatchmakingQueue(null);
        }
      },
      onGameSync: (serverGameState) => {
        setMultiplayerState(serverGameState);
        setCurrentView('multiplayer_game');
        setIsLobbyOpen(false);
        setMatchmakingQueue(null);

        // Record multiplayer match outcome upon game over (idempotent per room)
        if (serverGameState.phase === 'game_over' && serverGameState.roomId) {
          if (lastRecordedGameOverRoomRef.current !== serverGameState.roomId) {
            lastRecordedGameOverRoomRef.current = serverGameState.roomId;

            const myTeam = serverGameState.yourPosition % 2;
            const oppTeam = (serverGameState.yourPosition + 1) % 2;
            const myScore = serverGameState.scores[myTeam] || 0;
            const oppScore = serverGameState.scores[oppTeam] || 0;
            const won = myScore >= 10;
            const oppSlots = serverGameState.slots.filter(s => s.position % 2 !== myTeam);
            const oppNames = oppSlots.map(s => s.username || `Player ${s.position}`);
            const modeLabel = serverGameState.queueMode === 'rivals' ? 'Rivals' : 'Ranked Solo';

            const mpMatchItem: MatchHistoryItem = {
              id: `match_${serverGameState.roomId}_${Date.now()}`,
              date: Date.now(),
              mode: modeLabel,
              won,
              score: `${myScore} - ${oppScore}`,
              lpChange: won ? 25 : -16,
              opponentNames: oppNames.length > 0 ? oppNames : ['Opponents'],
            };

            setProfile(prev => ({
              ...prev,
              wins: won ? prev.wins + 1 : prev.wins,
              losses: won ? prev.losses : prev.losses + 1,
              totalGames: prev.totalGames + 1,
              recentMatches: [mpMatchItem, ...(prev.recentMatches || [])].slice(0, 30),
            }));

            if (authUser?.id) {
              authService.recordOfflineMatch(authUser.id, won, {
                tricksWon: serverGameState.tricksWon[myTeam],
                score: `${myScore} - ${oppScore}`,
                mode: serverGameState.queueMode === 'rivals' ? 'ranked_rivals' : 'ranked_solo',
                opponentNames: oppNames,
              }).then(() => {
                syncAuthoritativeProfile(authUser.id);
              });
            }
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
      onBattlePass: (bp, chs) => {
        setBattlePassState(bp);
        setChallenges(chs);
      },
      onRankUpdate: (update) => {
        setProfile(prev => ({
          ...prev,
          rankTier: update.newTier,
          rankPoints: update.newPoints,
        }));

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
        console.warn('Multiplayer notice:', msg);
      },
    });
  }, [profile.username, profile.avatarIcon]);

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

  // Handle first time tutorial trigger
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('bower_jj_tutorial_seen');
    const hasPromptedAuth = localStorage.getItem('bower_jj_auth_prompted');
    // If auth modal is about to prompt a brand new user, let auth finish first; NEVER prompt logged in users
    if (!hasSeenTutorial && hasPromptedAuth && !authUser) {
      setIsTutorialOpen(true);
    }
  }, [authUser]);

  const handleTutorialComplete = () => {
    localStorage.setItem('bower_jj_tutorial_seen', 'true');
    setIsTutorialOpen(false);
  };

  const handleAuthDismissOrContinue = () => {
    setIsAuthOpen(false);
    try {
      localStorage.setItem('bower_jj_auth_prompted', 'true');
    } catch {}
    // If logged in, do not prompt tutorial
    if (authUser) {
      try {
        localStorage.setItem('bower_jj_tutorial_seen', 'true');
      } catch {}
      return;
    }
    const hasSeenTutorial = localStorage.getItem('bower_jj_tutorial_seen');
    if (!hasSeenTutorial) {
      setTimeout(() => setIsTutorialOpen(true), 350);
    }
  };

  const handleOpenMatchmaking = (queue: QueueType) => {
    if (queue === 'private') {
      setLobbyInitialMode('custom');
      setIsLobbyOpen(true);
      return;
    }
    if (!authUser && (queue === 'ranked_solo' || queue === 'ranked_duo')) {
      const hasPromptedRanked = sessionStorage.getItem('bower_jj_ranked_prompted');
      if (!hasPromptedRanked) {
        sessionStorage.setItem('bower_jj_ranked_prompted', 'true');
        setAuthModalInitialTab('register');
        setAuthModalReason('Ranked Queue records your MMR & Global Leaderboard rank! Sign in or register to save your progression.');
        setIsAuthOpen(true);
        return;
      }
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
    setProfile(DEFAULT_PROFILE);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    showToast('You have been signed out. Active in offline guest mode.', 'Signed Out');
  };

  // Launch Local AI Match
  const handleStartAIMatch = (difficulty: AIDifficulty, rules: EuchreHouseRules) => {
    const players: Player[] = [
      {
        id: 'p0',
        name: profile.username,
        position: 0,
        isAI: false,
        avatarId: profile.avatarIcon,
        rankTier: profile.rankTier,
      },
      {
        id: 'p1',
        name: 'West (Bot)',
        position: 1,
        isAI: true,
        aiDifficulty: difficulty,
        avatarId: '🤖',
      },
      {
        id: 'p2',
        name: 'Partner (Bot)',
        position: 2,
        isAI: true,
        aiDifficulty: difficulty,
        avatarId: '🧝',
      },
      {
        id: 'p3',
        name: 'East (Bot)',
        position: 3,
        isAI: true,
        aiDifficulty: difficulty,
        avatarId: '👽',
      },
    ];

    const initialGame = initializeGame(players, rules, 0);
    setActiveGameState(initialGame);
    setCurrentView('ai_game');
  };

  // Handle AI Match Completion (Offline stats & progression)
  const handleAIMatchComplete = (
    won: boolean,
    userScore: number,
    oppScore: number,
    stats?: { tricksWon?: number; euchres?: number; marches?: number; successfulLoners?: number }
  ) => {
    setProfile(prev => {
      const nextWins = won ? prev.wins + 1 : prev.wins;
      const nextLosses = won ? prev.losses : prev.losses + 1;
      const nextGames = prev.totalGames + 1;
      const earnedXp = won ? 150 : 50;
      const totalXp = prev.xp + earnedXp;
      const levelUp = totalXp >= prev.nextLevelXp;
      const nextLevel = levelUp ? prev.level + 1 : prev.level;
      const nextLevelXp = levelUp ? prev.nextLevelXp + 1000 : prev.nextLevelXp;
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
        lpChange: won ? 20 : -15,
        opponentNames: ['BowerAI North', 'BowerAI East', 'BowerAI West'],
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
      authService.recordOfflineMatch(authUser.id, won, {
        tricksWon: stats?.tricksWon,
        euchres: stats?.euchres,
        marches: stats?.marches,
        successfulLoners: stats?.successfulLoners,
        score: `${userScore} - ${oppScore}`,
      }).then(() => {
        syncAuthoritativeProfile(authUser.id);
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
    setProfile(p => ({ ...p, avatarIcon: avatar }));
    multiplayerClient.connect(profile.username, avatar);
  };

  const handleUpdateUsername = (name: string) => {
    setProfile(p => ({ ...p, username: name }));
    multiplayerClient.connect(name, profile.avatarIcon);
  };

  const handleUpdateCosmetic = (category: 'hat' | 'cardBack' | 'banner' | 'title', id: string) => {
    setProfile(prev => ({
      ...prev,
      equippedCosmetics: {
        ...(prev.equippedCosmetics || {}),
        [category]: id,
      },
    }));
    multiplayerClient.equipCosmetic(category, id);
  };

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
            <span className="text-2xl">{partyInvite.fromAvatar}</span>
            <div>
              <div className="text-xs font-black text-white">{partyInvite.fromUsername}</div>
              <div className="text-[10px] text-cyan-300">Challenged you to Friendly Rivalry match!</div>
            </div>
          </div>
          <div className="flex space-x-2 pt-1">
            <button
              onClick={() => {
                const code = partyInvite.roomCode;
                const mode: LobbyGameMode = partyInvite.mode === 'rivals' ? 'rivals' : 'custom';
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
              onClick={() => setPartyInvite(null)}
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
          initialState={activeGameState}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenTutorial={() => setIsTutorialOpen(true)}
          onOpenEmotes={() => setIsEmoteWheelOpen(true)}
          activeEmotes={activeEmotes}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onExitGame={() => {
            if (authUser?.id) syncAuthoritativeProfile(authUser.id);
            setCurrentView('menu');
          }}
          onMatchComplete={handleAIMatchComplete}
        />
      ) : currentView === 'multiplayer_game' && multiplayerState ? (
        <MultiplayerGameTable
          serverState={multiplayerState}
          profile={profile}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenTutorial={() => setIsTutorialOpen(true)}
          onOpenEmotes={() => setIsEmoteWheelOpen(true)}
          activeEmotes={activeEmotes}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onExitGame={() => {
            multiplayerClient.leaveQueue();
            setMultiplayerState(null);
            setCurrentView('menu');
            if (authUser?.id) {
              syncAuthoritativeProfile(authUser.id);
            }
          }}
        />
      ) : (
        <MainMenu
          profile={profile}
          onStartAIMatch={handleStartAIMatch}
          onOpenMatchmaking={handleOpenMatchmaking}
          onOpenTutorial={() => setIsTutorialOpen(true)}
          onOpenRules={() => setIsRulesOpen(true)}
          onOpenProfile={() => {
            if (authUser?.id) syncAuthoritativeProfile(authUser.id);
            setIsProfileOpen(true);
          }}
          onOpenFriends={() => {
            multiplayerClient.fetchFriends();
            setIsFriendsOpen(true);
          }}
          onOpenLeaderboard={() => {
            if (authUser?.id) syncAuthoritativeProfile(authUser.id);
            authService.getLeaderboard().then(entries => setLeaderboardEntries(entries));
            multiplayerClient.fetchLeaderboard();
            setIsLeaderboardOpen(true);
          }}
          onOpenBowerPass={() => setIsBowerPassOpen(true)}
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
      />

      <FriendsModal
        isOpen={isFriendsOpen}
        onClose={() => setIsFriendsOpen(false)}
        friends={friendsList}
        incomingRequests={incomingFriendRequests}
        onInviteToParty={() => {
          showToast('Invited friend to party!');
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
      />

      <BowerPassModal
        isOpen={isBowerPassOpen}
        onClose={() => setIsBowerPassOpen(false)}
        battlePass={battlePassState}
        challenges={challenges}
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

      {/* Cloud Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={handleAuthDismissOrContinue}
        initialTab={authModalInitialTab}
        reason={authModalReason}
        onAuthSuccess={(user, token) => {
          setAuthUser(user);
          if (token) setAuthToken(token);
          if (user?.id) syncAuthoritativeProfile(user.id);
          handleAuthDismissOrContinue();
          showToast(`Signed in as ${user.user_metadata?.username || user.email}. Cloud sync active.`, 'Welcome Back!');
        }}
        onContinueAsGuest={() => {
          handleAuthDismissOrContinue();
          showToast('Playing locally as guest. Progression is stored on this device.', 'Guest Mode Active');
        }}
      />
    </div>
  );
};
export default App;
