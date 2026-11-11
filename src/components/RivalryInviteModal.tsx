/**
 * BOWER JJ — Friendly Rivalry Friend Invitation Modal
 * Prompts user to invite a friend to play against each other before queueing.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Swords,
  Copy,
  Check,
  UserPlus,
  Bot,
  Sparkles,
  Clock,
  Send,
  Users,
} from 'lucide-react';
import { FriendSummary, Room } from '../../server/types';
import { RankBadge, RankTier } from './RankBadge';
import { multiplayerClient } from '../services/multiplayerClient';
import { sounds } from '../audio/sound';

interface RivalryInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: FriendSummary[];
  userRank: RankTier;
  onMatchFound: () => void;
}

export const RivalryInviteModal: React.FC<RivalryInviteModalProps> = ({
  isOpen,
  onClose,
  friends,
  userRank,
  onMatchFound,
}) => {
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [invitedFriendId, setInvitedFriendId] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Connect and create a rivals room
    multiplayerClient.connect();
    multiplayerClient.createRoom(undefined, 'rivals');

    multiplayerClient.setCallbacks({
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
    });

    return () => {
      // Cleanup room if unmounted before start
    };
  }, [isOpen, onMatchFound]);

  if (!isOpen) return null;

  const rivalFriendSlot = currentRoom?.slots[1];
  const hasRivalJoined = rivalFriendSlot !== null && rivalFriendSlot !== undefined && !rivalFriendSlot.isAI;

  const handleInviteFriend = (friendId: string, friendName: string) => {
    sounds.playUiClick();
    setInvitedFriendId(friendId);
    multiplayerClient.sendPartyInvite(friendId, 'rivals');
    setStatusMessage(`Invitation sent to ${friendName}! Waiting for them to accept...`);
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
    // Fill empty partner seats (Seats 2 and 3) with calibrated AI
    multiplayerClient.fillWithAI();
    setTimeout(() => {
      multiplayerClient.startGame();
    }, 200);
  };

  const handlePlayWithBotRival = () => {
    sounds.playUiClick();
    multiplayerClient.fillWithAI();
    setTimeout(() => {
      multiplayerClient.startGame();
    }, 200);
  };

  const onlineFriends = friends.filter(f => f.isOnline);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-cyan-500/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-cyan-950/70 via-slate-900 to-cyan-950/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300">
              <Swords className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <span>Friendly Rivalry</span>
              </h2>
              <p className="text-xs text-gray-400">
                Play against a friend with random or AI partners
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Status Toast */}
          {statusMessage && (
            <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-xs font-bold text-center animate-in fade-in">
              {statusMessage}
            </div>
          )}

          {/* Table Seating Matchup Preview */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">
              Head-to-Head Table Assignment
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Team Blue: You */}
              <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-500/50 space-y-1">
                <div className="text-[10px] font-black text-blue-400 uppercase">Team Blue</div>
                <div className="font-bold text-white flex items-center space-x-1.5">
                  <span>{currentRoom?.slots[0]?.avatarIcon || '🤠'}</span>
                  <span className="truncate">{currentRoom?.slots[0]?.username || 'You (Host)'}</span>
                </div>
                <div className="text-[10px] text-blue-300/70">
                  Partner: Random / AI
                </div>
              </div>

              {/* Team Red: Rival Friend */}
              <div className={`p-3 rounded-xl border space-y-1 transition-all ${
                hasRivalJoined
                  ? 'bg-red-950/60 border-red-500/60 text-red-100'
                  : 'bg-slate-900 border-dashed border-slate-700 text-gray-400'
              }`}>
                <div className="text-[10px] font-black text-red-400 uppercase">Team Red (Opponent)</div>
                {hasRivalJoined ? (
                  <div className="font-bold text-white flex items-center space-x-1.5">
                    <span>{rivalFriendSlot?.avatarIcon}</span>
                    <span className="truncate">{rivalFriendSlot?.username}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 text-amber-400 font-bold">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Waiting for Friend...</span>
                  </div>
                )}
                <div className="text-[10px] text-red-300/70">
                  Partner: Random / AI
                </div>
              </div>
            </div>
          </div>

          {/* Room Code Share Strip */}
          {currentRoom && (
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase block">
                  Rivalry Room Code
                </span>
                <span className="text-xl font-black font-mono tracking-widest text-cyan-400">
                  {currentRoom.code}
                </span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentRoom.code);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-cyan-300 font-bold text-xs flex items-center space-x-1.5 transition-colors"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
          )}

          {/* Section: Invite Friends */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Choose a Friend to Challenge</span>
              </span>
              <span className="text-[11px] text-cyan-400 font-bold">
                {onlineFriends.length} Online
              </span>
            </div>

            {friends.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-center space-y-2">
                <p className="text-xs text-gray-400">
                  No friends added yet. Share your room code above or enter your friend's username below!
                </p>
                <form onSubmit={handleInviteByUsername} className="flex space-x-2 pt-1">
                  <input
                    type="text"
                    placeholder="Enter friend's username..."
                    value={usernameInput}
                    onChange={e => setUsernameInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center space-x-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Invite</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {friends.map(friend => {
                  const isInvited = invitedFriendId === friend.userId;

                  return (
                    <div
                      key={friend.userId}
                      className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                        friend.isOnline
                          ? 'bg-slate-800/90 border-slate-700'
                          : 'bg-slate-800/40 border-slate-800/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative text-2xl">
                          {friend.avatarIcon}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                              friend.isOnline ? 'bg-emerald-400' : 'bg-gray-500'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-white text-xs sm:text-sm">
                              {friend.username}
                            </span>
                            <span className="text-[9px] bg-slate-900 px-1.5 py-0.2 rounded text-gray-300">
                              Lv.{friend.level}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {friend.isOnline ? 'Available to play' : 'Offline'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <RankBadge tier={friend.rankTier} size="sm" />
                        <button
                          onClick={() => handleInviteFriend(friend.userId, friend.username)}
                          disabled={!friend.isOnline}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center space-x-1 shadow-md transition-all active:scale-95 ${
                            isInvited
                              ? 'bg-emerald-600 text-white'
                              : friend.isOnline
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black'
                              : 'bg-slate-700 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          {isInvited ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Invited</span>
                            </>
                          ) : (
                            <>
                              <Swords className="w-3.5 h-3.5" />
                              <span>Challenge</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2">
          {hasRivalJoined ? (
            <button
              onClick={handleStartMatch}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/30 flex items-center justify-center space-x-2 active:scale-95 transition-all"
            >
              <Swords className="w-4 h-4 fill-slate-950" />
              <span>Launch Rivalry Match!</span>
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                disabled
                className="flex-1 py-3 rounded-xl bg-slate-800 text-gray-500 font-bold text-xs flex items-center justify-center space-x-2 cursor-not-allowed"
              >
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>Waiting for friend to join...</span>
              </button>
              <button
                onClick={handlePlayWithBotRival}
                className="px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-cyan-300 font-bold text-xs border border-cyan-500/30 flex items-center space-x-1"
                title="Start a practice match with a bot rival immediately"
              >
                <Bot className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Play vs Bot</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
