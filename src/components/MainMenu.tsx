/**
 * BOWER JJ — Main Menu & Game Mode Arena
 * Streamlined Chess.com-inspired vertical Play layout.
 * Unified "Select Game Mode" selector, tactile 3D Start Game CTA, compact action cards, and zero mobile scrolling.
 */

import React, { useState, useRef, useEffect } from 'react';
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
import { CardView } from './CardView';
import { CARD_COLLECTIONS, PACK_ARTWORK_URL, RARITY_META } from '../config/collectiblesCatalog';
import { SanitizedGameState } from '../../server/types';
import { RankBadge, RANK_INFO, getRankDivisionInfo } from './RankBadge';

interface MainMenuProps {
  profile: PlayerProfileData;
  activeRankedMatch?: SanitizedGameState | null;
  onRejoinMatch?: () => void;
  onForfeitActiveMatch?: () => void;
  onStartAIMatch: (difficulty: AIDifficulty, rules: EuchreHouseRules) => void;
  onOpenMatchmaking: (type: QueueType, autoFillBots?: boolean) => void;
  onOpenTutorial: () => void;
  onOpenRules: () => void;
  onOpenProfile: () => void;
  onOpenFriends: () => void;
  onOpenLeaderboard: () => void;
  unopenedPacksCount?: number;
  onOpenCollection: (tab?: 'packs' | 'collections' | 'avatars') => void;
  onOpenPackOpener: () => void;
  onOpenRivalryInvite?: () => void;
  onOpenAchievements: () => void;
  pendingRequestsCount?: number;
  isMuted: boolean;
  onToggleMute: () => void;
  isAuthenticated?: boolean;
  onOpenAuth?: (tab?: 'login' | 'register', reason?: string) => void;
  onLogout?: () => void;
  onOpenTracker?: () => void;
}

type QuickModeId = 'ranked_solo' | 'unranked' | 'private' | 'ai_bots';

export const MainMenu: React.FC<MainMenuProps> = ({
  profile,
  activeRankedMatch,
  onRejoinMatch,
  onForfeitActiveMatch,
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
  onOpenTracker,
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIDifficulty>('medium');
  const [targetScore, setTargetScore] = useState<number>(10);
  const [stickTheDealer, setStickTheDealer] = useState<boolean>(true);

  // Unified Game Mode selection (drives the big green "Start Game" button)
  const [quickMode, setQuickMode] = useState<QuickModeId>('ranked_solo');
  const [isQuickSelectorOpen, setIsQuickSelectorOpen] = useState<boolean>(false);

  // Quick Learn Dialog (Tutorial vs Rules)
  const [isLearnDialogOpen, setIsLearnDialogOpen] = useState<boolean>(false);

  // Close modals on Escape key
  useEffect(() => {
    if (!isQuickSelectorOpen && !isLearnDialogOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsQuickSelectorOpen(false);
        setIsLearnDialogOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuickSelectorOpen, isLearnDialogOpen]);

  // Hidden owner shortcut: 5 rapid clicks on logo opens the private tracker
  const logoClicksRef = useRef<{ count: number; lastTime: number }>({ count: 0, lastTime: 0 });
  const handleLogoClick = () => {
    const now = Date.now();
    if (now - logoClicksRef.current.lastTime < 1800) {
      logoClicksRef.current.count += 1;
      if (logoClicksRef.current.count >= 5) {
        logoClicksRef.current.count = 0;
        if (onOpenTracker) {
          onOpenTracker();
        } else {
          window.location.href = '/tracker';
        }
      }
    } else {
      logoClicksRef.current = { count: 1, lastTime: now };
    }
  };

  const handleStartSelectedGame = () => {
    sounds.playUiClick();
    if (quickMode === 'ranked_solo') {
      onOpenMatchmaking('ranked_solo');
    } else if (quickMode === 'ai_bots') {
      // Directly open the game room lobby filled with bots
      onOpenMatchmaking('private', true);
    } else if (quickMode === 'unranked') {
      onOpenMatchmaking('unranked');
    } else if (quickMode === 'private') {
      // Directly open the game room lobby for playing with friends
      onOpenMatchmaking('private', false);
    }
  };

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
          <div
            onClick={handleLogoClick}
            title="BOWER JJ — Home of Competitive Euchre"
            className="flex items-center gap-3 px-2 cursor-pointer select-none group"
          >
            <img
              src="/assets/bower_jj_pack_logo.png?v=pack_crest"
              alt="BOWER JJ"
              className="h-11 w-auto object-contain group-hover:scale-105 transition-transform duration-200 drop-shadow-[0_4px_16px_rgba(245,158,11,0.45)]"
            />
          </div>

          {/* Primary Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => {
                sounds.playUiClick();
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
          CENTRAL PLAY ARENA (Expanded Desktop & Mobile Adaptive Grid)
      ===================================================================== */}
      <main
        className="relative z-10 flex-1 flex flex-col items-center h-full px-3 sm:px-6 py-2 sm:py-4 overflow-y-auto pb-28 sm:pb-8"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.35rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.75rem)',
        }}
      >
        <div className="w-full max-w-lg lg:max-w-3xl xl:max-w-4xl lg:bg-[#111726]/95 lg:border lg:border-slate-800/90 lg:rounded-3xl lg:shadow-[0_24px_80px_rgba(0,0,0,0.75)] p-3.5 sm:p-5 lg:p-6 flex flex-col justify-between flex-1 my-auto">
          {/* Top Header Bar: BOWER JJ Emblem Logo & Controls (Play removed) */}
          <div>
            <header className="relative flex items-center justify-between py-1 min-h-[44px] sm:min-h-[52px]">
              {/* Left: Quick Profile Avatar Button */}
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenProfile();
                }}
                className="flex items-center gap-2 p-1 sm:p-1.5 rounded-2xl bg-[#161f30] hover:bg-[#1c273d] border border-slate-700/80 shadow-sm transition-all cursor-pointer group z-10"
                title="View Profile & Career Stats"
              >
                <AvatarPortrait avatarId={profile.avatarIcon} size="xs" />
                <div className="hidden sm:flex flex-col text-left pr-1">
                  <span className="text-[11px] font-black text-white truncate max-w-[85px]">{profile.username}</span>
                  <span className="text-[9px] font-bold text-amber-400">LVL {profile.level}</span>
                </div>
              </button>

              {/* Center: BOWER JJ 3D Embossed Gold Foil Logo (Centered on top of name/level/rank button) */}
              <div
                onClick={handleLogoClick}
                title="BOWER JJ — Home of Competitive Euchre"
                className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex items-center justify-center select-none cursor-pointer group py-0.5 z-20 pointer-events-auto"
              >
                <img
                  src="/assets/bower_jj_pack_logo.png?v=pack_crest"
                  alt="BOWER JJ"
                  className="h-10 sm:h-12 md:h-14 w-auto max-w-[190px] sm:max-w-[240px] object-contain select-none group-hover:scale-105 active:scale-95 transition-transform duration-200 drop-shadow-[0_4px_16px_rgba(245,158,11,0.45)]"
                />
              </div>

              {/* Right: Audio Popover & Cloud / Sign Out Status */}
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#161f30] border border-slate-700/80 shadow-inner z-10">
                <AudioControlsPopover />
                {isAuthenticated ? (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => {
                        sounds.playUiClick();
                        onOpenProfile();
                      }}
                      className="p-1 rounded-full text-emerald-400 hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Cloud Saved — Tap to View Profile"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        sounds.playUiClick();
                        onLogout?.();
                      }}
                      className="p-1 rounded-full text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
                      title="Sign Out"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
            <div className="flex flex-col items-center mt-1 mb-1">
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenProfile();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#161f30]/95 hover:bg-[#1d283d] border border-slate-700/80 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
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
                  className="text-[10px] font-bold text-amber-300/80 hover:text-amber-200 underline decoration-amber-400/40 mt-0.5 cursor-pointer"
                >
                  Playing as Guest — Sign In to Save
                </button>
              )}
            </div>

            {/* =================================================================
                HERO TWIN-BOWER EMBLEM + RANK LP PILL
            ================================================================= */}
            <div className="relative flex flex-col items-center justify-center py-1 sm:py-2">
              <div className="pointer-events-none absolute w-56 h-28 rounded-full bg-gradient-to-r from-emerald-500/25 via-amber-400/20 to-emerald-500/25 blur-2xl" />

              {/* Static 3-Card Bower Fan Artwork */}
              <div className="relative flex items-center justify-center select-none pointer-events-none mb-1">
                <img
                  src="/assets/bower_3card_fan.svg?v=clean"
                  alt="Bower JJ 3-Card Bower Fan"
                  className="w-56 sm:w-64 h-auto max-h-24 sm:max-h-28 object-contain select-none pointer-events-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)]"
                />
              </div>

              {/* Single-Line Compact Rank & LP Pill */}
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenLeaderboard();
                }}
                className="relative z-30 -mt-1.5 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#151d2e] hover:bg-[#1c263b] border border-amber-400/60 shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <RankBadge
                  tier={profile.rankTier}
                  division={profile.rankDivision}
                  points={profile.rankPoints}
                  size="xs"
                  showLabel={false}
                  showDivisionPips={false}
                />
                <span className="text-xs sm:text-sm font-black text-white">
                  <span className="text-amber-400">
                    {RANK_INFO[profile.rankTier]?.name || `Rank ${profile.rankTier}`}
                  </span>
                  {profile.rankTier !== 'BOWER_JJ' && (
                    <span className="text-amber-200/90 text-[11px] ml-1 font-mono">
                      • {getRankDivisionInfo(profile.rankTier, profile.rankPoints, profile.rankDivision).division}
                    </span>
                  )}
                </span>
                <span className="text-slate-500 text-xs">•</span>
                <span className="text-xs font-bold text-slate-200 font-mono">{profile.rankPoints}/100 LP</span>
              </button>
            </div>
          </div>

          {/* Active Ranked Match Banner */}
          {activeRankedMatch && activeRankedMatch.phase !== 'game_over' && (() => {
            const myTeam = activeRankedMatch.yourPosition % 2;
            const oppTeam = (activeRankedMatch.yourPosition + 1) % 2;
            const myScore = activeRankedMatch.scores[myTeam] || 0;
            const oppScore = activeRankedMatch.scores[oppTeam] || 0;
            const targetScore = activeRankedMatch.rules?.targetScore ?? 10;
            const modeLabel =
              activeRankedMatch.queueMode === 'rivals'
                ? 'Ranked Rivals'
                : activeRankedMatch.queueMode === 'casual'
                ? 'Casual 2v2'
                : activeRankedMatch.queueMode === 'custom'
                ? `Custom Room (${activeRankedMatch.roomCode || 'Lobby'})`
                : 'Ranked 2v2';

            return (
              <div className="w-full my-2 rounded-2xl bg-gradient-to-r from-amber-950/80 via-[#131f33] to-emerald-950/80 border-2 border-amber-400/80 p-3 sm:p-4 shadow-[0_0_25px_rgba(245,158,11,0.25)] relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-500 animate-pulse" />
                
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center flex-shrink-0 text-amber-300 relative shadow-inner">
                      <Zap className="w-5 h-5 fill-amber-400 text-amber-400 animate-bounce" />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400/50 text-[10px] font-black text-emerald-300 uppercase tracking-wider">
                          Match In Progress
                        </span>
                        <span className="text-xs font-bold text-amber-300">{modeLabel}</span>
                      </div>
                      <div className="text-sm font-black text-white mt-0.5">
                        Your Team: <span className="text-emerald-400">{myScore}</span> — Opponents: <span className="text-rose-400">{oppScore}</span>
                        <span className="text-slate-400 text-xs font-medium ml-1.5">/ {targetScore} pts</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-shrink-0">
                    {onForfeitActiveMatch && (
                      <button
                        onClick={() => {
                          sounds.playUiClick();
                          if (window.confirm('Are you sure you want to forfeit and abandon this match?')) {
                            onForfeitActiveMatch();
                          }
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/50 text-xs font-bold text-slate-300 hover:text-rose-300 transition-all cursor-pointer"
                      >
                        Forfeit
                      </button>
                    )}
                    {onRejoinMatch && (
                      <button
                        onClick={() => {
                          sounds.playUiClick();
                          onRejoinMatch();
                        }}
                        className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:brightness-110 active:scale-95 text-white font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-500/30 border-t border-emerald-300/40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>REJOIN MATCH</span>
                        <span className="text-base font-black">➔</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* =================================================================
              CARD-BASED GAME MODE SELECTOR (4 Direct Cards across Mobile & Desktop)
          ================================================================= */}
          <div className="my-2 space-y-2.5 w-full">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Select Game Mode</span>
              </span>
              <span className="text-[11px] text-slate-400 font-semibold">
                {quickMode === 'ai_bots'
                  ? 'Instant Practice'
                  : quickMode === 'ranked_solo'
                  ? 'Competitive 2v2'
                  : quickMode === 'private'
                  ? 'Custom Lobby'
                  : 'Casual Play'}
              </span>
            </div>

            {/* The 4-Card Grid: Ranked, Casual, Play a Friend, Play Bots */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {/* Card 1: Ranked Solo */}
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setQuickMode('ranked_solo');
                }}
                className={`p-3.5 sm:p-4 rounded-2xl border text-left flex flex-col justify-between min-h-[96px] sm:min-h-[108px] transition-all cursor-pointer relative overflow-hidden group ${
                  quickMode === 'ranked_solo'
                    ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/80 shadow-[0_0_24px_rgba(245,158,11,0.25)]'
                    : 'bg-[#151e2f] border-slate-700/80 hover:border-amber-400/50 hover:bg-[#1a253a]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner group-hover:scale-105 transition-transform">
                    <Trophy className="w-5 h-5 sm:w-6 sm:h-6 fill-amber-400 text-amber-300" />
                  </div>
                  {quickMode === 'ranked_solo' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-ping" />
                  )}
                </div>
                <div>
                  <div className="text-base sm:text-lg lg:text-xl font-black text-white tracking-wide group-hover:text-amber-300 transition-colors leading-tight">
                    Ranked Solo
                  </div>
                </div>
              </button>

              {/* Card 2: Casual 2v2 */}
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setQuickMode('unranked');
                }}
                className={`p-3.5 sm:p-4 rounded-2xl border text-left flex flex-col justify-between min-h-[96px] sm:min-h-[108px] transition-all cursor-pointer relative overflow-hidden group ${
                  quickMode === 'unranked'
                    ? 'bg-cyan-500/15 border-cyan-400 ring-2 ring-cyan-400/80 shadow-[0_0_24px_rgba(6,182,212,0.25)]'
                    : 'bg-[#151e2f] border-slate-700/80 hover:border-cyan-400/50 hover:bg-[#1a253a]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-inner group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 fill-cyan-400/20" />
                  </div>
                  {quickMode === 'unranked' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4] animate-ping" />
                  )}
                </div>
                <div>
                  <div className="text-base sm:text-lg lg:text-xl font-black text-white tracking-wide group-hover:text-cyan-300 transition-colors leading-tight">
                    Casual 2v2
                  </div>
                </div>
              </button>

              {/* Card 3: Play a Friend */}
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setQuickMode('private');
                }}
                className={`p-3.5 sm:p-4 rounded-2xl border text-left flex flex-col justify-between min-h-[96px] sm:min-h-[108px] transition-all cursor-pointer relative overflow-hidden group ${
                  quickMode === 'private'
                    ? 'bg-sky-500/15 border-sky-400 ring-2 ring-sky-400/80 shadow-[0_0_24px_rgba(56,189,248,0.25)]'
                    : 'bg-[#151e2f] border-slate-700/80 hover:border-sky-400/50 hover:bg-[#1a253a]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-inner group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-sky-400 fill-sky-400/20" />
                  </div>
                  {quickMode === 'private' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8] animate-ping" />
                  )}
                </div>
                <div>
                  <div className="text-base sm:text-lg lg:text-xl font-black text-white tracking-wide group-hover:text-sky-300 transition-colors leading-tight">
                    Play a Friend
                  </div>
                </div>
              </button>

              {/* Card 4: Play Bots */}
              <button
                type="button"
                onClick={() => {
                  sounds.playUiClick();
                  setQuickMode('ai_bots');
                }}
                className={`p-3.5 sm:p-4 rounded-2xl border text-left flex flex-col justify-between min-h-[96px] sm:min-h-[108px] transition-all cursor-pointer relative overflow-hidden group ${
                  quickMode === 'ai_bots'
                    ? 'bg-emerald-500/15 border-emerald-400 ring-2 ring-emerald-400/80 shadow-[0_0_24px_rgba(16,185,129,0.25)]'
                    : 'bg-[#151e2f] border-slate-700/80 hover:border-emerald-400/50 hover:bg-[#1a253a]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-105 transition-transform">
                    <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 fill-emerald-400/20" />
                  </div>
                  {quickMode === 'ai_bots' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-ping" />
                  )}
                </div>
                <div>
                  <div className="text-base sm:text-lg lg:text-xl font-black text-white tracking-wide group-hover:text-emerald-300 transition-colors leading-tight">
                    Play Bots
                  </div>
                </div>
              </button>
            </div>

            {/* Giant 3D Green "Start Game" CTA Button */}
            <button
              type="button"
              onClick={handleStartSelectedGame}
              className="w-full py-3.5 sm:py-4 rounded-2xl bg-gradient-to-b from-[#34d378] via-[#22c55e] to-[#15803d] hover:brightness-105 active:translate-y-0.5 text-white font-black text-lg sm:text-xl tracking-tight shadow-[0_4px_0_#146435,0_10px_25px_rgba(39,174,96,0.35)] border-t border-emerald-300/40 transition-all cursor-pointer flex items-center justify-center gap-2.5 mt-1"
            >
              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />
              <span className="flex items-center gap-2">
                <span>Start Game</span>
                <span className="text-xs sm:text-sm font-semibold opacity-90">
                  • {quickMode === 'ai_bots'
                    ? 'Play Bots'
                    : quickMode === 'ranked_solo'
                    ? 'Ranked Solo'
                    : quickMode === 'private'
                    ? 'Play a Friend'
                    : 'Casual 2v2'}
                </span>
              </span>
            </button>
          </div>

          {/* =================================================================
              OPEN PACKS ACTION BUTTON
          ================================================================= */}
          <div className="mt-2 w-full">
            <button
              type="button"
              onClick={() => {
                sounds.playUiClick();
                onOpenPackOpener();
              }}
              className="w-full py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-2xl bg-gradient-to-r from-[#171c2b] via-[#20273d] to-[#171c2b] hover:from-[#242c44] hover:to-[#242c44] border border-amber-500/50 hover:border-amber-400 text-white font-black transition-all shadow-md hover:shadow-amber-500/20 flex items-center justify-between cursor-pointer group active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-8 h-11 sm:w-9 sm:h-12 rounded-lg overflow-hidden border border-amber-400/80 shadow-md flex-shrink-0 bg-slate-950 group-hover:scale-105 transition-transform">
                  <img
                    src={PACK_ARTWORK_URL}
                    alt="Booster Pack"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-left min-w-0">
                  <span className="text-sm sm:text-base font-black text-amber-300 group-hover:text-amber-200 transition-colors flex items-center gap-1.5 truncate">
                    <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Open Packs</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold block truncate">
                    {unopenedPacksCount > 0
                      ? `${unopenedPacksCount} booster pack${unopenedPacksCount > 1 ? 's' : ''} ready to open!`
                      : 'Unbox new cards, cosmetics & wax seals'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {unopenedPacksCount > 0 ? (
                  <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.4)] animate-pulse">
                    <Package className="w-3.5 h-3.5" />
                    <span>{unopenedPacksCount} READY</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-bold group-hover:border-amber-500/50 group-hover:text-white transition-colors">
                    Open ›
                  </span>
                )}
              </div>
            </button>
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
