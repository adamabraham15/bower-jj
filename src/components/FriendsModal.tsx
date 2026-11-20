/**
 * BOWER JJ — Friends & Social Hub Modal
 * Brawl Stars / Fortnite inspired tactical social experience.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  UserCheck,
  Search,
  Check,
  Trash2,
  Gamepad2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { FriendSummary, UserAccount } from '../../server/types';
import { RankBadge } from './RankBadge';
import { AvatarPortrait } from './AvatarPortrait';
import { multiplayerClient } from '../services/multiplayerClient';

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: FriendSummary[];
  incomingRequests: UserAccount['friendRequests'];
  onInviteToParty?: (friendId: string) => void;
  isAuthenticated?: boolean;
  onOpenAuth?: (tab?: 'login' | 'register', reason?: string) => void;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  isOpen,
  onClose,
  friends,
  incomingRequests,
  onInviteToParty,
  isAuthenticated = true,
  onOpenAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'add'>('friends');
  const [searchUsername, setSearchUsername] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    multiplayerClient.fetchFriends();
    const pollInterval = setInterval(() => {
      multiplayerClient.fetchFriends();
    }, 3000);
    const unsub = multiplayerClient.setCallbacks({
      onError: (err) => {
        setFeedbackMsg({ text: err, isError: true });
      },
      onNotice: (msg) => {
        if (msg.toLowerCase().includes('friend')) {
          setFeedbackMsg({ text: msg, isError: false });
        }
      },
    });
    return () => {
      clearInterval(pollInterval);
      unsub();
    };
  }, [isOpen, isAuthenticated]);

  if (!isOpen) return null;

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;

    multiplayerClient.sendFriendRequest(searchUsername.trim());
    setFeedbackMsg({ text: `Sending friend request to ${searchUsername.trim()}...` });
    setSearchUsername('');
    setTimeout(() => {
      multiplayerClient.fetchFriends();
    }, 800);
  };

  const handleAccept = (fromUserId: string) => {
    multiplayerClient.acceptFriendRequest(fromUserId);
    setFeedbackMsg({ text: 'Accepted friend request!' });
    setTimeout(() => {
      multiplayerClient.fetchFriends();
      setFeedbackMsg(null);
    }, 500);
  };

  const handleDecline = (fromUserId: string) => {
    multiplayerClient.declineFriendRequest(fromUserId);
    setTimeout(() => multiplayerClient.fetchFriends(), 500);
  };

  const handleRemove = (friendUserId: string) => {
    if (confirm('Are you sure you want to remove this friend?')) {
      multiplayerClient.removeFriend(friendUserId);
      setTimeout(() => multiplayerClient.fetchFriends(), 500);
    }
  };

  const onlineFriends = friends.filter(f => f.isOnline);
  const offlineFriends = friends.filter(f => !f.isOnline);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-cyan-500/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-cyan-950/60 to-slate-900">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">
                Social & Friends
              </h2>
              <p className="text-xs text-gray-400">
                {isAuthenticated ? `${friends.length} Friends (${onlineFriends.length} Online)` : 'Account Required'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isAuthenticated ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider">
                Account Required
              </h3>
              <p className="text-xs text-gray-400 max-w-xs mt-1.5 leading-relaxed">
                Friends, party invites, and social multiplayer require a registered player account.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs pt-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth?.('register', 'Create an account to add friends, form parties, and play multiplayer together!');
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition-all"
              >
                Create Account
              </button>
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth?.('login', 'Sign in to access your friends list and party invites.');
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-200 font-bold text-xs border border-slate-700 transition-colors"
              >
                Sign In
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-800 bg-slate-950/50 p-1.5 space-x-1.5">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'friends'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Friends ({friends.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center space-x-1.5 relative ${
              activeTab === 'requests'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Requests</span>
            {incomingRequests.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 animate-pulse">
                {incomingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center space-x-1.5 ${
              activeTab === 'add'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Friend</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Feedback banner */}
          {feedbackMsg && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold text-center border ${
                feedbackMsg.isError
                  ? 'bg-red-500/20 border-red-500/50 text-red-200'
                  : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
              }`}
            >
              {feedbackMsg.text}
            </div>
          )}

          {/* TAB 1: FRIENDS LIST */}
          {activeTab === 'friends' && (
            <div className="space-y-4">
              {friends.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  {incomingRequests.length > 0 && (
                    <div className="mx-auto max-w-sm bg-amber-500/15 border border-amber-400/50 rounded-2xl p-3 flex items-center justify-between text-left">
                      <div>
                        <div className="text-xs font-black text-amber-300">
                          {incomingRequests.length} Incoming Friend {incomingRequests.length === 1 ? 'Request' : 'Requests'}!
                        </div>
                        <div className="text-[11px] text-amber-100/80">
                          Accept pending requests to see your friends here.
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('requests')}
                        className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex-shrink-0 ml-2"
                      >
                        View
                      </button>
                    </div>
                  )}
                  <p className="text-gray-400 text-sm">No friends added yet!</p>
                  <p className="text-xs text-gray-500">
                    Search for players by their username to build your Euchre squad.
                  </p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="mt-3 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg"
                  >
                    Find Friends
                  </button>
                </div>
              ) : (
                <>
                  {/* Online Friends */}
                  {onlineFriends.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                        <span>Online — {onlineFriends.length}</span>
                      </div>
                      {onlineFriends.map(friend => (
                        <div
                          key={friend.userId}
                          className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl p-3 flex items-center justify-between transition-all"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="relative flex-shrink-0">
                              <AvatarPortrait avatarId={friend.avatarIcon} size="sm" />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                                  friend.status === 'in_game' ? 'bg-amber-400' : 'bg-emerald-400'
                                }`}
                              />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-black text-white text-sm">
                                  {friend.username}
                                </span>
                                <span className="text-[10px] font-bold bg-slate-900 px-1.5 py-0.5 rounded text-gray-300">
                                  Lv.{friend.level}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1.5 mt-0.5">
                                <span className="text-[11px] text-gray-400">
                                  {friend.status === 'in_game' ? 'Playing a match' : 'In Main Menu'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <RankBadge tier={friend.rankTier} points={friend.rankPoints} size="sm" />
                            <button
                              onClick={() => {
                                multiplayerClient.sendPartyInvite(friend.userId, 'custom', friend.username);
                                onInviteToParty?.(friend.userId);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center space-x-1 shadow-md active:scale-95 transition-transform"
                              title="Invite friend to your game room lobby"
                            >
                              <Gamepad2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Invite</span>
                            </button>
                            <button
                              onClick={() => handleRemove(friend.userId)}
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Remove Friend"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Offline Friends */}
                  {offlineFriends.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        Offline — {offlineFriends.length}
                      </div>
                      {offlineFriends.map(friend => (
                        <div
                          key={friend.userId}
                          className="bg-slate-800/40 border border-slate-800 rounded-2xl p-3 flex items-center justify-between opacity-75 hover:opacity-100 transition-opacity"
                        >
                          <div className="flex items-center space-x-3">
                            <AvatarPortrait avatarId={friend.avatarIcon} size="sm" className="grayscale opacity-75" />
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-gray-300 text-sm">
                                  {friend.username}
                                </span>
                                <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-gray-500">
                                  Lv.{friend.level}
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-500">Offline</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <RankBadge tier={friend.rankTier} points={friend.rankPoints} size="sm" />
                            <button
                              onClick={() => {
                                multiplayerClient.sendPartyInvite(friend.userId, 'custom', friend.username);
                                onInviteToParty?.(friend.userId);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 font-bold text-xs flex items-center space-x-1 shadow-sm active:scale-95 transition-all"
                              title="Invite friend to game lobby (delivers as soon as they are online)"
                            >
                              <Gamepad2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Invite</span>
                            </button>
                            <button
                              onClick={() => handleRemove(friend.userId)}
                              className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Remove Friend"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: PENDING REQUESTS */}
          {activeTab === 'requests' && (
            <div className="space-y-3">
              {incomingRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No pending friend requests.
                </div>
              ) : (
                incomingRequests.map(req => (
                  <div
                    key={req.fromUserId}
                    className="bg-slate-800 border border-cyan-500/40 rounded-2xl p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <AvatarPortrait avatarId={req.fromAvatar} size="sm" />
                      <div>
                        <div className="font-bold text-white text-sm">{req.fromUsername}</div>
                        <div className="text-[10px] text-gray-400 flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Wants to be friends</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleAccept(req.fromUserId)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1 shadow-md active:scale-95 transition-transform"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleDecline(req.fromUserId)}
                        className="p-1.5 rounded-xl bg-slate-700 hover:bg-red-500/20 text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: ADD FRIEND */}
          {activeTab === 'add' && (
            <div className="space-y-4">
              <form onSubmit={handleSendRequest} className="space-y-3">
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
                  Player Username
                </label>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="e.g. EuchrePro99"
                      value={searchUsername}
                      onChange={e => setSearchUsername(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-sm shadow-lg active:scale-95 transition-transform"
                  >
                    Add
                  </button>
                </div>
              </form>

              <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs text-gray-400">
                <div className="flex items-center space-x-2 text-cyan-400 font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>Online Friends &amp; Custom Lobbies</span>
                </div>
                <p>
                  Invite your friends to private rooms, choose your preferred table seats and teams, customize house rules, and compete together across desktop and mobile!
                </p>
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
};
