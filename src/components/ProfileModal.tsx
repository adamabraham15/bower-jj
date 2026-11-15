/**
 * BOWER JJ — Player Profile, Customization & Match History Modal
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Trophy,
  Flame,
  Star,
  Award,
  Shield,
  User,
  Palette,
  History,
  Check,
  Sparkles,
  Layers,
} from 'lucide-react';
import { RankBadge, RankTier } from './RankBadge';
import { sounds } from '../audio/sound';
import { authService } from '../services/supabaseClient';
import { AvatarPortrait } from './AvatarPortrait';
import {
  AVATAR_CATALOG,
  CARD_BACK_CATALOG,
  RARITY_META,
  getCardBackDefinition,
  resolveAvatarId,
  resolveCardBackId,
} from '../config/collectiblesCatalog';

export interface MatchHistoryItem {
  id: string;
  date: number;
  mode: string;
  won: boolean;
  score: string;
  lpChange: number;
  opponentNames: string[];
}

export interface PlayerProfileData {
  username: string;
  playerId: string;
  avatarIcon: string;
  level: number;
  xp: number;
  nextLevelXp: number;
  rankTier: RankTier;
  rankPoints: number;
  totalGames: number;
  wins: number;
  losses: number;
  tricksWon: number;
  euchres: number;
  marches: number;
  successfulLoners: number;
  currentStreak: number;
  bestStreak: number;
  favTrumpSuit: string;
  favMode?: string;
  equippedCosmetics?: {
    hat?: string;
    cardBack?: string;
    banner?: string;
    title?: string;
  };
  recentMatches?: MatchHistoryItem[];
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PlayerProfileData;
  onUpdateAvatar: (avatar: string) => void;
  onUpdateUsername: (name: string) => void;
  onUpdateCosmetic?: (category: 'hat' | 'cardBack' | 'banner' | 'title', id: string) => void;
  unlockedAvatars?: string[];
  unlockedCardBacks?: string[];
  onOpenCollection?: () => void;
}

export const BANNER_THEMES: Record<string, { name: string; bgClass: string }> = {
  default_navy: { name: 'Royal Cyber Navy', bgClass: 'from-blue-900 via-indigo-900 to-purple-900' },
  crimson_flame: { name: 'Crimson Flame', bgClass: 'from-red-950 via-orange-950 to-amber-900' },
  emerald_forest: { name: 'Jade Sovereign', bgClass: 'from-emerald-950 via-teal-900 to-slate-900' },
  cyber_purple: { name: 'Cyber Neon', bgClass: 'from-purple-900 via-fuchsia-950 to-indigo-950' },
  golden_royale: { name: 'Bower 24k Gold', bgClass: 'from-amber-800 via-yellow-700 to-amber-950' },
};

export const TITLE_OPTIONS = [
  'Recruit',
  'Trick Collector',
  'Trump Specialist',
  'Loner Legend',
  'Bower Master',
  'The Undefeated',
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdateAvatar,
  onUpdateUsername,
  onUpdateCosmetic,
  unlockedAvatars,
  unlockedCardBacks,
  onOpenCollection,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'wardrobe' | 'history'>('overview');
  const [selectedBanner, setSelectedBanner] = useState(profile.equippedCosmetics?.banner || 'default_navy');
  const [selectedCardBack, setSelectedCardBack] = useState(resolveCardBackId(profile.equippedCosmetics?.cardBack || 'classic_blue'));
  const [selectedTitle, setSelectedTitle] = useState(profile.equippedCosmetics?.title || 'Recruit');
  const [localMatches, setLocalMatches] = useState<MatchHistoryItem[]>(profile.recentMatches || []);

  useEffect(() => {
    if (profile.recentMatches && profile.recentMatches.length > 0) {
      setLocalMatches(profile.recentMatches);
    }
  }, [profile.recentMatches]);

  useEffect(() => {
    if (profile.equippedCosmetics?.banner) setSelectedBanner(profile.equippedCosmetics.banner);
    if (profile.equippedCosmetics?.cardBack) setSelectedCardBack(profile.equippedCosmetics.cardBack);
    if (profile.equippedCosmetics?.title) setSelectedTitle(profile.equippedCosmetics.title);
  }, [
    profile.equippedCosmetics?.banner,
    profile.equippedCosmetics?.cardBack,
    profile.equippedCosmetics?.title,
  ]);

  useEffect(() => {
    if (isOpen && profile.playerId) {
      authService.fetchMatchHistory(profile.playerId, 50).then((history) => {
        if (history && history.length > 0) {
          const formatMode = (m: string) =>
            m === 'ranked_solo'
              ? 'Ranked Solo'
              : m === 'ranked_rivals' || m === 'rivals'
              ? 'Friendly Rivalry'
              : m === 'ranked_duo' || m === 'duo'
              ? 'Ranked Duo'
              : m === 'unranked' || m === 'custom' || m === 'casual' || m === 'private'
              ? 'Custom Match'
              : m === 'offline_ai' || m === 'ai'
              ? 'Casual AI'
              : m;

          const mapped: MatchHistoryItem[] = history.map((h: any) => ({
            id: h.id,
            date: new Date(h.created_at).getTime(),
            mode: formatMode(h.mode),
            won: Boolean(h.won),
            score: h.score || '10 - 7',
            lpChange: h.lp_change ?? (h.won ? 20 : -15),
            opponentNames: Array.isArray(h.opponent_names) && h.opponent_names.length > 0 ? h.opponent_names : ['Opponents'],
          }));

          const localOnlyAi = (profile.recentMatches || []).filter(m => m.id.startsWith('match_ai_'));
          const combined = [...mapped, ...localOnlyAi].sort((a, b) => b.date - a.date);
          setLocalMatches(combined);
        } else if (profile.recentMatches && profile.recentMatches.length > 0) {
          setLocalMatches(profile.recentMatches);
        }
      });
    }
  }, [isOpen, profile.playerId, profile.recentMatches]);

  if (!isOpen) return null;

  const winRate = profile.totalGames > 0
    ? Math.round((profile.wins / profile.totalGames) * 100)
    : 0;

  const displayXp = profile.xp >= 1000 ? profile.xp % 1000 : profile.xp;
  const displayNextLevelXp = 1000;
  const xpPercent = Math.min(100, Math.round((displayXp / displayNextLevelXp) * 100));
  const matches: MatchHistoryItem[] = localMatches;

  const currentBannerTheme = BANNER_THEMES[selectedBanner] || BANNER_THEMES.default_navy;

  const handleEquipBanner = (bId: string) => {
    sounds.playUiClick();
    setSelectedBanner(bId);
    onUpdateCosmetic?.('banner', bId);
  };

  const handleEquipCardBack = (cbId: string) => {
    sounds.playUiClick();
    setSelectedCardBack(cbId);
    onUpdateCosmetic?.('cardBack', cbId);
  };

  const handleEquipTitle = (t: string) => {
    sounds.playUiClick();
    setSelectedTitle(t);
    onUpdateCosmetic?.('title', t);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border-2 border-amber-500/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Dynamic Customizable Banner Header */}
        <div className={`relative h-28 sm:h-32 bg-gradient-to-r ${currentBannerTheme.bgClass} p-4 flex justify-between items-start transition-all duration-300`}>
          <div className="flex flex-col space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-full bg-slate-900/85 border border-amber-400 text-amber-300 font-mono text-[11px] font-bold shadow-md">
                ID: {profile.playerId}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-900/70 border border-slate-700 text-gray-200 text-[10px] font-bold uppercase tracking-wider shadow-md">
                {selectedTitle}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-gray-300 hover:text-white border border-slate-700/60 shadow-lg z-30 transition-colors"
            title="Close Profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Avatar & Rank Placement - Cleanly spaced below banner */}
        <div className="px-6 pt-2 pb-1 relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Avatar overlapping banner cleanly */}
            <div className="-mt-12 sm:-mt-14 relative z-20 group cursor-pointer flex-shrink-0" onClick={() => setActiveTab('wardrobe')}>
              <AvatarPortrait
                avatarId={profile.avatarIcon}
                size="lg"
                showRarityGem
                className="!w-20 !h-20 border-4 border-slate-900 shadow-2xl ring-2 ring-amber-400/30"
              />
            </div>

            {/* Username & Level - completely below banner on solid background */}
            <div className="flex flex-col justify-center">
              <h2 className="text-2xl font-black text-white tracking-wide">
                <span>{profile.username}</span>
              </h2>
              <div className="text-xs text-amber-400 font-bold flex items-center space-x-1.5 mt-0.5">
                <span>LEVEL {profile.level}</span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-300 font-medium">{selectedTitle}</span>
              </div>
            </div>
          </div>

          {/* Rank Badge - positioned cleanly on the right, fully below banner */}
          <div className="flex-shrink-0 pl-2">
            <RankBadge tier={profile.rankTier} points={profile.rankPoints} size="md" />
          </div>
        </div>

        {/* XP Bar */}
        <div className="px-6 mt-3">
          <div className="flex justify-between text-xs font-bold text-gray-300 mb-1">
            <span>XP Progress</span>
            <span className="text-amber-400 font-mono">
              {displayXp.toLocaleString()} / {displayNextLevelXp.toLocaleString()} XP
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/80 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full transition-all duration-500 shadow-sm shadow-amber-400/50"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 mt-4 flex border-b border-slate-800 space-x-2 text-xs font-black">
          <button
            onClick={() => {
              sounds.playUiClick();
              setActiveTab('overview');
            }}
            className={`pb-2.5 px-3 flex items-center space-x-1.5 border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-amber-400 text-amber-300 font-black'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Overview & Stats</span>
          </button>

          <button
            onClick={() => {
              sounds.playUiClick();
              setActiveTab('wardrobe');
            }}
            className={`pb-2.5 px-3 flex items-center space-x-1.5 border-b-2 transition-all ${
              activeTab === 'wardrobe'
                ? 'border-amber-400 text-amber-300 font-black'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Wardrobe & Cosmetics</span>
          </button>

          <button
            onClick={() => {
              sounds.playUiClick();
              setActiveTab('history');
            }}
            className={`pb-2.5 px-3 flex items-center space-x-1.5 border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-amber-400 text-amber-300 font-black'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Match History</span>
          </button>
        </div>

        {/* Tab 1: Overview & Stats */}
        {activeTab === 'overview' && (
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            <div className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
              <Trophy className="w-4 h-4" />
              <span>Lifetime Performance</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 text-center">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Win Rate</span>
                <span className="text-xl font-black text-emerald-400">{winRate}%</span>
                <span className="text-[9px] text-gray-500 block">{profile.wins}W - {profile.losses}L</span>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 text-center">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Total Games</span>
                <span className="text-xl font-black text-white">{profile.totalGames}</span>
                <span className="text-[9px] text-gray-500 block">Matches</span>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 text-center">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Euchres</span>
                <span className="text-xl font-black text-red-400">{profile.euchres}</span>
                <span className="text-[9px] text-gray-500 block">Defenses (+2)</span>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 text-center">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Solo Sweeps</span>
                <span className="text-xl font-black text-cyan-400">{profile.successfulLoners}</span>
                <span className="text-[9px] text-gray-500 block">4-Pointers</span>
              </div>
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-gray-400 uppercase block font-bold">Tricks Captured</span>
                <span className="text-base font-black text-white">{profile.tricksWon}</span>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-gray-400 uppercase block font-bold">Marches Swept</span>
                <span className="text-base font-black text-white">{profile.marches}</span>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-gray-400 uppercase block font-bold">Best Win Streak</span>
                <span className="text-base font-black text-amber-400 flex items-center space-x-1">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>{profile.bestStreak} Wins</span>
                </span>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-gray-400 uppercase block font-bold">Favorite Suit</span>
                <span className="text-base font-black text-white capitalize">{profile.favTrumpSuit}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Wardrobe & Cosmetics */}
        {activeTab === 'wardrobe' && (() => {
          const unlockedAvatarSet = new Set(
            (unlockedAvatars && unlockedAvatars.length > 0
              ? unlockedAvatars
              : AVATAR_CATALOG.filter((a) => a.unlockedByDefault).map((a) => a.id)
            ).map((id) => resolveAvatarId(id))
          );
          const unlockedBackSet = new Set(
            (unlockedCardBacks && unlockedCardBacks.length > 0
              ? unlockedCardBacks
              : CARD_BACK_CATALOG.filter((c) => c.unlockedByDefault).map((c) => c.id)
            ).map((id) => resolveCardBackId(id))
          );
          const equippedAvatarId = resolveAvatarId(profile.avatarIcon);

          return (
          <div className="p-6 flex-1 overflow-y-auto space-y-5">
            {onOpenCollection && (
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenCollection();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-purple-500/15 to-cyan-500/20 border border-amber-400/40 hover:border-amber-300 text-amber-200 font-bold text-xs flex items-center justify-between transition-all"
              >
                <span className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Unlock more Card Backs &amp; Illustrated Avatars in Collection Vault</span>
                </span>
                <span className="text-amber-300 font-black">Open Vault →</span>
              </button>
            )}

            {/* 1. Illustrated Avatars */}
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 block mb-2">
                1. Illustrated Character Avatar
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {AVATAR_CATALOG.map((item) => {
                  const isUnlocked = unlockedAvatarSet.has(item.id) || item.unlockedByDefault;
                  const isEquipped = equippedAvatarId === item.id;
                  const rarity = RARITY_META[item.rarity];
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        sounds.playUiClick();
                        if (isUnlocked) {
                          onUpdateAvatar(item.id);
                        } else {
                          onOpenCollection?.();
                        }
                      }}
                      title={isUnlocked ? `${item.name} (${rarity.label})` : `Locked — ${item.unlockHint}`}
                      className={`p-1.5 rounded-2xl flex flex-col items-center justify-center transition-all ${
                        isEquipped
                          ? 'bg-amber-500/20 border-2 border-amber-400 shadow-lg shadow-amber-400/20 scale-105'
                          : isUnlocked
                          ? 'bg-slate-800/80 border border-slate-700 hover:bg-slate-700'
                          : 'bg-slate-900/70 border border-slate-800 opacity-65 hover:opacity-90'
                      }`}
                    >
                      <AvatarPortrait avatarId={item.id} size="md" locked={!isUnlocked} showRarityRing />
                      <span className="text-[9px] font-bold text-gray-200 truncate w-full text-center mt-1">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Banner Themes */}
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 block mb-2">
                2. Profile Banner Skin
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(BANNER_THEMES).map(([bId, theme]) => (
                  <button
                    key={bId}
                    onClick={() => handleEquipBanner(bId)}
                    className={`h-12 rounded-xl p-2.5 flex items-center justify-between border bg-gradient-to-r ${theme.bgClass} transition-all ${
                      selectedBanner === bId
                        ? 'border-amber-400 ring-2 ring-amber-400/50 scale-102'
                        : 'border-slate-700 hover:border-slate-500 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <span className="text-xs font-bold text-white drop-shadow-sm">{theme.name}</span>
                    {selectedBanner === bId && (
                      <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-xs">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Card Back Skins */}
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 block mb-2">
                3. Card Back Deck Skin
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARD_BACK_CATALOG.map((cb) => {
                  const isUnlocked = unlockedBackSet.has(cb.id) || cb.unlockedByDefault;
                  const isEquipped = resolveCardBackId(selectedCardBack) === cb.id;
                  return (
                    <button
                      key={cb.id}
                      onClick={() => {
                        if (isUnlocked) {
                          handleEquipCardBack(cb.id);
                        } else {
                          sounds.playUiClick();
                          onOpenCollection?.();
                        }
                      }}
                      title={isUnlocked ? cb.name : `Complete 5-card collection to unlock ${cb.name}`}
                      className={`p-2 rounded-xl border flex items-center space-x-2.5 transition-all text-left ${
                        isEquipped
                          ? 'bg-amber-500/10 border-amber-400 ring-1 ring-amber-400'
                          : isUnlocked
                          ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-700'
                          : 'bg-slate-900/60 border-slate-800 opacity-60 hover:opacity-85'
                      }`}
                    >
                      <img
                        src={cb.imageUrl}
                        alt={cb.name}
                        className={`w-7 h-10 rounded-md object-cover border border-white/20 flex-shrink-0 ${!isUnlocked ? 'grayscale' : ''}`}
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-gray-200 block truncate">{cb.name}</span>
                        <span className="text-[9px] text-slate-400 uppercase font-bold">
                          {isEquipped ? 'Equipped' : isUnlocked ? 'Unlocked' : 'Locked'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Player Title */}
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 block mb-2">
                4. Competitor Title
              </span>
              <div className="flex flex-wrap gap-2">
                {TITLE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleEquipTitle(t)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      selectedTitle === t
                        ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                        : 'bg-slate-800 hover:bg-slate-700 text-gray-300 border border-slate-700'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          );
        })()}

        {/* Tab 3: Match History */}
        {activeTab === 'history' && (
          <div className="p-6 flex-1 overflow-y-auto space-y-2.5">
            <div className="text-xs font-black uppercase tracking-wider text-amber-400 mb-2 flex items-center space-x-1.5">
              <History className="w-4 h-4" />
              <span>Recent Match Outcomes</span>
            </div>

            {matches.length === 0 ? (
              <div className="p-8 text-center text-gray-400 space-y-2 bg-slate-800/40 rounded-2xl border border-slate-700/60">
                <History className="w-8 h-8 text-amber-400/50 mx-auto" />
                <div className="text-sm font-bold text-gray-200">No Match History Yet</div>
                <div className="text-xs text-gray-400">
                  Complete an AI match or Ranked Solo match to record your match history and ladder climb.
                </div>
              </div>
            ) : (
              matches.map((m) => (
                <div
                  key={m.id}
                  className="p-3 bg-slate-800/70 rounded-2xl border border-slate-700/80 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                        m.won
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                          : 'bg-red-500/20 text-red-300 border border-red-500/50'
                      }`}
                    >
                      {m.won ? 'VICTORY' : 'DEFEAT'}
                    </div>

                    <div>
                      <div className="text-xs font-black text-white flex items-center space-x-2">
                        <span>{m.mode}</span>
                        <span className="text-gray-400">•</span>
                        <span className="font-mono text-amber-300 font-bold">{m.score}</span>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        vs {m.opponentNames.join(', ')}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-mono text-xs font-black block ${
                        m.lpChange > 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {m.lpChange > 0 ? `+${m.lpChange} LP` : `${m.lpChange} LP`}
                    </span>
                    <span className="text-[9px] text-gray-500">
                      {Math.round((Date.now() - m.date) / 60000)}m ago
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
