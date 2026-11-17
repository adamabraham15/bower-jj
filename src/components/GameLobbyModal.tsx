/**
 * BOWER JJ — Unified Authoritative Game Lobby
 * A single, seamless lobby where players join, select or swap seats (Blue or Red),
 * configure house rules, invite friends by username or online status,
 * fill with bots, and launch matches — consolidated to fit onto one screen.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Users,
  Bot,
  Sliders,
  UserPlus,
  Trash2,
  Clock,
  ArrowLeftRight,
  Send,
  Sparkles,
  Check,
} from 'lucide-react';
import { Room, FriendSummary, PlayerSlot } from '../../server/types';
import { RankTier } from './RankBadge';
import { AIDifficulty, PlayerPosition, DEFAULT_RULES, EuchreHouseRules } from '../engine/types';
import { multiplayerClient } from '../services/multiplayerClient';
import { sounds } from '../audio/sound';
import { AvatarPortrait } from './AvatarPortrait';
import { AudioControlsPopover } from './AudioControlsPopover';

export type LobbyGameMode = 'rivals' | 'custom';

interface GameLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends?: FriendSummary[];
  userRank: RankTier;
  userPoints: number;
  initialMode?: LobbyGameMode;
  autoFillBots?: boolean;
  onStartAIMatch?: (difficulty: AIDifficulty, rules: EuchreHouseRules) => void;
  onMatchFound: () => void;
}

export const GameLobbyModal: React.FC<GameLobbyModalProps> = ({
  isOpen,
  onClose,
  friends = [],
  initialMode = 'custom',
  autoFillBots = false,
  onStartAIMatch,
  onMatchFound,
}) => {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(multiplayerClient.getCurrentRoom());
  const [localPendingInvites, setLocalPendingInvites] = useState<Record<string, number>>({});
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [usernameInput, setUsernameInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [aiFillDifficulty, setAiFillDifficulty] = useState<AIDifficulty>('medium');
  const onMatchFoundRef = useRef(onMatchFound);
  onMatchFoundRef.current = onMatchFound;
  const autoFilledRef = useRef(false);

  // Live 1-second ticker so invite expiration countdowns update & auto-clear without manual refresh
  useEffect(() => {
    if (!isOpen) return;
    setNowMs(Date.now());
    const tick = setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);
      setLocalPendingInvites((prev) => {
        let changed = false;
        const next: Record<string, number> = {};
        for (const [uid, exp] of Object.entries(prev)) {
          if (exp > currentNow) {
            next[uid] = exp;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentRoom(null);
      setStatusMessage(null);
      setLocalPendingInvites({});
      autoFilledRef.current = false;
      return;
    }

    multiplayerClient.connect();
    multiplayerClient.fetchFriends();

    const friendsRefreshInterval = setInterval(() => {
      multiplayerClient.fetchFriends();
    }, 8000);

    // Check if an active lobby room already exists
    const activeRoom = multiplayerClient.getCurrentRoom();
    if (activeRoom && activeRoom.status === 'lobby') {
      setCurrentRoom(activeRoom);
      if (activeRoom.pendingInvites) {
        setLocalPendingInvites({ ...activeRoom.pendingInvites });
      }
      if (autoFillBots && activeRoom.slots.filter(s => s !== null).length < 4) {
        multiplayerClient.fillWithAI(aiFillDifficulty);
      }
    } else {
      setCurrentRoom(null);
      if (!multiplayerClient.isPendingJoin()) {
        // Create fresh room with the chosen initial mode and autoFillBots
        multiplayerClient.createRoom(undefined, initialMode, autoFillBots, aiFillDifficulty);
      }
    }

    const unsubscribe = multiplayerClient.setCallbacks({
      onRoom: (room) => {
        setCurrentRoom(room);
        // Auto-fill empty seats with bots when opened in bot mode
        if (autoFillBots && room.slots.filter(s => s !== null).length < 4) {
          multiplayerClient.fillWithAI(aiFillDifficulty);
        }

        // Synchronize pending invite state with authoritative server room state & current seated players
        const seatedIds = new Set(
          room.slots.filter((s): s is PlayerSlot => Boolean(s && !s.isAI && s.userId)).map((s) => s.userId!)
        );
        if (room.pendingInvites !== undefined) {
          const synced: Record<string, number> = {};
          const currentNow = Date.now();
          for (const [uid, exp] of Object.entries(room.pendingInvites)) {
            if (exp > currentNow && !seatedIds.has(uid)) {
              synced[uid] = exp;
            }
          }
          setLocalPendingInvites(synced);
        } else {
          setLocalPendingInvites((prev) => {
            const next = { ...prev };
            for (const uid of seatedIds) {
              delete next[uid];
            }
            return next;
          });
        }
        if (room.status === 'playing') {
          sounds.playVictoryFanfare();
          onMatchFoundRef.current();
        }
      },
      onGameSync: () => {
        onMatchFoundRef.current();
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

    const handleBeforeUnload = () => {
      multiplayerClient.leaveRoom();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(friendsRefreshInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unsubscribe();
    };
  }, [isOpen, initialMode, autoFillBots, aiFillDifficulty]);

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

  const currentMode: LobbyGameMode = (currentRoom?.queueMode === 'rivals') ? 'rivals' : 'custom';

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

  const handleUpdateRule = (patch: any) => {
    if (!isHost) return;
    sounds.playUiClick();
    multiplayerClient.updateRoomRules(patch);
  };

  const handleInviteFriend = (friend: FriendSummary) => {
    if (!currentRoom || humanCount >= 4) return;
    sounds.playUiClick();
    const expiresAt = Date.now() + 30000;
    setLocalPendingInvites((prev) => ({ ...prev, [friend.userId]: expiresAt }));
    multiplayerClient.sendPartyInvite(friend.userId, currentMode === 'rivals' ? 'rivals' : 'custom');
    setStatusMessage(`Invitation sent to ${friend.username}!`);
  };

  const handleInviteByUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim() || humanCount >= 4) return;
    sounds.playUiClick();
    multiplayerClient.sendPartyInvite(undefined, currentMode === 'rivals' ? 'rivals' : 'custom', usernameInput.trim());
    setStatusMessage(`Challenge sent to ${usernameInput.trim()}!`);
    setUsernameInput('');
  };

  const handleStartMatch = () => {
    sounds.playVictoryFanfare();
    if (multiplayerClient.isConnected() && currentRoom) {
      multiplayerClient.startGame();
    } else if (onStartAIMatch) {
      const fallbackRules: EuchreHouseRules = {
        ...DEFAULT_RULES,
        targetScore: currentRoom?.rules.targetScore || 10,
        stickTheDealer: currentRoom?.rules.stickTheDealer !== false,
        partnerOrderUpGoesAlone: currentRoom?.rules.partnerOrderUpGoesAlone !== false,
      };
      onStartAIMatch(aiFillDifficulty, fallbackRules);
      onClose();
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl lg:max-w-3xl bg-[#0d1526] border-2 border-amber-500/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]">
        {/* Header Bar */}
        <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-[#10192e] to-slate-950 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-inner">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2 leading-none">
                <span>Game Room Lobby</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                  ● Ready
                </span>
              </h2>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-none">
                4-Player Room • Choose seats, bots &amp; invite friends
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <AudioControlsPopover compact />
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-full bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!currentRoom ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 my-auto min-h-[260px]">
            {statusMessage ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                  <X className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-white">Unable to Join Room</h3>
                  <p className="text-xs text-red-300 max-w-xs">{statusMessage}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleClose}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                  >
                    Return to Menu
                  </button>
                  {autoFillBots && onStartAIMatch && (
                    <button
                      onClick={() => {
                        sounds.playVictoryFanfare();
                        onStartAIMatch(aiFillDifficulty, DEFAULT_RULES);
                        handleClose();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md"
                    >
                      Play Offline vs Bots
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setStatusMessage(null);
                      multiplayerClient.createRoom(undefined, 'custom');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md"
                  >
                    Retry Online
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 animate-pulse">
                  <Users className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-white">
                    {autoFillBots ? 'Setting up Practice Room...' : 'Connecting to Game Lobby...'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {autoFillBots ? 'Seating bots and preparing table...' : 'Synchronizing seats with lobby...'}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex-1 p-2 sm:p-3 space-y-2 overflow-y-auto">
            {/* Status Toast */}
            {statusMessage && (
              <div className="p-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-bold text-center animate-in fade-in">
                {statusMessage}
              </div>
            )}

            {/* =================================================================
                HIGH-VISIBILITY: INVITE ONLINE FRIENDS DIRECT CARD
            ================================================================= */}
            <div className="p-2 sm:p-2.5 bg-gradient-to-r from-cyan-950/70 via-[#0e1c2e] to-cyan-950/70 rounded-2xl border-2 border-cyan-400/70 shadow-[0_0_24px_rgba(6,182,212,0.15)] space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-ping" />
                  <span className="text-xs font-black uppercase tracking-wider text-cyan-200 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Invite Online Friends</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40">
                    {onlineFriends.length} Online
                  </span>
                  <span className="font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-500/40">
                    {4 - humanCount} Slots Open
                  </span>
                </div>
              </div>

              {/* Online Friends Quick-Invite List */}
              {onlineFriends.length > 0 ? (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
                  {onlineFriends.map((fr) => {
                    const isSeatedInLobby = Boolean(
                      currentRoom?.slots.some(
                        (s) =>
                          s &&
                          !s.isAI &&
                          (s.userId === fr.userId || s.username.toLowerCase() === fr.username.toLowerCase())
                      )
                    );
                    const serverExp = currentRoom?.pendingInvites?.[fr.userId];
                    const effectiveExp =
                      currentRoom?.pendingInvites !== undefined ? serverExp : localPendingInvites[fr.userId];
                    const remainingSec = effectiveExp ? Math.max(0, Math.ceil((effectiveExp - nowMs) / 1000)) : 0;
                    const isPendingInvite = !isSeatedInLobby && remainingSec > 0;
                    const isLobbyFullForHumans = !isSeatedInLobby && humanCount >= 4;
                    const isDisabled = isSeatedInLobby || isPendingInvite || isLobbyFullForHumans;

                    return (
                      <div
                        key={fr.userId}
                        className="flex-shrink-0 p-1 px-2 rounded-xl bg-slate-900/90 border border-cyan-500/30 flex items-center gap-1.5 shadow"
                      >
                        <AvatarPortrait avatarId={fr.avatarIcon} size="xs" />
                        <div className="text-left">
                          <span className="text-[11px] font-black text-white block truncate max-w-[85px]">
                            {fr.username}
                          </span>
                          {isPendingInvite ? (
                            <span className="text-[8px] text-amber-300 font-bold block leading-none">
                              Sent ({remainingSec}s)
                            </span>
                          ) : (
                            <span className="text-[8px] text-emerald-400 font-bold block leading-none">
                              Online
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleInviteFriend(fr)}
                          disabled={isDisabled}
                          className={`px-2 py-0.5 rounded-lg text-[9px] font-black transition-all cursor-pointer ${
                            isSeatedInLobby
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                              : isPendingInvite
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 cursor-default animate-pulse'
                              : isLobbyFullForHumans
                              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md active:scale-95'
                          }`}
                        >
                          {isSeatedInLobby ? 'Seated' : isPendingInvite ? 'Sent' : 'Invite'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[10px] text-slate-300/80 bg-slate-900/60 px-2 py-1 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span>No friends online right now — send an invite by username below or fill with bots!</span>
                </div>
              )}

              {/* Direct Username Challenge Input */}
              <form onSubmit={handleInviteByUsername} className="flex gap-1.5">
                <input
                  type="text"
                  disabled={humanCount >= 4}
                  placeholder={humanCount >= 4 ? 'Lobby is full (4/4)' : 'Invite player by username...'}
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="flex-1 px-2.5 py-1 rounded-xl bg-slate-900/95 border border-slate-700 text-white text-[11px] focus:outline-none focus:border-cyan-400 font-mono disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={humanCount >= 4 || !usernameInput.trim()}
                  className="px-3 py-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md cursor-pointer transition-all active:scale-95 flex-shrink-0"
                >
                  <Send className="w-3 h-3" />
                  <span>Send</span>
                </button>
              </form>
            </div>

            {/* =================================================================
                2-COLUMN SECTION: SEATING (LEFT) & RULES/BOTS (RIGHT)
            ================================================================= */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5">
              {/* Left Column: 4 Table Seats */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold text-gray-400 px-0.5">
                  <span className="uppercase tracking-wider">Table Seats ({occupiedCount}/4)</span>

                  {/* Ergonomic Quick Team Switch right above seats */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Team:</span>
                    <button
                      onClick={() => handleSwitchTeam('blue')}
                      disabled={myPosition === 0 || myPosition === 2}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer ${
                        myPosition === 0 || myPosition === 2
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-800 text-blue-300 hover:bg-blue-950/60 border border-blue-500/40'
                      }`}
                    >
                      <span>🔵 Blue</span>
                      {(myPosition === 0 || myPosition === 2) && <Check className="w-2.5 h-2.5" />}
                    </button>
                    <button
                      onClick={() => handleSwitchTeam('red')}
                      disabled={myPosition === 1 || myPosition === 3}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer ${
                        myPosition === 1 || myPosition === 3
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-slate-800 text-red-300 hover:bg-red-950/60 border border-red-500/40'
                      }`}
                    >
                      <span>🔴 Red</span>
                      {(myPosition === 1 || myPosition === 3) && <Check className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[0, 1, 2, 3].map((pos) => {
                    const slot = currentRoom?.slots[pos];
                    const isBlueTeam = pos % 2 === 0;
                    const isMe = myPosition === pos;
                    const seatRole =
                      pos === 0
                        ? 'South (Host / Blue)'
                        : pos === 2
                        ? 'North (Partner / Blue)'
                        : pos === 1
                        ? 'West (Opponent / Red)'
                        : 'East (Partner / Red)';

                    return (
                      <div
                        key={pos}
                        className={`p-1.5 rounded-xl border flex flex-col justify-between space-y-1 transition-all ${
                          isMe
                            ? isBlueTeam
                              ? 'bg-blue-950/80 border-blue-400 ring-2 ring-blue-500/40 shadow text-blue-100'
                              : 'bg-red-950/80 border-red-400 ring-2 ring-red-500/40 shadow text-red-100'
                            : slot
                            ? isBlueTeam
                              ? 'bg-blue-950/40 border-blue-500/40 text-blue-200'
                              : 'bg-red-950/40 border-red-500/40 text-red-200'
                            : 'bg-slate-950/60 border-dashed border-slate-700 text-gray-500'
                        }`}
                      >
                        <div className="flex items-center justify-between min-w-0">
                          <div className="flex items-center space-x-1.5 min-w-0">
                            {slot ? (
                              <div className="relative flex-shrink-0">
                                <AvatarPortrait avatarId={slot.avatarIcon} size="xs" />
                              </div>
                            ) : (
                              <span className="w-5 h-5 rounded-lg bg-slate-900/70 border border-slate-800 flex items-center justify-center text-[10px] flex-shrink-0">
                                🪑
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold truncate text-[11px] flex items-center space-x-1">
                                <span className="truncate">{slot ? slot.username : `Empty`}</span>
                                {isMe && (
                                  <span className="text-[8px] bg-amber-400 text-slate-950 font-black px-1 rounded">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] opacity-75 truncate">{seatRole}</div>
                            </div>
                          </div>

                          {isHost && slot && !isMe && (
                            <button
                              onClick={() => {
                                sounds.playUiClick();
                                multiplayerClient.kickPlayer(pos as PlayerPosition);
                              }}
                              title="Kick Player"
                              className="p-1 rounded-md text-red-400 hover:bg-red-950/80 transition-colors flex-shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Seat Sit/Swap Action */}
                        <div className="flex justify-end pt-0.5">
                          {!slot ? (
                            <button
                              onClick={() => handleSwitchSeat(pos as PlayerPosition)}
                              className={`px-2 py-0.5 rounded-lg font-black text-[9px] shadow-sm flex items-center space-x-1 transition-all active:scale-95 cursor-pointer ${
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
                              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[8px] font-bold flex items-center space-x-1 border border-amber-500/30 transition-all active:scale-95 cursor-pointer"
                              title="Swap seats"
                            >
                              <ArrowLeftRight className="w-2 h-2" />
                              <span>Swap</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Rules & Bot Controls */}
              <div className="space-y-1.5">
                {/* House Rules */}
                <div className="p-2 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                    <span className="uppercase tracking-wider flex items-center gap-1.5 text-amber-400 text-[11px]">
                      <Sliders className="w-3 h-3" />
                      <span>House Rules</span>
                    </span>
                    <span className="text-[9px] text-gray-500">{isHost ? 'Host Config' : 'Set by Host'}</span>
                  </div>

                  {/* Target Score */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-bold text-[10px]">Winning Goal:</span>
                    <div className="flex space-x-1">
                      {[5, 7, 10].map((score) => (
                        <button
                          key={score}
                          disabled={!isHost}
                          onClick={() => handleUpdateRule({ targetScore: score })}
                          className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition-all ${
                            (currentRoom?.rules.targetScore || 10) === score
                              ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                              : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                          }`}
                        >
                          {score} pts
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Stick the Dealer & Canadian Loner */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Stick Dealer:</span>
                      <button
                        disabled={!isHost}
                        onClick={() => handleUpdateRule({ stickTheDealer: !currentRoom?.rules.stickTheDealer })}
                        className={`px-2 py-0.5 rounded-md text-[9px] font-black ${
                          currentRoom?.rules.stickTheDealer !== false
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {currentRoom?.rules.stickTheDealer !== false ? 'ON' : 'OFF'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Canadian Solo:</span>
                      <button
                        disabled={!isHost}
                        onClick={() => {
                          const nextVal = currentRoom?.rules.partnerOrderUpGoesAlone === false;
                          handleUpdateRule({ canadianLoner: nextVal, partnerOrderUpGoesAlone: nextVal });
                        }}
                        className={`px-2 py-0.5 rounded-md text-[9px] font-black ${
                          currentRoom?.rules.partnerOrderUpGoesAlone !== false
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {currentRoom?.rules.partnerOrderUpGoesAlone !== false ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bot Difficulty Fill Controls (Host only) */}
                {isHost && (
                  <div className="p-2 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                      <span className="uppercase tracking-wider flex items-center gap-1 text-emerald-400 text-[11px]">
                        <Bot className="w-3 h-3" />
                        <span>Fill Empty Seats with Bots</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(['easy', 'medium', 'hard'] as AIDifficulty[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => {
                            sounds.playUiClick();
                            setAiFillDifficulty(d);
                            if (isHost) {
                              multiplayerClient.fillWithAI(d);
                            }
                          }}
                          className={`flex-1 py-1 rounded-lg text-[9px] font-black capitalize transition-all cursor-pointer ${
                            aiFillDifficulty === d
                              ? 'bg-emerald-500 text-slate-950 shadow'
                              : 'bg-slate-800 text-gray-400 hover:text-white'
                          }`}
                        >
                          {d}
                        </button>
                      ))}

                      <button
                        onClick={() => {
                          sounds.playUiClick();
                          multiplayerClient.fillWithAI(aiFillDifficulty);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-bold text-[9px] cursor-pointer"
                      >
                        Fill Bots
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {currentRoom && (
          <div className="p-2.5 sm:p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white text-xs font-bold transition-colors cursor-pointer flex-shrink-0"
            >
              Leave Lobby
            </button>

            {isHost ? (
              <button
                onClick={handleStartMatch}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-b from-[#34d378] via-[#22c55e] to-[#15803d] hover:brightness-105 active:scale-95 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_3px_0_#146435,0_8px_20px_rgba(39,174,96,0.35)] flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Sparkles className="w-4 h-4 fill-white" />
                <span>
                  {occupiedCount === 4
                    ? 'Start Match (All 4 Ready!)'
                    : `Start Match (Fill with ${aiFillDifficulty.toUpperCase()} Bots)`}
                </span>
              </button>
            ) : (
              <div className="flex-1 py-2 rounded-xl bg-slate-800/80 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center space-x-2">
                <Clock className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>
                  {occupiedCount === 4
                    ? 'All seats ready! Waiting for host to start...'
                    : `Waiting for host (${occupiedCount}/4 seated)...`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
