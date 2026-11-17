/**
 * BOWER JJ — Live Authoritative Multiplayer Card Table
 * Powered by real-time WebSockets with Hand Privacy Anti-Cheat.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SanitizedGameState, PlayerSlot, RankTier } from '../../server/types';
import { Card, Suit, PlayerPosition, getPlayerTeam, getPlayerPartner } from '../engine/types';
import { getWinningTeam, isCanadianLonerForced, isHandCardInteractive } from '../engine/game';
import { isCardPlayLegal, formatCardName, sortCardsBySuit, ALL_SUITS } from '../engine/cards';
import { CardView, SuitIcon } from './CardView';
import { TrumpBanner, MakerBadge } from './TrumpBanner';
import {
  DealerAvatarBadge,
  DealerDeckStack,
  LeadSuitBadge,
  ModalDealerBanner,
  GoAloneControl,
  TurnActiveDot,
  CenterKittyDisplay,
  TurnedDownNoticeChip,
  TrickProgressStrip,
  isActiveDecisionPhase,
} from './BiddingModalHelpers';
import { AudioControlsPopover } from './AudioControlsPopover';
import { PostMatchModal } from './PostMatchModal';
import { PublicProfileModal, PublicPlayerData } from './PublicProfileModal';
import { PlayerProfileData } from './ProfileModal';
import { AvatarPortrait } from './AvatarPortrait';
import { resolveAvatarId, resolveCardBackId, getTableFeltDefinition } from '../config/collectiblesCatalog';
import { sounds } from '../audio/sound';
import { multiplayerClient } from '../services/multiplayerClient';
import confetti from 'canvas-confetti';
import {
  MessageSquare,
  Volume2,
  VolumeX,
  HelpCircle,
  Sparkles,
  Shield,
  Wifi,
  WifiOff,
  Zap,
  AlertTriangle,
  ArrowUpDown,
} from 'lucide-react';

interface MultiplayerGameTableProps {
  serverState: SanitizedGameState;
  profile?: PlayerProfileData;
  lastRankUpdate?: {
    oldTier: RankTier;
    newTier: RankTier;
    oldPoints: number;
    newPoints: number;
    lpChange: number;
  } | null;
  onOpenRules: () => void;
  onOpenTutorial: () => void;
  onOpenEmotes: () => void;
  activeEmotes: Record<number, { text?: string; emoji?: string }>;
  isMuted: boolean;
  onToggleMute: () => void;
  onPlayAgain?: () => void;
  onExitGame: (forfeit?: boolean) => void;
}

function formatRelativeHandMessage(message: string, myTeam: 0 | 1): string {
  if (!message) return '';
  const team0Label = myTeam === 0 ? 'Your Team' : 'Opponents';
  const team1Label = myTeam === 1 ? 'Your Team' : 'Opponents';
  return message
    .replace(/Team Blue/g, team0Label)
    .replace(/Team Red/g, team1Label)
    .replace(/Team 0/g, team0Label)
    .replace(/Team 1/g, team1Label);
}

export const MultiplayerGameTable: React.FC<MultiplayerGameTableProps> = ({
  serverState,
  profile,
  lastRankUpdate,
  onOpenRules,
  onOpenTutorial,
  onOpenEmotes,
  activeEmotes,
  isMuted,
  onToggleMute,
  onPlayAgain,
  onExitGame,
}) => {
  const [aloneToggle, setAloneToggle] = useState(false);
  const [inspectedPlayer, setInspectedPlayer] = useState<PublicPlayerData | null>(null);
  const [mutedUsernames, setMutedUsernames] = useState<Set<string>>(new Set());
  const [isLocallyReadyForNextHand, setIsLocallyReadyForNextHand] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState<boolean>(false);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number>(15);
  const turnStartTimeRef = useRef<number>(Date.now());
  const [autoSortBySuit, setAutoSortBySuit] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('bower_jj_auto_sort_by_suit');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const toggleAutoSort = () => {
    const next = !autoSortBySuit;
    setAutoSortBySuit(next);
    sounds.playUiClick();
    try {
      localStorage.setItem('bower_jj_auto_sort_by_suit', String(next));
    } catch {}
  };

  const displayHand = useMemo(() => {
    if (autoSortBySuit) {
      return sortCardsBySuit(serverState.yourHand || [], serverState.trumpSuit);
    }
    return serverState.yourHand || [];
  }, [serverState.yourHand, serverState.trumpSuit, autoSortBySuit]);

  useEffect(() => {
    const unsubscribe = multiplayerClient.setCallbacks({
      onProfile: (playerData) => {
        setInspectedPlayer((prev) => (prev ? playerData : null));
      },
    });
    return () => unsubscribe();
  }, []);

  // Reset ready state whenever a new hand starts
  useEffect(() => {
    if (serverState.phase !== 'hand_scored') {
      setIsLocallyReadyForNextHand(false);
    }
  }, [serverState.phase]);

  // Reset "Go Alone!" checkbox when leaving bidding or when a new hand is dealt
  useEffect(() => {
    if (serverState.phase !== 'bidding_round_1' && serverState.phase !== 'bidding_round_2') {
      setAloneToggle(false);
    }
  }, [serverState.phase, serverState.dealer]);

  // 15-Second Radial Turn Countdown Timer
  useEffect(() => {
    if (isActiveDecisionPhase(serverState.phase)) {
      setTurnSecondsLeft(15);
      turnStartTimeRef.current = Date.now();
    }
  }, [serverState.currentTurn, serverState.phase, serverState.currentTrick?.cards?.length]);

  useEffect(() => {
    if (!isActiveDecisionPhase(serverState.phase) || serverState.phase === 'game_over' || serverState.phase === 'trick_resolving') {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - turnStartTimeRef.current) / 1000;
      const remaining = Math.max(0, 15 - elapsed);
      setTurnSecondsLeft(remaining);

      // Auto-play when 15 seconds expire on your turn in multiplayer
      if (remaining <= 0) {
        clearInterval(interval);
        if (serverState.currentTurn === serverState.yourPosition) {
          if (serverState.phase === 'playing') {
            const hand = serverState.yourHand || [];
            const plays = hand.filter((c) =>
              isCardPlayLegal(c, hand, serverState.currentTrick, serverState.trumpSuit)
            );
            if (plays.length > 0) {
              multiplayerClient.playCard(plays[0].id);
            }
          } else if (serverState.phase === 'bidding_round_1') {
            multiplayerClient.bid('pass', undefined, false);
          } else if (serverState.phase === 'bidding_round_2') {
            multiplayerClient.bid('pass', undefined, false);
          } else if (serverState.phase === 'dealer_discard' && serverState.dealer === serverState.yourPosition) {
            const hand = serverState.yourHand || [];
            if (hand.length > 0) {
              multiplayerClient.discard(hand[0].id);
            }
          }
        }
      }
    }, 120);

    return () => clearInterval(interval);
  }, [
    serverState.currentTurn,
    serverState.phase,
    serverState.yourHand,
    serverState.trumpSuit,
    serverState.currentTrick?.leadSuit,
    serverState.yourPosition,
    serverState.dealer,
  ]);

  // Hand tray horizontal scroll and drag-to-pan handlers (allows moving cards back and forth on mobile)
  const handScrollRef = useRef<HTMLDivElement>(null);
  const isDraggingHandRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartXRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const dragResetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTrayMouseDown = (e: React.MouseEvent) => {
    if (!handScrollRef.current) return;
    isDraggingHandRef.current = true;
    hasDraggedRef.current = false;
    dragStartXRef.current = e.clientX;
    scrollStartXRef.current = handScrollRef.current.scrollLeft;
  };

  const handleTrayMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingHandRef.current || !handScrollRef.current) return;
    const delta = e.clientX - dragStartXRef.current;
    if (Math.abs(delta) > 5) {
      hasDraggedRef.current = true;
    }
    handScrollRef.current.scrollLeft = scrollStartXRef.current - delta;
  };

  const handleTrayMouseUp = () => {
    isDraggingHandRef.current = false;
    if (dragResetTimerRef.current) clearTimeout(dragResetTimerRef.current);
    dragResetTimerRef.current = setTimeout(() => {
      hasDraggedRef.current = false;
    }, 120);
  };

  const handleTrayTouchStart = (e: React.TouchEvent) => {
    if (!handScrollRef.current) return;
    hasDraggedRef.current = false;
    dragStartXRef.current = e.touches[0].clientX;
  };

  const handleTrayTouchMove = (e: React.TouchEvent) => {
    const delta = Math.abs(e.touches[0].clientX - dragStartXRef.current);
    if (delta > 8) {
      hasDraggedRef.current = true;
    }
  };

  const handleTrayTouchEnd = () => {
    if (dragResetTimerRef.current) clearTimeout(dragResetTimerRef.current);
    dragResetTimerRef.current = setTimeout(() => {
      hasDraggedRef.current = false;
    }, 120);
  };

  const yourPos = serverState.yourPosition;
  const yourTeam = yourPos % 2;
  const targetScore = serverState.rules?.targetScore ?? 10;
  const winningTeam = serverState.winningTeam ?? getWinningTeam(serverState.scores, targetScore);
  const isVictory = winningTeam === yourTeam;
  const isYourTurn = serverState.currentTurn === yourPos;
  const isDealer = serverState.dealer === yourPos;
  const isPartnerOfDealer = serverState.dealer === getPlayerPartner(yourPos);
  const allowAloneCalls = serverState.rules?.allowAloneCalls ?? true;
  const stickTheDealer = serverState.rules?.stickTheDealer ?? true;
  const forcesCanadianLoner = isCanadianLonerForced(serverState.rules, isPartnerOfDealer);
  const isDealerDiscardPhase = serverState.phase === 'dealer_discard' && isDealer;
  const isBenched = serverState.benchedPlayer === yourPos;
  const isTrickResolving = serverState.phase === 'trick_resolving';

  // Smoothly ensure hand starts at beginning when picking up card / dealer discard begins
  useEffect(() => {
    if (isDealerDiscardPhase && handScrollRef.current) {
      handScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [isDealerDiscardPhase]);

  // Helper to map absolute seat position (0, 1, 2, 3) to relative UI placement:
  // 0 offset = Bottom (You)
  // 1 offset = Left
  // 2 offset = Top (Partner)
  // 3 offset = Right
  const getRelativePosition = (pos: PlayerPosition): 'bottom' | 'left' | 'top' | 'right' => {
    const diff = (pos - yourPos + 4) % 4;
    switch (diff) {
      case 0: return 'bottom';
      case 1: return 'left';
      case 2: return 'top';
      case 3: return 'right';
    }
    return 'bottom';
  };

  const getSlot = (pos: PlayerPosition): PlayerSlot | undefined => {
    return serverState.slots?.find(s => s.position === pos);
  };

  const dealerSlot = getSlot(serverState.dealer);
  const dealerName = isDealer ? 'You' : dealerSlot?.username || `Seat ${serverState.dealer}`;

  const renderPlayerPod = (pos: PlayerPosition, customStyle?: string) => {
    const slot = getSlot(pos);
    const relPos = getRelativePosition(pos);
    const isCurrentTurn = serverState.currentTurn === pos && isActiveDecisionPhase(serverState.phase);
    const isPlayerDealer = serverState.dealer === pos;
    const isTrumpCaller = serverState.trumpSuit !== undefined && serverState.callingPlayer === pos;
    const isSlotBenched = serverState.benchedPlayer === pos;
    const myTeam = getPlayerTeam(serverState.yourPosition);
    const isTeammate = getPlayerTeam(pos) === myTeam;
    const cardCount = serverState.handCounts?.[pos] || 0;
    const emote = activeEmotes[pos];

    const positionStyle = customStyle || {
      bottom: 'bottom-1.5 sm:bottom-2.5 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-28 md:left-32 lg:left-36',
      left: 'left-1 sm:left-3 top-1/2 -translate-y-1/2',
      top: 'top-1.5 sm:top-3 left-1/2 -translate-x-1/2',
      right: 'right-1 sm:right-3 top-1/2 -translate-y-1/2',
    }[relPos];

    const isMutedPlayer = slot ? mutedUsernames.has(slot.username) : false;

    return (
      <div className={`absolute ${positionStyle} flex flex-col items-center z-20 pointer-events-auto`}>
        {/* Floating Emote */}
        {emote && !isMutedPlayer && (
          <div className="mb-1 px-3 py-1 bg-slate-900 border-2 border-amber-400 text-white text-xs font-bold rounded-2xl shadow-xl animate-bounce">
            {emote.emoji || emote.text}
          </div>
        )}

        {(() => {
          const isMe = Boolean(slot && slot.position === serverState.yourPosition && profile);
          const podAvatar = slot ? resolveAvatarId(isMe ? (profile?.avatarIcon || slot.avatarIcon) : slot.avatarIcon) : undefined;
          const podCardBack = resolveCardBackId(isMe ? (profile?.equippedCosmetics?.cardBack || slot?.equippedCardBack) : slot?.equippedCardBack);
          const isHorizontalSeat = relPos === 'top' || relPos === 'bottom';
          const fannedHand = pos !== yourPos && !isSlotBenched && cardCount > 0 ? (
            <div
              className={`flex items-center justify-center -space-x-6 scale-75 ${
                relPos === 'top' ? 'sm:scale-90 origin-right' : 'sm:scale-95 origin-top'
              } pointer-events-none`}
            >
              {Array.from({ length: Math.min(cardCount, 5) }).map((_, idx, arr) => {
                const mid = (arr.length - 1) / 2;
                const rot = (idx - mid) * 7;
                return (
                  <div key={idx} style={{ transform: `rotate(${rot}deg)` }} className="drop-shadow-md">
                    <CardView isFacedown size="xs" cardBackSkin={podCardBack} />
                  </div>
                );
              })}
            </div>
          ) : null;

          const avatarAndName = (
            <div className="flex flex-col items-center">
              <div
                onClick={() => {
                  if (slot) {
                    sounds.playUiClick();
                    setInspectedPlayer({
                      id: slot.userId || `bot_${slot.username}`,
                      username: slot.username,
                      avatarIcon: podAvatar || slot.avatarIcon,
                      level: isMe ? (profile?.level ?? 1) : (slot.isAI ? 8 : 1),
                      rankTier: isMe ? ((profile?.rankTier as RankTier) || slot.rankTier || '9') : (slot.rankTier || '9'),
                      rankPoints: isMe ? (profile?.rankPoints ?? 0) : 50,
                      totalGames: isMe ? (profile?.totalGames ?? 0) : (slot.isAI ? 120 : 15),
                      wins: isMe ? (profile?.wins ?? 0) : (slot.isAI ? 68 : 9),
                      losses: isMe ? (profile?.losses ?? 0) : (slot.isAI ? 52 : 6),
                      bestStreak: isMe ? (profile?.bestStreak ?? 0) : 4,
                      isFriend: false,
                      isOnline: slot.connected,
                      equippedCosmetics: {
                        cardBack: podCardBack,
                      },
                    });
                    if (slot.userId && !slot.isAI) {
                      multiplayerClient.fetchProfile(slot.userId, slot.username);
                    }
                  }
                }}
                title={slot ? `Inspect ${slot.username}` : undefined}
                className="relative cursor-pointer hover:scale-105 active:scale-95 transition-transform"
              >
                <div
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl p-0.5 transition-all duration-300 flex items-center justify-center relative
                    ${isTeammate ? 'bg-gradient-to-tr from-cyan-600 to-sky-400' : 'bg-gradient-to-tr from-rose-600 to-amber-500'}
                    ${isCurrentTurn ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-900 scale-105 shadow-lg shadow-amber-400/50' : isPlayerDealer ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-500/30' : 'opacity-90'}
                    ${isSlotBenched ? 'grayscale opacity-50' : ''}`}
                >
                  {/* 15-Second Radial Turn Countdown Progress Ring */}
                  {isCurrentTurn && (
                    <div className="absolute -inset-1 sm:-inset-1.5 pointer-events-none z-20 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                        <circle
                          cx="32"
                          cy="32"
                          r="27"
                          className="stroke-slate-900/60"
                          strokeWidth="3.5"
                          fill="none"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="27"
                          className={`transition-all duration-150 ${
                            turnSecondsLeft <= 2
                              ? 'stroke-red-500 animate-pulse'
                              : turnSecondsLeft <= 5
                              ? 'stroke-amber-400'
                              : 'stroke-emerald-400'
                          }`}
                          strokeWidth="3.5"
                          strokeDasharray={169.65}
                          strokeDashoffset={169.65 * (1 - Math.max(0, turnSecondsLeft) / 15)}
                          strokeLinecap="round"
                          fill="none"
                        />
                      </svg>
                      <div
                        className={`absolute -top-2.5 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black shadow-md ${
                          turnSecondsLeft <= 2
                            ? 'bg-red-500 text-white animate-bounce'
                            : turnSecondsLeft <= 5
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-emerald-500 text-slate-950'
                        }`}
                      >
                        {Math.ceil(turnSecondsLeft)}s
                      </div>
                    </div>
                  )}

                  <div className="w-full h-full bg-slate-900 rounded-[14px] flex flex-col items-center justify-center overflow-hidden">
                    {slot ? (
                      <AvatarPortrait
                        avatarId={podAvatar}
                        size="md"
                        showRarityRing={false}
                        className="!w-full !h-full !rounded-[14px]"
                      />
                    ) : (
                      <span className="text-xl sm:text-2xl">🪑</span>
                    )}
                  </div>
                </div>

                {/* Dealer Chip */}
                {isPlayerDealer && <DealerAvatarBadge />}

                {/* Trump Maker Chip */}
                {isTrumpCaller && serverState.trumpSuit && (
                  <MakerBadge trumpSuit={serverState.trumpSuit} isUserTeam={serverState.callingTeam === myTeam} />
                )}

                {/* Online/Offline connection status */}
                {slot && !slot.isAI && (
                  <div
                    title={slot.connected ? 'Connected' : 'Disconnected'}
                    className={`absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                      slot.connected ? 'bg-emerald-400' : 'bg-red-500 animate-ping'
                    }`}
                  />
                )}

                {/* Card Count for others */}
                {pos !== yourPos && (
                  <div className="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-gray-200 shadow-sm z-10">
                    {isSlotBenched ? 'BENCH' : `${cardCount} 🂠`}
                  </div>
                )}
              </div>

              {/* Player Name */}
              <div className="mt-1 flex flex-col items-center">
                <div className="text-[11px] sm:text-xs font-bold text-white flex items-center space-x-1">
                  <span>{slot ? (pos === yourPos ? `${slot.username} (You)` : slot.username) : `Seat ${pos}`}</span>
                  {isCurrentTurn && <TurnActiveDot />}
                </div>
                {slot?.isAI && (
                  <span className="text-[9px] uppercase tracking-wider text-gray-400 font-mono">
                    AI ({slot.aiDifficulty})
                  </span>
                )}
                {!isHorizontalSeat && fannedHand && (
                  <div className="mt-0.5 sm:mt-1 h-[40px] sm:h-[52px] flex items-start justify-center pointer-events-none">
                    {fannedHand}
                  </div>
                )}
              </div>
            </div>
          );

          if (isHorizontalSeat) {
            return (
              <div className="flex items-center justify-center gap-2.5 sm:gap-4">
                {relPos === 'top' && fannedHand}
                {avatarAndName}
                {isPlayerDealer && (
                  <DealerDeckStack relativePos={relPos} cardBackSkin={podCardBack} inline />
                )}
              </div>
            );
          }

          return (
            <div className="relative flex flex-col items-center">
              {avatarAndName}
              {isPlayerDealer && (
                <DealerDeckStack relativePos={relPos} cardBackSkin={podCardBack} />
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  const trickCards = serverState.currentTrick.cards;
  const leadSuit = serverState.currentTrick.leadSuit;
  const callerSlot = serverState.callingPlayer !== undefined ? getSlot(serverState.callingPlayer) : undefined;
  const callerName = serverState.callingPlayer !== undefined
    ? (serverState.callingPlayer === yourPos ? 'You' : callerSlot?.username || `Seat ${serverState.callingPlayer}`)
    : undefined;
  const callerTeam = serverState.callingTeam ?? (serverState.callingPlayer !== undefined ? getPlayerTeam(serverState.callingPlayer) : undefined);
  const equippedFelt = getTableFeltDefinition(profile?.equippedCosmetics?.tableFelt || profile?.tableFelt);

  return (
    <div className="relative w-full h-[100dvh] bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* Top Header */}
      <header
        className="w-full px-1.5 xs:px-2.5 sm:px-3 py-1 sm:py-2 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-1 z-30 flex-shrink-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.35rem)',
          paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 0.35rem)',
          paddingRight: 'calc(env(safe-area-inset-right, 0px) + 0.35rem)',
        }}
      >
        <div className="flex items-center space-x-1 xs:space-x-1.5 sm:space-x-3 min-w-0 flex-shrink">
          <button
            onClick={() => {
              sounds.playUiClick();
              if (serverState.phase === 'game_over') {
                onExitGame(false);
              } else {
                setShowExitConfirmModal(true);
              }
            }}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-300 flex-shrink-0"
          >
            ← Exit
          </button>

          {/* Scores (Relative: Your Team vs Opponents) */}
          {(() => {
            const myTeamIdx = getPlayerTeam(serverState.yourPosition);
            const oppTeamIdx = (myTeamIdx + 1) % 2;
            const myScore = serverState.scores[myTeamIdx] || 0;
            const oppScore = serverState.scores[oppTeamIdx] || 0;
            const myTricks = serverState.tricksWon[myTeamIdx] || 0;
            const oppTricks = serverState.tricksWon[oppTeamIdx] || 0;

            return (
              <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-950 px-1.5 xs:px-2 sm:px-2.5 py-1 rounded-xl border border-slate-800 shadow-inner text-xs min-w-0 flex-shrink">
                <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-cyan-400 flex-shrink-0" />
                  <span className="font-black text-cyan-300">
                    <span className="hidden sm:inline">YOUR TEAM: </span>
                    <span className="hidden xs:inline sm:hidden">TEAM: </span>
                    {myScore}
                  </span>
                  <span className="hidden md:inline text-[10px] text-gray-400 font-mono">({myTricks} trk)</span>
                </div>
                <span className="text-gray-600 font-bold text-xs">-</span>
                <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-rose-400 flex-shrink-0" />
                  <span className="font-black text-rose-300">
                    <span className="hidden sm:inline">OPPONENTS: </span>
                    <span className="hidden xs:inline sm:hidden">OPP: </span>
                    {oppScore}
                  </span>
                  <span className="hidden md:inline text-[10px] text-gray-400 font-mono">({oppTricks} trk)</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Trump Banner (Header) */}
        {serverState.trumpSuit && (
          <TrumpBanner
            trumpSuit={serverState.trumpSuit}
            callerName={callerName}
            callerTeam={callerTeam}
            isAlone={serverState.isAlone}
            isUserTeam={callerTeam === getPlayerTeam(serverState.yourPosition)}
          />
        )}

        {/* Controls */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0 z-20">
          <button
            onClick={onOpenEmotes}
            title="Emotes"
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 flex-shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <div className="flex-shrink-0">
            <AudioControlsPopover compact />
          </div>
          <button
            onClick={() => {
              sounds.playUiClick();
              onOpenRules();
            }}
            title="Rules Compendium"
            className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-300 flex-shrink-0"
          >
            <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* Visible Mobile & Desktop Trick Counter Strip */}
      <TrickProgressStrip
        tricksWon={serverState.tricksWon}
        phase={serverState.phase}
        yourTeam={getPlayerTeam(yourPos)}
      />

      {/* Main Felt Arena (Dynamic Custom Felt or Midnight Casino) */}
      <main
        className="relative flex-1 min-h-0 flex items-center justify-center p-2 sm:p-6 overflow-hidden"
        style={{ background: equippedFelt.bgGradient }}
      >
        {/* Modern Ambient Felt Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${equippedFelt.accentHex}15 0%, ${equippedFelt.feltColor}85 50%, ${equippedFelt.vignette} 80%)`,
          }}
        />

        {/* Subtle Modern Luxury Geometric Table Seal */}
        <div className="absolute flex flex-col items-center justify-center pointer-events-none select-none">
          <div
            className="w-72 h-72 sm:w-96 sm:h-96 rounded-full border flex flex-col items-center justify-center p-6"
            style={{ borderColor: `${equippedFelt.accentHex}18` }}
          >
            <div
              className="w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center"
              style={{ borderColor: `${equippedFelt.accentHex}10` }}
            >
              <span
                className="text-2xl sm:text-4xl font-black tracking-[0.35em] uppercase font-sans"
                style={{ color: `${equippedFelt.accentHex}18` }}
              >
                BOWER JJ
              </span>
              <div
                className="flex items-center gap-2 mt-1.5 text-xs"
                style={{ color: `${equippedFelt.accentHex}18` }}
              >
                <span>♠</span>
                <span>♥</span>
                <span>♣</span>
                <span>♦</span>
              </div>
            </div>
          </div>
        </div>

        {/* All 4 Player Pods on Table Felt */}
        {[0, 1, 2, 3].map(pos => (
          <React.Fragment key={pos}>
            {renderPlayerPod(pos as PlayerPosition)}
          </React.Fragment>
        ))}

        {/* Center Trick Arena */}
        <div
          className="relative w-72 h-72 sm:w-84 sm:h-84 rounded-full border-2 backdrop-blur-xs flex items-center justify-center"
          style={{
            borderColor: `${equippedFelt.feltBorder}85`,
            backgroundColor: `${equippedFelt.feltColor}90`,
            boxShadow: `0 0 50px rgba(0,0,0,0.8), inset 0 0 35px ${equippedFelt.accentHex}12`,
          }}
        >
          {/* Turned-up Card (Round 1) / Turned-down Card (Round 2) */}
          <CenterKittyDisplay
            phase={serverState.phase}
            upCard={serverState.upCard}
            canCallTurnedDownSuit={serverState.rules?.canCallTurnedDownSuit ?? false}
          />

          {/* Lead Suit Banner */}
          {(serverState.phase === 'playing' || isTrickResolving) && leadSuit && (
            <LeadSuitBadge leadSuit={leadSuit} />
          )}

          {/* Played Cards in Trick Arena (Clamped spread so East/West cards stay completely clear of avatars!) */}
          {(serverState.phase === 'playing' || isTrickResolving) && (
            <div className="relative w-full h-full flex items-center justify-center">
              {trickCards.map(pc => {
                const relPos = getRelativePosition(pc.player);
                const slot = getSlot(pc.player);
                const isWinningCard = isTrickResolving && serverState.currentTrick.winningCard?.id === pc.card.id;

                const positionStyle = {
                  bottom: 'bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2',
                  left: 'left-12 sm:left-14 top-1/2 -translate-y-1/2',
                  top: 'top-6 sm:top-7 left-1/2 -translate-x-1/2',
                  right: 'right-12 sm:right-14 top-1/2 -translate-y-1/2',
                }[relPos];

                return (
                  <div
                    key={pc.card.id}
                    className={`absolute transition-all duration-300 flex flex-col items-center ${positionStyle} ${
                      isWinningCard ? 'scale-115 z-30' : 'z-20'
                    }`}
                  >
                    {isWinningCard && (
                      <span className="text-xs font-black text-amber-300 bg-amber-500/20 border border-amber-400 px-2 py-0.5 rounded-full mb-1 animate-bounce">
                        👑 TRICK WINNER
                      </span>
                    )}

                    <CardView
                      card={pc.card}
                      trumpSuit={serverState.trumpSuit}
                      size="sm"
                      isPlayable={false}
                      isSelected={isWinningCard}
                      playerTag={pc.player === yourPos ? 'You' : slot ? slot.username.split(' ')[0] : undefined}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Trick Resolving Banner */}
          {isTrickResolving && serverState.currentTrick.winner !== undefined && serverState.currentTrick.winningCard && (
            <div className="absolute inset-x-2 bottom-4 z-40 bg-slate-900/95 border-2 border-amber-400 rounded-2xl p-2.5 text-center shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="text-xs font-black text-amber-300 flex items-center justify-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {getSlot(serverState.currentTrick.winner)?.username || `Player ${serverState.currentTrick.winner}`} WON THE TRICK with {formatCardName(serverState.currentTrick.winningCard, serverState.trumpSuit)}!
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Human Interactive Bidding Modal (Round 1) */}
        {isYourTurn && serverState.phase === 'bidding_round_1' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pb-36 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-xs bg-slate-900 border-2 border-amber-500 rounded-3xl p-5 shadow-2xl flex flex-col items-center space-y-3">
              <div className="text-center">
                <div className="text-xs font-black text-amber-400 uppercase tracking-wider">Your Call (Round 1)</div>
                <div className="text-xs text-gray-300 mt-0.5">Turn the kitty card into Trump?</div>
              </div>

              <ModalDealerBanner
                dealerName={dealerName}
                dealerAvatar={dealerSlot?.avatarIcon}
                isSelfDealer={isDealer}
                isPartnerDealer={isPartnerOfDealer}
              />

              {serverState.upCard && (
                <div className="my-1 flex flex-col items-center p-2.5 bg-slate-950/70 rounded-2xl border border-amber-500/40 shadow-inner">
                  <CardView card={serverState.upCard} size="md" isPlayable={false} />
                </div>
              )}

              <GoAloneControl
                allowAloneCalls={allowAloneCalls}
                checked={aloneToggle}
                forcedCanadianLoner={forcesCanadianLoner}
                onChange={setAloneToggle}
                pointsLabel=" (+4 Pts)"
              />

              <div className="flex space-x-3 w-full pt-1">
                <button
                  onClick={() => {
                    sounds.playUiClick();
                    multiplayerClient.bid('pass', undefined, false);
                    setAloneToggle(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-300 transition-all active:scale-95"
                >
                  Pass
                </button>
                <button
                  onClick={() => {
                    sounds.playTrumpCall();
                    multiplayerClient.bid(isDealer ? 'pick_up' : 'order_up', undefined, aloneToggle || forcesCanadianLoner);
                    setAloneToggle(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 transition-all active:scale-95"
                >
                  {isDealer ? 'Pick Up' : forcesCanadianLoner ? 'Order Up Alone 🚀' : 'Order Up'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Human Interactive Bidding Modal (Round 2) */}
        {isYourTurn && serverState.phase === 'bidding_round_2' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pb-36 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500 rounded-3xl p-5 shadow-2xl flex flex-col items-center space-y-3">
              <div className="text-center">
                <div className="text-xs font-black text-amber-400 uppercase tracking-wider">Your Call (Round 2)</div>
                <div className="text-xs text-gray-300 mt-0.5">Select a new trump suit:</div>
              </div>

              <ModalDealerBanner
                dealerName={dealerName}
                dealerAvatar={dealerSlot?.avatarIcon}
                isSelfDealer={isDealer}
                isPartnerDealer={isPartnerOfDealer}
              />

              <TurnedDownNoticeChip
                upCard={serverState.upCard}
                canCallTurnedDownSuit={serverState.rules?.canCallTurnedDownSuit ?? false}
              />

              <GoAloneControl
                allowAloneCalls={allowAloneCalls}
                checked={aloneToggle}
                onChange={setAloneToggle}
                pointsLabel=""
              />

              <div className="grid grid-cols-3 gap-2 w-full">
                {ALL_SUITS.filter(s => s !== serverState.upCard?.suit).map(suit => (
                  <button
                    key={suit}
                    onClick={() => {
                      sounds.playTrumpCall();
                      multiplayerClient.bid('call_trump', suit, aloneToggle);
                      setAloneToggle(false);
                    }}
                    className="py-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 border border-slate-700 font-black text-sm flex items-center justify-center space-x-1.5 transition-all active:scale-95 group"
                  >
                    <SuitIcon suit={suit} className="w-4 h-4" />
                    <span className="capitalize text-xs group-hover:text-slate-950">{suit}</span>
                  </button>
                ))}
              </div>

              {!(isDealer && stickTheDealer) ? (
                <button
                  onClick={() => {
                    sounds.playUiClick();
                    multiplayerClient.bid('pass', undefined, false);
                    setAloneToggle(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-400"
                >
                  Pass
                </button>
              ) : (
                <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                  Stick The Dealer: You must name a trump!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dealer Discard Prompt */}
        {isDealerDiscardPhase ? (
          <div className="absolute top-16 z-40 bg-amber-500 text-slate-950 px-4 py-2 rounded-2xl shadow-2xl font-black text-xs animate-bounce flex items-center space-x-2 text-center max-w-md mx-2">
            <span>👇</span>
            <span>
              {isBenched
                ? 'Partner Ordered You Up Alone! Tap 1 card below to discard to the kitty before sitting out.'
                : 'Dealer Discard: Tap 1 card from your hand below to discard it to the kitty!'}
            </span>
          </div>
        ) : isBenched ? (
          <div className="absolute top-16 z-40 bg-cyan-950/90 border-2 border-cyan-400 text-cyan-200 px-4 py-2 rounded-2xl shadow-2xl font-bold text-xs text-center mx-2">
            🚀 Your partner is GOING ALONE! You sit this hand out.
          </div>
        ) : null}

        {/* Hand Scored Overlay */}
        {serverState.phase === 'hand_scored' && serverState.lastHandResult && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4">
              <div className="text-4xl">
                {serverState.lastHandResult.isMarch ? '🏆' : serverState.lastHandResult.isEuchre ? '🔥' : '✨'}
              </div>

              <div>
                <h3 className="text-xl font-black text-white">
                  {serverState.lastHandResult.isMarch
                    ? serverState.lastHandResult.calledAlone ? 'SOLO MARCH!' : 'MARCH!'
                    : serverState.lastHandResult.isEuchre
                    ? 'EUCHRED!'
                    : 'HAND COMPLETED'}
                </h3>
                <p className="text-xs text-amber-300 font-semibold mt-1">
                  {formatRelativeHandMessage(serverState.lastHandResult.message, getPlayerTeam(serverState.yourPosition))}
                </p>
              </div>

              {(() => {
                const myTeamIdx = getPlayerTeam(serverState.yourPosition);
                const oppTeamIdx = (myTeamIdx + 1) % 2;
                const myScore = serverState.scores[myTeamIdx] || 0;
                const oppScore = serverState.scores[oppTeamIdx] || 0;

                const readyList = serverState.readyForNextHand || [];
                const isReady =
                  isLocallyReadyForNextHand ||
                  Boolean(profile?.playerId && readyList.includes(profile.playerId)) ||
                  Boolean(profile?.username && readyList.includes(profile.username));
                const readyCount = Math.max(isReady ? 1 : 0, readyList.length);

                return (
                  <>
                    <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700 flex justify-around items-center">
                      <div>
                        <div className="text-xs font-bold text-cyan-300">Your Team</div>
                        <div className="text-2xl font-black text-white">{myScore}</div>
                      </div>
                      <div className="text-xs text-gray-500 font-bold">vs</div>
                      <div>
                        <div className="text-xs font-bold text-rose-300">Opponents</div>
                        <div className="text-2xl font-black text-white">{oppScore}</div>
                      </div>
                    </div>

                    {/* All Seated Players Ready Status Indicator */}
                    <div className="py-1">
                      <div className="text-[11px] font-bold text-slate-400 mb-1">
                        All players must click Deal Next Hand before next deal:
                      </div>
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {serverState.slots.map((slot, idx) => {
                          if (!slot) return null;
                          const isSlotReady =
                            slot.isAI ||
                            readyList.includes(slot.userId || slot.username) ||
                            (idx === serverState.yourPosition && isReady);
                          return (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isSlotReady
                                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                                  : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isSlotReady ? 'bg-emerald-400' : 'bg-slate-500'
                                }`}
                              />
                              <span>{idx === serverState.yourPosition ? 'You' : slot.username}</span>
                              <span>{isSlotReady ? '✓' : '⏳'}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {!isReady ? (
                      <button
                        onClick={() => {
                          sounds.playDealCard();
                          setIsLocallyReadyForNextHand(true);
                          multiplayerClient.nextHand();
                        }}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span>Deal Next Hand →</span>
                      </button>
                    ) : (
                      <div className="w-full py-3.5 rounded-2xl bg-slate-800/90 border border-amber-400/50 text-amber-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-inner">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>Ready! Waiting for all players ({readyCount}/4)...</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Post-Match Progression & Accolades Screen */}
        {serverState.phase === 'game_over' && (() => {
          const isRankedMatch =
            serverState.queueMode === 'solo' ||
            serverState.queueMode === 'duo' ||
            (Boolean(serverState.isMatchmade || multiplayerClient.getCurrentRoom()?.isMatchmade) &&
              serverState.queueMode !== 'casual' &&
              serverState.queueMode !== 'custom' &&
              serverState.queueMode !== 'rivals');

          const matchTypeLabel = isRankedMatch
            ? 'Ranked Solo Queue'
            : serverState.queueMode === 'casual'
            ? 'Casual Unranked (No Rank Risk)'
            : serverState.queueMode === 'rivals'
            ? 'Friendly Rivalry (No Rank Risk)'
            : 'Private Custom Room (No Rank Risk)';

          const effectiveLpDelta = isRankedMatch
            ? (lastRankUpdate?.lpChange ?? (isVictory ? 24 : -16))
            : 0;

          return (
            <PostMatchModal
              isOpen={true}
              isVictory={isVictory}
              finalScore={serverState.scores}
              tricksWon={serverState.matchStats?.teamTricksWon?.[yourTeam] ?? serverState.tricksWon[yourTeam]}
              marches={serverState.matchStats?.teamMarches?.[yourTeam] ?? 0}
              euchres={serverState.matchStats?.teamEuchres?.[yourTeam] ?? 0}
              loners={serverState.matchStats?.playerLoners?.[yourPos] ?? 0}
              lpDelta={effectiveLpDelta}
              isRanked={isRankedMatch}
              matchTypeLabel={matchTypeLabel}
              oldTier={lastRankUpdate?.oldTier || (profile?.rankTier as any) || serverState.slots[yourPos]?.rankTier || '9'}
              newTier={lastRankUpdate?.newTier || (profile?.rankTier as any) || serverState.slots[yourPos]?.rankTier || '9'}
              currentPoints={lastRankUpdate?.newPoints ?? profile?.rankPoints ?? 0}
              xpEarned={isVictory ? 350 : 120}
              playerLevel={profile?.level ?? 1}
              playerXp={(profile?.xp ?? 350) % 1000}
              nextLevelXp={1000}
              players={serverState.slots.map(s => ({
                id: s.userId || `slot_${s.position}`,
                name: s.username,
                avatarIcon: s.avatarIcon,
                isAI: s.isAI,
                position: s.position,
                rankTier: s.rankTier,
              }))}
              yourPosition={serverState.yourPosition}
              onPlayAgain={() => {
                if (onPlayAgain) {
                  onPlayAgain();
                } else {
                  multiplayerClient.leaveQueue();
                  onExitGame(false);
                }
              }}
              onExit={() => onExitGame(false)}
            />
          );
        })()}
      </main>

      {/* Bottom Player Hand Tray with Safe Area Inset for Home Indicator (Hidden when match is completed to avoid screen clutter) */}
      {serverState.phase !== 'game_over' && (
        <footer
          className={`relative bg-slate-900/95 border-t border-slate-800 px-2 py-2 flex flex-col items-center z-50 flex-shrink-0 min-h-[145px] xs:min-h-[155px] sm:min-h-[195px] md:min-h-[220px] lg:min-h-[240px] shadow-2xl transition-opacity duration-300 ${serverState.phase === 'hand_scored' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
        >
          {/* Turn prompt indicator & Sort Option */}
          <div className="w-full flex items-center justify-between text-[11px] sm:text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 sm:mb-2 px-1 sm:px-2 z-10">
            <div className="flex-1 text-center truncate px-1">
              {serverState.phase === 'hand_scored' ? (
                <span className="text-amber-400 font-bold">
                  Hand Scored — Ready for Next Deal
                </span>
              ) : serverState.phase === 'trick_resolving' ? (
                <span className="text-amber-400 font-bold animate-pulse">Resolving Trick...</span>
              ) : isDealerDiscardPhase ? (
                <span className="text-amber-400 font-black animate-pulse">
                  {isBenched
                    ? 'Partner Going Alone — Tap a card to discard'
                    : 'Tap a card to discard • Swipe to view all 6'}
                </span>
              ) : isBenched ? (
                <span className="text-gray-400">Partner is going alone. Your hand is sitting out.</span>
              ) : isYourTurn && (serverState.phase === 'bidding_round_1' || serverState.phase === 'bidding_round_2') ? (
                <span className="text-amber-400 font-black animate-pulse flex items-center justify-center space-x-1">
                  <span>👉 Your Call: Choose Trump or Pass!</span>
                </span>
              ) : isYourTurn && serverState.phase === 'playing' ? (
                <span className="text-amber-400 font-black animate-pulse flex items-center justify-center space-x-1">
                  <span>👉 Your turn!</span>
                  {leadSuit && (
                    <span className="hidden xs:inline">Must follow {leadSuit.toUpperCase()}!</span>
                  )}
                </span>
              ) : (
                <span className="text-gray-400 truncate">Waiting for other players...</span>
              )}
            </div>

            {/* Organize Hand by Suit Button */}
            <button
              onClick={toggleAutoSort}
              title={autoSortBySuit ? 'Auto-Sort by Suit is ON (tap to toggle)' : 'Auto-Sort by Suit is OFF (tap to sort)'}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border flex-shrink-0 active:scale-95 ${
                autoSortBySuit
                  ? 'bg-amber-400/20 border-amber-400/60 text-amber-300 hover:bg-amber-400/30'
                  : 'bg-slate-800/80 border-slate-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              <ArrowUpDown className="w-3 h-3 text-amber-400" />
              <span>{autoSortBySuit ? 'Sort: Suit' : 'Sort: Off'}</span>
            </button>
          </div>

          {/* Mobile swipe helper cue during 6-card discard */}
          {(isDealerDiscardPhase || displayHand.length > 5) && (
            <div className="text-[10px] text-amber-300 font-bold sm:hidden flex items-center justify-center space-x-1.5 py-0.5 animate-pulse">
              <span>👈</span>
              <span>Swipe cards to view all 6 in full</span>
              <span>👉</span>
            </div>
          )}

          {/* Hand Cards Tray (Mobile-first responsive sizing: all 5 fit normally; 6 cards scroll smoothly back and forth on mobile) */}
          <div
            ref={handScrollRef}
            className={`w-full max-w-full overflow-y-visible scrollbar-none select-none ${
              isDealerDiscardPhase || displayHand.length > 5
                ? 'overflow-x-auto touch-pan-x cursor-grab active:cursor-grabbing'
                : 'overflow-x-auto sm:overflow-x-visible touch-pan-x'
            }`}
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehaviorX: 'contain',
            }}
            onMouseDown={handleTrayMouseDown}
            onMouseMove={handleTrayMouseMove}
            onMouseUp={handleTrayMouseUp}
            onMouseLeave={handleTrayMouseUp}
            onTouchStart={handleTrayTouchStart}
            onTouchMove={handleTrayTouchMove}
            onTouchEnd={handleTrayTouchEnd}
          >
            <div className={`flex items-center justify-center min-w-full w-max gap-1 xs:gap-1.5 min-[400px]:gap-2 sm:gap-3 md:gap-4 ${
              isDealerDiscardPhase || displayHand.length > 5 ? 'px-3 sm:px-6' : 'px-0.5 sm:px-4'
            } pt-5 sm:pt-7 pb-1.5 sm:pb-2.5 min-h-[96px] xs:min-h-[105px] sm:min-h-[142px] md:min-h-[162px] lg:min-h-[182px]`}>
              {displayHand.map((card, idx) => {
                const isLegal = serverState.phase === 'playing'
                  ? isCardPlayLegal(card, serverState.yourHand, serverState.currentTrick, serverState.trumpSuit)
                  : isDealerDiscardPhase;

                return (
                  <div
                    key={card.id}
                    className="transition-transform duration-150 flex-shrink-0 hover:z-30"
                    style={{
                      zIndex: idx,
                      maxWidth:
                        isDealerDiscardPhase || displayHand.length > 5
                          ? undefined
                          : 'calc((100vw - 48px) / 5)',
                    }}
                  >
                    <CardView
                      card={card}
                      trumpSuit={serverState.trumpSuit}
                      isPlayable={isHandCardInteractive({
                        isDealerDiscardPhase,
                        isBenched,
                        isYourTurn,
                        isLegal,
                      })}
                      size="hand"
                      onClick={() => {
                        if (hasDraggedRef.current) return;
                        sounds.playCardSnap();
                        if (isDealerDiscardPhase) {
                          multiplayerClient.discard(card.id);
                        } else if (!isBenched && isYourTurn && isLegal) {
                          multiplayerClient.playCard(card.id);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </footer>
      )}

      {/* Inspect Public Player Profile Modal */}
      <PublicProfileModal
        isOpen={inspectedPlayer !== null}
        onClose={() => setInspectedPlayer(null)}
        player={inspectedPlayer}
        isMuted={inspectedPlayer ? mutedUsernames.has(inspectedPlayer.username) : false}
        onToggleMutePlayer={(uname) => {
          setMutedUsernames(prev => {
            const next = new Set(prev);
            if (next.has(uname)) next.delete(uname);
            else next.add(uname);
            return next;
          });
        }}
      />

      {/* Exit Confirmation Modal (Guards against accidental forfeits) */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-gradient-to-b from-[#162032] to-[#0c1322] border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-[0_15px_50px_rgba(0,0,0,0.8)] text-center relative overflow-hidden">
            {/* Top gold glow bar */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />
            
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 mb-3 shadow-inner">
              <Zap className="w-6 h-6 fill-amber-400 text-amber-400" />
            </div>

            <h3 className="text-lg font-black text-white tracking-tight">
              Ranked Match In Progress
            </h3>
            
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              Leaving will minimize your game. You can return to the main menu without forfeiting and <span className="text-amber-300 font-bold">rejoin at any time</span>!
            </p>

            <div className="mt-5 space-y-2">
              {/* Primary Resume Button */}
              <button
                onClick={() => {
                  sounds.playUiClick();
                  setShowExitConfirmModal(false);
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 hover:brightness-105 active:scale-95 text-white font-black text-sm tracking-wide shadow-lg shadow-emerald-500/25 border-t border-emerald-300/40 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Stay in Game (Resume)</span>
              </button>

              {/* Keep Match Active & Go to Menu */}
              <button
                onClick={() => {
                  sounds.playUiClick();
                  setShowExitConfirmModal(false);
                  onExitGame(false);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-600 hover:border-amber-400/60 text-amber-300 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Return to Menu (Keep Match Active)</span>
              </button>

              {/* Destructive Forfeit */}
              <button
                onClick={() => {
                  sounds.playUiClick();
                  setShowExitConfirmModal(false);
                  onExitGame(true);
                }}
                className="w-full py-2 text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
              >
                Forfeit & Abandon Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
