/**
 * BOWER JJ — Main Menu & Game Mode Arena
 * Streamlined Chess.com-inspired vertical Play layout.
 * Unified "Select Game Mode" selector, tactile 3D Start Game CTA, compact action cards, and zero mobile scrolling.
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
  Swords,
  ShieldCheck,
  LogOut,
  Package,
  ChevronDown,
  GraduationCap,
  Award,
  Check,
  SlidersHorizontal,
  X,
} from 'lucide-react';
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

type QuickModeId = 'ranked_solo' | 'unranked' | 'rivalry' | 'private' | 'ai_bots';

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

  // Unified Game Mode selection (drives the big green "Start Game" button)
  const [quickMode, setQuickMode] = useState<QuickModeId>('ranked_solo');
  const [isQuickSelectorOpen, setIsQuickSelectorOpen] = useState<boolean>(false);

  // Inline expanded drawer for Play Bots customization
  const [isBotsDrawerOpen, setIsBotsDrawerOpen] = useState<boolean>(false);

  // Quick Learn Dialog (Tutorial vs Rules)
  const [isLearnDialogOpen, setIsLearnDialogOpen] = useState<boolean>(false);

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
      case 'unranked':
        return {
          icon: <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0" />,
          title: 'Casual Unranked',
          sub: '10 pts',
        };
      case 'rivalry':
        return {
          icon: <Swords className="w-4 h-4 text-cyan-300 flex-shrink-0" />,
          title: 'Friendly Rivalry',
          sub: 'Head-to-Head',
        };
      case 'private':
        return {
          icon: <Users className="w-4 h-4 text-amber-300 flex-shrink-0" />,
          title: 'Private Lobby',
          sub: 'Room Code',
        };
      case 'ai_bots':
        return {
          icon: <Bot className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
          title: `Play Bots (${selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1)})`,
          sub: `${targetScore} pts`,
        };
    }
  };

  const activeModeMeta = getQuickModeSummary();

  return (
    <div className="relative h-[100dvh] w-full bg-[#0b0f19] text-white flex flex-col lg:flex-row overflow-hidden select-none">
      {/* Subtle Background Ambient Lighting */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_15%,_rgba(16,185,129,0.12)_0%,_rgba(245,158,11,0.06)_32%,_transparent_65%)] pointer-events-none" />

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
                setIsBotsDrawerOpen(false);
                setIsQuickSelectorOpen(false);
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
              onClick={() => {
                sounds.playUiClick();
                setIsLearnDialogOpen(true);
              }}
              className="w-full px-4 py-3 rounded-2xl hover:bg-slate-800/70 text-slate-300 hover:text-white font-bold text-sm flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <GraduationCap className="w-5 h-5 text-cyan-400" />
                <span>Learn Euchre</span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

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
          CENTRAL PLAY ARENA (Single-Screen Mobile App Format — No Scrolling)
      ===================================================================== */}
      <main
        className="relative z-10 flex-1 flex flex-col justify-between items-center h-full px-3.5 sm:px-6 py-2 sm:py-4 overflow-y-auto lg:overflow-hidden"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.35rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.75rem)',
        }}
      >
        <div className="w-full max-w-[430px] lg:max-w-[470px] lg:bg-[#111726]/95 lg:border lg:border-slate-800/90 lg:rounded-3xl lg:shadow-[0_24px_80px_rgba(0,0,0,0.75)] lg:p-5 flex flex-col justify-between flex-1 my-auto">
          {/* Top Header Bar: Brand Logo | "Play" | Audio & Cloud Controls */}
          <div>
            <header className="flex items-center justify-between py-1">
              {/* Left: Bower JJ Logo */}
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenProfile();
                }}
                className="relative group flex items-center gap-2 cursor-pointer"
                title="BOWER JJ — Competitive Euchre"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 p-[2px] shadow-md shadow-amber-500/20 flex items-center justify-center">
                  <div className="w-full h-full rounded-[10px] bg-[#0f1624] flex flex-col items-center justify-center px-0.5">
                    <span className="text-[7px] font-black tracking-tighter text-amber-200 leading-none">BOWER</span>
                    <span className="text-xs font-black text-amber-400 leading-none mt-0.5">JJ</span>
                  </div>
                </div>
              </button>

              {/* Center: "Play" Title */}
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">Play</h1>

              {/* Right: Audio Popover & Cloud Status */}
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#161f30] border border-slate-700/80 shadow-inner">
                <AudioControlsPopover />
                {isAuthenticated ? (
                  <button
                    onClick={() => {
                      sounds.playUiClick();
                      onOpenProfile();
                    }}
                    className="p-1 rounded-full text-emerald-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Cloud Saved"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      sounds.playUiClick();
                      onOpenAuth?.('login', 'Sign in to access your saved BOWER JJ profile, rank, and card packs.');
                    }}
                    className="p-1 rounded-full text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Sign In / Backup"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </header>

            {/* Profile Identity Pill */}
            <div className="flex flex-col items-center mt-1 mb-1.5">
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenProfile();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#161f30]/95 hover:bg-[#1d283d] border border-slate-700/80 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <AvatarPortrait avatarId={profile.avatarIcon} size="xs" />
                <span className="text-xs font-black text-white max-w-[120px] truncate">{profile.username}</span>
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
                  className="text-[10px] font-bold text-amber-300/80 hover:text-amber-200 underline decoration-amber-400/40 mt-0.5 cursor-pointer"
                >
                  Playing as Guest — Sign In to Save
                </button>
              )}
            </div>

            {/* =================================================================
                HERO TWIN-BOWER EMBLEM + RANK LP PILL
            ================================================================= */}
            <div className="relative flex flex-col items-center justify-center py-1">
              <div className="pointer-events-none absolute w-48 h-24 rounded-full bg-gradient-to-r from-emerald-500/20 via-amber-400/15 to-emerald-500/20 blur-xl" />

              <div
                onClick={() => {
                  sounds.playUiClick();
                  onOpenLeaderboard();
                }}
                className="relative flex items-center justify-center cursor-pointer group"
                title="Season 1: Bower Sovereign — View World Rankings"
              >
                <span className="text-amber-400/80 text-lg -mr-2 select-none transform -scale-x-100 rotate-12">
                  🌿
                </span>

                {/* Compact Fan of 3 Jack Bower Cards */}
                <div className="relative flex items-center justify-center h-20 w-28">
                  {/* Left Card: Jack of Spades */}
                  <div className="absolute -left-1 w-12 h-17 rounded-lg bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 p-[1.5px] shadow-lg transform -rotate-16 -translate-x-2 group-hover:-rotate-20 transition-transform">
                    <div className="w-full h-full rounded-[6.5px] bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col justify-between p-1 border border-amber-300/40">
                      <div className="text-left leading-none">
                        <div className="text-[10px] font-black text-amber-300">J</div>
                        <div className="text-[9px] text-amber-400">♠</div>
                      </div>
                      <div className="text-center text-base text-amber-300/90">♠</div>
                    </div>
                  </div>

                  {/* Middle Card: Golden Bower */}
                  <div className="absolute w-12 h-17 rounded-lg bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-600 p-[1.5px] shadow-lg transform -rotate-3 -translate-y-0.5 z-10 group-hover:-translate-y-1.5 transition-transform">
                    <div className="w-full h-full rounded-[6.5px] bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 flex flex-col justify-between p-1 text-slate-950">
                      <div className="text-left leading-none">
                        <div className="text-[10px] font-black">J</div>
                        <div className="text-[9px] font-black">♣</div>
                      </div>
                      <div className="text-center text-base font-black">♣</div>
                    </div>
                  </div>

                  {/* Right Card: Emerald Sovereign Jack of Clubs */}
                  <div className="absolute right-0 w-13 h-17 rounded-lg bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 p-[1.5px] shadow-[0_6px_20px_rgba(16,185,129,0.35)] transform rotate-12 translate-x-2 z-20 group-hover:rotate-16 transition-transform">
                    <div className="w-full h-full rounded-[6.5px] bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-950 flex flex-col justify-between p-1 border border-emerald-400/40">
                      <div className="text-left leading-none">
                        <div className="text-[10px] font-black text-amber-300">J</div>
                        <div className="text-[9px] text-amber-300">♣</div>
                      </div>
                      <div className="text-center text-lg text-amber-300 drop-shadow">♣</div>
                    </div>
                  </div>
                </div>

                <span className="text-amber-400/80 text-lg -ml-2 select-none -rotate-12">🌿</span>
              </div>

              {/* Single-Line Compact Rank & LP Pill */}
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenLeaderboard();
                }}
                className="relative z-30 -mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#151d2e] hover:bg-[#1c263b] border border-amber-400/50 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <span className="w-4 h-4 rounded bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-[10px] flex items-center justify-center shadow">
                  {profile.rankTier}
                </span>
                <span className="text-xs font-black text-white">
                  Rank <span className="text-amber-400">{profile.rankTier}</span>
                </span>
                <span className="text-slate-500 text-xs">•</span>
                <span className="text-[11px] font-bold text-slate-300">{profile.rankPoints}/100 LP</span>
              </button>
            </div>
          </div>

          {/* =================================================================
              UNIFIED GAME MODE SELECTOR + GIANT 3D "START GAME" CTA
          ================================================================= */}
          <div className="my-2 space-y-2">
            {/* The Slide-Down "Select Game Mode" Pill */}
            <div className="relative">
              <button
                onClick={() => {
                  sounds.playUiClick();
                  setIsQuickSelectorOpen((prev) => !prev);
                  setIsBotsDrawerOpen(false);
                }}
                className="w-full py-2.5 px-3.5 rounded-2xl bg-[#161f30] hover:bg-[#1c273d] border border-slate-700/80 flex items-center justify-between shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {activeModeMeta.icon}
                  <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex-shrink-0">
                    Select Game Mode:
                  </span>
                  <span className="text-xs sm:text-sm font-black text-white truncate">
                    {activeModeMeta.title}
                  </span>
                  <span className="text-slate-400 text-xs font-bold hidden sm:inline flex-shrink-0">
                    • {activeModeMeta.sub}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 ml-1.5 flex-shrink-0 transition-transform duration-200 ${
                    isQuickSelectorOpen ? 'rotate-180 text-amber-400' : ''
                  }`}
                />
              </button>

              {/* The Slide-Down Modal/Drawer (Holds ALL game modes in one clean menu) */}
              {isQuickSelectorOpen && (
                <div className="absolute top-full left-0 right-0 z-40 mt-1.5 p-3 rounded-2xl bg-[#131b2b] border border-slate-700 shadow-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Choose Your Game Mode
                    </span>
                    <button
                      onClick={() => setIsQuickSelectorOpen(false)}
                      className="p-1 rounded-md text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-1">
                    {(
                      [
                        {
                          id: 'ranked_solo',
                          label: 'Ranked Solo Queue',
                          desc: 'Competitive MMR • 10 pts • Earn Rank LP',
                          icon: <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />,
                        },
                        {
                          id: 'unranked',
                          label: 'Casual Play (Unranked)',
                          desc: 'Zero rank loss • Practice & Earn XP',
                          icon: <Shield className="w-4 h-4 text-cyan-400" />,
                        },
                        {
                          id: 'rivalry',
                          label: 'Friendly Rivalry',
                          desc: 'Challenge a friend head-to-head',
                          icon: <Swords className="w-4 h-4 text-cyan-300" />,
                        },
                        {
                          id: 'private',
                          label: 'Private Room Lobby',
                          desc: 'Play with friends using room code',
                          icon: <Users className="w-4 h-4 text-amber-300" />,
                        },
                        {
                          id: 'ai_bots',
                          label: 'Play Bots (Instant AI)',
                          desc: `${selectedDifficulty.toUpperCase()} • ${targetScore} pts • Offline & Ready`,
                          icon: <Bot className="w-4 h-4 text-emerald-400" />,
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
                        className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          quickMode === opt.id
                            ? 'bg-emerald-500/15 border-emerald-400/70 text-white'
                            : 'bg-[#182235] border-slate-800 text-slate-300 hover:bg-[#1e2a40]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {opt.icon}
                          <div>
                            <div className="text-xs font-black">{opt.label}</div>
                            <div className="text-[10px] text-slate-400">{opt.desc}</div>
                          </div>
                        </div>
                        {quickMode === opt.id && <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>

                  {/* Inline Bot Rules when AI Bots is chosen */}
                  {quickMode === 'ai_bots' && (
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">AI Difficulty:</span>
                        <div className="flex gap-1">
                          {(['easy', 'medium', 'hard'] as AIDifficulty[]).map((d) => (
                            <button
                              key={d}
                              onClick={() => {
                                sounds.playUiClick();
                                setSelectedDifficulty(d);
                              }}
                              className={`px-2 py-0.5 rounded text-[11px] font-black capitalize cursor-pointer ${
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
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Target Score:</span>
                        <div className="flex gap-1">
                          {[5, 7, 10].map((pts) => (
                            <button
                              key={pts}
                              onClick={() => {
                                sounds.playUiClick();
                                setTargetScore(pts);
                              }}
                              className={`px-2 py-0.5 rounded text-[11px] font-black cursor-pointer ${
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

                      <button
                        onClick={() => setIsQuickSelectorOpen(false)}
                        className="w-full py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs cursor-pointer"
                      >
                        Confirm &amp; Close Selector
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tactile 3D Green "Start Game" Primary CTA Button */}
            <button
              onClick={handleStartSelectedGame}
              className="w-full py-3.5 sm:py-4 rounded-2xl bg-gradient-to-b from-[#34d378] via-[#27ae60] to-[#1e8e4c] hover:brightness-105 active:translate-y-0.5 text-white font-black text-lg sm:text-xl tracking-tight shadow-[0_4px_0_#146435,0_10px_25px_rgba(39,174,96,0.35)] border-t border-emerald-300/40 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Start Game</span>
            </button>
          </div>

          {/* =================================================================
              COMPACT ACTION BUTTONS (Clean, no scroll, zero redundancy)
          ================================================================= */}
          <div className="space-y-2 mt-1">
            {/* ROW 1: PLAY A FRIEND (Private Lobby) */}
            <div className="rounded-2xl bg-[#161f30] border border-slate-700/75 overflow-hidden shadow-sm transition-all">
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenMatchmaking('private');
                }}
                className="w-full px-3.5 py-3 hover:bg-[#1c273d] flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-xl shadow-inner flex-shrink-0">
                    🤝
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black text-white">Play a Friend</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-400">Private Lobby ›</span>
              </button>
            </div>

            {/* ROW 2: PLAY BOTS (Instant AI Practice + Settings) */}
            <div className="rounded-2xl bg-[#161f30] border border-slate-700/75 overflow-hidden shadow-sm transition-all">
              <button
                onClick={() => {
                  sounds.playUiClick();
                  setIsBotsDrawerOpen((prev) => !prev);
                }}
                className="w-full px-3.5 py-3 hover:bg-[#1c273d] flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-xl shadow-inner flex-shrink-0">
                    🤖
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-black text-white block leading-tight">Play Bots</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold text-emerald-300 capitalize">
                    {selectedDifficulty} • {targetScore} pts
                  </span>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </button>

              {/* Inline Bot Controls */}
              {isBotsDrawerOpen && (
                <div className="px-3.5 pb-3 pt-1 border-t border-slate-800/80 bg-[#121a29] space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">AI Difficulty:</span>
                    <div className="flex gap-1">
                      {(['easy', 'medium', 'hard'] as AIDifficulty[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => {
                            sounds.playUiClick();
                            setSelectedDifficulty(d);
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-black capitalize cursor-pointer ${
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
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Target Points:</span>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[5, 7, 10].map((pts) => (
                          <button
                            key={pts}
                            onClick={() => {
                              sounds.playUiClick();
                              setTargetScore(pts);
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-black cursor-pointer ${
                              targetScore === pts
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {pts}
                          </button>
                        ))}
                      </div>

                      <label className="flex items-center gap-1.5 text-[11px] text-slate-300 font-bold cursor-pointer ml-1">
                        <input
                          type="checkbox"
                          checked={stickTheDealer}
                          onChange={(e) => setStickTheDealer(e.target.checked)}
                          className="rounded text-amber-500 focus:ring-0"
                        />
                        <span>Stick</span>
                      </label>
                    </div>
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
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 font-black text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Launch AI Match Now</span>
                  </button>
                </div>
              )}
            </div>

            {/* ROW 3: CARD VAULT & PACKS */}
            <div className="rounded-2xl bg-[#161f30] border border-slate-700/75 overflow-hidden shadow-sm transition-all">
              <div
                onClick={() => {
                  sounds.playUiClick();
                  if (unopenedPacksCount > 0) {
                    onOpenPackOpener();
                  } else {
                    onOpenCollection('collections');
                  }
                }}
                className="w-full px-3.5 py-3 hover:bg-[#1c273d] flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-8 h-10 rounded-md overflow-hidden border border-amber-400/70 shadow-sm flex-shrink-0 bg-slate-950">
                    <img
                      src={PACK_ARTWORK_URL}
                      alt="Bower JJ Pack"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left min-w-0">
                    <span className="text-sm font-black text-white block truncate">
                      Card Vault &amp; Packs
                    </span>
                    {unopenedPacksCount > 0 && (
                      <span className="text-[10px] font-bold text-amber-300 block">
                        Tap to unseal booster packs!
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {unopenedPacksCount > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/30 to-yellow-500/20 border border-amber-400/70 text-amber-200 font-black text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      <span>{unopenedPacksCount}</span>
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-400">Vault ›</span>
                  )}
                </div>
              </div>
            </div>
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
          MOBILE BOTTOM NAVIGATION BAR (5 Tabs — Matches Native App Format)
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
              setIsQuickSelectorOpen(false);
              setIsBotsDrawerOpen(false);
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

          {/* Tab 3: Learn (Tutorial & Rules) */}
          <button
            onClick={() => {
              sounds.playUiClick();
              setIsLearnDialogOpen(true);
            }}
            className="py-2.5 flex flex-col items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <GraduationCap className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">Learn</span>
          </button>

          {/* Tab 4: Rankings (Leaderboard & Achievements) */}
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

      {/* Learn Dialog (Tutorial vs Rules) */}
      {isLearnDialogOpen && (
        <div
          onClick={() => setIsLearnDialogOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#131b2b] border border-slate-700 p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-300 font-black text-sm">
                <GraduationCap className="w-5 h-5" />
                <span>Learn Euchre</span>
              </div>
              <button
                onClick={() => setIsLearnDialogOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => {
                  sounds.playUiClick();
                  setIsLearnDialogOpen(false);
                  onOpenTutorial();
                }}
                className="w-full p-3.5 rounded-2xl bg-[#182235] hover:bg-[#1e2a40] border border-slate-700/80 text-left flex items-center gap-3.5 cursor-pointer transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-300 flex-shrink-0">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-white">Interactive Tutorial</div>
                  <div className="text-[11px] text-slate-400">Step-by-step Euchre walkthrough for beginners</div>
                </div>
              </button>

              <button
                onClick={() => {
                  sounds.playUiClick();
                  setIsLearnDialogOpen(false);
                  onOpenRules();
                }}
                className="w-full p-3.5 rounded-2xl bg-[#182235] hover:bg-[#1e2a40] border border-slate-700/80 text-left flex items-center gap-3.5 cursor-pointer transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 flex-shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-white">Rules Compendium</div>
                  <div className="text-[11px] text-slate-400">Bower hierarchy, ordering up, scoring &amp; reneging</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
