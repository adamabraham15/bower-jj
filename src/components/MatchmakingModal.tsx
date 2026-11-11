/**
 * BOWER JJ — Live Multiplayer Matchmaking & Private Lobby Hub
 * Connects directly to the authoritative WebSocket server with custom house rules.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Shield,
  Copy,
  Check,
  Sparkles,
  Bot,
  LogIn,
  Plus,
  Link,
  Sliders,
  UserPlus,
  Trash2,
} from 'lucide-react';
import { RankBadge, RankTier } from './RankBadge';
import { sounds } from '../audio/sound';
import { multiplayerClient } from '../services/multiplayerClient';
import { Room, PlayerSlot, FriendSummary } from '../../server/types';
import { AIDifficulty, PlayerPosition } from '../engine/types';

export type QueueType = 'ranked_solo' | 'ranked_rivals' | 'ranked_duo' | 'unranked' | 'private';

interface MatchmakingModalProps {
  isOpen: boolean;
  queueType: QueueType;
  userRank: RankTier;
  userPoints: number;
  friends?: FriendSummary[];
  onClose: () => void;
  onMatchFound: () => void;
}

export const MatchmakingModal: React.FC<MatchmakingModalProps> = ({
  isOpen,
  queueType,
  userRank,
  userPoints,
  friends = [],
  onClose,
  onMatchFound,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [playersFound, setPlayersFound] = useState(1);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());
  const [aiFillDifficulty, setAiFillDifficulty] = useState<AIDifficulty>('medium');

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = multiplayerClient.setCallbacks({
      onRoom: (room) => {
        setCurrentRoom(room);
        setErrorMessage(null);
        if (room.status === 'playing') {
          sounds.playVictoryFanfare();
          onMatchFound();
        }
      },
      onQueue: (data) => {
        setPlayersFound(data.playersFound);
        setSeconds(data.elapsedSeconds);
        setErrorMessage(null);
      },
      onGameSync: () => {
        onMatchFound();
      },
      onError: (msg) => {
        setErrorMessage(msg);
      },
    });

    // Connect to server (queued requests like enterQueue automatically flush upon connection)
    multiplayerClient.connect().then((connected) => {
      if (connected) {
        setErrorMessage(null);
      }
    });

    if (queueType === 'private') {
      multiplayerClient.createRoom();
    } else {
      const mode = (queueType === 'ranked_rivals' || queueType === 'ranked_duo') ? 'rivals' : 'solo';
      multiplayerClient.enterQueue(mode);
    }

    return () => {
      unsubscribe();
      if (queueType !== 'private') {
        multiplayerClient.leaveQueue();
      }
    };
  }, [isOpen, queueType, onMatchFound]);

  if (!isOpen) return null;

  const isHost = currentRoom?.slots[0]?.username === multiplayerClient['username'] || true;
  const occupiedCount = currentRoom?.slots.filter(s => s !== null).length || 0;

  const handleCopyLink = () => {
    if (!currentRoom) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : (import.meta.env?.VITE_APP_URL || 'https://bowerjj.com');
    const link = `${origin}/?join=${currentRoom.code}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleInviteFriend = (friend: FriendSummary) => {
    if (!currentRoom) return;
    sounds.playUiClick();
    multiplayerClient.sendPartyInvite(friend.userId, 'rivals');
    setInvitedFriends(prev => new Set(prev).add(friend.userId));
  };

  const handleUpdateRule = (patch: any) => {
    sounds.playUiClick();
    multiplayerClient.updateRoomRules(patch);
  };

  const title = {
    ranked_solo: 'Ranked Solo Matchmaking',
    ranked_rivals: 'Friendly Rivalry (Head-to-Head)',
    ranked_duo: 'Friendly Rivalry (Head-to-Head)',
    unranked: 'Unranked Casual Queue',
    private: 'Private Game Room',
  }[queueType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-amber-500/70 rounded-3xl p-5 sm:p-6 shadow-2xl text-center space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-amber-400 font-black text-sm uppercase tracking-wider">
            <Shield className="w-4 h-4" />
            <span>{title}</span>
          </div>
          <button
            onClick={() => {
              sounds.playUiClick();
              if (queueType !== 'private') multiplayerClient.leaveQueue();
              onClose();
            }}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div
            onClick={() => {
              setErrorMessage(null);
              multiplayerClient.connect();
            }}
            className="p-2.5 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs font-bold animate-pulse cursor-pointer hover:bg-red-900/80 transition-colors flex items-center justify-between"
          >
            <span>{errorMessage}</span>
            <span className="text-[10px] underline ml-2">Click to Retry</span>
          </div>
        )}

        {queueType === 'private' ? (
          /* Private Room View */
          <div className="space-y-4 text-left">
            {/* Tab to Create or Join */}
            <div className="flex border-b border-slate-800 pb-2 space-x-2">
              <button
                onClick={() => {
                  sounds.playUiClick();
                  setActiveTab('create');
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                  activeTab === 'create'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-800 text-gray-400 hover:text-white'
                }`}
              >
                Room Lobby
              </button>
              <button
                onClick={() => {
                  sounds.playUiClick();
                  setActiveTab('join');
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                  activeTab === 'join'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-800 text-gray-400 hover:text-white'
                }`}
              >
                Join with Code
              </button>
            </div>

            {activeTab === 'join' ? (
              /* Join Room Form */
              <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-3">
                <span className="text-xs font-bold text-gray-300 block">Enter 6-Character Room Code:</span>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    placeholder="E.G. AB12CD"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl font-mono text-center font-black tracking-widest text-amber-300 uppercase focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={() => {
                      sounds.playUiClick();
                      if (joinCodeInput.trim().length === 6) {
                        multiplayerClient.joinRoom(joinCodeInput.trim());
                        setActiveTab('create');
                      }
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md"
                  >
                    Join
                  </button>
                </div>
              </div>
            ) : (
              /* Host / Room Lobby View */
              <div className="space-y-4">
                {currentRoom && (
                  <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Room Code</span>
                      <span className="text-[10px] text-emerald-400 font-bold">● Ready for Players</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl font-black font-mono tracking-widest text-amber-400">
                          {currentRoom.code}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(currentRoom.code);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }}
                          title="Copy Room Code"
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-300 transition-colors"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Direct Invite Link */}
                      <button
                        onClick={handleCopyLink}
                        className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-sm active:scale-95"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Seats List */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-400">
                    <span>Table Seats ({occupiedCount}/4)</span>
                    <span className="text-amber-400 font-mono">
                      Target: {currentRoom?.rules.targetScore || 10} Pts
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[0, 1, 2, 3].map((pos) => {
                      const slot = currentRoom?.slots[pos];
                      const isBlueTeam = pos % 2 === 0;
                      return (
                        <div
                          key={pos}
                          className={`p-2.5 rounded-xl border flex items-center justify-between ${
                            slot
                              ? isBlueTeam
                                ? 'bg-blue-950/60 border-blue-500/50 text-blue-200'
                                : 'bg-red-950/60 border-red-500/50 text-red-200'
                              : 'bg-slate-950/60 border-dashed border-slate-700 text-gray-500'
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-base flex-shrink-0">{slot ? slot.avatarIcon : '🪑'}</span>
                            <div className="min-w-0">
                              <div className="font-bold truncate text-[11px]">
                                {slot ? slot.username : `Empty Seat ${pos + 1}`}
                              </div>
                              <div className="text-[9px] opacity-75">
                                {pos === 0 ? 'Host (Blue)' : pos === 2 ? 'Partner (Blue)' : pos === 1 ? 'West (Red)' : 'East (Red)'}
                              </div>
                            </div>
                          </div>

                          {/* Host can kick seat (except seat 0) */}
                          {pos !== 0 && slot && (
                            <button
                              onClick={() => {
                                sounds.playUiClick();
                                multiplayerClient.kickPlayer(pos as PlayerPosition);
                              }}
                              title="Clear Seat"
                              className="p-1 rounded-md text-red-400 hover:bg-red-950/80 transition-colors flex-shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Host House Rules Configuration */}
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

                {/* Online Friends Direct Invite Drawer */}
                {friends.filter(f => f.isOnline).length > 0 && (
                  <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                      <span className="flex items-center space-x-1">
                        <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Invite Online Friends</span>
                      </span>
                      <span className="text-[10px] text-emerald-400">
                        {friends.filter(f => f.isOnline).length} Online
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                      {friends.filter(f => f.isOnline).map((fr) => {
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
                  </div>
                )}

                {/* AI Fill & Start Game Actions */}
                <div className="space-y-2 pt-1">
                  {/* AI Fill Selector */}
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
                      disabled={occupiedCount === 4}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 disabled:opacity-40 text-xs font-bold text-amber-300 flex items-center space-x-1 shadow-sm"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Fill AI</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      sounds.playVictoryFanfare();
                      multiplayerClient.startGame();
                    }}
                    disabled={occupiedCount !== 4}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 disabled:opacity-40 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 flex items-center justify-center space-x-2 transition-all active:scale-95"
                  >
                    <span>Start Match ({occupiedCount}/4)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Live Matchmaking Queue View */
          <div className="space-y-4">
            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border border-amber-400/30 animate-pulse" />
              <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Users className="w-7 h-7 text-amber-400 animate-pulse" />
              </div>
            </div>

            <div>
              <h3 className="text-base font-black text-white">SEARCHING FOR REAL PLAYERS...</h3>
              <div className="text-xs font-mono text-gray-400 mt-1">
                Queue Time: {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')} | Players in Pool: {playersFound}/4
              </div>
              <div className="mt-2 text-[11px] text-amber-300/90 font-medium bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 max-w-xs mx-auto">
                {queueType === 'ranked_rivals' || queueType === 'ranked_duo' ? (
                  <span>⚔️ <strong>Friendly Rivalry:</strong> You and your friend compete on opposing teams with random/AI partners to guarantee zero collusion!</span>
                ) : seconds < 15 ? (
                  <span>🔍 Prioritizing real humans: Searching for opponents within your competitive rank tier...</span>
                ) : seconds < 30 ? (
                  <span>🌐 Expanding matchmaking search radius to nearby competitive divisions...</span>
                ) : (
                  <span>⚡ Final search phase: Pairing available players (AI difficulty compensated to {userRank} Tier).</span>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex justify-around items-center">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-cyan-400 font-bold uppercase mb-1">Your Team</span>
                <RankBadge tier={userRank} points={userPoints} size="sm" showLabel={false} />
                <span className="text-xs font-bold text-white mt-1">Blue</span>
              </div>
              <div className="text-sm font-black text-amber-500">VS</div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-red-400 font-bold uppercase mb-1">Opponents</span>
                <RankBadge tier={userRank} size="sm" showLabel={false} />
                <span className="text-xs font-bold text-white mt-1">Red</span>
              </div>
            </div>

            <button
              onClick={() => {
                sounds.playUiClick();
                multiplayerClient.leaveQueue();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-300 transition-colors"
            >
              Cancel Matchmaking
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
