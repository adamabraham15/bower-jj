/**
 * BOWER JJ — Tactical Card Table
 * Mobile-first portrait/landscape interactive Euchre arena.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Card,
  Suit,
  PlayerPosition,
  EuchreGameState,
  BidDecision,
  getPlayerTeam,
  getPlayerPartner,
} from '../engine/types';
import {
  getEffectiveSuit,
  isCardPlayLegal,
  getLegalPlays,
  getSuitSymbol,
  getSuitColor,
  formatCardName,
  sortCardsBySuit,
  ALL_SUITS,
} from '../engine/cards';
import {
  decideRound1Bid,
  decideRound2Bid,
  decideDealerDiscard,
  decideCardPlay,
} from '../engine/ai';
import {
  initializeGame,
  pickRandomDealer,
  isCanadianLonerForced,
  isHandCardInteractive,
  handleBid,
  handleDealerDiscard,
  playCard,
  completeTrick,
  startNextHand,
} from '../engine/game';
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
import { RankBadge, RankTier } from './RankBadge';
import { PostMatchModal } from './PostMatchModal';
import { PublicProfileModal, PublicPlayerData } from './PublicProfileModal';

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
import { AvatarPortrait } from './AvatarPortrait';
import {
  BOT_AVATAR_BY_DIFFICULTY,
  BOT_CARD_BACK_BY_DIFFICULTY,
  resolveAvatarId,
  resolveCardBackId,
  getTableFeltDefinition,
} from '../config/collectiblesCatalog';
import { sounds } from '../audio/sound';
import confetti from 'canvas-confetti';
import {
  MessageSquare,
  Volume2,
  VolumeX,
  RotateCcw,
  HelpCircle,
  Trophy,
  ShieldAlert,
  Sparkles,
  Award,
  ArrowUpDown,
  Clock,
} from 'lucide-react';

interface GameTableProps {
  initialState: EuchreGameState;
  profile?: {
    rankTier?: RankTier;
    rankPoints?: number;
    level?: number;
    xp?: number;
    nextLevelXp?: number;
    avatarIcon?: string;
    tableFelt?: string;
    equippedCosmetics?: {
      cardBack?: string;
      banner?: string;
      title?: string;
      tableFelt?: string;
    };
  };
  onOpenRules: () => void;
  onOpenTutorial: () => void;
  onOpenEmotes: () => void;
  activeEmotes: Record<number, { text?: string; emoji?: string }>;
  isMuted: boolean;
  onToggleMute: () => void;
  onExitGame: () => void;
  onMatchComplete?: (
    won: boolean,
    myScore: number,
    oppScore: number,
    stats?: {
      tricksWon?: number;
      euchres?: number;
      marches?: number;
      successfulLoners?: number;
    }
  ) => void;
}

export const GameTable: React.FC<GameTableProps> = ({
  initialState,
  profile,
  onOpenRules,
  onOpenTutorial,
  onOpenEmotes,
  activeEmotes,
  isMuted,
  onToggleMute,
  onExitGame,
  onMatchComplete,
}) => {
  const [state, setState] = useState<EuchreGameState>(initialState);
  const [aloneToggle, setAloneToggle] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [inspectedPlayer, setInspectedPlayer] = useState<PublicPlayerData | null>(null);
  const [matchReported, setMatchReported] = useState(false);
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

  // Synchronize internal state whenever a brand new game instance is initialized
  useEffect(() => {
    setState(initialState);
    setAloneToggle(false);
    setIsProcessingAI(false);
    setMatchReported(false);
  }, [initialState]);

  // Ensure "Go Alone!" checkbox resets between hands or outside bidding phases
  useEffect(() => {
    if (state.phase !== 'bidding_round_1' && state.phase !== 'bidding_round_2') {
      setAloneToggle(false);
    }
  }, [state.phase, state.dealer]);

  // Trigger celebration on match victory
  useEffect(() => {
    if (state.phase === 'game_over' && !matchReported) {
      setMatchReported(true);
      const userTeamWon = state.scores[0] >= state.rules.targetScore;
      if (userTeamWon) {
        confetti({
          particleCount: 130,
          spread: 85,
          origin: { y: 0.6 },
        });
        sounds.playVictoryFanfare();
      }
      onMatchComplete?.(userTeamWon, state.scores[0], state.scores[1], {
        tricksWon: state.matchStats?.teamTricksWon?.[0] ?? (state.tricksWon[0] || 0),
        euchres: state.matchStats?.teamEuchres?.[0] ?? 0,
        marches: state.matchStats?.teamMarches?.[0] ?? 0,
        successfulLoners: state.matchStats?.playerLoners?.[0] ?? 0,
      });
    }
  }, [state.phase, state.scores, state.rules.targetScore, matchReported, onMatchComplete]);

  // Trick completion pause: Keep all 4 cards on screen for 1.8 seconds with winner announcement
  useEffect(() => {
    if (state.phase !== 'trick_resolving') return;

    const winnerPos = state.currentTrick.winner;
    const isUserTeam = winnerPos !== undefined && getPlayerTeam(winnerPos) === 0;
    sounds.playTrickWin(isUserTeam);

    const timer = setTimeout(() => {
      const next = completeTrick(state);
      setState(next);
    }, 1800);

    return () => clearTimeout(timer);
  }, [state.phase]);

  // AI turn automation loop
  useEffect(() => {
    const currentTurn = state.currentTurn;
    const currentPlayer = state.players[currentTurn];

    // If it's human player's turn, game over, hand scored, or trick resolving, pause AI
    if (
      !currentPlayer.isAI ||
      state.phase === 'game_over' ||
      state.phase === 'hand_scored' ||
      state.phase === 'trick_resolving'
    ) {
      return;
    }

    // AI is thinking
    setIsProcessingAI(true);
    const timer = setTimeout(() => {
      try {
        const difficulty = currentPlayer.aiDifficulty || 'medium';

        if (state.phase === 'bidding_round_1') {
          const decision = decideRound1Bid(state, currentTurn, difficulty);
          sounds.playUiClick();
          const next = handleBid(state, decision);
          setState(next);
        } else if (state.phase === 'bidding_round_2') {
          const decision = decideRound2Bid(state, currentTurn, difficulty);
          sounds.playTrumpCall();
          const next = handleBid(state, decision);
          setState(next);
        } else if (state.phase === 'dealer_discard' && state.dealer === currentTurn) {
          const discard = decideDealerDiscard(state.hands[currentTurn], state.trumpSuit!, difficulty);
          sounds.playCardSnap();
          const next = handleDealerDiscard(state, discard);
          setState(next);
        } else if (state.phase === 'playing') {
          const card = decideCardPlay(state, currentTurn, difficulty);
          sounds.playCardSnap();
          const next = playCard(state, currentTurn, card);
          setState(next);
        }
      } catch (err) {
        console.error('AI step error:', err);
      } finally {
        setIsProcessingAI(false);
      }
    }, 750); // Natural pacing for comfortable viewing

    return () => clearTimeout(timer);
  }, [state]);

  // Human player actions
  const isHumanPartnerOfDealer = state.dealer === 2; // North is dealer, South (0) is partner
  const forcesCanadianLoner = isCanadianLonerForced(state.rules, isHumanPartnerOfDealer);

  const handleHumanRound1Bid = (type: 'pass' | 'order_up' | 'pick_up') => {
    if (state.currentTurn !== 0 || state.phase !== 'bidding_round_1') return;
    sounds.playUiClick();
    if (type !== 'pass') sounds.playTrumpCall();

    const next = handleBid(state, {
      player: 0,
      type,
      alone: aloneToggle || forcesCanadianLoner,
    });
    setState(next);
    setAloneToggle(false);
  };

  const handleHumanRound2Bid = (type: 'pass' | 'call_trump', suit?: Suit) => {
    if (state.currentTurn !== 0 || state.phase !== 'bidding_round_2') return;
    sounds.playUiClick();
    if (type === 'call_trump') sounds.playTrumpCall();
    const next = handleBid(state, {
      player: 0,
      type,
      suit,
      alone: aloneToggle,
    });
    setState(next);
    setAloneToggle(false);
  };

  const handleHumanDiscard = (card: Card) => {
    if (state.currentTurn !== 0 || state.phase !== 'dealer_discard') return;
    sounds.playCardSnap();
    const next = handleDealerDiscard(state, card);
    setState(next);
  };

  const handleHumanCardPlay = (card: Card) => {
    if (state.currentTurn !== 0 || state.phase !== 'playing') return;
    sounds.playCardSnap();
    const next = playCard(state, 0, card);
    setState(next);
  };

  const handleNextHandClick = () => {
    sounds.playDealCard();
    const next = startNextHand(state);
    setState(next);
  };

  // 15-Second Radial Turn Countdown Timer
  useEffect(() => {
    if (isActiveDecisionPhase(state.phase)) {
      setTurnSecondsLeft(15);
      turnStartTimeRef.current = Date.now();
    }
  }, [state.currentTurn, state.phase, state.currentTrick.cards.length]);

  useEffect(() => {
    if (!isActiveDecisionPhase(state.phase) || state.phase === 'game_over' || state.phase === 'trick_resolving') {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - turnStartTimeRef.current) / 1000;
      const remaining = Math.max(0, 15 - elapsed);
      setTurnSecondsLeft(remaining);

      // Auto-play when 15 seconds expire on human player's turn
      if (remaining <= 0) {
        clearInterval(interval);
        if (state.currentTurn === 0) {
          if (state.phase === 'playing') {
            const hand = state.hands[0] || [];
            const plays = getLegalPlays(hand, state.currentTrick, state.trumpSuit);
            if (plays.length > 0) {
              handleHumanCardPlay(plays[0]);
            }
          } else if (state.phase === 'bidding_round_1') {
            handleHumanRound1Bid('pass');
          } else if (state.phase === 'bidding_round_2') {
            const mustCall = state.rules.stickTheDealer && state.dealer === 0;
            if (mustCall) {
              const legalSuit = ALL_SUITS.find((s) => s !== state.upCard?.suit) || 'hearts';
              handleHumanRound2Bid('call_trump', legalSuit);
            } else {
              handleHumanRound2Bid('pass');
            }
          } else if (state.phase === 'dealer_discard' && state.dealer === 0) {
            const hand = state.hands[0] || [];
            if (hand.length > 0) {
              handleHumanDiscard(hand[0]);
            }
          }
        }
      }
    }, 120);

    return () => clearInterval(interval);
  }, [
    state.currentTurn,
    state.phase,
    state.hands,
    state.trumpSuit,
    state.currentTrick.leadSuit,
    state.rules.stickTheDealer,
    state.dealer,
    state.upCard,
  ]);

  // Helper to render player pod
  const renderPlayerPod = (pos: PlayerPosition, positionStyle: string) => {
    const player = state.players[pos];
    const isDealer = state.dealer === pos;
    const isTrumpCaller = state.trumpSuit !== undefined && state.callingPlayer === pos;
    const isCurrentTurn = state.currentTurn === pos && isActiveDecisionPhase(state.phase);
    const isBenched = state.benchedPlayer === pos;
    const isTeammate = getPlayerTeam(pos) === 0;
    const hand = state.hands[pos];
    const emote = activeEmotes[pos];
    const relPos: 'bottom' | 'left' | 'top' | 'right' =
      pos === 0 ? 'bottom' : pos === 1 ? 'left' : pos === 2 ? 'top' : 'right';

    return (
      <div className={`absolute ${positionStyle} flex flex-col items-center z-20 pointer-events-auto`}>
        {/* Floating Emote / Speech Bubble */}
        {emote && (
          <div className="mb-1 px-3 py-1 bg-slate-900 border-2 border-amber-400 text-white text-xs font-bold rounded-2xl shadow-xl animate-bounce">
            {emote.emoji || emote.text}
          </div>
        )}

        {(() => {
          const fallbackBotAvatars = BOT_AVATAR_BY_DIFFICULTY[player.aiDifficulty || 'medium'];
          const resolvedAvatar = resolveAvatarId(
            pos === 0
              ? (profile?.avatarIcon || player.avatarId)
              : (player.avatarId || fallbackBotAvatars[pos % fallbackBotAvatars.length])
          );
          const resolvedCardBack = resolveCardBackId(
            pos === 0
              ? (profile?.equippedCosmetics?.cardBack || player.cardBack)
              : (player.cardBack || BOT_CARD_BACK_BY_DIFFICULTY[player.aiDifficulty || 'medium'])
          );
          const isHorizontalSeat = relPos === 'top' || relPos === 'bottom';
          const fannedHand = pos !== 0 && !isBenched && hand.length > 0 ? (
            <div
              className={`flex items-center justify-center -space-x-6 scale-75 ${
                relPos === 'top' ? 'sm:scale-90 origin-right' : 'sm:scale-95 origin-top'
              } pointer-events-none`}
            >
              {Array.from({ length: Math.min(hand.length, 5) }).map((_, idx, arr) => {
                const mid = (arr.length - 1) / 2;
                const rot = (idx - mid) * 7;
                return (
                  <div key={idx} style={{ transform: `rotate(${rot}deg)` }} className="drop-shadow-md">
                    <CardView isFacedown size="xs" cardBackSkin={resolvedCardBack} />
                  </div>
                );
              })}
            </div>
          ) : null;

          const avatarAndName = (
            <div className="flex flex-col items-center">
              <div
                onClick={() => {
                  sounds.playUiClick();
                  const tier = (player.rankTier as RankTier) || (pos === 0 ? '9' : player.aiDifficulty === 'hard' ? 'K' : player.aiDifficulty === 'medium' ? '10' : '9');
                  setInspectedPlayer({
                    id: player.id || `bot_${player.name}`,
                    username: player.name,
                    avatarIcon: resolvedAvatar,
                    level: pos === 0 ? (profile?.level ?? 1) : 8,
                    rankTier: tier,
                    rankPoints: pos === 0 ? (profile?.rankPoints ?? 0) : 50,
                    totalGames: pos === 0 ? 12 : 95,
                    wins: pos === 0 ? 9 : 52,
                    losses: pos === 0 ? 3 : 43,
                    bestStreak: 4,
                    isFriend: pos === 2,
                    isOnline: true,
                    equippedCosmetics: {
                      hat: resolvedAvatar,
                      cardBack: resolvedCardBack,
                      banner: 'default_navy',
                      title: player.isAI ? `Tactical AI (${player.aiDifficulty})` : 'Competitor',
                    },
                  });
                }}
                title={`Inspect ${player.name}`}
                className="relative cursor-pointer hover:scale-105 active:scale-95 transition-transform"
              >
                {/* Avatar Container */}
                <div
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl p-0.5 transition-all duration-300 flex items-center justify-center relative
                    ${isTeammate ? 'bg-gradient-to-tr from-cyan-600 to-sky-400' : 'bg-gradient-to-tr from-rose-600 to-amber-500'}
                    ${isCurrentTurn ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-900 scale-105 shadow-lg shadow-amber-400/50' : isDealer ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-500/30' : 'opacity-90'}
                    ${isBenched ? 'grayscale opacity-50' : ''}`}
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
                    <AvatarPortrait
                      avatarId={resolvedAvatar}
                      size="md"
                      showRarityRing={false}
                      className="!w-full !h-full !rounded-[14px]"
                    />
                  </div>
                </div>

                {/* Dealer Chip */}
                {isDealer && <DealerAvatarBadge />}

                {/* Trump Maker Chip */}
                {isTrumpCaller && state.trumpSuit && (
                  <MakerBadge trumpSuit={state.trumpSuit} isUserTeam={state.callingTeam === 0} />
                )}

                {/* Card Count Badge */}
                {pos !== 0 && (
                  <div className="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-gray-200 shadow-sm z-10">
                    {isBenched ? 'BENCHED' : `${hand.length} 🂠`}
                  </div>
                )}
              </div>

              {/* Player Name & Info */}
              <div className="mt-1 flex flex-col items-center">
                <div className="text-[11px] sm:text-xs font-bold text-white flex items-center space-x-1">
                  <span>{player.name}</span>
                  {isCurrentTurn && <TurnActiveDot />}
                </div>
                {isBenched ? (
                  <span className="text-[9px] uppercase font-bold text-red-400 bg-red-950/80 px-1.5 rounded-sm">
                    Sitting Out
                  </span>
                ) : (
                  <>
                    {player.isAI && (
                      <span className="text-[9px] uppercase tracking-wider text-gray-400 font-mono">
                        AI ({player.aiDifficulty})
                      </span>
                    )}
                    {!isHorizontalSeat && fannedHand && (
                      <div className="mt-0.5 sm:mt-1 h-[40px] sm:h-[52px] flex items-start justify-center pointer-events-none">
                        {fannedHand}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );

          if (isHorizontalSeat) {
            return (
              <div className="flex items-center justify-center gap-2.5 sm:gap-4">
                {relPos === 'top' && fannedHand}
                {avatarAndName}
                {isDealer && (
                  <DealerDeckStack relativePos={relPos} cardBackSkin={resolvedCardBack} inline />
                )}
              </div>
            );
          }

          return (
            <div className="relative flex flex-col items-center">
              {avatarAndName}
              {isDealer && (
                <DealerDeckStack relativePos={relPos} cardBackSkin={resolvedCardBack} />
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  const humanHand = state.hands[0] || [];
  const displayHand = useMemo(() => {
    if (autoSortBySuit) {
      return sortCardsBySuit(humanHand, state.trumpSuit);
    }
    return humanHand;
  }, [humanHand, state.trumpSuit, autoSortBySuit]);
  const isHumanTurn = state.currentTurn === 0;
  const isDealerDiscardPhase = state.phase === 'dealer_discard' && state.dealer === 0;
  const isHumanBenched = state.benchedPlayer === 0;

  // Smoothly ensure hand starts at beginning when picking up card / dealer discard begins
  useEffect(() => {
    if (isDealerDiscardPhase && handScrollRef.current) {
      handScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [isDealerDiscardPhase]);

  const trickCards = state.currentTrick.cards;
  const leadSuit = state.currentTrick.leadSuit;
  const isTrickResolving = state.phase === 'trick_resolving';
  const callerPlayer = state.callingPlayer !== undefined ? state.players[state.callingPlayer] : undefined;
  const callerName = state.callingPlayer !== undefined
    ? (state.callingPlayer === 0 ? 'You' : callerPlayer?.name || `Seat ${state.callingPlayer}`)
    : undefined;
  const callerTeam = state.callingTeam ?? (state.callingPlayer !== undefined ? getPlayerTeam(state.callingPlayer) : undefined);
  const dealerPlayer = state.players[state.dealer];
  const dealerAvatar = resolveAvatarId(state.dealer === 0 ? (profile?.avatarIcon || dealerPlayer?.avatarId) : dealerPlayer?.avatarId);
  const equippedFelt = getTableFeltDefinition(profile?.equippedCosmetics?.tableFelt || profile?.tableFelt);

  return (
    <div className="relative w-full h-[100dvh] bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* Top Header: Scoreboard & Trump Banner */}
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
              onExitGame();
            }}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-300 flex-shrink-0"
          >
            ← Exit
          </button>

          {/* Team Scores Pill */}
          <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-950 px-1.5 xs:px-2 sm:px-2.5 py-1 rounded-xl border border-slate-800 shadow-inner text-xs min-w-0 flex-shrink">
            <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-cyan-400 flex-shrink-0" />
              <span className="font-black text-cyan-300">
                <span className="hidden sm:inline">YOUR TEAM: </span>
                <span className="hidden xs:inline sm:hidden">TEAM: </span>
                {state.scores[0]}
              </span>
              <span className="hidden md:inline text-[10px] text-gray-400 font-mono">({state.tricksWon[0]} trk)</span>
            </div>
            <span className="text-gray-600 font-bold text-xs">-</span>
            <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-rose-400 flex-shrink-0" />
              <span className="font-black text-rose-300">
                <span className="hidden sm:inline">OPPONENTS: </span>
                <span className="hidden xs:inline sm:hidden">OPP: </span>
                {state.scores[1]}
              </span>
              <span className="hidden md:inline text-[10px] text-gray-400 font-mono">({state.tricksWon[1]} trk)</span>
            </div>
          </div>
        </div>

        {/* Trump Banner (Header) */}
        {state.trumpSuit && (
          <TrumpBanner
            trumpSuit={state.trumpSuit}
            callerName={callerName}
            callerTeam={callerTeam}
            isAlone={state.isAlone}
            isUserTeam={callerTeam === 0}
          />
        )}

        {/* Action Controls */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0 z-20">
          <button
            onClick={onOpenEmotes}
            title="Emotes & Quick Chat"
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
        tricksWon={state.tricksWon}
        phase={state.phase}
        yourTeam={0}
      />

      {/* Main Playing Felt Area (Dynamic Custom Felt or Midnight Casino) */}
      <main
        className="relative flex-1 min-h-0 flex items-center justify-center p-2 sm:p-6 overflow-hidden"
        style={{ background: equippedFelt.bgGradient }}
      >
        {/* Modern Ambient Felt Vignette & Concentric Track Rings */}
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

        {/* Player Pods on Table Felt:
            - Partner North at top
            - Opponent West at left (pushed close to edge to eliminate avatar-trick overlap)
            - Opponent East at right (pushed close to edge to eliminate avatar-trick overlap)
            - You South at bottom */}
        {renderPlayerPod(2, 'top-1.5 sm:top-3 left-1/2 -translate-x-1/2')} {/* Partner (North) */}
        {renderPlayerPod(1, 'left-1 sm:left-3 top-1/2 -translate-y-1/2')} {/* Opponent 1 (West) */}
        {renderPlayerPod(3, 'right-1 sm:right-3 top-1/2 -translate-y-1/2')} {/* Opponent 2 (East) */}
        {renderPlayerPod(0, 'bottom-1.5 sm:bottom-2.5 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-28 md:left-32 lg:left-36')} {/* You (South) */}

        {/* Center Trick Arena & Table Hub */}
        <div
          className="relative w-72 h-72 sm:w-84 sm:h-84 rounded-full border-2 backdrop-blur-xs flex items-center justify-center"
          style={{
            borderColor: `${equippedFelt.feltBorder}85`,
            backgroundColor: `${equippedFelt.feltColor}90`,
            boxShadow: `0 0 50px rgba(0,0,0,0.8), inset 0 0 35px ${equippedFelt.accentHex}12`,
          }}
        >
          {/* Bidding Round 1 & Round 2 Kitty Display */}
          <CenterKittyDisplay
            phase={state.phase}
            upCard={state.upCard}
            canCallTurnedDownSuit={state.rules.canCallTurnedDownSuit}
          />

          {/* Active Lead Suit Indicator in center */}
          {(state.phase === 'playing' || isTrickResolving) && leadSuit && (
            <LeadSuitBadge leadSuit={leadSuit} showFollowHint />
          )}

          {/* Played Cards in Trick Arena (Clamped spread so East/West cards stay completely clear of avatars!) */}
          {(state.phase === 'playing' || isTrickResolving) && (
            <div className="relative w-full h-full flex items-center justify-center">
              {trickCards.map(pc => {
                const player = state.players[pc.player];
                const isWinningCard = isTrickResolving && state.currentTrick.winningCard?.id === pc.card.id;

                // Position each card inside the center felt circle without encroaching on avatars
                const positionStyle =
                  pc.player === 0
                    ? 'bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2'
                    : pc.player === 2
                    ? 'top-6 sm:top-7 left-1/2 -translate-x-1/2'
                    : pc.player === 1
                    ? 'left-12 sm:left-14 top-1/2 -translate-y-1/2'
                    : 'right-12 sm:right-14 top-1/2 -translate-y-1/2';

                return (
                  <div
                    key={pc.card.id}
                    className={`absolute transition-all duration-300 flex flex-col items-center ${positionStyle} ${
                      isWinningCard ? 'scale-115 z-30' : 'z-20'
                    }`}
                  >
                    {/* Winner crown */}
                    {isWinningCard && (
                      <span className="text-xs font-black text-amber-300 bg-amber-500/20 border border-amber-400 px-2 py-0.5 rounded-full mb-1 animate-bounce">
                        👑 TRICK WINNER
                      </span>
                    )}

                    <CardView
                      card={pc.card}
                      trumpSuit={state.trumpSuit}
                      size="sm"
                      isPlayable={false}
                      isSelected={isWinningCard}
                      playerTag={pc.player === 0 ? 'You' : player.name.split(' ')[0]}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Trick Resolving Banner: Announced and Clear! */}
          {isTrickResolving && state.currentTrick.winner !== undefined && state.currentTrick.winningCard && (
            <div className="absolute inset-x-2 bottom-4 z-40 bg-slate-900/95 border-2 border-amber-400 rounded-2xl p-2.5 text-center shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="text-xs font-black text-amber-300 flex items-center justify-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {state.players[state.currentTrick.winner].name} WON THE TRICK with {formatCardName(state.currentTrick.winningCard, state.trumpSuit)}!
                </span>
              </div>
            </div>
          )}

          {/* AI Calculating Indicator */}
          {isProcessingAI && !isTrickResolving && (
            <div className="absolute bottom-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-[10px] font-mono text-amber-300 flex items-center space-x-1.5 animate-pulse z-10">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>AI thinking...</span>
            </div>
          )}
        </div>

        {/* Human Interactive Bidding Modals */}
        {isHumanTurn && state.phase === 'bidding_round_1' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pb-36 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-xs bg-slate-900 border-2 border-amber-500 rounded-3xl p-5 shadow-2xl flex flex-col items-center space-y-3">
              <div className="text-center">
                <div className="text-xs font-black text-amber-400 uppercase tracking-wider">Your Call (Round 1)</div>
                <div className="text-xs text-gray-300 mt-0.5">Turn the kitty card into Trump?</div>
              </div>

              <ModalDealerBanner
                dealerName={dealerPlayer?.name || `Seat ${state.dealer}`}
                dealerAvatar={dealerAvatar}
                isSelfDealer={state.dealer === 0}
                isPartnerDealer={isHumanPartnerOfDealer}
              />

              {/* Prominent Turned-Up Card Display */}
              {state.upCard && (
                <div className="my-1 flex flex-col items-center p-2.5 bg-slate-950/70 rounded-2xl border border-amber-500/40 shadow-inner">
                  <CardView card={state.upCard} size="md" isPlayable={false} />
                </div>
              )}

              <GoAloneControl
                allowAloneCalls={state.rules.allowAloneCalls}
                checked={aloneToggle}
                forcedCanadianLoner={forcesCanadianLoner}
                onChange={setAloneToggle}
                pointsLabel=" (+4 Pts)"
              />

              <div className="flex space-x-3 w-full pt-1">
                <button
                  onClick={() => handleHumanRound1Bid('pass')}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-300 transition-all active:scale-95"
                >
                  Pass
                </button>
                <button
                  onClick={() => handleHumanRound1Bid(state.dealer === 0 ? 'pick_up' : 'order_up')}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 transition-all active:scale-95"
                >
                  {state.dealer === 0 ? 'Pick Up' : forcesCanadianLoner ? 'Order Up Alone 🚀' : 'Order Up'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isHumanTurn && state.phase === 'bidding_round_2' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pb-36 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500 rounded-3xl p-5 shadow-2xl flex flex-col items-center space-y-3">
              <div className="text-center">
                <div className="text-xs font-black text-amber-400 uppercase tracking-wider">Your Call (Round 2)</div>
                <div className="text-xs text-gray-300 mt-0.5">Select a new trump suit:</div>
              </div>

              <ModalDealerBanner
                dealerName={dealerPlayer?.name || `Seat ${state.dealer}`}
                dealerAvatar={dealerAvatar}
                isSelfDealer={state.dealer === 0}
                isPartnerDealer={isHumanPartnerOfDealer}
              />

              <TurnedDownNoticeChip
                upCard={state.upCard}
                canCallTurnedDownSuit={state.rules.canCallTurnedDownSuit}
              />

              <GoAloneControl
                allowAloneCalls={state.rules.allowAloneCalls}
                checked={aloneToggle}
                onChange={setAloneToggle}
                pointsLabel=""
              />

              {/* Suit Selection Buttons with Crisp SVG Icons */}
              <div className="grid grid-cols-3 gap-2 w-full">
                {ALL_SUITS.filter(s => s !== state.upCard?.suit).map(suit => {
                  return (
                    <button
                      key={suit}
                      onClick={() => handleHumanRound2Bid('call_trump', suit)}
                      className="py-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 border border-slate-700 font-black text-sm flex items-center justify-center space-x-1.5 transition-all active:scale-95 group"
                    >
                      <SuitIcon suit={suit} className="w-4 h-4" />
                      <span className="capitalize text-xs group-hover:text-slate-950">{suit}</span>
                    </button>
                  );
                })}
              </div>

              {/* Pass Button */}
              {!(state.dealer === 0 && state.rules.stickTheDealer) ? (
                <button
                  onClick={() => handleHumanRound2Bid('pass')}
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

        {/* Dealer Discard Prompt & Benched Notification */}
        {isDealerDiscardPhase ? (
          <div className="absolute top-16 z-40 bg-amber-500 text-slate-950 px-4 py-2 rounded-2xl shadow-2xl font-black text-xs animate-bounce flex items-center space-x-2 text-center max-w-md mx-2">
            <span>👇</span>
            <span>
              {isHumanBenched
                ? 'Partner Ordered You Up Alone! Tap 1 card below to discard to the kitty before sitting out.'
                : 'Dealer Discard: Tap 1 card from your hand below to discard it to the kitty!'}
            </span>
          </div>
        ) : isHumanBenched ? (
          <div className="absolute top-16 z-40 bg-cyan-950/90 border-2 border-cyan-400 text-cyan-200 px-4 py-2 rounded-2xl shadow-2xl font-bold text-xs text-center mx-2">
            🚀 Your partner ordered you up and is GOING ALONE! You sit this hand out.
          </div>
        ) : null}

        {/* Hand Scored Fullscreen Overlay */}
        {state.phase === 'hand_scored' && state.lastHandResult && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4">
              <div className="text-4xl">
                {state.lastHandResult.isMarch ? '🏆' : state.lastHandResult.isEuchre ? '🔥' : '✨'}
              </div>

              <div>
                <h3 className="text-xl font-black text-white">
                  {state.lastHandResult.isMarch
                    ? state.lastHandResult.calledAlone ? 'SOLO MARCH!' : 'MARCH!'
                    : state.lastHandResult.isEuchre
                    ? 'EUCHRED!'
                    : 'HAND COMPLETED'}
                </h3>
                <p className="text-xs text-amber-300 font-semibold mt-1">
                  {formatRelativeHandMessage(state.lastHandResult.message, 0)}
                </p>
              </div>

              {/* Score Update */}
              <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700 flex justify-around items-center">
                <div>
                  <div className="text-xs font-bold text-cyan-300">Your Team</div>
                  <div className="text-2xl font-black text-white">{state.scores[0]}</div>
                </div>
                <div className="text-xs text-gray-500 font-bold">vs</div>
                <div>
                  <div className="text-xs font-bold text-rose-300">Opponents</div>
                  <div className="text-2xl font-black text-white">{state.scores[1]}</div>
                </div>
              </div>

              <button
                onClick={handleNextHandClick}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 transition-all active:scale-95"
              >
                Deal Next Hand →
              </button>
            </div>
          </div>
        )}

        {/* Post-Match Progression & Accolades Screen */}
        {state.phase === 'game_over' && (
          <PostMatchModal
            isOpen={true}
            isVictory={state.scores[0] >= state.rules.targetScore}
            finalScore={state.scores}
            tricksWon={state.matchStats?.teamTricksWon?.[0] ?? state.tricksWon[0]}
            marches={state.matchStats?.teamMarches?.[0] ?? 0}
            euchres={state.matchStats?.teamEuchres?.[0] ?? 0}
            loners={state.matchStats?.playerLoners?.[0] ?? 0}
            lpDelta={0}
            isRanked={false}
            matchTypeLabel="Offline Bot Practice (No Rank Risk)"
            oldTier={profile?.rankTier || (state.players[0].rankTier as RankTier) || '9'}
            newTier={profile?.rankTier || (state.players[0].rankTier as RankTier) || '9'}
            currentPoints={profile?.rankPoints ?? 0}
            xpEarned={state.scores[0] >= state.rules.targetScore ? 150 : 50}
            playerLevel={profile?.level ?? 1}
            playerXp={(profile?.xp ?? 150) % 1000}
            nextLevelXp={1000}
            players={state.players.map(p => ({
              id: p.id,
              name: p.name,
              avatarIcon: p.avatarId,
              isAI: p.isAI,
              position: p.position,
              rankTier: (p.rankTier as RankTier) || '9',
            }))}
            yourPosition={0}
            onPlayAgain={() => {
              const newGame = initializeGame(state.players, state.rules, pickRandomDealer());
              setMatchReported(false);
              setState(newGame);
            }}
            onExit={onExitGame}
          />
        )}
      </main>

      {/* Bottom Player Hand Tray with Safe Area Inset for Home Indicator (Hidden when match is completed to avoid screen clutter) */}
      {state.phase !== 'game_over' && (
        <footer
          className={`relative bg-slate-900/95 border-t border-slate-800 px-2 py-2 flex flex-col items-center z-50 flex-shrink-0 min-h-[145px] xs:min-h-[155px] sm:min-h-[195px] md:min-h-[220px] lg:min-h-[240px] shadow-2xl transition-opacity duration-300 ${
            state.phase === 'hand_scored' ? 'opacity-30 pointer-events-none' : 'opacity-100'
          }`}
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
        >
          {/* Turn prompt indicator & Sort Option */}
          <div className="w-full flex items-center justify-between text-[11px] sm:text-xs font-bold text-gray-300 uppercase tracking-wider mb-1 sm:mb-2 px-1 sm:px-2 z-10">
            <div className="flex-1 text-center truncate px-1">
              {state.phase === 'hand_scored' ? (
                <span className="text-amber-400 font-bold">Hand Scored — Ready for Next Deal</span>
              ) : state.phase === 'trick_resolving' ? (
                <span className="text-amber-400 font-bold animate-pulse">Resolving Trick...</span>
              ) : isDealerDiscardPhase ? (
                <span className="text-amber-400 font-black animate-pulse">
                  {isHumanBenched
                    ? 'Partner Going Alone — Tap to discard'
                    : 'Tap a card to discard • Swipe to view all 6'}
                </span>
              ) : isHumanBenched ? (
                <span className="text-gray-400">Partner is going alone. Sitting out.</span>
              ) : isHumanTurn && (state.phase === 'bidding_round_1' || state.phase === 'bidding_round_2') ? (
                <span className="text-amber-400 font-black animate-pulse flex items-center justify-center space-x-1">
                  <span>👉 Your Call: Choose Trump or Pass!</span>
                </span>
              ) : isHumanTurn && state.phase === 'playing' ? (
                <span className="text-amber-400 font-black animate-pulse flex items-center justify-center space-x-1">
                  <span>👉 Your turn!</span>
                  {leadSuit && (
                    <span className="hidden xs:inline">Must follow {leadSuit.toUpperCase()}!</span>
                  )}
                </span>
              ) : (
                <span className="text-gray-400 truncate">Waiting for {state.players[state.currentTurn]?.name || 'Opponent'}...</span>
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
                const isLegal = state.phase === 'playing'
                  ? isCardPlayLegal(card, humanHand, state.currentTrick, state.trumpSuit)
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
                      trumpSuit={state.trumpSuit}
                      isPlayable={isHandCardInteractive({
                        isDealerDiscardPhase,
                        isBenched: isHumanBenched,
                        isYourTurn: isHumanTurn,
                        isLegal,
                      })}
                      size="hand"
                      onClick={() => {
                        if (hasDraggedRef.current) return;
                        if (isDealerDiscardPhase) {
                          handleHumanDiscard(card);
                        } else if (!isHumanBenched && isHumanTurn && isLegal) {
                          handleHumanCardPlay(card);
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

      {/* Inspect Public Profile Modal */}
      <PublicProfileModal
        isOpen={inspectedPlayer !== null}
        onClose={() => setInspectedPlayer(null)}
        player={inspectedPlayer}
      />
    </div>
  );
};
