/**
 * BOWER JJ — Main Menu & Game Mode Arena
 * Clean, organized Chess.com-inspired vertical Play layout with responsive Desktop & Mobile navigation.
 */

import React, { useState } from 'react';
import {
  Trophy,
  Bot,
  Users,
  Shield,
  HelpCircle,
  BookOpen,
  Sparkles,
  Zap,
  Play,
  Crown,
  Swords,
  ShieldCheck,
  LogOut,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Award,
  Check,
  SlidersHorizontal,
} from 'lucide-react';
import { RankBadge } from './RankBadge';
import { PlayerProfileData } from './ProfileModal';
import { AIDifficulty, EuchreHouseRules, DEFAULT_RULES } from '../engine/types';
import { QueueType } from './MatchmakingModal';
import { sounds } from '../audio/sound';
import { AvatarPortrait } from './AvatarPortrait';
import { AudioControlsPopover } from './AudioControlsPopover';
import { CARD_COLLECTIONS, PACK_ARTWORK_URL, RARITY_META } from '../config/collectiblesCatalog';

interface MainMenuProps {
  profile: PlayerProfileData;
  onStartAIMatch: (difficulty: AIDifficulty, rules: EuchreHouseRules) => void;
  onOpenMatchmaking: (type: QueueType) => void;
  onOpenTutorial: () => void;
  onOpenRules: () => void;
  onOpenProfile: () => void;
  onOpenFriends: () => void;
  onOpenLeaderboard: () => void;
  unopenedPacksCount?: number;
  onOpenCollection: (tab?: 'packs' | 'collections' | 'avatars') => void;
  onOpenPackOpener: () => void;
  onOpenRivalryInvite: () => void;
  onOpenAchievements: () => void;
  pendingRequestsCount?: number;
  isMuted: boolean;
  onToggleMute: () => void;
  isAuthenticated?: boolean;
  onOpenAuth?: (tab?: 'login' | 'register', reason?: string) => void;
  onLogout?: () => void;
}

type QuickModeId = 'ranked_solo' | 'ai_bots' | 'unranked' | 'private' | 'rivalry';

export const MainMenu: React.FC<MainMenuProps> = ({
  profile,
  onStartAIMatch,
  onOpenMatchmaking,
  onOpenTutorial,
  onOpenRules,
  onOpenProfile,
  onOpenFriends,
  onOpenLeaderboard,
  unopenedPacksCount = 0,
  onOpenCollection,
  onOpenPackOpener,
  onOpenRivalryInvite,
  onOpenAchievements,
  pendingRequestsCount = 0,
  isAuthenticated = false,
  onOpenAuth,
  onLogout,
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIDifficulty>('medium');
  const [targetScore, setTargetScore] = useState<number>(10);
  const [stickTheDealer, setStickTheDealer] = useState<boolean>(true);

  // Quick-play selector state (bar directly above "Start Game")
  const [quickMode, setQuickMode] = useState<QuickModeId>('ranked_solo');
  const [isQuickSelectorOpen, setIsQuickSelectorOpen] = useState<boolean>(false);

  // Expandable sub-panels for stacked action cards
  const [expandedCard, setExpandedCard] = useState<'ranked' | 'friend' | 'bots' | 'learn' | null>(null);
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);

  const toggleCard = (card: 'ranked' | 'friend' | 'bots' | 'learn') => {
    sounds.playUiClick();
    setExpandedCard((prev) => (prev === card ? null : card));
  };

  const handleStartSelectedGame = () => {
    sounds.playUiClick();
    if (quickMode === 'ranked_solo') {
      onOpenMatchmaking('ranked_solo');
    } else if (quickMode === 'ai_bots') {
      sounds.playVictoryFanfare();
      onStartAIMatch(selectedDifficulty, {
        ...DEFAULT_RULES,
        targetScore,
        stickTheDealer,
      });
    } else if (quickMode === 'unranked') {
      onOpenMatchmaking('unranked');
    } else if (quickMode === 'private') {
      onOpenMatchmaking('private');
    } else if (quickMode === 'rivalry') {
      onOpenRivalryInvite();
    }
  };

  const getQuickModeSummary = () => {
    switch (quickMode) {
      case 'ranked_solo':
        return {
          icon: <Zap className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />,
          title: 'Ranked Solo Queue',
          sub: '10 pts',
        };
      case 'ai_bots':
        return {
          icon: <Bot className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
          title: `Play Bots (${selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1)})`,
          sub: `${targetScore} pts`,
        };
      case 'unranked':
        return {
          icon: <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0" />,
          title: 'Casual Unranked',
          sub: '10 pts',
        };
      case 'private':
        return {
          icon: <Users className="w-4 h-4 text-amber-300 flex-shrink-0" />,
          title: 'Private Room Lobby',
          sub: 'Custom',
        };
      case 'rivalry':
        return {
          icon: <Swords className="w-4 h-4 text-cyan-300 flex-shrink-0" />,
          title: 'Friendly Rivalry',
          sub: 'Head-to-Head',
        };
    }
  };

  const activeModeMeta = getQuickModeSummary();

  return (
    <div className="relative min-h-[100dvh] w-full bg-[#0b0f19] text-white flex flex-col lg:flex-row overflow-x-hidden select-none">
      {/* Subtle Background Ambient Lighting */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_18%,_rgba(16,185,129,0.12)_0%,_rgba(245,158,11,0.06)_35%,_transparent_70%)] pointer-events-none" />

      {/* =====================================================================
          DESKTOP LEFT NAVIGATION RAIL (Visible on lg+ screens)
      ===================================================================== */}
      <aside className="hidden lg:flex w-64 xl:w-72 flex-col justify-between bg-[#0f1523]/95 border-r border-slate-800/80 p-5 z-20 flex-shrink-0">
        <div className="space-y-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 p-[2px] shadow-lg shadow-amber-500/20 flex-shrink-0">
              <div className="w-full h-full rounded-[14px] bg-slate-950 flex flex-col items-center justify-center">
                <span className="text-[9px] font-black tracking-tighter text-amber-300 leading-none">BOWER</span>
                <span className="text-sm font-black text-amber-400 leading-none mt-0.5">JJ</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-lg font-black tracking-wider text-amber-400 leading-none">BOWER JJ</div>
              <div className="text-[11px] text-slate-400 font-semibold mt-1 truncate">Competitive Euchre Arena</div>
            </div>
          </div>

          {/* Primary Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => {
                sounds.playUiClick();
                setExpandedCard(null);
                setIsMoreOpen(false);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-black text-sm flex items-center gap-3.5 shadow-sm cursor-pointer transition-all"
            >
              <Play className="w-5 h-5 fill-emerald-400 text-emerald-400" />
              <span>Play</span>
            </button>

            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenCollection(unopenedPacksCount > 0 ? 'packs' : 'collections');
              }}
              className="w-full px-4 py-3 rounded-2xl hover:bg-slate-800/70 text-slate-300 hover:text-white font-bold text-sm flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <Package className="w-5 h-5 text-amber-400" />
                <span>Vault &amp; Packs</span>
              </div>
              {unopenedPacksCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow">
                  {unopenedPacksCount}
                </span>
              )}
            </button>

            <button
              onClick={() => toggleCard('learn')}
              className={`w-full px-4 py-3 rounded-2xl hover:bg-slate-800/70 font-bold text-sm flex items-center justify-between transition-all cursor-pointer ${
                expandedCard === 'learn' ? 'bg-slate-800/80 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <GraduationCap className="w-5 h-5 text-cyan-400" />
                <span>Learn Euchre</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${expandedCard === 'learn' ? 'rotate-180' : ''}`}
              />
            </button>

            {expandedCard === 'learn' && (
              <div className="pl-9 pr-2 py-1 space-y-1">
                <button
                  onClick={() => {
                    sounds.playUiClick();
                    onOpenTutorial();
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-xs font-bold text-amber-300 flex items-center gap-2 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Interactive Tutorial</span>
                </button>
                <button
                  onClick={() => {
                    sounds.playUiClick();
                    onOpenRules();
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-xs font-bold text-cyan-300 flex items-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Rules Compendium</span>
                </button>
              </div>
            )}

            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenLeaderboard();
              }}
              className="w-full px-4 py-3 rounded-2xl hover:bg-slate-800/70 text-slate-300 hover:text-white font-bold text-sm flex items-center gap-3.5 transition-all cursor-pointer"
            >
              <Trophy className="w-5 h-5 text-amber-300" />
              <span>Rankings</span>
            </button>

            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenFriends();
              }}
              className="w-full px-4 py-3 rounded-2xl hover:bg-slate-800/70 text-slate-300 hover:text-white font-bold text-sm flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <Users className="w-5 h-5 text-cyan-300" />
                <span>Friends</span>
              </div>
              {pendingRequestsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-black text-xs animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenAchievements();
              }}
              className="w-full px-4 py-3 rounded-2xl hover:bg-slate-800/70 text-slate-300 hover:text-white font-bold text-sm flex items-center gap-3.5 transition-all cursor-pointer"
            >
              <Award className="w-5 h-5 text-yellow-400" />
              <span>Trophies</span>
            </button>
          </nav>
        </div>

        {/* Bottom Profile & Auth Box on Desktop Rail */}
        <div className="space-y-2.5 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => {
              sounds.playUiClick();
              onOpenProfile();
            }}
            className="w-full p-3 rounded-2xl bg-[#161f30] hover:bg-[#1d283d] border border-slate-700/80 flex items-center gap-3 transition-all cursor-pointer group"
          >
            <AvatarPortrait avatarId={profile.avatarIcon} size="sm" showRarityGem />
            <div className="text-left min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-white group-hover:text-amber-300 truncate">
                  {profile.username}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
              </div>
              <div className="text-xs font-bold text-slate-400">
                LVL {profile.level} • <span className="text-amber-400">Rank {profile.rankTier}</span>
              </div>
            </div>
          </button>

          {!isAuthenticated ? (
            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenAuth?.('login', 'Sign in to save your rank, card packs, and collections across devices.');
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Sign In / Cloud Save</span>
            </button>
          ) : (
            <div className="flex items-center justify-between px-2 text-[11px] text-emerald-400 font-bold">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Cloud Synced
              </span>
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onLogout?.();
                }}
                className="text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* =====================================================================
          CENTRAL PLAY ARENA (Chess.com-style vertical column)
      ===================================================================== */}
      <main
        className="relative z-10 flex-1 flex justify-center items-start lg:py-6 px-3 sm:px-6 overflow-y-auto"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.75rem)',
        }}
      >
        <div className="w-full max-w-[440px] lg:max-w-[480px] lg:bg-[#111726]/95 lg:border lg:border-slate-800/90 lg:rounded-3xl lg:shadow-[0_24px_80px_rgba(0,0,0,0.75)] lg:p-6 flex flex-col">
          {/* Top Header Bar: Brand Emblem | "Play" | Audio & Cloud Pill */}
          <header className="flex items-center justify-between py-2">
            {/* Left: Bower JJ Hex Crest */}
            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenProfile();
              }}
              className="relative group flex items-center gap-2 cursor-pointer"
              title="BOWER JJ — Competitive Euchre"
            >
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 p-[2px] shadow-lg shadow-amber-500/20 flex items-center justify-center">
                <div className="w-full h-full rounded-[14px] bg-[#0f1624] flex flex-col items-center justify-center px-1">
                  <span className="text-[8px] font-black tracking-tighter text-amber-200 leading-none">BOWER</span>
                  <span className="text-sm font-black text-amber-400 leading-none mt-0.5">JJ</span>
                </div>
              </div>
            </button>

            {/* Center: Bold "Play" Title */}
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Play</h1>

            {/* Right: Audio & Account Cloud Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#161f30] border border-slate-700/80 shadow-inner">
              <AudioControlsPopover />
              {isAuthenticated ? (
                <button
                  onClick={() => {
                    sounds.playUiClick();
                    onOpenProfile();
                  }}
                  className="p-1.5 rounded-full text-emerald-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Cloud Saved — View Profile"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    sounds.playUiClick();
                    onOpenAuth?.('login', 'Sign in to access your saved BOWER JJ profile, rank, and card packs.');
                  }}
                  className="p-1.5 rounded-full text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Sign In / Backup to Cloud"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
              )}
            </div>
          </header>

          {/* Sub-Header Player Identity Pill */}
          <div className="flex flex-col items-center mt-1 mb-3 gap-1.5">
            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenProfile();
              }}
              className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#161f30]/95 hover:bg-[#1d283d] border border-slate-700/80 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <AvatarPortrait avatarId={profile.avatarIcon} size="xs" />
              <span className="text-xs font-black text-white max-w-[130px] truncate">{profile.username}</span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs font-bold text-slate-300">LVL {profile.level}</span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs font-bold text-slate-300">
                Rank <strong className="text-amber-400">{profile.rankTier}</strong>
              </span>
            </button>

            {!isAuthenticated && (
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenAuth?.(
                    'register',
                    'Create a free account or sign in to save your MMR, competitive rank, card packs, and collections across devices.'
                  );
                }}
                className="text-[11px] font-bold text-amber-300/90 hover:text-amber-200 underline decoration-amber-400/50 underline-offset-2 cursor-pointer"
              >
                Playing as Guest — Sign In to Save Progress
              </button>
            )}
          </div>

          {/* =================================================================
              HERO TWIN-BOWER EMBLEM + RANK LP PILL
          ================================================================= */}
          <div className="relative flex flex-col items-center justify-center py-1.5">
            {/* Ambient Emerald/Gold Spotlight Behind Cards */}
            <div className="pointer-events-none absolute w-52 h-28 rounded-full bg-gradient-to-r from-emerald-500/25 via-amber-400/20 to-emerald-500/25 blur-2xl" />

            {/* Twin Jack Bowers Crest */}
            <div
              onClick={() => {
                sounds.playUiClick();
                onOpenLeaderboard();
              }}
              className="relative flex items-center justify-center cursor-pointer group"
              title="Season 1: Bower Sovereign — View World Rankings"
            >
              {/* Left Wreath Wing */}
              <span className="text-amber-400/80 text-xl sm:text-2xl -mr-2 select-none transform -scale-x-100 rotate-12">
                🌿
              </span>

              {/* Fan of 3 Jack Bower Cards */}
              <div className="relative flex items-center justify-center h-24 sm:h-28 w-32 sm:w-36">
                {/* Left Card: Jack of Spades */}
                <div className="absolute -left-1 w-14 sm:w-16 h-20 sm:h-24 rounded-xl bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 p-[2px] shadow-xl transform -rotate-16 -translate-x-2.5 group-hover:-rotate-20 transition-transform">
                  <div className="w-full h-full rounded-[10px] bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col justify-between p-1.5 border border-amber-300/40">
                    <div className="text-left leading-none">
                      <div className="text-[11px] sm:text-xs font-black text-amber-300">J</div>
                      <div className="text-[10px] text-amber-400">♠</div>
                    </div>
                    <div className="text-center text-lg sm:text-xl text-amber-300/90 drop-shadow">♠</div>
                  </div>
                </div>

                {/* Middle Card: Golden Bower */}
                <div className="absolute w-14 sm:w-16 h-20 sm:h-24 rounded-xl bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-600 p-[2px] shadow-xl transform -rotate-3 -translate-y-1 z-10 group-hover:-translate-y-2 transition-transform">
                  <div className="w-full h-full rounded-[10px] bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 flex flex-col justify-between p-1.5 text-slate-950">
                    <div className="text-left leading-none">
                      <div className="text-[11px] sm:text-xs font-black">J</div>
                      <div className="text-[10px] font-black">♣</div>
                    </div>
                    <div className="text-center text-lg sm:text-xl font-black">♣</div>
                  </div>
                </div>

                {/* Right Front Card: Emerald Sovereign Jack of Clubs */}
                <div className="absolute right-0 w-15 sm:w-[66px] h-20 sm:h-24 rounded-xl bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 p-[2px] shadow-[0_10px_28px_rgba(16,185,129,0.4)] transform rotate-12 translate-x-2.5 z-20 group-hover:rotate-16 transition-transform">
                  <div className="w-full h-full rounded-[9px] bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-950 flex flex-col justify-between p-1.5 border border-emerald-400/40">
                    <div className="text-left leading-none">
                      <div className="text-[11px] sm:text-xs font-black text-amber-300">J</div>
                      <div className="text-[10px] text-amber-300">♣</div>
                    </div>
                    <div className="text-center text-xl sm:text-2xl text-amber-300 drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)]">
                      ♣
                    </div>
                    <div className="h-0.5 w-full rounded-full bg-amber-400/40" />
                  </div>
                </div>
              </div>

              {/* Right Wreath Wing */}
              <span className="text-amber-400/80 text-xl sm:text-2xl -ml-2 select-none -rotate-12">🌿</span>
            </div>

            {/* Overlapping Single-Line Rank & LP Pill */}
            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenLeaderboard();
              }}
              className="relative z-30 -mt-2.5 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#151d2e] hover:bg-[#1c263b] border border-amber-400/50 shadow-[0_6px_20px_rgba(0,0,0,0.65)] transition-all active:scale-95 cursor-pointer"
            >
              <span className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-[11px] flex items-center justify-center shadow">
                {profile.rankTier}
              </span>
              <span className="text-xs font-black text-white">
                Rank <span className="text-amber-400">{profile.rankTier}</span>
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs font-bold text-slate-300">{profile.rankPoints}/100 LP</span>
            </button>
          </div>

          {/* =================================================================
              QUICK-PLAY MODE SELECTOR BAR + GIANT 3D "START GAME" BUTTON
          ================================================================= */}
          <div className="mt-3 space-y-3">
            {/* Selector Dropdown Pill (Matches Chess.com "10 min v" bar) */}
            <div className="relative">
              <button
                onClick={() => {
                  sounds.playUiClick();
                  setIsQuickSelectorOpen((prev) => !prev);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-[#161f30] hover:bg-[#1c273d] border border-slate-700/80 flex items-center justify-center gap-2.5 shadow-md transition-all cursor-pointer"
              >
                {activeModeMeta.icon}
                <span className="text-sm sm:text-base font-black text-white">{activeModeMeta.title}</span>
                <span className="text-slate-400 text-sm font-bold">• {activeModeMeta.sub}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 ml-1 transition-transform duration-200 ${
                    isQuickSelectorOpen ? 'rotate-180 text-amber-400' : ''
                  }`}
                />
              </button>

              {/* Inline Mode & Rule Selector Drawer */}
              {isQuickSelectorOpen && (
                <div className="mt-2 p-3.5 rounded-2xl bg-[#131b2b] border border-slate-700 shadow-2xl space-y-3 animate-in fade-in duration-150">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
                    Select Quick-Start Mode
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {(
                      [
                        {
                          id: 'ranked_solo',
                          label: 'Ranked Solo Queue',
                          desc: 'Competitive MMR • 10 pts',
                          icon: <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />,
                        },
                        {
                          id: 'ai_bots',
                          label: 'Play Bots (Instant AI)',
                          desc: `${selectedDifficulty.toUpperCase()} • ${targetScore} pts`,
                          icon: <Bot className="w-4 h-4 text-emerald-400" />,
                        },
                        {
                          id: 'unranked',
                          label: 'Casual Play (Unranked)',
                          desc: 'Zero rank loss • Earn XP',
                          icon: <Shield className="w-4 h-4 text-cyan-400" />,
                        },
                        {
                          id: 'private',
                          label: 'Private Lobby Room',
                          desc: 'Create or Join with Room Code',
                          icon: <Users className="w-4 h-4 text-amber-300" />,
                        },
                        {
                          id: 'rivalry',
                          label: 'Friendly Rivalry',
                          desc: 'Challenge a friend head-to-head',
                          icon: <Swords className="w-4 h-4 text-cyan-300" />,
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          sounds.playUiClick();
                          setQuickMode(opt.id);
                          if (opt.id !== 'ai_bots') {
                            setIsQuickSelectorOpen(false);
                          }
                        }}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          quickMode === opt.id
                            ? 'bg-emerald-500/15 border-emerald-400/70 text-white'
                            : 'bg-[#182235] border-slate-800 text-slate-300 hover:bg-[#1e2a40]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {opt.icon}
                          <div>
                            <div className="text-xs sm:text-sm font-black">{opt.label}</div>
                            <div className="text-[10px] text-slate-400">{opt.desc}</div>
                          </div>
                        </div>
                        {quickMode === opt.id && <Check className="w-4 h-4 text-emerald-400" />}
                      </button>
                    ))}
                  </div>

                  {/* Inline Bot Rules when AI Bots is chosen */}
                  {quickMode === 'ai_bots' && (
                    <div className="pt-2 border-t border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">AI Difficulty:</span>
                        <div className="flex gap-1.5">
                          {(['easy', 'medium', 'hard'] as AIDifficulty[]).map((d) => (
                            <button
                              key={d}
                              onClick={() => {
                                sounds.playUiClick();
                                setSelectedDifficulty(d);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-black capitalize cursor-pointer ${
                                selectedDifficulty === d
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Target Score:</span>
                        <div className="flex gap-1.5">
                          {[5, 7, 10].map((pts) => (
                            <button
                              key={pts}
                              onClick={() => {
                                sounds.playUiClick();
                                setTargetScore(pts);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer ${
                                targetScore === pts
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {pts} pts
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tactile 3D Green "Start Game" Primary CTA Button */}
            <button
              onClick={handleStartSelectedGame}
              className="w-full py-4 rounded-2xl bg-gradient-to-b from-[#34d378] via-[#27ae60] to-[#1e8e4c] hover:brightness-105 active:translate-y-0.5 text-white font-black text-xl sm:text-2xl tracking-tight shadow-[0_5px_0_#146435,0_12px_30px_rgba(39,174,96,0.38)] border-t border-emerald-300/40 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Start Game</span>
            </button>
          </div>

          {/* =================================================================
              4 STACKED PRIMARY MODE CARDS (Chess.com-style vertical rows)
          ================================================================= */}
          <div className="mt-4 space-y-2.5">
            {/* ROW 1: RANKED & RIVALRY */}
            <div className="rounded-2xl bg-[#161f30] border border-slate-700/75 overflow-hidden shadow-md transition-all">
              <button
                onClick={() => toggleCard('ranked')}
                className="w-full px-4 py-3.5 hover:bg-[#1c273d] flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-2xl shadow-inner flex-shrink-0">
                    🏆
                  </div>
                  <span className="text-base sm:text-lg font-black text-white">Ranked &amp; Rivalry</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-amber-400 hidden sm:inline">
                    {100 - profile.rankPoints} LP to Promo
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      expandedCard === 'ranked' ? 'rotate-180 text-amber-400' : ''
                    }`}
                  />
                </div>
              </button>

              {expandedCard === 'ranked' && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 bg-[#121a29] space-y-2.5 animate-in fade-in duration-150">
                  <p className="text-xs text-slate-300">
                    Season 1: Bower Sovereign — {100 - profile.rankPoints} points until promotion! Opponents balanced via hidden MMR.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        sounds.playUiClick();
                        onOpenMatchmaking('ranked_solo');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer"
                    >
                      <Zap className="w-4 h-4 fill-slate-950" />
                      <span>Ranked Solo Queue</span>
                    </button>
                    <button
                      onClick={() => {
                        sounds.playUiClick();
                        onOpenRivalryInvite();
                      }}
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Swords className="w-4 h-4 text-cyan-400" />
                      <span>Friendly Rivalry</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ROW 2: PLAY A FRIEND (PRIVATE LOBBY & RIVALRY) */}
            <div className="rounded-2xl bg-[#161f30] border border-slate-700/75 overflow-hidden shadow-md transition-all">
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenMatchmaking('private');
                }}
                className="w-full px-4 py-3.5 hover:bg-[#1c273d] flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-2xl shadow-inner flex-shrink-0">
                    🤝
                  </div>
                  <div className="text-left">
                    <div className="text-base sm:text-lg font-black text-white">Play a Friend</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-400">Private Lobby ›</span>
              </button>
            </div>

            {/* ROW 3: PLAY BOTS (AI MATCH + INLINE SETTINGS) */}
            <div className="rounded-2xl bg-[#161f30] border border-slate-700/75 overflow-hidden shadow-md transition-all">
              <button
                onClick={() => toggleCard('bots')}
                className="w-full px-4 py-3.5 hover:bg-[#1c273d] flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-2xl shadow-inner flex-shrink-0">
                    🤖
                  </div>
                  <div className="text-left">
                    <span className="text-base sm:text-lg font-black text-white block leading-tight">Play Bots</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-bold text-emerald-300 capitalize">
                    {selectedDifficulty} • {targetScore} pts
                  </span>
                  <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                </div>
              </button>

              {expandedCard === 'bots' && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-[#121a29] space-y-3 animate-in fade-in duration-150">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                      AI Difficulty
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'easy', label: 'Easy', desc: 'Beginner' },
                        { id: 'medium', label: 'Medium', desc: 'Tactical' },
                        { id: 'hard', label: 'Hard', desc: 'Master Mind' },
                      ].map((diff) => (
                        <button
                          key={diff.id}
                          onClick={() => {
                            sounds.playUiClick();
                            setSelectedDifficulty(diff.id as AIDifficulty);
                          }}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                            selectedDifficulty === diff.id
                              ? 'bg-emerald-500/20 border-emerald-400 text-white ring-1 ring-emerald-400'
                              : 'bg-slate-800/90 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="text-xs font-black">{diff.label}</div>
                          <div className="text-[9px] opacity-75">{diff.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-400">Points:</span>
                      {[5, 7, 10].map((pts) => (
                        <button
                          key={pts}
                          onClick={() => {
                            sounds.playUiClick();
                            setTargetScore(pts);
                          }}
                          className={`px-2.5 py-1 rounded-lg font-black text-xs cursor-pointer ${
                            targetScore === pts
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {pts}
                        </button>
                      ))}
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-300 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={stickTheDealer}
                        onChange={(e) => setStickTheDealer(e.target.checked)}
                        className="rounded text-amber-500 focus:ring-0"
                      />
                      <span>Stick The Dealer</span>
                    </label>
                  </div>

                  <button
                    onClick={() => {
                      sounds.playVictoryFanfare();
                      onStartAIMatch(selectedDifficulty, {
                        ...DEFAULT_RULES,
                        targetScore,
                        stickTheDealer,
                      });
                    }}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>Start AI Game Now</span>
                  </button>
                </div>
              )}
            </div>

            {/* ROW 4: CARD VAULT & PACKS */}
            <div className="rounded-2xl bg-[#161f30] border border-slate-700/75 overflow-hidden shadow-md transition-all">
              <div
                onClick={() => {
                  sounds.playUiClick();
                  if (unopenedPacksCount > 0) {
                    onOpenPackOpener();
                  } else {
                    onOpenCollection('collections');
                  }
                }}
                className="w-full px-4 py-3.5 hover:bg-[#1c273d] flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative w-10 h-12 rounded-lg overflow-hidden border border-amber-400/70 shadow-md flex-shrink-0 bg-slate-950">
                    <img
                      src={PACK_ARTWORK_URL}
                      alt="Bower JJ Pack"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left min-w-0">
                    <span className="text-base sm:text-lg font-black text-white block truncate">
                      Card Vault &amp; Packs
                    </span>
                    {unopenedPacksCount > 0 && (
                      <span className="text-[11px] font-bold text-amber-300 block">
                        Tap to tear open booster packs!
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {unopenedPacksCount > 0 ? (
                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/30 to-yellow-500/20 border border-amber-400/70 text-amber-200 font-black text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span>{unopenedPacksCount}</span>
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-400">Open ›</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* =================================================================
              "MORE ⌄" TOGGLE BUTTON & SECONDARY DRAWER
          ================================================================= */}
          <div className="mt-4 flex flex-col items-center">
            <button
              onClick={() => {
                sounds.playUiClick();
                setIsMoreOpen((prev) => !prev);
              }}
              className="px-6 py-2 rounded-full bg-[#161f30] hover:bg-[#1c273d] border border-slate-700/80 text-slate-200 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow transition-all cursor-pointer"
            >
              <span>More</span>
              {isMoreOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isMoreOpen && (
              <div className="w-full mt-3 space-y-2.5 animate-in fade-in duration-150">
                {/* Casual Play (Unranked) */}
                <button
                  onClick={() => {
                    sounds.playUiClick();
                    onOpenMatchmaking('unranked');
                  }}
                  className="w-full px-4 py-3 rounded-2xl bg-[#161f30] hover:bg-[#1c273d] border border-slate-700/75 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-black text-white">Casual Play (Unranked)</div>
                      <div className="text-[11px] text-slate-400">Practice experimental calls with zero rank loss</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-cyan-300">Play ›</span>
                </button>

                {/* Open Collection Armory */}
                <button
                  onClick={() => {
                    sounds.playUiClick();
                    onOpenCollection('collections');
                  }}
                  className="w-full px-4 py-3 rounded-2xl bg-[#161f30] hover:bg-[#1c273d] border border-slate-700/75 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-black text-white">Browse All 10 Card Collections</div>
                      <div className="text-[11px] text-slate-400">Equip custom Card Backs &amp; Illustrated Avatars</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-300">Vault ›</span>
                </button>

                {/* Tutorial, Rules & Trophies Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      sounds.playUiClick();
                      onOpenTutorial();
                    }}
                    className="p-3 rounded-2xl bg-[#161f30] hover:bg-[#1c273d] border border-slate-700/75 text-left transition-all cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4 text-amber-400 mb-1" />
                    <div className="text-xs font-black text-white">Tutorial</div>
                    <div className="text-[10px] text-slate-400">Step-by-step</div>
                  </button>

                  <button
                    onClick={() => {
                      sounds.playUiClick();
                      onOpenRules();
                    }}
                    className="p-3 rounded-2xl bg-[#161f30] hover:bg-[#1c273d] border border-slate-700/75 text-left transition-all cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-cyan-400 mb-1" />
                    <div className="text-xs font-black text-white">Rules</div>
                    <div className="text-[10px] text-slate-400">Compendium</div>
                  </button>

                  <button
                    onClick={() => {
                      sounds.playUiClick();
                      onOpenAchievements();
                    }}
                    className="p-3 rounded-2xl bg-[#161f30] hover:bg-[#1c273d] border border-slate-700/75 text-left transition-all cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 text-yellow-400 mb-1" />
                    <div className="text-xs font-black text-white">Trophies</div>
                    <div className="text-[10px] text-slate-400">Achievements</div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* =====================================================================
          DESKTOP RIGHT SIDEBAR WIDGETS (Visible on xl+ screens)
      ===================================================================== */}
      <aside className="hidden xl:flex w-80 flex-col gap-4 py-6 pr-6 z-20 flex-shrink-0">
        {/* Widget 1: Unopened Booster Packs / Vault Showcase */}
        <div className="p-5 rounded-3xl bg-[#111726]/95 border border-slate-800/90 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Collector Vault</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black text-xs">
              {unopenedPacksCount} Unopened
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <img
              src={PACK_ARTWORK_URL}
              alt="Bower JJ Booster Pack"
              className="w-16 h-24 rounded-xl object-cover border border-amber-400/70 shadow-lg flex-shrink-0"
            />
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-white leading-snug">
                {unopenedPacksCount > 0
                  ? `${unopenedPacksCount} Booster Pack${unopenedPacksCount > 1 ? 's' : ''} Ready!`
                  : 'Level-Up Booster Packs'}
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Complete any 5-card set (10, J, Q, K, A) to permanently unlock its signature Card Back.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {unopenedPacksCount > 0 && (
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenPackOpener();
                }}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs shadow cursor-pointer"
              >
                Open Pack
              </button>
            )}
            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenCollection('collections');
              }}
              className={`py-2.5 px-3 rounded-xl bg-[#161f30] hover:bg-[#1c273d] border border-slate-700 text-slate-200 font-bold text-xs cursor-pointer ${
                unopenedPacksCount > 0 ? '' : 'col-span-2'
              }`}
            >
              Browse Vault
            </button>
          </div>
        </div>

        {/* Widget 2: Featured Card Back Collections Preview */}
        <div className="p-5 rounded-3xl bg-[#111726]/95 border border-slate-800/90 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-300">
              Featured Card Sets
            </span>
            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenCollection('collections');
              }}
              className="text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
            >
              View All 10 ›
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {CARD_COLLECTIONS.slice(0, 3).map((col) => (
              <button
                key={col.id}
                onClick={() => {
                  sounds.playUiClick();
                  onOpenCollection('collections');
                }}
                className="p-2 rounded-2xl bg-[#161f30] hover:bg-[#1c273d] border border-slate-800 text-center transition-all group cursor-pointer"
              >
                <img
                  src={col.cardBackImageUrl}
                  alt={col.name}
                  className="w-12 h-16 mx-auto rounded-md object-cover border border-slate-700 group-hover:scale-105 transition-transform"
                />
                <span className="text-[10px] font-black text-white block mt-1.5 truncate">{col.name}</span>
                <span className={`text-[9px] font-bold uppercase ${RARITY_META[col.rarity].textClass}`}>
                  {RARITY_META[col.rarity].label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* =====================================================================
          MOBILE BOTTOM NAVIGATION BAR (5 Tabs — Matches Chess.com Reference)
      ===================================================================== */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-[#0e1320]/95 backdrop-blur-xl border-t border-slate-800/90"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-md mx-auto grid grid-cols-5 items-center">
          {/* Tab 1: Play (Active) */}
          <button
            onClick={() => {
              sounds.playUiClick();
              setExpandedCard(null);
              setIsMoreOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="relative py-2.5 flex flex-col items-center justify-center text-emerald-400 cursor-pointer"
          >
            <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <Play className="w-5 h-5 fill-emerald-400" />
            <span className="text-[10px] font-black mt-1">Play</span>
          </button>

          {/* Tab 2: Vault */}
          <button
            onClick={() => {
              sounds.playUiClick();
              onOpenCollection(unopenedPacksCount > 0 ? 'packs' : 'collections');
            }}
            className="relative py-2.5 flex flex-col items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <div className="relative">
              <Package className="w-5 h-5" />
              {unopenedPacksCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow">
                  {unopenedPacksCount > 99 ? '99+' : unopenedPacksCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold mt-1">Vault</span>
          </button>

          {/* Tab 3: Learn */}
          <button
            onClick={() => {
              sounds.playUiClick();
              onOpenTutorial();
            }}
            className="py-2.5 flex flex-col items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <GraduationCap className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">Learn</span>
          </button>

          {/* Tab 4: Rankings */}
          <button
            onClick={() => {
              sounds.playUiClick();
              onOpenLeaderboard();
            }}
            className="py-2.5 flex flex-col items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Trophy className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">Rankings</span>
          </button>

          {/* Tab 5: Friends */}
          <button
            onClick={() => {
              sounds.playUiClick();
              onOpenFriends();
            }}
            className="relative py-2.5 flex flex-col items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <div className="relative">
              <Users className="w-5 h-5" />
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse shadow">
                  {pendingRequestsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold mt-1">Friends</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
