/**
 * BOWER JJ — Tactical Card Table
 * Mobile-first portrait/landscape interactive Euchre arena.
 */

import React, { useState, useEffect } from 'react';
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
import { DealerAvatarBadge, ModalDealerBanner, GoAloneControl } from './BiddingModalHelpers';
import { RankBadge, RankTier } from './RankBadge';
import { PostMatchModal } from './PostMatchModal';
import { PublicProfileModal, PublicPlayerData } from './PublicProfileModal';
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
} from 'lucide-react';

interface GameTableProps {
  initialState: EuchreGameState;
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
        tricksWon: state.tricksWon[0] || 0,
        euchres: state.scores[0] >= 2 ? 1 : 0,
        marches: state.scores[0] >= 2 ? 1 : 0,
        successfulLoners: state.scores[0] >= 4 ? 1 : 0,
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

  // Helper to render player pod
  const renderPlayerPod = (pos: PlayerPosition, positionStyle: string) => {
    const player = state.players[pos];
    const isDealer = state.dealer === pos;
    const isTrumpCaller = state.trumpSuit !== undefined && state.callingPlayer === pos;
    const isCurrentTurn = state.currentTurn === pos && state.phase === 'playing';
    const isBenched = state.benchedPlayer === pos;
    const isTeamBlue = getPlayerTeam(pos) === 0;
    const hand = state.hands[pos];
    const emote = activeEmotes[pos];

    return (
      <div className={`absolute ${positionStyle} flex flex-col items-center z-20 pointer-events-auto`}>
        {/* Floating Emote / Speech Bubble */}
        {emote && (
          <div className="mb-1 px-3 py-1 bg-slate-900 border-2 border-amber-400 text-white text-xs font-bold rounded-2xl shadow-xl animate-bounce">
            {emote.emoji || emote.text}
          </div>
        )}

        <div
          onClick={() => {
            sounds.playUiClick();
            const avatar = pos === 0 ? '🤠' : pos === 1 ? '🤖' : pos === 2 ? '🧝' : '👽';
            const tier = (player.rankTier as RankTier) || (pos === 0 ? '9' : player.aiDifficulty === 'hard' ? 'K' : player.aiDifficulty === 'medium' ? '10' : '9');
            setInspectedPlayer({
              id: player.id || `bot_${player.name}`,
              username: player.name,
              avatarIcon: player.avatarId || avatar,
              level: pos === 0 ? 1 : 8,
              rankTier: tier,
              rankPoints: 50,
              totalGames: pos === 0 ? 12 : 95,
              wins: pos === 0 ? 9 : 52,
              losses: pos === 0 ? 3 : 43,
              bestStreak: 4,
              isFriend: pos === 2,
              isOnline: true,
              equippedCosmetics: {
                hat: avatar,
                cardBack: 'classic_blue',
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
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl p-0.5 transition-all duration-300 flex items-center justify-center
              ${isTeamBlue ? 'bg-gradient-to-tr from-blue-600 to-cyan-400' : 'bg-gradient-to-tr from-red-600 to-amber-500'}
              ${isCurrentTurn ? 'ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-900 scale-105 shadow-lg shadow-amber-400/50' : isDealer ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-500/30' : 'opacity-90'}
              ${isBenched ? 'grayscale opacity-50' : ''}`}
          >
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex flex-col items-center justify-center overflow-hidden">
              <span className="text-xl sm:text-2xl">
                {pos === 0 ? '🤠' : pos === 1 ? '🤖' : pos === 2 ? '🧝' : '👽'}
              </span>
            </div>
          </div>

          {/* Dealer Chip */}
          {isDealer && <DealerAvatarBadge />}

          {/* Trump Maker Chip */}
          {isTrumpCaller && state.trumpSuit && (
            <MakerBadge trumpSuit={state.trumpSuit} isBlueTeam={isTeamBlue} />
          )}

          {/* Card Count Badge */}
          {pos !== 0 && (
            <div className="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-gray-200 shadow-sm">
              {isBenched ? 'BENCHED' : `${hand.length} 🂠`}
            </div>
          )}
        </div>

        {/* Player Name & Info */}
        <div className="mt-1 flex flex-col items-center">
          <div className="text-[11px] sm:text-xs font-bold text-white flex items-center space-x-1">
            <span>{player.name}</span>
            {isCurrentTurn && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
          </div>
          {isBenched ? (
            <span className="text-[9px] uppercase font-bold text-red-400 bg-red-950/80 px-1.5 rounded-sm">
              Sitting Out
            </span>
          ) : player.isAI ? (
            <span className="text-[9px] uppercase tracking-wider text-gray-400 font-mono">
              AI ({player.aiDifficulty})
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  const humanHand = state.hands[0];
  const isHumanTurn = state.currentTurn === 0;
  const isDealerDiscardPhase = state.phase === 'dealer_discard' && state.dealer === 0;
  const isHumanBenched = state.benchedPlayer === 0;

  const trickCards = state.currentTrick.cards;
  const leadSuit = state.currentTrick.leadSuit;
  const isTrickResolving = state.phase === 'trick_resolving';
  const callerPlayer = state.callingPlayer !== undefined ? state.players[state.callingPlayer] : undefined;
  const callerName = state.callingPlayer !== undefined
    ? (state.callingPlayer === 0 ? 'You' : callerPlayer?.name || `Seat ${state.callingPlayer}`)
    : undefined;
  const callerTeam = state.callingTeam ?? (state.callingPlayer !== undefined ? getPlayerTeam(state.callingPlayer) : undefined);
  const dealerPlayer = state.players[state.dealer];
  const dealerAvatar = state.dealer === 0 ? '🤠' : state.dealer === 1 ? '🤖' : state.dealer === 2 ? '🧝' : '👽';

  return (
    <div className="relative w-full h-[100dvh] bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* Top Header: Scoreboard & Trump Banner */}
      <header
        className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between z-30 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.4rem)' }}
      >
        <div className="flex items-center space-x-1.5 sm:space-x-3">
          <button
            onClick={() => {
              sounds.playUiClick();
              onExitGame();
            }}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-300"
          >
            ← Exit
          </button>

          {/* Team Scores Pill */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-950 px-2 sm:px-2.5 py-1 rounded-xl border border-slate-800 shadow-inner text-xs">
            <div className="flex items-center space-x-1 sm:space-x-1.5">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-cyan-400" />
              <span className="font-black text-cyan-300">
                <span className="hidden sm:inline">BLUE: </span>
                <span className="sm:hidden">B: </span>
                {state.scores[0]}
              </span>
              <span className="hidden md:inline text-[10px] text-gray-400 font-mono">({state.tricksWon[0]} trk)</span>
            </div>
            <span className="text-gray-600 font-bold text-xs">-</span>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-400" />
              <span className="font-black text-red-300">
                <span className="hidden sm:inline">RED: </span>
                <span className="sm:hidden">R: </span>
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
          />
        )}

        {/* Action Controls */}
        <div className="flex items-center space-x-1 sm:space-x-1.5">
          <button
            onClick={onOpenEmotes}
            title="Emotes & Quick Chat"
            className="p-1 sm:p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300"
          >
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={() => {
              sounds.playUiClick();
              onToggleMute();
            }}
            title="Toggle Audio"
            className="p-1 sm:p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-300"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>
          <button
            onClick={() => {
              sounds.playUiClick();
              onOpenRules();
            }}
            title="Rules Compendium"
            className="p-1 sm:p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-300"
          >
            <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* Main Playing Felt Area */}
      <main className="relative flex-1 min-h-0 bg-gradient-to-b from-[#071920] via-[#052225] to-[#031317] flex items-center justify-center p-2 sm:p-6 overflow-hidden">
        {/* Felt Glow & Watermark */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.09)_0%,_transparent_70%)] pointer-events-none" />
        <div className="absolute text-emerald-950/20 text-8xl sm:text-9xl font-black select-none pointer-events-none tracking-widest font-mono">
          BOWER JJ
        </div>

        {/* Player Pods */}
        {renderPlayerPod(2, 'top-2 sm:top-4')} {/* Partner (North) */}
        {renderPlayerPod(1, 'left-2 sm:left-6 top-1/2 -translate-y-1/2')} {/* Opponent 1 (West) */}
        {renderPlayerPod(3, 'right-2 sm:right-6 top-1/2 -translate-y-1/2')} {/* Opponent 2 (East) */}
        {renderPlayerPod(0, 'bottom-28 sm:bottom-36')} {/* You (South) */}

        {/* Center Trick Arena & Table Hub */}
        <div className="relative w-72 h-72 sm:w-84 sm:h-84 rounded-full border border-emerald-500/25 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center shadow-2xl">
          {/* Bidding Round 1 Kitty Display */}
          {state.phase === 'bidding_round_1' && state.upCard && (
            <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
              <span className="text-[11px] text-amber-300 font-black uppercase mb-1.5 tracking-wider bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                Turned-Up Card
              </span>
              <CardView card={state.upCard} size="md" isPlayable={false} />
            </div>
          )}

          {/* Active Lead Suit Indicator in center */}
          {(state.phase === 'playing' || isTrickResolving) && leadSuit && (
            <div className="absolute top-2 z-10 flex items-center space-x-1.5 bg-slate-900/90 border border-slate-700 px-3 py-1 rounded-full shadow-lg">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Lead:</span>
              <SuitIcon suit={leadSuit} className="w-3.5 h-3.5" />
              <span className={`text-[11px] font-black uppercase ${leadSuit === 'hearts' || leadSuit === 'diamonds' ? 'text-red-400' : 'text-white'}`}>
                {leadSuit}
              </span>
              <span className="text-[9px] text-gray-400 hidden sm:inline">(Follow suit!)</span>
            </div>
          )}

          {/* Played Cards in Trick Arena (Clearly Positioned and Visible!) */}
          {(state.phase === 'playing' || isTrickResolving) && (
            <div className="relative w-full h-full flex items-center justify-center">
              {trickCards.map(pc => {
                const player = state.players[pc.player];
                const isWinningCard = isTrickResolving && state.currentTrick.winningCard?.id === pc.card.id;

                // Position each card towards the player who threw it
                const positionStyle =
                  pc.player === 0
                    ? 'bottom-4 left-1/2 -translate-x-1/2'
                    : pc.player === 2
                    ? 'top-8 left-1/2 -translate-x-1/2'
                    : pc.player === 1
                    ? 'left-4 top-1/2 -translate-y-1/2'
                    : 'right-4 top-1/2 -translate-y-1/2';

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
                  {state.lastHandResult.message}
                </p>
              </div>

              {/* Score Update */}
              <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700 flex justify-around items-center">
                <div>
                  <div className="text-xs font-bold text-cyan-300">Team Blue</div>
                  <div className="text-2xl font-black text-white">{state.scores[0]}</div>
                </div>
                <div className="text-xs text-gray-500 font-bold">vs</div>
                <div>
                  <div className="text-xs font-bold text-red-300">Team Red</div>
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
            tricksWon={state.tricksWon[0]}
            marches={state.scores[0] >= 2 ? 1 : 0}
            euchres={state.scores[0] >= 2 ? 1 : 0}
            loners={state.scores[0] >= 4 ? 1 : 0}
            lpDelta={state.scores[0] >= state.rules.targetScore ? 24 : -14}
            oldTier={(state.players[0].rankTier as RankTier) || '9'}
            newTier={(state.players[0].rankTier as RankTier) || '9'}
            currentPoints={55}
            xpEarned={state.scores[0] >= state.rules.targetScore ? 450 : 250}
            playerLevel={1}
            playerXp={450}
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
              setState(newGame);
            }}
            onExit={onExitGame}
          />
        )}
      </main>

      {/* Bottom Player Hand Tray with Safe Area Inset for Home Indicator (Hidden when match is completed to avoid screen clutter) */}
      {state.phase !== 'game_over' && (
        <footer
          className={`relative bg-slate-900/95 border-t border-slate-800 px-2 py-2 flex flex-col items-center z-50 flex-shrink-0 min-h-[145px] shadow-2xl transition-opacity duration-300 ${
            state.phase === 'hand_scored' ? 'opacity-30 pointer-events-none' : 'opacity-100'
          }`}
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
        >
          {/* Turn prompt indicator */}
          <div className="text-[11px] sm:text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
            {state.phase === 'hand_scored' ? (
              <span className="text-amber-400 font-bold">Hand Scored — Ready for Next Deal</span>
            ) : state.phase === 'trick_resolving' ? (
              <span className="text-amber-400 font-bold animate-pulse">Resolving Trick...</span>
            ) : isDealerDiscardPhase ? (
              <span className="text-amber-400 font-black animate-pulse">
                {isHumanBenched
                  ? 'Partner Going Alone — Tap a card to discard before sitting out'
                  : 'Tap a card to discard it to the kitty'}
              </span>
            ) : isHumanBenched ? (
              <span className="text-gray-400">Partner is going alone. Your hand is sitting out.</span>
            ) : isHumanTurn && (state.phase === 'bidding_round_1' || state.phase === 'bidding_round_2') ? (
              <span className="text-amber-400 font-black animate-pulse flex items-center space-x-1">
                <span>👉 Your Call: Choose Trump or Pass! Hand cards below 👇</span>
              </span>
            ) : isHumanTurn && state.phase === 'playing' ? (
              <span className="text-amber-400 font-black animate-pulse flex items-center space-x-1">
                <span>👉 Your turn!</span>
                {leadSuit && (
                  <span>Must follow {leadSuit.toUpperCase()} if you have it!</span>
                )}
              </span>
            ) : (
              <span className="text-gray-400">Waiting for {state.players[state.currentTurn]?.name || 'Opponent'}...</span>
            )}
          </div>

          {/* Hand Cards */}
          <div className="flex justify-center items-center -space-x-2 sm:-space-x-3 max-w-full overflow-x-auto px-4 py-2 min-h-[130px]">
            {humanHand.map((card, idx) => {
              const isLegal = state.phase === 'playing'
                ? isCardPlayLegal(card, humanHand, state.currentTrick, state.trumpSuit)
                : isDealerDiscardPhase;

              return (
                <div
                  key={card.id}
                  className="transition-transform duration-150 hover:-translate-y-3 flex-shrink-0"
                  style={{ zIndex: idx }}
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
                    size="md"
                    onClick={() => {
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
