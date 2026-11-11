/**
 * BOWER JJ — Main Menu & Game Mode Arena
 * Fortnite & Brawl Stars inspired competitive UI.
 */

import React, { useState } from 'react';
import {
  Trophy,
  Bot,
  Users,
  Shield,
  HelpCircle,
  BookOpen,
  Volume2,
  VolumeX,
  Sparkles,
  Zap,
  Play,
  Flame,
  Crown,
  Swords,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { RankBadge, RankTier } from './RankBadge';
import { PlayerProfileData } from './ProfileModal';
import { AIDifficulty, EuchreHouseRules, DEFAULT_RULES } from '../engine/types';
import { QueueType } from './MatchmakingModal';
import { sounds } from '../audio/sound';

interface MainMenuProps {
  profile: PlayerProfileData;
  onStartAIMatch: (difficulty: AIDifficulty, rules: EuchreHouseRules) => void;
  onOpenMatchmaking: (type: QueueType) => void;
  onOpenTutorial: () => void;
  onOpenRules: () => void;
  onOpenProfile: () => void;
  onOpenFriends: () => void;
  onOpenLeaderboard: () => void;
  onOpenBowerPass: () => void;
  onOpenRivalryInvite: () => void;
  onOpenAchievements: () => void;
  pendingRequestsCount?: number;
  isMuted: boolean;
  onToggleMute: () => void;
  isAuthenticated?: boolean;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  profile,
  onStartAIMatch,
  onOpenMatchmaking,
  onOpenTutorial,
  onOpenRules,
  onOpenProfile,
  onOpenFriends,
  onOpenLeaderboard,
  onOpenBowerPass,
  onOpenRivalryInvite,
  onOpenAchievements,
  pendingRequestsCount = 0,
  isMuted,
  onToggleMute,
  isAuthenticated = false,
  onOpenAuth,
  onLogout,
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIDifficulty>('medium');
  const [targetScore, setTargetScore] = useState<number>(10);
  const [stickTheDealer, setStickTheDealer] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'modes' | 'battlepass'>('modes');

  return (
    <div className="relative min-h-[100dvh] w-full bg-slate-950 text-white flex flex-col overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.12)_0%,_transparent_60%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.08)_0%,_transparent_60%)] pointer-events-none" />

      {/* Top Navigation Bar with Mobile Safe Area Support */}
      <header
        className="relative z-20 px-3 sm:px-4 py-2 sm:py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between gap-1.5 sm:gap-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.65rem)' }}
      >
        {/* Brand Logo */}
        <div className="flex items-center space-x-2 min-w-0 flex-shrink">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-lg shadow-amber-500/30 flex items-center justify-center flex-shrink-0">
            <span className="font-black text-slate-950 text-sm sm:text-base">JJ</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm sm:text-lg font-black tracking-tight leading-none text-white flex items-center space-x-1.5">
              <span>BOWER JJ</span>
              <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black">
                EUCHRE
              </span>
            </div>
            <span className="hidden md:inline text-[10px] text-gray-400 font-medium truncate">Competitive Online Card Arena</span>
          </div>
        </div>

        {/* Social, Leaderboard & User Status */}
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          {/* Friends Modal Button */}
          <button
            onClick={() => {
              sounds.playUiClick();
              onOpenFriends();
            }}
            className="relative p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 transition-all active:scale-95 flex items-center space-x-1"
            title="Friends & Social Squad"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-black">Friends</span>
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          {/* Leaderboard Button */}
          <button
            onClick={() => {
              sounds.playUiClick();
              onOpenLeaderboard();
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition-all active:scale-95 flex items-center space-x-1"
            title="World Rankings"
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-black">Rankings</span>
          </button>

          {/* Sound Mute */}
          <button
            onClick={() => {
              sounds.playUiClick();
              onToggleMute();
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Account Authentication Button */}
          {isAuthenticated ? (
            <div className="flex items-center space-x-1 sm:space-x-1.5">
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenProfile();
                }}
                className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-500/50 text-emerald-300 text-[10px] sm:text-[11px] font-bold flex items-center space-x-1 shadow-sm transition-all"
                title="Account is backed up to Cloud Database"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="hidden md:inline">Cloud Saved</span>
              </button>
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onLogout?.();
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-red-950/60 hover:text-red-300 border border-slate-700 hover:border-red-500/40 text-gray-400 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenAuth?.();
              }}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 text-[10px] sm:text-[11px] font-black flex items-center space-x-1 sm:space-x-1.5 shadow-md shadow-amber-500/25 transition-all active:scale-95"
              title="Sign In / Register to Save Rank & Progress"
            >
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Sign In</span>
            </button>
          )}

          {/* Profile Card */}
          <button
            onClick={() => {
              sounds.playUiClick();
              onOpenProfile();
            }}
            className="flex items-center space-x-1.5 sm:space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 shadow-md transition-all active:scale-95 group"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-700 flex items-center justify-center text-base sm:text-lg flex-shrink-0">
              {profile.avatarIcon}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-white group-hover:text-amber-300 truncate max-w-[90px]">
                {profile.username}
              </div>
              <div className="text-[10px] text-amber-400 font-mono font-bold">
                LVL {profile.level} • {profile.rankTier}
              </div>
            </div>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main
        className="relative z-10 flex-1 max-w-5xl mx-auto w-full p-3 sm:p-6 space-y-4 sm:space-y-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.5rem)' }}
      >
        {/* Banner: Current Rank & Daily Progress */}
        <section className="p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border-2 border-amber-500/40 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:w-auto">
            {/* Mobile Badge */}
            <div className="sm:hidden flex-shrink-0">
              <RankBadge tier={profile.rankTier} points={profile.rankPoints} size="md" />
            </div>
            {/* Desktop Badge */}
            <div className="hidden sm:block flex-shrink-0">
              <RankBadge tier={profile.rankTier} points={profile.rankPoints} size="lg" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] sm:text-xs uppercase font-black tracking-wider text-amber-400 flex items-center space-x-1">
                <Crown className="w-3 sm:w-3.5 h-3 sm:h-3.5 flex-shrink-0" />
                <span>Season 1: Bower Sovereign</span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-white leading-tight">
                Competitive Division
              </h2>
              <p className="text-[11px] sm:text-xs text-gray-300 mt-0.5 leading-normal">
                {100 - profile.rankPoints} points until promotion! Opponents balanced via hidden MMR.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto flex-shrink-0">
            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenMatchmaking('ranked_solo');
              }}
              className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/30 flex items-center justify-center space-x-2 transition-all active:scale-95"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Ranked Solo Queue</span>
            </button>
            <button
              onClick={() => {
                sounds.playUiClick();
                onOpenRivalryInvite();
              }}
              className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-cyan-300 font-bold text-xs sm:text-sm border border-cyan-500/40 transition-all active:scale-95 flex items-center justify-center space-x-2"
              title="Challenge a friend to a head-to-head match on opposing teams"
            >
              <Swords className="w-4 h-4 text-cyan-400" />
              <span>Friendly Rivalry</span>
            </button>
          </div>
        </section>

        {/* Tab Selector: Play vs Battle Pass */}
        <div className="flex border-b border-slate-800 space-x-4">
          <button
            onClick={() => {
              sounds.playUiClick();
              setActiveTab('modes');
            }}
            className={`pb-2 text-sm font-black transition-all border-b-2 ${
              activeTab === 'modes'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Game Modes
          </button>
          <button
            onClick={() => {
              sounds.playUiClick();
              setActiveTab('battlepass');
            }}
            className={`pb-2 text-sm font-black transition-all border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'battlepass'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Battle Pass (Season 1)</span>
          </button>
        </div>

        {activeTab === 'modes' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Mode 1: Play Against AI (Featured / Instant Action) */}
            <div className="md:col-span-2 p-5 rounded-3xl bg-slate-900 border-2 border-emerald-500/50 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 text-emerald-400 font-black text-xs uppercase tracking-wider">
                    <Bot className="w-4 h-4" />
                    <span>Instant Match</span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-500/40">
                    Offline & Ready
                  </span>
                </div>
                <h3 className="text-xl font-black text-white">Play Against AI</h3>
                <p className="text-xs text-gray-300 mt-1">
                  Sharpen your card counting and trick strategy against 3 intelligent computer opponents.
                </p>

                {/* AI Difficulty Selector */}
                <div className="mt-4 space-y-2">
                  <span className="text-[11px] font-bold uppercase text-gray-400 block">AI Difficulty:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'easy', label: 'Easy', desc: 'Beginner' },
                      { id: 'medium', label: 'Medium', desc: 'Tactical' },
                      { id: 'hard', label: 'Hard', desc: 'Master Mind' },
                    ].map(diff => (
                      <button
                        key={diff.id}
                        onClick={() => {
                          sounds.playUiClick();
                          setSelectedDifficulty(diff.id as AIDifficulty);
                        }}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          selectedDifficulty === diff.id
                            ? 'bg-emerald-500/20 border-emerald-400 text-white ring-1 ring-emerald-400'
                            : 'bg-slate-800 border-slate-700 text-gray-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-black">{diff.label}</div>
                        <div className="text-[9px] opacity-75">{diff.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Match Options */}
                <div className="mt-4 flex flex-wrap gap-4 items-center justify-between text-xs border-t border-slate-800 pt-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400 font-bold">Target Points:</span>
                    {[5, 7, 10].map(pts => (
                      <button
                        key={pts}
                        onClick={() => {
                          sounds.playUiClick();
                          setTargetScore(pts);
                        }}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                          targetScore === pts
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                        }`}
                      >
                        {pts}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={stickTheDealer}
                      onChange={e => setStickTheDealer(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-0"
                    />
                    <span className="text-gray-300 font-semibold">Stick The Dealer</span>
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
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/30 flex items-center justify-center space-x-2 transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Start AI Game Now</span>
              </button>
            </div>

            {/* Quick Action Column */}
            <div className="space-y-4">
              {/* Private Room */}
              <div
                onClick={() => {
                  sounds.playUiClick();
                  onOpenMatchmaking('private');
                }}
                className="p-4 rounded-3xl bg-slate-900 border border-slate-800 hover:border-amber-500/60 transition-all cursor-pointer shadow-lg group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-amber-400 uppercase">Private Lobby</span>
                  <Users className="w-4 h-4 text-gray-400 group-hover:text-amber-400" />
                </div>
                <h4 className="text-sm font-black text-white">Create / Join Room</h4>
                <p className="text-[11px] text-gray-400 mt-1">
                  Play with friends using custom room codes and configurable house rules.
                </p>
              </div>

              {/* Unranked Casual */}
              <div
                onClick={() => {
                  sounds.playUiClick();
                  onOpenMatchmaking('unranked');
                }}
                className="p-4 rounded-3xl bg-slate-900 border border-slate-800 hover:border-cyan-500/60 transition-all cursor-pointer shadow-lg group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-cyan-400 uppercase">Casual Play</span>
                  <Shield className="w-4 h-4 text-gray-400 group-hover:text-cyan-400" />
                </div>
                <h4 className="text-sm font-black text-white">Unranked Matchmaking</h4>
                <p className="text-[11px] text-gray-400 mt-1">
                  Practice experimental calls and level up your XP with zero rank loss.
                </p>
              </div>

              {/* Learn, Rules & Trophies Trio */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    sounds.playUiClick();
                    onOpenTutorial();
                  }}
                  className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-400 text-left transition-all active:scale-95"
                >
                  <HelpCircle className="w-4 h-4 text-amber-400 mb-1" />
                  <div className="text-xs font-bold text-white">Tutorial</div>
                  <div className="text-[9px] text-gray-400">Step-by-step</div>
                </button>

                <button
                  onClick={() => {
                    sounds.playUiClick();
                    onOpenRules();
                  }}
                  className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-400 text-left transition-all active:scale-95"
                >
                  <BookOpen className="w-4 h-4 text-cyan-400 mb-1" />
                  <div className="text-xs font-bold text-white">Rules</div>
                  <div className="text-[9px] text-gray-400">Compendium</div>
                </button>

                <button
                  onClick={() => {
                    sounds.playUiClick();
                    onOpenAchievements();
                  }}
                  className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-yellow-400 text-left transition-all active:scale-95"
                >
                  <Trophy className="w-4 h-4 text-yellow-400 mb-1" />
                  <div className="text-xs font-bold text-white">Trophies</div>
                  <div className="text-[9px] text-gray-400">Achievements</div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Battle Pass Season 1 Preview */
          <div className="p-6 rounded-3xl bg-slate-900 border-2 border-amber-500/40 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-black uppercase text-amber-400">SEASON 1 BATTLE PASS</span>
                <h3 className="text-xl font-black text-white">The Crown of Bowers</h3>
                <p className="text-xs text-gray-300">
                  Earn cosmetic rewards simply by playing ranked, unranked, or AI matches!
                </p>
              </div>
              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenBowerPass();
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 text-slate-950 font-black text-xs shadow-md active:scale-95 transition-transform"
              >
                Open Bower Pass
              </button>
            </div>

            {/* Reward track showcase */}
            <div
              onClick={() => {
                sounds.playUiClick();
                onOpenBowerPass();
              }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 cursor-pointer group"
            >
              <div className="p-3 bg-slate-800 rounded-2xl border border-amber-500/40 text-center group-hover:border-amber-400 transition-all">
                <span className="text-2xl block mb-1">🤠</span>
                <span className="text-xs font-bold text-white block">Outlaw Hat</span>
                <span className="text-[10px] text-amber-400 font-black uppercase">Tier 1</span>
              </div>
              <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700 text-center group-hover:border-amber-400 transition-all">
                <span className="text-2xl block mb-1">🎩</span>
                <span className="text-xs font-bold text-white block">Top Hat</span>
                <span className="text-[10px] text-amber-300 font-black uppercase">Tier 3</span>
              </div>
              <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700 text-center group-hover:border-amber-400 transition-all">
                <span className="text-2xl block mb-1">✨</span>
                <span className="text-xs font-bold text-white block">Obsidian Gold</span>
                <span className="text-[10px] text-amber-300 font-black uppercase">Tier 5</span>
              </div>
              <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700 text-center group-hover:border-amber-400 transition-all">
                <span className="text-2xl block mb-1">👑</span>
                <span className="text-xs font-bold text-white block">Crown of Bowers</span>
                <span className="text-[10px] text-amber-300 font-black uppercase">Tier 10 (Apex)</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
