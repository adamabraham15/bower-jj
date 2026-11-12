/**
 * BOWER JJ — Unified Authoritative Game Lobby
 * A single, seamless lobby where players join, select or swap seats (Blue or Red),
 * configure house rules, toggle game modes (Rivalry vs Custom Match), invite friends,
 * and launch matches.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Swords,
  Users,
  Copy,
  Check,
  Link,
  Bot,
  Sliders,
  UserPlus,
  Trash2,
  Clock,
  ArrowLeftRight,
  Shield,
  Send,
  Sparkles,
} from 'lucide-react';
import { Room, FriendSummary, PlayerSlot } from '../../server/types';
import { RankBadge, RankTier } from './RankBadge';
import { AIDifficulty, PlayerPosition } from '../engine/types';
import { multiplayerClient } from '../services/multiplayerClient';
import { sounds } from '../audio/sound';

export type LobbyGameMode = 'rivals' | 'custom';

interface GameLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends?: FriendSummary[];
  userRank: RankTier;
  userPoints: number;
  initialMode?: LobbyGameMode;
  onMatchFound: () => void;
}

export const GameLobbyModal: React.FC<GameLobbyModalProps> = ({
  isOpen,
  onClose,
  friends = [],
  userRank,
  userPoints,
  initialMode = 'custom',
  onMatchFound,
}) => {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(multiplayerClient.getCurrentRoom());
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());
  const [usernameInput, setUsernameInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [aiFillDifficulty, setAiFillDifficulty] = useState<AIDifficulty>('medium');
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    multiplayerClient.connect();

    // Check if an active lobby room already exists (e.g. joined via code, invite, or link)
    const activeRoom = multiplayerClient.getCurrentRoom();
    if (activeRoom && activeRoom.status === 'lobby') {
      setCurrentRoom(activeRoom);
    } else if (!multiplayerClient.isPendingJoin()) {
      // Create fresh room with the chosen initial mode
      multiplayerClient.createRoom(undefined, initialMode);
    }

    const unsubscribe = multiplayerClient.setCallbacks({
      onRoom: (room) => {
        setCurrentRoom(room);
        if (room.status === 'playing') {
          sounds.playVictoryFanfare();
          onMatchFound();
        }
      },
      onGameSync: () => {
        onMatchFound();
      },
      onNotice: (msg) => {
        setStatusMessage(msg);
        setTimeout(() => setStatusMessage(null), 4000);
      },
      onError: (msg) => {
        setStatusMessage(msg);
        setTimeout(() => setStatusMessage(null), 4000);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, initialMode, onMatchFound]);

  if (!isOpen) return null;

  const myUserId = multiplayerClient.getUserId();
  const myUsername = multiplayerClient.getUsername();

  const myPos = currentRoom?.slots.findIndex(
    s => s && (myUserId ? s.userId === myUserId : s.username === myUsername)
  );
  const myPosition = myPos !== undefined && myPos !== -1 ? (myPos as PlayerPosition) : null;

  const isHost = Boolean(
    currentRoom && (
      myUserId
        ? currentRoom.hostUserId === myUserId
        : (currentRoom.slots[0]?.username === myUsername || currentRoom.hostUserId === currentRoom.slots[0]?.userId)
    )
  );

  const occupiedSlots = currentRoom?.slots.filter(s => s !== null) || [];
  const occupiedCount = occupiedSlots.length;
  const humanSlots = occupiedSlots.filter(s => !s?.isAI);
  const humanCount = humanSlots.length;

  const blueSlot0 = currentRoom?.slots[0];
  const redSlot1 = currentRoom?.slots[1];
  const blueSlot2 = currentRoom?.slots[2];
  const redSlot3 = currentRoom?.slots[3];

  const hasHumanOnBlue = Boolean((blueSlot0 && !blueSlot0.isAI) || (blueSlot2 && !blueSlot2.isAI));
  const hasHumanOnRed = Boolean((redSlot1 && !redSlot1.isAI) || (redSlot3 && !redSlot3.isAI));
  const hasTwoOpposingHumans = hasHumanOnBlue && hasHumanOnRed;

  const currentMode: LobbyGameMode = (currentRoom?.queueMode === 'rivals') ? 'rivals' : 'custom';

  const handleCopyLink = () => {
    if (!currentRoom) return;
    const origin = typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://bower-jj.vercel.app';
    const link = `${origin}/?join=${currentRoom.code}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSwitchTeam = (targetTeam: 'blue' | 'red') => {
    sounds.playUiClick();
    const targetSeats: PlayerPosition[] = targetTeam === 'blue' ? [0, 2] : [1, 3];
    if (myPosition !== null && targetSeats.includes(myPosition)) return;

    // Prefer empty seat on that team
    const emptyTarget = targetSeats.find(pos => currentRoom?.slots[pos] === null);
    if (emptyTarget !== undefined) {
      multiplayerClient.switchSeat(emptyTarget);
    } else {
      // Swap with first seat on target team
      multiplayerClient.switchSeat(targetSeats[0]);
    }
  };

  const handleSwitchSeat = (targetPos: PlayerPosition) => {
    sounds.playUiClick();
    multiplayerClient.switchSeat(targetPos);
  };

  const handleSelectMode = (mode: LobbyGameMode) => {
    if (!isHost) return;
    sounds.playUiClick();
    multiplayerClient.updateRoomMode(mode);
  };

  const handleUpdateRule = (patch: any) => {
    if (!isHost) return;
    sounds.playUiClick();
    multiplayerClient.updateRoomRules(patch);
  };

  const handleInviteFriend = (friend: FriendSummary) => {
    if (!currentRoom) return;
    sounds.playUiClick();
    multiplayerClient.sendPartyInvite(friend.userId, currentMode === 'rivals' ? 'rivals' : 'duo');
    setInvitedFriends(prev => new Set(prev).add(friend.userId));
    setStatusMessage(`Invitation sent to ${friend.username}!`);
  };

  const handleInviteByUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    sounds.playUiClick();
    multiplayerClient.sendFriendRequest(usernameInput.trim());
    setStatusMessage(`Challenge sent to ${usernameInput.trim()}!`);
    setUsernameInput('');
  };

  const handleStartMatch = () => {
    sounds.playVictoryFanfare();
    multiplayerClient.startGame();
  };

  const handleClose = () => {
    sounds.playUiClick();
    multiplayerClient.leaveRoom();
    setCurrentRoom(null);
    setStatusMessage(null);
    onClose();
  };

  const onlineFriends = friends.filter(f => f.isOnline);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-amber-500/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <span>Game Room Lobby</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                  ● Ready
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Choose your seats and game mode before launching
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {!currentRoom ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 my-auto min-h-[320px]">
            {statusMessage ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                  <X className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-white">Unable to Join Room</h3>
                  <p className="text-xs text-red-300 max-w-xs">{statusMessage}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                  >
                    Return to Menu
                  </button>
                  <button
                    onClick={() => {
                      setStatusMessage(null);
                      multiplayerClient.createRoom(undefined, initialMode);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md"
                  >
                    Create New Room
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 animate-pulse">
                  <Users className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-white">
                    {multiplayerClient.getPendingJoinCode()
                      ? `Joining Room ${multiplayerClient.getPendingJoinCode()}...`
                      : 'Connecting to Game Lobby...'}
                  </h3>
                  <p className="text-xs text-gray-400">Synchronizing seats and match rules with host...</p>
                </div>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Status Toast */}
            {statusMessage && (
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-bold text-center animate-in fade-in">
                {statusMessage}
              </div>
            )}

            {/* Room Code & Invite Strip */}
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block">
                  Room Code
                </span>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black font-mono tracking-widest text-amber-400">
                    {currentRoom.code}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentRoom.code);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    title="Copy Room Code"
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-amber-300 transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-sm active:scale-95"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
              </button>
            </div>

          {/* Game Mode Selector (Host can change mode in lobby, Guest views selected mode) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-400">
              <span className="uppercase tracking-wider flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Game Mode {isHost ? '(Host Selector)' : '(Selected by Host)'}</span>
              </span>
              <span className="text-[10px] text-amber-400 font-mono">
                {currentMode === 'rivals' ? '1v1 Head-to-Head' : '4-Player Custom'}
              </span>
            </div>

            {isHost ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSelectMode('rivals')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    currentMode === 'rivals'
                      ? 'bg-cyan-950/70 border-cyan-400 ring-2 ring-cyan-500/40 shadow-lg text-white'
                      : 'bg-slate-950/60 border-slate-800 text-gray-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Swords className={`w-4 h-4 ${currentMode === 'rivals' ? 'text-cyan-400' : 'text-gray-500'}`} />
                    <span className="text-xs font-black uppercase tracking-wider">Friendly Rivalry</span>
                  </div>
                  <p className="text-[10px] opacity-80 leading-relaxed">
                    1v1 Head-to-Head: You & your rival compete on opposing teams (Blue vs Red) with AI partners.
                  </p>
                </button>

                <button
                  onClick={() => handleSelectMode('custom')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    currentMode === 'custom'
                      ? 'bg-amber-950/70 border-amber-400 ring-2 ring-amber-500/40 shadow-lg text-white'
                      : 'bg-slate-950/60 border-slate-800 text-gray-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Users className={`w-4 h-4 ${currentMode === 'custom' ? 'text-amber-400' : 'text-gray-500'}`} />
                    <span className="text-xs font-black uppercase tracking-wider">Custom Match</span>
                  </div>
                  <p className="text-[10px] opacity-80 leading-relaxed">
                    Play with up to 4 players or bots. Freely choose teams, seats, and custom house rules.
                  </p>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  {currentMode === 'rivals' ? (
                    <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300">
                      <Swords className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
                      <Users className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-black text-white">
                      {currentMode === 'rivals' ? 'Friendly Rivalry (1v1)' : 'Custom Match (4-Player)'}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {currentMode === 'rivals'
                        ? 'Rivals are seated on opposing teams (Blue vs Red) with AI partners.'
                        : 'Choose your preferred seat on Blue or Red team.'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Team Switch Bar */}
          <div className="p-2.5 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold text-gray-400">
              Your Team:{' '}
              <span className={myPosition === 0 || myPosition === 2 ? 'text-blue-400 font-black' : myPosition === 1 || myPosition === 3 ? 'text-red-400 font-black' : 'text-gray-400'}>
                {myPosition === 0 || myPosition === 2 ? '🔵 Blue Team' : myPosition === 1 || myPosition === 3 ? '🔴 Red Team' : 'Unassigned'}
              </span>
            </div>
            <div className="flex space-x-1.5">
              <button
                onClick={() => handleSwitchTeam('blue')}
                disabled={myPosition === 0 || myPosition === 2}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center space-x-1 ${
                  myPosition === 0 || myPosition === 2
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 cursor-default'
                    : 'bg-slate-800 text-blue-300 hover:bg-blue-950/60 border border-blue-500/40 active:scale-95'
                }`}
              >
                <span>🔵 Join Blue</span>
                {(myPosition === 0 || myPosition === 2) && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => handleSwitchTeam('red')}
                disabled={myPosition === 1 || myPosition === 3}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center space-x-1 ${
                  myPosition === 1 || myPosition === 3
                    ? 'bg-red-600 text-white shadow-md shadow-red-500/30 cursor-default'
                    : 'bg-slate-800 text-red-300 hover:bg-red-950/60 border border-red-500/40 active:scale-95'
                }`}
              >
                <span>🔴 Join Red</span>
                {(myPosition === 1 || myPosition === 3) && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Table Seating: 4 Seats across Blue & Red teams */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-gray-400">
              <span>Table Seats ({occupiedCount}/4 seated)</span>
              <span className="text-amber-400 font-mono">
                Goal: {currentRoom?.rules.targetScore || 10} Pts
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[0, 1, 2, 3].map((pos) => {
                const slot = currentRoom?.slots[pos];
                const isBlueTeam = pos % 2 === 0;
                const isMe = myPosition === pos;
                const seatRole = pos === 0
                  ? 'South (Host / Blue)'
                  : pos === 2
                  ? 'North (Partner / Blue)'
                  : pos === 1
                  ? 'West (Opponent / Red)'
                  : 'East (Partner / Red)';

                return (
                  <div
                    key={pos}
                    className={`p-2.5 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                      isMe
                        ? isBlueTeam
                          ? 'bg-blue-950/80 border-blue-400 ring-2 ring-blue-500/40 shadow-lg text-blue-100'
                          : 'bg-red-950/80 border-red-400 ring-2 ring-red-500/40 shadow-lg text-red-100'
                        : slot
                        ? isBlueTeam
                          ? 'bg-blue-950/40 border-blue-500/40 text-blue-200'
                          : 'bg-red-950/40 border-red-500/40 text-red-200'
                        : 'bg-slate-950/60 border-dashed border-slate-700 text-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between min-w-0">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="text-base flex-shrink-0">{slot ? slot.avatarIcon : '🪑'}</span>
                        <div className="min-w-0">
                          <div className="font-bold truncate text-[11px] flex items-center space-x-1">
                            <span>{slot ? slot.username : `Empty Seat ${pos + 1}`}</span>
                            {isMe && (
                              <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1 rounded-md">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] opacity-75">
                            {seatRole}
                          </div>
                        </div>
                      </div>

                      {/* Host can kick other seated players */}
                      {isHost && slot && !isMe && (
                        <button
                          onClick={() => {
                            sounds.playUiClick();
                            multiplayerClient.kickPlayer(pos as PlayerPosition);
                          }}
                          title="Kick Player"
                          className="p-1 rounded-md text-red-400 hover:bg-red-950/80 transition-colors flex-shrink-0 ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Seat Action Buttons: Sit Here or Swap */}
                    <div className="flex justify-end pt-1">
                      {!slot ? (
                        <button
                          onClick={() => handleSwitchSeat(pos as PlayerPosition)}
                          className={`px-2.5 py-1 rounded-lg font-black text-[10px] shadow-sm flex items-center space-x-1 transition-all active:scale-95 ${
                            isBlueTeam
                              ? 'bg-blue-500 hover:bg-blue-400 text-white'
                              : 'bg-red-500 hover:bg-red-400 text-white'
                          }`}
                        >
                          <span>Sit Here</span>
                        </button>
                      ) : !isMe ? (
                        <button
                          onClick={() => handleSwitchSeat(pos as PlayerPosition)}
                          className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold flex items-center space-x-1 border border-amber-500/30 transition-all active:scale-95"
                          title="Swap seats with this position"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          <span>Swap</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* House Rules Configuration */}
          {isHost ? (
            <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/80 space-y-3">
              <div className="flex items-center space-x-1.5 text-xs font-black uppercase text-amber-400">
                <Sliders className="w-3.5 h-3.5" />
                <span>Host Game Rules</span>
              </div>

              {/* Target Score */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-bold">Winning Points:</span>
                <div className="flex space-x-1.5">
                  {[5, 7, 10].map((score) => (
                    <button
                      key={score}
                      onClick={() => handleUpdateRule({ targetScore: score })}
                      className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all ${
                        (currentRoom?.rules.targetScore || 10) === score
                          ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stick the Dealer */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-bold">Stick The Dealer:</span>
                <button
                  onClick={() => handleUpdateRule({ stickTheDealer: !currentRoom?.rules.stickTheDealer })}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                    currentRoom?.rules.stickTheDealer !== false
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                      : 'bg-slate-700 text-gray-400 hover:text-white'
                  }`}
                >
                  {currentRoom?.rules.stickTheDealer !== false ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Canadian Loner */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-bold">Canadian Loner (Forced Solo):</span>
                <button
                  onClick={() => {
                    const nextVal = currentRoom?.rules.partnerOrderUpGoesAlone === false;
                    handleUpdateRule({ canadianLoner: nextVal, partnerOrderUpGoesAlone: nextVal });
                  }}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                    currentRoom?.rules.partnerOrderUpGoesAlone !== false
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                      : 'bg-slate-700 text-gray-400 hover:text-white'
                  }`}
                >
                  {currentRoom?.rules.partnerOrderUpGoesAlone !== false ? 'Active' : 'Off'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-800/40 rounded-2xl border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                <div className="flex items-center space-x-1.5 text-amber-400">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Game Rules</span>
                </div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Set by Host</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-gray-400">Goal</div>
                  <div className="font-black text-amber-300">{currentRoom?.rules.targetScore || 10} Pts</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-gray-400">Stick Dealer</div>
                  <div className="font-black text-emerald-400">
                    {currentRoom?.rules.stickTheDealer !== false ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="text-[10px] text-gray-400">Canadian Loner</div>
                  <div className="font-black text-emerald-400">
                    {currentRoom?.rules.partnerOrderUpGoesAlone !== false ? 'Active' : 'Off'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Online Friends Direct Invite Drawer */}
          <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-400">
              <span className="flex items-center space-x-1">
                <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Invite Online Friends</span>
              </span>
              <span className="text-[10px] text-emerald-400">
                {onlineFriends.length} Online
              </span>
            </div>

            {onlineFriends.length > 0 ? (
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {onlineFriends.map((fr) => {
                  const isInvited = invitedFriends.has(fr.userId);
                  return (
                    <div
                      key={fr.userId}
                      className="p-1.5 px-2 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <span>{fr.avatarIcon}</span>
                        <span className="font-bold text-white text-[11px]">{fr.username}</span>
                      </div>

                      <button
                        onClick={() => handleInviteFriend(fr)}
                        disabled={isInvited}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all ${
                          isInvited
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                        }`}
                      >
                        {isInvited ? 'Invited ✓' : 'Invite'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <form onSubmit={handleInviteByUsername} className="flex space-x-2 pt-1">
                <input
                  type="text"
                  placeholder="Challenge player by username..."
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400 font-mono"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            )}
          </div>
        </div>
        )}

        {/* Footer Actions */}
        {currentRoom && (
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2">
          {isHost ? (
            <div className="space-y-2">
              {/* Bot Difficulty & Fill */}
              {occupiedCount < 4 && (
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1 flex-1">
                    {(['easy', 'medium', 'hard'] as AIDifficulty[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setAiFillDifficulty(d)}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-black capitalize transition-all ${
                          aiFillDifficulty === d
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-gray-400'
                        }`}
                      >
                        {d} AI
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      sounds.playUiClick();
                      multiplayerClient.fillWithAI(aiFillDifficulty);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-bold text-amber-300 flex items-center space-x-1 shadow-sm"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>Fill Bots</span>
                  </button>
                </div>
              )}

              {/* Start Match Button */}
              {currentMode === 'rivals' ? (
                hasTwoOpposingHumans ? (
                  <button
                    onClick={handleStartMatch}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/30 flex items-center justify-center space-x-2 active:scale-95 transition-all"
                  >
                    <Swords className="w-4 h-4 fill-slate-950" />
                    <span>Launch Rivalry Match!</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      sounds.playUiClick();
                      multiplayerClient.fillWithAI();
                      setTimeout(() => multiplayerClient.startGame(), 250);
                    }}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-cyan-500/30 flex items-center justify-center space-x-2 active:scale-95 transition-all"
                  >
                    <Bot className="w-4 h-4" />
                    <span>Play vs Bot Rival ({occupiedCount}/4)</span>
                  </button>
                )
              ) : (
                <button
                  onClick={handleStartMatch}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 flex items-center justify-center space-x-2 transition-all active:scale-95"
                >
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>
                    {occupiedCount === 4
                      ? `Start Match (4/4 Ready)`
                      : `Start Match (Fill Remaining with ${aiFillDifficulty.toUpperCase()} Bots)`}
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-full py-3 rounded-2xl bg-slate-800/80 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center space-x-2">
                <Clock className="w-4 h-4 animate-spin text-amber-400" />
                <span>
                  {occupiedCount === 4
                    ? 'All 4 seats ready! Waiting for host to start match...'
                    : `Waiting for host to start match (${occupiedCount}/4 seated)...`}
                </span>
              </div>
              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white text-xs font-bold transition-colors"
              >
                Leave Lobby
              </button>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};
