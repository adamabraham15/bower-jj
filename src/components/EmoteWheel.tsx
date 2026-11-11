/**
 * BOWER JJ — Tactical Emote & Quick Chat Wheel
 * Fortnite / Brawl Stars inspired quick-reaction overlay.
 */

import React, { useState } from 'react';
import { MessageSquare, Smile, VolumeX, Volume2, X } from 'lucide-react';
import { sounds } from '../audio/sound';

export interface EmoteMessage {
  id: string;
  senderPos: number;
  text?: string;
  emoji?: string;
  timestamp: number;
}

interface EmoteWheelProps {
  isOpen: boolean;
  onClose: () => void;
  onSendEmote: (emote: { text?: string; emoji?: string }) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

const QUICK_CHATS = [
  'Good luck! 🍀',
  'Nice hand! 👏',
  'Good call! 🎯',
  'Well played! 🔥',
  'Oops! 😅',
  'Going Alone! 🚀',
  'Euchred! 💀',
  'Good game! 🤝',
];

const EMOJIS = ['🔥', '👑', '😎', '🎉', '💪', '🤔', '👀', '🃏', '😱', '🥳'];

export const EmoteWheel: React.FC<EmoteWheelProps> = ({
  isOpen,
  onClose,
  onSendEmote,
  isMuted,
  onToggleMute,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'emoji'>('chat');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-4 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                sounds.playUiClick();
                setActiveTab('chat');
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'chat'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Quick Chat</span>
            </button>
            <button
              onClick={() => {
                sounds.playUiClick();
                setActiveTab('emoji');
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'emoji'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>Emotes</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                sounds.playUiClick();
                onToggleMute();
              }}
              title={isMuted ? 'Unmute audio & emotes' : 'Mute audio & emotes'}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                sounds.playUiClick();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="py-4">
          {activeTab === 'chat' ? (
            <div className="grid grid-cols-2 gap-2">
              {QUICK_CHATS.map((phrase, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    sounds.playUiClick();
                    onSendEmote({ text: phrase });
                    onClose();
                  }}
                  className="px-3 py-2.5 rounded-xl bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 border border-slate-700/80 text-xs font-semibold text-left transition-all active:scale-95"
                >
                  {phrase}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3 py-2">
              {EMOJIS.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    sounds.playUiClick();
                    onSendEmote({ emoji });
                    onClose();
                  }}
                  className="h-12 flex items-center justify-center text-2xl rounded-xl bg-slate-800 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400 text-center transition-all hover:scale-110 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
