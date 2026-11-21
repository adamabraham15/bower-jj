/**
 * BOWER JJ — Inspect Player's Public Profile Modal
 * Opens from the Competitive Leaderboard, Friends List, or Game Table.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Trophy,
  UserPlus,
  Check,
  VolumeX,
  Volume2,
  Flag,
  AlertTriangle,
  Flame,
  Swords,
} from 'lucide-react';
import { RankBadge, RankTier, RankDivision, RANK_INFO, getRankDivisionInfo } from './RankBadge';
import { sounds } from '../audio/sound';
import { multiplayerClient } from '../services/multiplayerClient';
import { authService } from '../services/supabaseClient';
import { AvatarPortrait } from './AvatarPortrait';
import { getCardBackDefinition } from '../config/collectiblesCatalog';

export interface PublicPlayerData {
  id: string;
  username: string;
  avatarIcon: string;
  equippedCardBack?: string;
  level: number;
  rankTier: RankTier;
  rankDivision?: RankDivision;
  rankPoints: number;
  mmr?: number;
  rankPosition?: number;
  totalGames?: number;
  wins?: number;
  losses?: number;
  winStreak?: number;
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
  isCurrentUser?: boolean;
  onOpenOwnProfile?: () => void;
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
  isCurrentUser = false,
  onOpenOwnProfile,
}) => {
  const [requestSent, setRequestSent] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [enrichedPlayer, setEnrichedPlayer] = useState<PublicPlayerData | null>(player);

  useEffect(() => {
    setEnrichedPlayer(player);
    setRequestSent(false);
    setShowReportDialog(false);
    setReportSubmitted(false);

    if (isOpen && player?.id) {
      authService
        .fetchFullProfile(player.id)
        .then((full) => {
          if (full) {
            setEnrichedPlayer((prev) => {
              if (!prev || prev.id !== player.id) return prev;
              const rawXp = full.xp?.xp ?? 0;
              const rawLvl = full.xp?.level ?? prev.level ?? 1;
              const resolvedLevel = rawXp >= 1000 ? Math.floor(rawXp / 1000) + 1 : Math.max(1, rawLvl);
              return {
                ...prev,
                level: resolvedLevel,
                avatarIcon: full.profile?.avatar_icon || prev.avatarIcon,
                equippedCardBack:
                  full.cosmetics?.equipped_card_back ||
                  prev.equippedCardBack ||
                  prev.equippedCosmetics?.cardBack,
                rankTier: (full.rank?.rank_tier as RankTier) || prev.rankTier,
                rankDivision: (full.rank?.rank_division as RankDivision) || prev.rankDivision,
                rankPoints: full.rank?.rank_points ?? prev.rankPoints,
                mmr: full.rank?.mmr ?? prev.mmr,
                bestStreak: full.statistics?.best_streak ?? prev.bestStreak,
                winStreak: full.statistics?.current_streak ?? prev.winStreak,
                equippedCosmetics: {
                  ...prev.equippedCosmetics,
                  hat: full.cosmetics?.equipped_hat || prev.equippedCosmetics?.hat,
                  cardBack: full.cosmetics?.equipped_card_back || prev.equippedCosmetics?.cardBack,
                  banner: full.cosmetics?.equipped_banner || prev.equippedCosmetics?.banner,
                  title: full.cosmetics?.equipped_title || prev.equippedCosmetics?.title,
                },
              };
            });
          }
        })
        .catch(() => {});
    }
  }, [isOpen, player]);

  if (!isOpen || !enrichedPlayer) return null;

  const p = enrichedPlayer;
  const totalGames = p.totalGames || 0;
  const wins = p.wins || 0;
  const losses = p.losses || 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const tierInfo = RANK_INFO[p.rankTier] || RANK_INFO['9'];
  const divInfo = getRankDivisionInfo(p.rankTier, p.rankPoints, p.rankDivision);
  const title =
    p.equippedCosmetics?.title && p.equippedCosmetics.title !== 'Recruit'
      ? p.equippedCosmetics.title
      : tierInfo.title;

  const handleAddFriend = () => {
    sounds.playUiClick();
    multiplayerClient.sendFriendRequest(p.username);
    setRequestSent(true);
    onSendFriendRequest?.(p.username);
  };

  const handleReport = (reason: string) => {
    sounds.playUiClick();
    multiplayerClient.reportPlayer(p.id, p.username, reason);
    setReportSubmitted(true);
    setTimeout(() => {
      setShowReportDialog(false);
      setReportSubmitted(false);
    }, 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in zoom-in-95 duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-slate-900 border-2 border-amber-500/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        <div
          className="h-24 p-3.5 flex justify-between items-start relative overflow-hidden"
          style={{
            background: tierInfo.bg,
            borderBottom: `1px solid ${tierInfo.border}`,
          }}
        >
          <div
            className="absolute inset-0 opacity-35 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 100%, ${tierInfo.color} 0%, transparent 70%)`,
            }}
          />

          <div className="relative z-10 flex items-center space-x-1.5">
            {p.rankPosition && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                <span>#{p.rankPosition} World</span>
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full bg-slate-950/85 border border-amber-400/50 text-amber-300 font-bold text-[10px]">
              {title}
            </span>
          </div>

          <div className="relative z-10 flex items-center space-x-1.5">
            {!isCurrentUser && onToggleMutePlayer && (
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onToggleMutePlayer(p.username);
                }}
                title={isMuted ? 'Unmute Player' : 'Mute Player'}
                className={`p-1.5 rounded-full flex items-center justify-center transition-colors ${
                  isMuted ? 'bg-red-500 text-white' : 'bg-slate-900/70 hover:bg-slate-800 text-gray-300'
                }`}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            )}

            {!isCurrentUser && (
              <button
                onClick={() => {
                  sounds.playUiClick();
                  setShowReportDialog(true);
                }}
                title="Report Player"
                className="p-1.5 rounded-full bg-slate-900/70 hover:bg-red-900/60 text-gray-300 hover:text-red-300 flex items-center justify-center transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => {
                sounds.playUiClick();
                onClose();
              }}
              className="w-7 h-7 rounded-full bg-slate-900/70 hover:bg-slate-800 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Avatar & Badges */}
        <div className="px-5 -mt-11 flex flex-col items-center relative z-10">
          <div className="rounded-2xl p-1 bg-slate-900 border-2 border-amber-400/40 shadow-2xl">
            <AvatarPortrait avatarId={p.avatarIcon} size="lg" showRarityGem />
          </div>

          {(() => {
            const cb = getCardBackDefinition(p.equippedCardBack || p.equippedCosmetics?.cardBack);
            return (
              <div className="mt-2 inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300">
                <img
                  src={cb.imageUrl}
                  alt={cb.name}
                  className="w-3.5 h-5 rounded-[3px] object-cover border border-white/20"
                />
                <span className="font-semibold">{cb.name}</span>
              </div>
            );
          })()}

          <h3 className="text-xl font-black text-white mt-2 flex items-center justify-center space-x-1.5">
            <span>{p.username}</span>
            {(p.winStreak || 0) >= 3 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-400/50 text-[10px] font-black text-orange-300">
                <Flame className="w-3 h-3 fill-orange-400 text-orange-400" />
                {p.winStreak}W
              </span>
            )}
          </h3>

          <div className="text-xs text-amber-400 font-bold flex items-center space-x-1.5 mt-0.5">
            <span>LEVEL {p.level || 1}</span>
            {p.mmr && (
              <>
                <span className="text-gray-500">•</span>
                <span className="text-slate-300 font-mono">MMR {p.mmr}</span>
              </>
            )}
          </div>

          {/* Sovereign Rank Crest & Division */}
          <div className="mt-3 p-3 w-full rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RankBadge
                tier={p.rankTier}
                division={p.rankDivision}
                points={p.rankPoints}
                size="md"
                showLabel={false}
              />
              <div className="text-left">
                <div
                  className="text-sm font-black tracking-wide"
                  style={{ color: tierInfo.color }}
                >
                  {divInfo.fullRankName}
                </div>
                <div className="text-[11px] text-slate-400 font-semibold">
                  {tierInfo.title}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black font-mono text-white">
                {p.rankTier === 'BOWER_JJ' ? `${p.rankPoints} LP` : `${p.rankPoints}/100 LP`}
              </div>
              <div className="text-[10px] text-amber-300 font-bold">
                {p.rankTier === 'BOWER_JJ' ? divInfo.compactRankName : `Div ${divInfo.division}`}
              </div>
            </div>
          </div>
        </div>

        {/* Career Ranked Statistics Grid (Includes Record & Win Rate!) */}
        <div className="p-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-gray-400 block font-bold uppercase">Win Rate</span>
            <span className="text-sm font-black text-emerald-400">{winRate}%</span>
          </div>
          <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-gray-400 block font-bold uppercase">Ranked Record</span>
            <span className="text-sm font-black text-white font-mono">
              {wins}W - {losses}L
            </span>
          </div>
          <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-gray-400 block font-bold uppercase">Best Streak</span>
            <span className="text-sm font-black text-amber-400">{p.bestStreak || 0}W</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex space-x-2">
          {isCurrentUser ? (
            <button
              onClick={() => {
                sounds.playUiClick();
                onClose();
                onOpenOwnProfile?.();
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all"
            >
              Open My Full Account &amp; Wardrobe
            </button>
          ) : !p.isFriend ? (
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
            <div className="w-full py-2 text-xs text-emerald-400 font-bold">
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
                <span>Report {p.username}</span>
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
