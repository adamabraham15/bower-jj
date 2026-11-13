/**
 * BOWER JJ — Live Authoritative Multiplayer Card Table
 * Powered by real-time WebSockets with Hand Privacy Anti-Cheat.
 */

import React, { useState, useEffect } from 'react';
import { SanitizedGameState, PlayerSlot, RankTier } from '../../server/types';
import { Card, Suit, PlayerPosition, getPlayerTeam } from '../engine/types';
import { isCardPlayLegal, formatCardName, ALL_SUITS } from '../engine/cards';
import { CardView, SuitIcon } from './CardView';
import { PostMatchModal } from './PostMatchModal';
import { PublicProfileModal, PublicPlayerData } from './PublicProfileModal';
import { PlayerProfileData } from './ProfileModal';
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
  onExitGame: () => void;
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
  onExitGame,
}) => {
  const [aloneToggle, setAloneToggle] = useState(false);
  const [inspectedPlayer, setInspectedPlayer] = useState<PublicPlayerData | null>(null);
  const [mutedUsernames, setMutedUsernames] = useState<Set<string>>(new Set());
  const [autoDealCountdown, setAutoDealCountdown] = useState<number>(6);

  useEffect(() => {
    if (serverState.phase !== 'hand_scored') {
      setAutoDealCountdown(6);
      return;
    }

    const timer = setInterval(() => {
      setAutoDealCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          multiplayerClient.nextHand();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [serverState.phase]);

  const yourPos = serverState.yourPosition;
  const isYourTurn = serverState.currentTurn === yourPos;
  const isDealer = serverState.dealer === yourPos;
  const isDealerDiscardPhase = serverState.phase === 'dealer_discard' && isDealer;
  const isBenched = serverState.benchedPlayer === yourPos;
  const isTrickResolving = serverState.phase === 'trick_resolving';

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
    return serverState.slots.find(s => s.position === pos);
  };

  const renderPlayerPod = (pos: PlayerPosition) => {
    const slot = getSlot(pos);
    const relPos = getRelativePosition(pos);
    const isCurrentTurn = serverState.currentTurn === pos && serverState.phase === 'playing';
    const isPlayerDealer = serverState.dealer === pos;
    const isSlotBenched = serverState.benchedPlayer === pos;
    const isBlueTeam = getPlayerTeam(pos) === 0;
    const cardCount = serverState.handCounts[pos] || 0;
    const emote = activeEmotes[pos];

    const positionStyle = {
      bottom: 'bottom-28 sm:bottom-36',
      left: 'left-2 sm:left-6 top-1/2 -translate-y-1/2',
      top: 'top-2 sm:top-4',
      right: 'right-2 sm:right-6 top-1/2 -translate-y-1/2',
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

        <div
          onClick={() => {
            if (slot) {
              sounds.playUiClick();
              setInspectedPlayer({
                id: slot.userId || `bot_${slot.username}`,
                username: slot.username,
                avatarIcon: slot.avatarIcon,
                level: slot.isAI ? 8 : 1,
                rankTier: slot.rankTier || '9',
                rankPoints: 50,
                totalGames: slot.isAI ? 120 : 15,
                wins: slot.isAI ? 68 : 9,
                losses: slot.isAI ? 52 : 6,
                bestStreak: 4,
                isFriend: false,
                isOnline: slot.connected,
              });
              if (slot.userId) {
                multiplayerClient.fetchProfile(slot.userId, slot.username);
              }
            }
          }}
          title={slot ? `Inspect ${slot.username}` : undefined}
          className="relative cursor-pointer hover:scale-105 active:scale-95 transition-transform"
        >
          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl p-0.5 transition-all duration-300 flex items-center justify-center
              ${isBlueTeam ? 'bg-gradient-to-tr from-blue-600 to-cyan-400' : 'bg-gradient-to-tr from-red-600 to-amber-500'}
              ${isCurrentTurn ? 'ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-900 scale-105 shadow-lg shadow-amber-400/50' : 'opacity-90'}
              ${isSlotBenched ? 'grayscale opacity-50' : ''}`}
          >
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex flex-col items-center justify-center overflow-hidden">
              <span className="text-xl sm:text-2xl">{slot ? slot.avatarIcon : '🪑'}</span>
            </div>
          </div>

          {/* Dealer Chip */}
          {isPlayerDealer && (
            <div
              title="Dealer"
              className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-400 border-2 border-slate-900 text-slate-950 font-black text-[11px] flex items-center justify-center shadow-md animate-pulse"
            >
              D
            </div>
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
            <div className="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-gray-200 shadow-sm">
              {isSlotBenched ? 'BENCH' : `${cardCount} 🂠`}
            </div>
          )}
        </div>

        {/* Player Name */}
        <div className="mt-1 flex flex-col items-center">
          <div className="text-[11px] sm:text-xs font-bold text-white flex items-center space-x-1">
            <span>{slot ? (pos === yourPos ? `${slot.username} (You)` : slot.username) : `Seat ${pos}`}</span>
            {isCurrentTurn && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
          </div>
          {slot?.isAI && (
            <span className="text-[9px] uppercase tracking-wider text-gray-400 font-mono">
              AI ({slot.aiDifficulty})
            </span>
          )}
        </div>
      </div>
    );
  };

  const trickCards = serverState.currentTrick.cards;
  const leadSuit = serverState.currentTrick.leadSuit;

  return (
    <div className="relative w-full h-[100dvh] bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* Top Header */}
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

          {/* Scores */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-950 px-2 sm:px-2.5 py-1 rounded-xl border border-slate-800 shadow-inner text-xs">
            <div className="flex items-center space-x-1 sm:space-x-1.5">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-cyan-400" />
              <span className="font-black text-cyan-300">
                <span className="hidden sm:inline">BLUE: </span>
                <span className="sm:hidden">B: </span>
                {serverState.scores[0]}
              </span>
              <span className="hidden md:inline text-[10px] text-gray-400 font-mono">({serverState.tricksWon[0]} trk)</span>
            </div>
            <span className="text-gray-600 font-bold text-xs">-</span>
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-400" />
              <span className="font-black text-red-300">
                <span className="hidden sm:inline">RED: </span>
                <span className="sm:hidden">R: </span>
                {serverState.scores[1]}
              </span>
              <span className="hidden md:inline text-[10px] text-gray-400 font-mono">({serverState.tricksWon[1]} trk)</span>
            </div>
          </div>
        </div>

        {/* Trump Banner (Header) */}
        {serverState.trumpSuit && (
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-950 border border-amber-400 shadow-md">
            <span className="text-[10px] text-amber-400 uppercase font-black tracking-wide">TRUMP:</span>
            <SuitIcon suit={serverState.trumpSuit} className="w-4 h-4" />
            <span className={`text-xs font-black uppercase tracking-wider ${serverState.trumpSuit === 'hearts' || serverState.trumpSuit === 'diamonds' ? 'text-red-400' : 'text-slate-100'}`}>
              {serverState.trumpSuit}
            </span>
            {serverState.isAlone && (
              <span className="text-[8px] bg-red-600 text-white font-black px-1.5 rounded-sm ml-0.5 animate-pulse">
                ALONE
              </span>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center space-x-1 sm:space-x-1.5">
          <button
            onClick={onOpenEmotes}
            title="Emotes"
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

      {/* Main Felt Arena */}
      <main className="relative flex-1 min-h-0 bg-gradient-to-b from-[#071920] via-[#052225] to-[#031317] flex items-center justify-center p-2 sm:p-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.09)_0%,_transparent_70%)] pointer-events-none" />

        {/* 4 Seated Player Pods */}
        {[0, 1, 2, 3].map(pos => (
          <React.Fragment key={pos}>
            {renderPlayerPod(pos as PlayerPosition)}
          </React.Fragment>
        ))}

        {/* Center Trick Arena */}
        <div className="relative w-72 h-72 sm:w-84 sm:h-84 rounded-full border border-emerald-500/25 bg-emerald-950/25 backdrop-blur-xs flex items-center justify-center shadow-2xl">
          {/* Turned-up Card during Round 1 */}
          {serverState.phase === 'bidding_round_1' && serverState.upCard && (
            <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
              <span className="text-[11px] text-amber-300 font-black uppercase mb-1.5 tracking-wider bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                Turned-Up Card
              </span>
              <CardView card={serverState.upCard} size="md" isPlayable={false} />
            </div>
          )}

          {/* Lead Suit Banner */}
          {(serverState.phase === 'playing' || isTrickResolving) && leadSuit && (
            <div className="absolute top-2 z-10 flex items-center space-x-1.5 bg-slate-900/90 border border-slate-700 px-3 py-1 rounded-full shadow-lg">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Lead:</span>
              <SuitIcon suit={leadSuit} className="w-3.5 h-3.5" />
              <span className={`text-[11px] font-black uppercase ${leadSuit === 'hearts' || leadSuit === 'diamonds' ? 'text-red-400' : 'text-white'}`}>
                {leadSuit}
              </span>
            </div>
          )}

          {/* Played Cards in Trick Arena */}
          {(serverState.phase === 'playing' || isTrickResolving) && (
            <div className="relative w-full h-full flex items-center justify-center">
              {trickCards.map(pc => {
                const relPos = getRelativePosition(pc.player);
                const slot = getSlot(pc.player);
                const isWinningCard = isTrickResolving && serverState.currentTrick.winningCard?.id === pc.card.id;

                const positionStyle = {
                  bottom: 'bottom-4 left-1/2 -translate-x-1/2',
                  left: 'left-4 top-1/2 -translate-y-1/2',
                  top: 'top-8 left-1/2 -translate-x-1/2',
                  right: 'right-4 top-1/2 -translate-y-1/2',
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

              {serverState.upCard && (
                <div className="my-1 flex flex-col items-center p-2.5 bg-slate-950/70 rounded-2xl border border-amber-500/40 shadow-inner">
                  <CardView card={serverState.upCard} size="md" isPlayable={false} />
                </div>
              )}

              {/* Alone Toggle */}
              <label className="flex items-center space-x-2 cursor-pointer bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 hover:border-amber-400">
                <input
                  type="checkbox"
                  checked={aloneToggle}
                  onChange={e => setAloneToggle(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0"
                />
                <span className="text-xs font-bold text-amber-300">Go Alone! 🚀 (+4 Pts)</span>
              </label>

              <div className="flex space-x-3 w-full pt-1">
                <button
                  onClick={() => {
                    sounds.playUiClick();
                    multiplayerClient.bid('pass', undefined, false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-300 transition-all active:scale-95"
                >
                  Pass
                </button>
                <button
                  onClick={() => {
                    sounds.playTrumpCall();
                    multiplayerClient.bid(isDealer ? 'pick_up' : 'order_up', undefined, aloneToggle);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30 transition-all active:scale-95"
                >
                  {isDealer ? 'Pick Up' : 'Order Up'}
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

              {/* Alone Toggle */}
              <label className="flex items-center space-x-2 cursor-pointer bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 hover:border-amber-400">
                <input
                  type="checkbox"
                  checked={aloneToggle}
                  onChange={e => setAloneToggle(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0"
                />
                <span className="text-xs font-bold text-amber-300">Go Alone! 🚀</span>
              </label>

              <div className="grid grid-cols-3 gap-2 w-full">
                {ALL_SUITS.filter(s => s !== serverState.upCard?.suit).map(suit => (
                  <button
                    key={suit}
                    onClick={() => {
                      sounds.playTrumpCall();
                      multiplayerClient.bid('call_trump', suit, aloneToggle);
                    }}
                    className="py-3 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 border border-slate-700 font-black text-sm flex items-center justify-center space-x-1.5 transition-all active:scale-95 group"
                  >
                    <SuitIcon suit={suit} className="w-4 h-4" />
                    <span className="capitalize text-xs group-hover:text-slate-950">{suit}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  sounds.playUiClick();
                  multiplayerClient.bid('pass', undefined, false);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-400"
              >
                Pass
              </button>
            </div>
          </div>
        )}

        {/* Dealer Discard Prompt */}
        {isDealerDiscardPhase && (
          <div className="absolute top-16 z-40 bg-amber-500 text-slate-950 px-4 py-2 rounded-2xl shadow-2xl font-black text-xs animate-bounce flex items-center space-x-2">
            <span>👇</span>
            <span>Dealer Discard: Tap 1 card from your hand below to discard it to the kitty!</span>
          </div>
        )}

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
                  {serverState.lastHandResult.message}
                </p>
              </div>

              <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700 flex justify-around items-center">
                <div>
                  <div className="text-xs font-bold text-cyan-300">Team Blue</div>
                  <div className="text-2xl font-black text-white">{serverState.scores[0]}</div>
                </div>
                <div className="text-xs text-gray-500 font-bold">vs</div>
                <div>
                  <div className="text-xs font-bold text-red-300">Team Red</div>
                  <div className="text-2xl font-black text-white">{serverState.scores[1]}</div>
                </div>
              </div>

              <button
                onClick={() => {
                  sounds.playDealCard();
                  multiplayerClient.nextHand();
                }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 transition-all active:scale-95"
              >
                Deal Next Hand (Auto in {autoDealCountdown}s) →
              </button>
            </div>
          </div>
        )}

        {/* Post-Match Progression & Accolades Screen */}
        {serverState.phase === 'game_over' && (
          <PostMatchModal
            isOpen={true}
            isVictory={serverState.scores[serverState.yourPosition % 2] >= 10}
            finalScore={serverState.scores}
            tricksWon={serverState.tricksWon[serverState.yourPosition % 2]}
            marches={serverState.scores[serverState.yourPosition % 2] >= 2 ? 1 : 0}
            euchres={serverState.scores[serverState.yourPosition % 2] >= 2 ? 1 : 0}
            loners={serverState.scores[serverState.yourPosition % 2] >= 4 ? 1 : 0}
            lpDelta={
              serverState.queueMode === 'custom' || serverState.queueMode === 'casual'
                ? 0
                : (lastRankUpdate?.lpChange ?? (serverState.scores[serverState.yourPosition % 2] >= 10 ? 24 : -16))
            }
            oldTier={lastRankUpdate?.oldTier || (profile?.rankTier as any) || serverState.slots[serverState.yourPosition]?.rankTier || '9'}
            newTier={lastRankUpdate?.newTier || (profile?.rankTier as any) || serverState.slots[serverState.yourPosition]?.rankTier || '9'}
            currentPoints={lastRankUpdate?.newPoints ?? profile?.rankPoints ?? 0}
            xpEarned={serverState.scores[serverState.yourPosition % 2] >= 10 ? 475 : 250}
            playerLevel={profile?.level ?? 1}
            playerXp={profile?.xp ?? 475}
            nextLevelXp={profile?.nextLevelXp ?? 1000}
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
              multiplayerClient.leaveQueue();
              onExitGame();
            }}
            onExit={onExitGame}
          />
        )}
      </main>

      {/* Bottom Player Hand Tray with Safe Area Inset for Home Indicator (Hidden when match is completed to avoid screen clutter) */}
      {serverState.phase !== 'game_over' && (
        <footer
          className={`relative bg-slate-900/95 border-t border-slate-800 px-2 py-2 flex flex-col items-center z-50 flex-shrink-0 min-h-[145px] shadow-2xl transition-opacity duration-300 ${serverState.phase === 'hand_scored' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
        >
          {/* Turn prompt indicator */}
          <div className="text-[11px] sm:text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
            {serverState.phase === 'hand_scored' ? (
              <span className="text-amber-400 font-bold">Hand Scored — Next Deal Starting in {autoDealCountdown}s...</span>
            ) : serverState.phase === 'trick_resolving' ? (
              <span className="text-amber-400 font-bold animate-pulse">Resolving Trick...</span>
            ) : isBenched ? (
              <span className="text-gray-400">Partner is going alone. Your hand is sitting out.</span>
            ) : isYourTurn && (serverState.phase === 'bidding_round_1' || serverState.phase === 'bidding_round_2') ? (
              <span className="text-amber-400 font-black animate-pulse flex items-center space-x-1">
                <span>👉 Your Call: Choose Trump or Pass! Hand cards below 👇</span>
              </span>
            ) : isYourTurn && serverState.phase === 'playing' ? (
              <span className="text-amber-400 font-black animate-pulse flex items-center space-x-1">
                <span>👉 Your turn!</span>
                {leadSuit && (
                  <span>Must follow {leadSuit.toUpperCase()} if you have it!</span>
                )}
              </span>
            ) : isDealerDiscardPhase ? (
              <span className="text-amber-400 font-black animate-pulse">Tap a card to discard it to the kitty</span>
            ) : (
              <span className="text-gray-400">Waiting for other players...</span>
            )}
          </div>

          {/* Hand Cards (Only Your Cards exist here!) */}
          <div className="flex justify-center items-center -space-x-2 sm:-space-x-3 max-w-full overflow-x-auto px-4 py-2 min-h-[130px]">
            {serverState.yourHand.map((card, idx) => {
              const isLegal = serverState.phase === 'playing'
                ? isCardPlayLegal(card, serverState.yourHand, serverState.currentTrick, serverState.trumpSuit)
                : isDealerDiscardPhase;

              return (
                <div
                  key={card.id}
                  className="transition-transform duration-150 hover:-translate-y-3 flex-shrink-0"
                  style={{ zIndex: idx }}
                >
                  <CardView
                    card={card}
                    trumpSuit={serverState.trumpSuit}
                    isPlayable={!isBenched && isYourTurn && isLegal}
                    size="md"
                    onClick={() => {
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
    </div>
  );
};
