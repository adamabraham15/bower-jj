/**
 * BOWER JJ — Interactive Beginner Tutorial
 * Step-by-step interactive walkthrough with hands-on practice hand.
 */

import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, CheckCircle2, Zap, HelpCircle, X, Sparkles } from 'lucide-react';
import { CardView, SuitIcon } from './CardView';
import { Card, Suit } from '../engine/types';
import { sounds } from '../audio/sound';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState(0);
  const [selectedPracticeCard, setSelectedPracticeCard] = useState<string | null>(null);
  const [practiceFeedback, setPracticeFeedback] = useState<{ type: 'error' | 'warn' | 'success'; text: string } | null>(null);
  const [practiceSuccess, setPracticeSuccess] = useState(false);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Welcome to BOWER JJ Euchre! 🃏',
      subtitle: 'The Fast-Paced 2v2 Card Battle',
      content: (
        <div className="space-y-3 text-sm text-gray-300">
          <p>
            Euchre is a classic, high-octane 4-player trick-taking game played in fixed partnerships:
            <strong className="text-amber-400"> You & your Partner (Team Blue)</strong> versus
            <strong className="text-red-400"> Two Opponents (Team Red)</strong>.
          </p>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
            <div className="flex items-center space-x-2 text-white font-bold">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>The Match Objective</span>
            </div>
            <p className="text-xs text-gray-300">
              First team to score <strong>10 points</strong> wins the match! Points are earned by winning tricks during hands.
            </p>
          </div>
          <p className="text-xs text-gray-400">
            Euchre uses a stripped <strong>24-card deck</strong>: only 9, 10, Jack, Queen, King, and Ace in all 4 suits.
          </p>
        </div>
      ),
    },
    {
      title: 'The Bowers: The Supreme Trumps 👑',
      subtitle: 'The Most Powerful Cards in the Game',
      content: (
        <div className="space-y-3 text-sm text-gray-300">
          <p>
            When a suit is chosen as <strong className="text-amber-300">Trump</strong>, the Jacks become the highest ranking cards!
          </p>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="flex flex-col items-center p-3 bg-amber-500/10 border-2 border-amber-500/50 rounded-2xl text-center">
              <span className="text-xs font-black text-amber-400 uppercase mb-2">Right Bower</span>
              <CardView card={{ id: 'hearts-J', suit: 'hearts', rank: 'J' }} trumpSuit="hearts" size="sm" isPlayable={false} />
              <span className="text-xs text-white mt-2 font-bold">Jack of Trump Suit</span>
              <span className="text-[10px] text-amber-300 font-black uppercase mt-0.5">#1 Highest Card In Game</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-cyan-500/10 border-2 border-cyan-500/50 rounded-2xl text-center">
              <span className="text-xs font-black text-cyan-400 uppercase mb-2">Left Bower</span>
              <CardView card={{ id: 'diamonds-J', suit: 'diamonds', rank: 'J' }} trumpSuit="hearts" size="sm" isPlayable={false} />
              <span className="text-xs text-white mt-2 font-bold">Jack of Same Color</span>
              <span className="text-[10px] text-cyan-300 font-black uppercase mt-0.5">#2 Highest Card In Game</span>
            </div>
          </div>
          <div className="p-3 bg-slate-800 rounded-xl text-xs text-amber-200 border border-amber-500/30">
            ⚠️ <strong>CRITICAL RULE:</strong> The Left Bower legally <em>becomes a member of the Trump suit</em> for the hand! If Hearts is trump, the Jack of Diamonds is classified as a Heart.
          </div>
        </div>
      ),
    },
    {
      title: 'Trump Hierarchy',
      subtitle: 'Full Ranking from Supreme to Lowest',
      content: (
        <div className="space-y-3 text-sm text-gray-300">
          <p>When <strong className="text-red-400 font-bold">Hearts ♥</strong> is Trump, here is the exact hierarchy:</p>
          <div className="p-3 bg-slate-800/90 rounded-2xl border border-slate-700 space-y-2">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wide">Trump Suit Hierarchy:</div>
            <div className="flex flex-wrap gap-1.5 items-center justify-center">
              <span className="px-2 py-1 bg-amber-500 text-slate-950 font-black text-xs rounded-lg shadow-sm">J♥ (Right Bower)</span>
              <span className="text-gray-400 font-bold">&gt;</span>
              <span className="px-2 py-1 bg-cyan-500 text-slate-950 font-black text-xs rounded-lg shadow-sm">J♦ (Left Bower)</span>
              <span className="text-gray-400 font-bold">&gt;</span>
              <span className="px-2 py-1 bg-slate-700 text-white font-bold text-xs rounded-lg">A♥</span>
              <span className="text-gray-400 font-bold">&gt;</span>
              <span className="px-2 py-1 bg-slate-700 text-white font-bold text-xs rounded-lg">K♥</span>
              <span className="text-gray-400 font-bold">&gt;</span>
              <span className="px-2 py-1 bg-slate-700 text-white font-bold text-xs rounded-lg">Q♥</span>
              <span className="text-gray-400 font-bold">&gt;</span>
              <span className="px-2 py-1 bg-slate-700 text-white font-bold text-xs rounded-lg">10♥</span>
              <span className="text-gray-400 font-bold">&gt;</span>
              <span className="px-2 py-1 bg-slate-700 text-white font-bold text-xs rounded-lg">9♥</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Any trump card beats ANY off-suit card, even an off-suit Ace!
          </p>
        </div>
      ),
    },
    {
      title: 'Interactive Drill: Following Suit & Winning 🎯',
      subtitle: 'Tap the winning card below to play!',
      content: (
        <div className="space-y-3 text-sm text-gray-300">
          <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700 text-xs">
            <strong>Scenario:</strong> Trump is <span className="text-red-400 font-black">Hearts ♥</span>.
            West leads the <span className="text-amber-300 font-black">King of Spades (K♠)</span>.
            Which card in your hand should you play to <strong>win the trick</strong>?
          </div>

          {/* West's Led Card */}
          <div className="flex flex-col items-center py-1">
            <span className="text-[10px] text-amber-400 font-bold uppercase mb-1">
              West Led:
            </span>
            <CardView card={{ id: 'spades-K', suit: 'spades', rank: 'K' }} trumpSuit="hearts" size="sm" isPlayable={false} />
          </div>

          {/* Your Selectable Hand */}
          <div className="border-t border-slate-700 pt-2">
            <span className="text-xs font-black text-amber-300 block mb-2 text-center uppercase tracking-wider">
              Your Hand (Tap a card to test):
            </span>
            <div className="flex justify-center items-center space-x-3">
              <CardView
                card={{ id: 'spades-9', suit: 'spades', rank: '9' }}
                trumpSuit="hearts"
                size="md"
                isSelected={selectedPracticeCard === 'spades-9'}
                onClick={() => {
                  sounds.playCardSnap();
                  setSelectedPracticeCard('spades-9');
                  setPracticeSuccess(false);
                  setPracticeFeedback({
                    type: 'warn',
                    text: '⚠️ 9♠ is a legal play (it follows Spades), but King beats 9! This would lose the trick to West.',
                  });
                }}
              />
              <CardView
                card={{ id: 'spades-A', suit: 'spades', rank: 'A' }}
                trumpSuit="hearts"
                size="md"
                isSelected={selectedPracticeCard === 'spades-A'}
                onClick={() => {
                  sounds.playTrickWin(true);
                  setSelectedPracticeCard('spades-A');
                  setPracticeSuccess(true);
                  setPracticeFeedback({
                    type: 'success',
                    text: '🎉 WINNING MOVE! You legally followed suit with the Ace of Spades (A♠), beating the King of Spades to win the trick!',
                  });
                }}
              />
              <CardView
                card={{ id: 'hearts-9', suit: 'hearts', rank: '9' }}
                trumpSuit="hearts"
                size="md"
                isSelected={selectedPracticeCard === 'hearts-9'}
                onClick={() => {
                  sounds.playUiClick();
                  setSelectedPracticeCard('hearts-9');
                  setPracticeSuccess(false);
                  setPracticeFeedback({
                    type: 'error',
                    text: '❌ ILLEGAL MOVE! Although 9♥ is Trump, West led Spades and you still hold Spades in your hand (9♠ and A♠). You MUST follow suit!',
                  });
                }}
              />
            </div>
          </div>

          {practiceFeedback && (
            <div
              className={`p-3 rounded-xl text-xs font-bold transition-all shadow-md ${
                practiceFeedback.type === 'success'
                  ? 'bg-emerald-950/80 text-emerald-200 border-2 border-emerald-500'
                  : practiceFeedback.type === 'error'
                  ? 'bg-red-950/80 text-red-200 border-2 border-red-500'
                  : 'bg-amber-950/80 text-amber-200 border-2 border-amber-500'
              }`}
            >
              {practiceFeedback.text}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Scoring & Going Alone 🏆',
      subtitle: 'How to Win the Match',
      content: (
        <div className="space-y-2.5 text-xs text-gray-300">
          <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700 flex justify-between items-center">
            <div>
              <div className="font-bold text-white text-sm">Made Bid (3 or 4 tricks)</div>
              <div className="text-gray-400">Calling team wins majority</div>
            </div>
            <span className="text-lg font-black text-amber-400">+1 Point</span>
          </div>

          <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700 flex justify-between items-center">
            <div>
              <div className="font-bold text-emerald-400 text-sm">March (All 5 tricks)</div>
              <div className="text-gray-400">Calling team sweeps the hand</div>
            </div>
            <span className="text-lg font-black text-emerald-400">+2 Points</span>
          </div>

          <div className="p-2.5 bg-slate-800 rounded-xl border border-cyan-500/40 flex justify-between items-center">
            <div>
              <div className="font-bold text-cyan-400 text-sm">Loner March (Solo sweep) 🚀</div>
              <div className="text-gray-400">Player calls Alone and wins all 5 tricks</div>
            </div>
            <span className="text-lg font-black text-cyan-400">+4 Points!</span>
          </div>

          <div className="p-2.5 bg-slate-800 rounded-xl border border-red-500/40 flex justify-between items-center">
            <div>
              <div className="font-bold text-red-400 text-sm">EUCHRED! (Defenders win 3+) 🔥</div>
              <div className="text-gray-400">Defenders stop the makers</div>
            </div>
            <span className="text-lg font-black text-red-400">+2 Points</span>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-amber-500/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 font-black text-xs rounded-full">
              STEP {step + 1}/{steps.length}
            </span>
            <span className="text-xs font-bold text-gray-300">Beginner Tutorial</span>
          </div>
          <button
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto max-h-[65vh]">
          <h3 className="text-lg font-black text-white">{current.title}</h3>
          <h4 className="text-xs font-bold text-amber-400 mb-3">{current.subtitle}</h4>
          {current.content}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="text-xs text-gray-400 hover:text-white font-semibold px-2 py-1"
          >
            Skip Tutorial
          </button>

          <div className="flex items-center space-x-2">
            {step > 0 && (
              <button
                onClick={() => {
                  sounds.playUiClick();
                  setStep(s => s - 1);
                  setSelectedPracticeCard(null);
                  setPracticeFeedback(null);
                  setPracticeSuccess(false);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-300"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={() => {
                sounds.playUiClick();
                if (isLast) {
                  sounds.playVictoryFanfare();
                  onComplete();
                  onClose();
                } else {
                  setStep(s => s + 1);
                  setSelectedPracticeCard(null);
                  setPracticeFeedback(null);
                  setPracticeSuccess(false);
                }
              }}
              className="flex items-center space-x-1 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/30"
            >
              <span>{isLast ? "Let's Play Euchre!" : 'Next Step'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
