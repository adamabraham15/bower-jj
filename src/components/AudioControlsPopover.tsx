/**
 * BOWER JJ — Accessible Audio & Music Controls Popover
 * Allows players to independently toggle and adjust Chill Lo-Fi Background Music
 * and Game Sound Effects (SFX), with persistent preferences across sessions.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Music, Sliders } from 'lucide-react';
import { sounds, AudioPreferences } from '../audio/sound';

interface AudioControlsPopoverProps {
  compact?: boolean;
}

export const AudioControlsPopover: React.FC<AudioControlsPopoverProps> = ({
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prefs, setPrefs] = useState<AudioPreferences>(() => sounds.getAudioPreferences());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = sounds.subscribe(nextPrefs => {
      setPrefs(nextPrefs);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const isAllMuted = prefs.sfxMuted && !prefs.musicEnabled;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          sounds.playUiClick();
          setIsOpen(prev => !prev);
        }}
        title="Music & Sound Settings"
        aria-label="Music and Sound Settings"
        className={`${
          compact
            ? 'p-1 sm:p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-300'
            : 'p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-gray-300 hover:text-white'
        } flex items-center space-x-1 transition-all relative`}
      >
        {isAllMuted ? (
          <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
        ) : (
          <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" />
        )}
        {prefs.musicEnabled && (
          <span
            title="Chill Background Music Active"
            className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-68 sm:w-72 rounded-2xl bg-slate-900/98 border border-slate-700/90 shadow-2xl p-4 z-50 text-left space-y-3.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Audio & Vibe Mixer
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextMuteAll = !isAllMuted;
                sounds.setMuted(nextMuteAll);
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                isAllMuted
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25'
              }`}
            >
              {isAllMuted ? 'Unmute All' : 'Mute All'}
            </button>
          </div>

          {/* Background Music Control */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Music className={`w-3.5 h-3.5 ${prefs.musicEnabled ? 'text-cyan-400' : 'text-gray-500'}`} />
                <div>
                  <div className="text-xs font-bold text-white leading-tight">Chill Background Music</div>
                  <div className="text-[10px] text-gray-400">
                    {sounds.getMusicScene() === 'game' ? 'Atmospheric Match Groove' : 'Lo-Fi Lounge Beats'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  sounds.setMusicEnabled(!prefs.musicEnabled);
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  prefs.musicEnabled
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-800 text-gray-400 border border-slate-700'
                }`}
              >
                {prefs.musicEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="range"
                min={0}
                max={100}
                value={prefs.musicEnabled ? Math.round(prefs.musicVolume * 100) : 0}
                onChange={e => {
                  const val = Number(e.target.value) / 100;
                  sounds.setMusicVolume(val);
                }}
                aria-label="Background Music Volume"
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="text-[10px] font-mono font-bold text-gray-300 w-8 text-right">
                {prefs.musicEnabled ? `${Math.round(prefs.musicVolume * 100)}%` : '0%'}
              </span>
            </div>
          </div>

          {/* Game Sound Effects Control */}
          <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Volume2 className={`w-3.5 h-3.5 ${!prefs.sfxMuted ? 'text-amber-400' : 'text-gray-500'}`} />
                <div>
                  <div className="text-xs font-bold text-white leading-tight">Game Sound Effects</div>
                  <div className="text-[10px] text-gray-400">Cards, bids & pack reveals</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextMuted = !prefs.sfxMuted;
                  sounds.setSfxMuted(nextMuted);
                  if (!nextMuted) sounds.playUiClick();
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  !prefs.sfxMuted
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-gray-400 border border-slate-700'
                }`}
              >
                {!prefs.sfxMuted ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="range"
                min={0}
                max={100}
                value={!prefs.sfxMuted ? Math.round(prefs.sfxVolume * 100) : 0}
                onChange={e => {
                  const val = Number(e.target.value) / 100;
                  sounds.setSfxVolume(val);
                }}
                aria-label="Sound Effects Volume"
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <span className="text-[10px] font-mono font-bold text-gray-300 w-8 text-right">
                {!prefs.sfxMuted ? `${Math.round(prefs.sfxVolume * 100)}%` : '0%'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
