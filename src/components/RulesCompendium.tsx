/**
 * BOWER JJ — Official Illustrated Rules Compendium
 * Searchable & Interactive Trump Hierarchy Visualizer
 */

import React, { useState } from 'react';
import { BookOpen, X, Sparkles, Trophy, ShieldCheck, Zap } from 'lucide-react';
import { Suit } from '../engine/types';
import { ALL_SUITS, getSameColorSuit } from '../engine/cards';
import { CardView, SuitIcon } from './CardView';
import { sounds } from '../audio/sound';

interface RulesCompendiumProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesCompendium: React.FC<RulesCompendiumProps> = ({ isOpen, onClose }) => {
  const [selectedTrump, setSelectedTrump] = useState<Suit>('hearts');
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'bidding' | 'scoring' | 'loners'>('hierarchy');

  if (!isOpen) return null;

  const sameColor = getSameColorSuit(selectedTrump);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-amber-500/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <span className="text-base font-black text-white tracking-wide">
              BOWER JJ — OFFICIAL RULES COMPENDIUM
            </span>
          </div>
          <button
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 pt-2 space-x-2 overflow-x-auto">
          {[
            { id: 'hierarchy', label: 'Card Hierarchy', icon: Sparkles },
            { id: 'bidding', label: 'Bidding & Calling', icon: Zap },
            { id: 'scoring', label: 'Scoring & Euchres', icon: ShieldCheck },
            { id: 'loners', label: 'Going Alone', icon: Trophy },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  sounds.playUiClick();
                  setActiveTab(tab.id as any);
                }}
                className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
                  isActive
                    ? 'border-amber-400 text-amber-400 bg-slate-800/80'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-gray-300 text-sm">
          {activeTab === 'hierarchy' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-800/80 rounded-xl border border-slate-700">
                <span className="text-xs font-bold text-gray-300">
                  Select Trump Suit to preview hierarchy:
                </span>
                <div className="flex space-x-2">
                  {ALL_SUITS.map(suit => {
                    const isSelected = selectedTrump === suit;
                    const symbols: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
                    const isRed = suit === 'hearts' || suit === 'diamonds';
                    return (
                      <button
                        key={suit}
                        onClick={() => {
                          sounds.playUiClick();
                          setSelectedTrump(suit);
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold text-sm flex items-center space-x-1.5 transition-all ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-300'
                            : 'bg-slate-700/80 text-gray-300 hover:bg-slate-600'
                        }`}
                      >
                        <SuitIcon suit={suit} className="w-4 h-4" />
                        <span className="capitalize text-xs">{suit}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bowers Showcase */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase text-amber-400 tracking-wider">
                  The Two Supreme Bowers for {selectedTrump.toUpperCase()}:
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl flex items-center space-x-3">
                    <CardView card={{ id: `${selectedTrump}-J`, suit: selectedTrump, rank: 'J' }} trumpSuit={selectedTrump} size="sm" isPlayable={false} />
                    <div>
                      <div className="text-xs font-black text-amber-400">RIGHT BOWER</div>
                      <div className="text-[11px] text-gray-300">Jack of {selectedTrump}</div>
                      <div className="text-[10px] text-amber-300 font-semibold">Highest card in the game!</div>
                    </div>
                  </div>

                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/40 rounded-xl flex items-center space-x-3">
                    <CardView card={{ id: `${sameColor}-J`, suit: sameColor, rank: 'J' }} trumpSuit={selectedTrump} size="sm" isPlayable={false} />
                    <div>
                      <div className="text-xs font-black text-cyan-400">LEFT BOWER</div>
                      <div className="text-[11px] text-gray-300">Jack of {sameColor}</div>
                      <div className="text-[10px] text-cyan-300 font-semibold">2nd highest card (acts as {selectedTrump}!)</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Hierarchy Strip */}
              <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 space-y-2">
                <div className="text-xs font-bold text-white">Full Trump Hierarchy:</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-1 rounded bg-amber-500 text-slate-950 font-black text-xs">J of {selectedTrump} (Right)</span>
                  <span className="text-gray-500">→</span>
                  <span className="px-2 py-1 rounded bg-cyan-500 text-slate-950 font-black text-xs">J of {sameColor} (Left)</span>
                  <span className="text-gray-500">→</span>
                  <span className="px-2 py-1 rounded bg-slate-700 text-white font-bold text-xs">A</span>
                  <span className="text-gray-500">→</span>
                  <span className="px-2 py-1 rounded bg-slate-700 text-white font-bold text-xs">K</span>
                  <span className="text-gray-500">→</span>
                  <span className="px-2 py-1 rounded bg-slate-700 text-white font-bold text-xs">Q</span>
                  <span className="text-gray-500">→</span>
                  <span className="px-2 py-1 rounded bg-slate-700 text-white font-bold text-xs">10</span>
                  <span className="text-gray-500">→</span>
                  <span className="px-2 py-1 rounded bg-slate-700 text-white font-bold text-xs">9</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bidding' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 space-y-1.5">
                <div className="font-bold text-amber-400 text-sm">Round 1: The Kitty Upcard</div>
                <p className="text-xs text-gray-300">
                  After 5 cards are dealt to each player, the top card of the kitty is flipped face-up.
                  Clockwise starting from the player left of the dealer, each player can:
                </p>
                <ul className="list-disc list-inside text-xs space-y-1 text-gray-300 pl-1">
                  <li><strong>Order Up</strong> (or <strong>Pick Up</strong> if you are dealer): Accepts the upcard's suit as Trump. Dealer adds the upcard to their hand and discards 1 card face down.</li>
                  <li><strong>Pass</strong>: Declines to make the upcard trump.</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 space-y-1.5">
                <div className="font-bold text-amber-400 text-sm">Round 2: Naming Any Other Suit</div>
                <p className="text-xs text-gray-300">
                  If all 4 players pass in Round 1, the upcard is turned down. Players can name any of the other 3 suits as Trump.
                </p>
                <p className="text-xs text-amber-200">
                  <strong>Stick The Dealer Rule:</strong> In competitive BOWER JJ matches, the dealer cannot pass in Round 2. If the first 3 players pass, the dealer must pick a trump suit!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'scoring' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 space-y-1.5">
                <div className="font-bold text-emerald-400 text-sm">Makers Scoring (Calling Team)</div>
                <ul className="list-disc list-inside text-xs space-y-1 text-gray-300">
                  <li>Win 3 or 4 tricks: <strong>1 Point</strong></li>
                  <li>Win all 5 tricks (March): <strong>2 Points</strong></li>
                  <li>Called Alone and win all 5 tricks: <strong>4 Points!</strong></li>
                </ul>
              </div>

              <div className="p-3 bg-slate-800 rounded-xl border border-red-500/40 space-y-1.5">
                <div className="font-bold text-red-400 text-sm">EUCHRED! (Defending Team) 🔥</div>
                <p className="text-xs text-gray-300">
                  If the calling team fails to win at least 3 tricks, they are <strong>Euchred</strong>!
                  The defending team is awarded <strong>2 Points</strong>.
                </p>
              </div>

              <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
                <div className="font-bold text-white text-sm">Winning the Game</div>
                <p className="text-xs text-gray-300">
                  The first team to accumulate <strong>10 points</strong> wins the match!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'loners' && (
            <div className="space-y-3">
              <div className="p-3 bg-gradient-to-r from-cyan-950/60 to-slate-800 rounded-xl border border-cyan-500/40 space-y-2">
                <div className="font-bold text-cyan-300 text-sm flex items-center space-x-1.5">
                  <Trophy className="w-4 h-4 text-cyan-400" />
                  <span>Going Alone ("Loner")</span>
                </div>
                <p className="text-xs text-gray-300">
                  When ordering up or calling trump, any player may declare they are <strong>Going Alone</strong>!
                </p>
                <div className="p-2 bg-slate-900/80 rounded-lg text-xs space-y-1">
                  <div>• Your partner's cards are benched face down and they do not play.</div>
                  <div>• You play 1 vs 2 against both opponents.</div>
                  <div>• If you win all 5 tricks solo: You score a massive <strong className="text-amber-300">4 POINTS</strong>!</div>
                  <div>• If you take 3 or 4 tricks: 1 Point.</div>
                  <div>• If you get stopped with fewer than 3 tricks: Defending opponents score 2 Points (Euchre).</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
