/**
 * BOWER JJ — Inspect Other Player's Public Profile Modal
 */

import React, { useState } from 'react';
import { X, Trophy, Shield, Flame, UserPlus, Check, VolumeX, Volume2, Flag, AlertTriangle } from 'lucide-react';
import { RankBadge, RankTier } from './RankBadge';
import { sounds } from '../audio/sound';
import { multiplayerClient } from '../services/multiplayerClient';

export interface PublicPlayerData {
  id: string;
  username: string;
  avatarIcon: string;
  level: number;
  rankTier: RankTier;
  rankPoints: number;
  totalGames?: number;
  wins?: number;
  losses?: number;
  bestStreak?: number;
  isFriend?: boolean;
  isOnline?: boolean;
  equippedCosmetics?: {
    hat?: string;
    cardBack?: string;
    banner?: string;
    title?: string;
  };
}

interface PublicProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: PublicPlayerData | null;
  onSendFriendRequest?: (username: string) => void;
  isMuted?: boolean;
  onToggleMutePlayer?: (username: string) => void;
}

const REPORT_REASONS = [
  'Collusion / Unfair Teaming',
  'AFK / Intentional Stalling',
  'Spamming Offensive Emotes',
  'Unsportsmanlike Conduct',
];

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  isOpen,
  onClose,
  player,
  onSendFriendRequest,
  isMuted = false,
  onToggleMutePlayer,
}) => {
  const [requestSent, setRequestSent] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  if (!isOpen || !player) return null;

  const totalGames = player.totalGames || 0;
  const wins = player.wins || 0;
  const losses = player.losses || 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const title = player.equippedCosmetics?.title || 'Competitor';

  const handleAddFriend = () => {
    sounds.playUiClick();
    multiplayerClient.sendFriendRequest(player.username);
    setRequestSent(true);
    onSendFriendRequest?.(player.username);
  };

  const handleReport = (reason: string) => {
    sounds.playUiClick();
    multiplayerClient.reportPlayer(player.id, player.username, reason);
    setReportSubmitted(true);
    setTimeout(() => {
      setShowReportDialog(false);
      setReportSubmitted(false);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-sm bg-slate-900 border-2 border-amber-500/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-center">
        {/* Banner */}
        <div className="h-20 bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 p-3 flex justify-between items-start">
          <div className="flex items-center space-x-1.5">
            <span className="px-2 py-0.5 rounded-full bg-slate-900/80 border border-amber-400 text-amber-300 font-mono text-[10px] font-bold">
              {title}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            {onToggleMutePlayer && (
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onToggleMutePlayer(player.username);
                }}
                title={isMuted ? 'Unmute Player' : 'Mute Player'}
                className={`p-1.5 rounded-full flex items-center justify-center transition-colors ${
                  isMuted ? 'bg-red-500 text-white' : 'bg-slate-900/60 hover:bg-slate-800 text-gray-300'
                }`}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={() => {
                sounds.playUiClick();
                setShowReportDialog(true);
              }}
              title="Report Player"
              className="p-1.5 rounded-full bg-slate-900/60 hover:bg-red-900/60 text-gray-300 hover:text-red-300 flex items-center justify-center transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                sounds.playUiClick();
                onClose();
              }}
              className="w-7 h-7 rounded-full bg-slate-900/60 hover:bg-slate-800 text-gray-300 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Avatar & Badges */}
        <div className="px-5 -mt-10 flex flex-col items-center">
          <div className="w-18 h-18 rounded-2xl bg-slate-800 border-4 border-slate-900 flex items-center justify-center text-4xl shadow-xl">
            {player.avatarIcon}
          </div>

          <h3 className="text-lg font-black text-white mt-2 flex items-center space-x-1.5">
            <span>{player.username}</span>
          </h3>

          <div className="text-xs text-amber-400 font-bold flex items-center space-x-1.5 mt-0.5">
            <span>LEVEL {player.level}</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-300">{player.isOnline ? 'Online Now' : 'Offline'}</span>
          </div>

          <div className="mt-3">
            <RankBadge tier={player.rankTier} points={player.rankPoints} size="md" />
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="p-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-gray-400 block font-bold">Win Rate</span>
            <span className="text-sm font-black text-emerald-400">{winRate}%</span>
          </div>
          <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-gray-400 block font-bold">Matches</span>
            <span className="text-sm font-black text-white">{totalGames}</span>
          </div>
          <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-gray-400 block font-bold">Best Streak</span>
            <span className="text-sm font-black text-amber-400">{player.bestStreak || 0}W</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex space-x-2">
          {!player.isFriend ? (
            <button
              onClick={handleAddFriend}
              disabled={requestSent}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md active:scale-95 ${
                requestSent
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black'
              }`}
            >
              {requestSent ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Friend Request Sent!</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Add Friend</span>
                </>
              )}
            </button>
          ) : (
            <div className="w-full py-2 text-xs text-gray-400 font-bold">
              ✓ Friends
            </div>
          )}
        </div>

        {/* Report Player Submodal */}
        {showReportDialog && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-30 p-5 flex flex-col justify-center text-left animate-in fade-in">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-black text-red-400 flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Report {player.username}</span>
              </h4>
              <button
                onClick={() => setShowReportDialog(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportSubmitted ? (
              <div className="py-6 text-center space-y-2">
                <Check className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-gray-200">
                  Report submitted. Thank you for keeping BOWER JJ fair!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-gray-400 mb-2">
                  Select a violation reason for moderation review:
                </p>
                {REPORT_REASONS.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => handleReport(r)}
                    className="w-full text-left px-3 py-2 rounded-xl bg-slate-800 hover:bg-red-950/50 border border-slate-700 hover:border-red-500/50 text-xs font-bold text-gray-200 transition-colors"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
