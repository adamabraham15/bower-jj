/**
 * BOWER JJ — Tactile "Tear & Reveal" Booster Pack Opening Flow
 * Complete 5-stage unboxing experience:
 * 'PACK_INSPECT' -> 'TEARING' -> 'CARDS_DEALT' -> 'REVEALING' -> 'SUMMARY'
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Package,
  CheckCircle2,
  Layers,
  Award,
  Eye,
  RotateCw,
  X,
  Crown,
  Zap,
  ZoomIn,
  Scissors,
  ChevronRight,
  Shield,
  Palette,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  PACK_ARTWORK_URL,
  RARITY_META,
  RarityTier,
  WAX_SEALS_CONFIG,
  TABLE_FELTS,
  getCardBackDefinition,
  getAvatarDefinition,
  getCollectionDefinition,
} from '../../config/collectiblesCatalog';
import { PackOpenResult, DrawnCardResult } from '../../../server/types';
import { AvatarPortrait } from '../AvatarPortrait';
import {
  sfx_pack_tear,
  sfx_card_flip,
  sfx_legendary_reveal,
  sfx_set_complete,
  hapticTear,
  hapticLegendary,
  hapticTap,
} from '../../utils/soundEffects';
import { sounds } from '../../audio/sound';

interface PackOpeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  unopenedCount: number;
  isOpening: boolean;
  packResult: PackOpenResult | null;
  onRequestOpenPack: () => void;
  onResetPackResult: () => void;
  onEquipCardBack?: (cardBackId: string) => void;
  onEquipTableFelt?: (feltId: string) => void;
  onOpenCollection?: () => void;
  onUpdateWaxSeals?: (newBalance: number) => void;
  currentWaxSeals?: number;
}

export type PackStage = 'PACK_INSPECT' | 'TEARING' | 'CARDS_DEALT' | 'REVEALING' | 'SUMMARY';

export const PackOpeningModal: React.FC<PackOpeningModalProps> = ({
  isOpen,
  onClose,
  unopenedCount,
  isOpening,
  packResult,
  onRequestOpenPack,
  onResetPackResult,
  onEquipCardBack,
  onEquipTableFelt,
  onOpenCollection,
  onUpdateWaxSeals,
  currentWaxSeals = 0,
}) => {
  const [stage, setStage] = useState<PackStage>('PACK_INSPECT');
  const [revealedIndices, setRevealedIndices] = useState<boolean[]>([false, false, false, false, false]);
  const [justRevealedIndex, setJustRevealedIndex] = useState<number | null>(null);
  const [spotlightRarity, setSpotlightRarity] = useState<RarityTier | null>(null);
  const [inspectedCard, setInspectedCard] = useState<DrawnCardResult | null>(null);
  const [equippedInSummary, setEquippedInSummary] = useState<Record<string, boolean>>({});
  const [tearProgress, setTearProgress] = useState<number>(0);
  const [isTearDragging, setIsTearDragging] = useState<boolean>(false);
  const [totalSealsEarned, setTotalSealsEarned] = useState<number>(0);

  // 3D pack tilt state
  const [tilt, setTilt] = useState<{ rx: number; ry: number; shineX: number; shineY: number }>({
    rx: 0,
    ry: 0,
    shineX: 50,
    shineY: 35,
  });

  const tearStripRef = useRef<HTMLDivElement | null>(null);

  // Reset modal state on open
  useEffect(() => {
    if (!isOpen) return;
    if (packResult) {
      setRevealedIndices([false, false, false, false, false]);
      setStage('REVEALING');
    } else {
      setStage('PACK_INSPECT');
      setRevealedIndices([false, false, false, false, false]);
    }
    setTearProgress(0);
    setIsTearDragging(false);
    setJustRevealedIndex(null);
    setSpotlightRarity(null);
    setInspectedCard(null);
    setEquippedInSummary({});
    setTotalSealsEarned(0);
  }, [isOpen]);

  // Spacebar key shortcut for Desktop pack tear
  useEffect(() => {
    if (!isOpen || stage !== 'PACK_INSPECT' || unopenedCount <= 0 || isOpening) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        triggerTearSequence();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stage, unopenedCount, isOpening]);

  // Calculate wax seals earned from duplicates when packResult arrives
  useEffect(() => {
    if (!packResult) return;
    let seals = 0;
    for (const c of packResult.cards) {
      if (c.wasDuplicate) {
        seals += WAX_SEALS_CONFIG.duplicateSeals[c.rarity] || 10;
      }
    }
    setTotalSealsEarned(seals);
    if (seals > 0 && onUpdateWaxSeals) {
      onUpdateWaxSeals(currentWaxSeals + seals);
    }
  }, [packResult]);

  // Handle stage transition from TEARING to CARDS_DEALT when packResult is available
  useEffect(() => {
    if (stage !== 'TEARING' || !packResult) return;

    const dealTimer = setTimeout(() => {
      setStage('CARDS_DEALT');
      sfx_card_flip();

      setTimeout(() => {
        setStage('REVEALING');
      }, 600);
    }, 450);

    return () => clearTimeout(dealTimer);
  }, [stage, packResult]);

  if (!isOpen) return null;

  const triggerTearSequence = () => {
    if (stage !== 'PACK_INSPECT' || isOpening || unopenedCount <= 0) return;
    setTearProgress(1);
    setStage('TEARING');
    sfx_pack_tear();
    hapticTear();
    onRequestOpenPack();
  };

  // Swipe gesture processing across top foil line
  const processTearPointer = (clientX: number) => {
    if (!tearStripRef.current || stage !== 'PACK_INSPECT' || isOpening || unopenedCount <= 0) return;
    const rect = tearStripRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setTearProgress(ratio);

    if (ratio >= 0.7) {
      triggerTearSequence();
    }
  };

  const handleRevealCard = (index: number) => {
    if (stage !== 'REVEALING' || revealedIndices[index] || !packResult) return;
    const card = packResult.cards[index];
    if (!card) return;

    const next = [...revealedIndices];
    next[index] = true;
    setRevealedIndices(next);
    setJustRevealedIndex(index);
    setSpotlightRarity(card.rarity);

    // Audio & Haptics
    sfx_card_flip();
    hapticTap();

    if (card.identity === 'J' || card.rarity === 'legendary') {
      sfx_legendary_reveal();
      hapticLegendary();
    }

    // Check if this was the last unrevealed card
    if (next.every(Boolean)) {
      setTimeout(() => {
        setStage('SUMMARY');
        // If a collection was completed, fire confetti celebration
        if (packResult.newlyUnlockedCardBacks.length > 0) {
          sfx_set_complete();
          try {
            confetti({
              particleCount: 120,
              spread: 85,
              origin: { y: 0.55 },
              colors: ['#fbbf24', '#f59e0b', '#38bdf8', '#10b981', '#ffffff'],
            });
          } catch {}
        }
      }, 1200);
    }
  };

  const handleRevealAll = () => {
    if (stage !== 'REVEALING' || !packResult) return;
    setRevealedIndices([true, true, true, true, true]);
    sfx_card_flip();
    hapticTap();

    const hasBower = packResult.cards.some((c) => c.identity === 'J' || c.rarity === 'legendary');
    if (hasBower) {
      sfx_legendary_reveal();
    }

    setTimeout(() => {
      setStage('SUMMARY');
      if (packResult.newlyUnlockedCardBacks.length > 0) {
        sfx_set_complete();
        try {
          confetti({
            particleCount: 120,
            spread: 85,
            origin: { y: 0.55 },
            colors: ['#fbbf24', '#f59e0b', '#38bdf8', '#10b981', '#ffffff'],
          });
        } catch {}
      }
    }, 1000);
  };

  const handleOpenAnother = () => {
    onResetPackResult();
    setStage('PACK_INSPECT');
    setRevealedIndices([false, false, false, false, false]);
    setTearProgress(0);
    setJustRevealedIndex(null);
    setSpotlightRarity(null);
    setInspectedCard(null);
    setTotalSealsEarned(0);
  };

  const allRevealed = revealedIndices.every(Boolean);
  const revealedCount = revealedIndices.filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 backdrop-blur-md p-2 sm:p-4 select-none">
      <div className="relative w-full max-w-4xl max-h-[95dvh] bg-gradient-to-b from-[#101726] via-[#0c1220] to-[#080d17] border border-amber-500/40 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden p-4 sm:p-7">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide uppercase">
                Bower JJ Booster Pack
              </h2>
              <div className="flex items-center gap-2 text-xs text-amber-300 font-bold">
                <span>{unopenedCount} Sealed Packs</span>
                <span className="text-slate-500">•</span>
                <span>5 Cards Per Pack</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =================================================================
            STAGE 1 & 2: PACK_INSPECT & TEARING
        ================================================================= */}
        {(stage === 'PACK_INSPECT' || stage === 'TEARING') && (
          <div className="flex-1 flex flex-col items-center justify-center py-6 min-h-[380px] sm:min-h-[440px]">
            {unopenedCount <= 0 ? (
              <div className="text-center space-y-4 max-w-md">
                <div className="w-28 h-40 mx-auto rounded-2xl overflow-hidden border-2 border-slate-700 opacity-40 grayscale shadow-xl">
                  <img src={PACK_ARTWORK_URL} alt="Empty Pack" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl font-black text-white">No Sealed Packs</h3>
                <p className="text-xs text-slate-400">
                  Level up in matches or complete weekly challenges to earn more booster packs!
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                >
                  Return to Menu
                </button>
              </div>
            ) : (
              <>
                {/* Mobile Swipe / Desktop Spacebar Banner */}
                <div className="mb-4 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center gap-2 text-amber-300 text-xs font-black animate-pulse select-none">
                  <Scissors className="w-4 h-4 rotate-90" />
                  <span>Swipe across top seam or press Spacebar to rip open!</span>
                </div>

                {/* 3D Foil Booster Pack with Tilt & Specular Sheen */}
                <div
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const px = ((e.clientX - rect.left) / rect.width) * 100;
                    const py = ((e.clientY - rect.top) / rect.height) * 100;
                    setTilt({
                      rx: ((py - 50) / 50) * -14,
                      ry: ((px - 50) / 50) * 16,
                      shineX: px,
                      shineY: py,
                    });
                  }}
                  onMouseLeave={() => setTilt({ rx: 0, ry: 0, shineX: 50, shineY: 35 })}
                  className={`relative w-56 sm:w-64 aspect-[520/740] cursor-pointer select-none transition-all duration-300 ${
                    stage === 'TEARING' ? 'scale-110 brightness-125' : 'hover:scale-105'
                  }`}
                  style={{
                    perspective: '1000px',
                    transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                    filter:
                      stage === 'TEARING'
                        ? 'drop-shadow(0 0 45px rgba(251,191,36,0.9))'
                        : 'drop-shadow(0 20px 35px rgba(0,0,0,0.85))',
                  }}
                >
                  {/* Top Perforated Foil Strip (Peels off during swipe/tear) */}
                  <div
                    className={`absolute inset-x-0 top-0 h-9 z-30 rounded-t-2xl overflow-hidden border-t-2 border-x-2 border-amber-300/80 transition-all duration-300 ${
                      stage === 'TEARING' ? '-translate-y-12 rotate-6 translate-x-8 opacity-0 scale-105' : 'translate-y-0 opacity-100'
                    }`}
                    style={{
                      background:
                        'repeating-linear-gradient(90deg, rgba(251,191,36,0.35) 0px, rgba(251,191,36,0.35) 3px, rgba(15,23,42,0.85) 3px, rgba(15,23,42,0.85) 6px)',
                    }}
                  >
                    <div className="w-full h-full bg-gradient-to-b from-amber-300/35 via-amber-500/15 to-slate-950/80 flex items-center justify-center">
                      <span className="text-[9px] font-black tracking-widest text-amber-200 uppercase">
                        ★ FACTORY SEALED FOIL ★
                      </span>
                    </div>
                  </div>

                  {/* Interactive Tear Seam (Touch & Drag across top line) */}
                  <div
                    ref={tearStripRef}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setIsTearDragging(true);
                      e.currentTarget.setPointerCapture(e.pointerId);
                      processTearPointer(e.clientX);
                    }}
                    onPointerMove={(e) => {
                      if (isTearDragging) processTearPointer(e.clientX);
                    }}
                    onPointerUp={() => setIsTearDragging(false)}
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerTearSequence();
                    }}
                    className="absolute inset-x-0 top-6 h-10 z-40 cursor-ew-resize select-none flex items-center px-2"
                  >
                    <div className="w-full h-0.5 border-t-2 border-dashed border-amber-300/90 relative">
                      <div
                        className="absolute left-0 -top-[1px] h-1 bg-white shadow-[0_0_15px_#ffffff,0_0_25px_#fbbf24] transition-all duration-75 rounded-full"
                        style={{ width: `${Math.max(0, tearProgress * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Main Booster Pack Foil Body */}
                  <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-amber-400/80 bg-slate-950 shadow-2xl">
                    <img
                      src={PACK_ARTWORK_URL}
                      alt="Booster Pack"
                      draggable={false}
                      className="w-full h-full object-cover"
                    />

                    {/* Specular Diagonal Foil Sheen */}
                    <div
                      className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-75"
                      style={{
                        background: `radial-gradient(circle at ${tilt.shineX}% ${tilt.shineY}%, rgba(255,255,255,0.7) 0%, rgba(251,191,36,0.3) 35%, transparent 70%)`,
                      }}
                    />
                  </div>
                </div>

                {/* Primary Tear Button */}
                <button
                  onClick={triggerTearSequence}
                  disabled={isOpening}
                  className="mt-6 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  <Scissors className="w-4 h-4 rotate-90" />
                  <span>{isOpening ? 'Tearing Pack...' : 'Tear Pack'}</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* =================================================================
            STAGE 3 & 4: CARDS_DEALT & REVEALING
        ================================================================= */}
        {(stage === 'CARDS_DEALT' || stage === 'REVEALING') && packResult && (
          <div className="flex-1 flex flex-col justify-between py-2 space-y-4 animate-in fade-in duration-300">
            {/* Header info */}
            <div className="text-center space-y-1">
              <h3 className="text-base sm:text-xl font-black text-amber-300 uppercase tracking-wider">
                {allRevealed
                  ? 'All 5 Cards Revealed!'
                  : `Tap Face-Down Cards to Reveal (${revealedCount} / 5)`}
              </h3>
              <p className="text-xs text-slate-400">
                Pulsing rim glows indicate card rarity tier • Watch for Legendary Bowers!
              </p>
            </div>

            {/* 5-Card Grid on Velvet Table Surface */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 justify-items-center py-2">
              {packResult.cards.map((card, idx) => (
                <div
                  key={`${card.cardId}_${idx}`}
                  style={{ animationDelay: `${idx * 120}ms` }}
                  className="animate-in fade-in zoom-in-90 duration-300"
                >
                  <RevealCardItem
                    card={card}
                    index={idx}
                    isRevealed={revealedIndices[idx]}
                    onReveal={() => handleRevealCard(idx)}
                    onInspect={() => {
                      sounds.playUiClick();
                      setInspectedCard(card);
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Quick Action Bar */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {!allRevealed ? (
                <button
                  onClick={handleRevealAll}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Reveal All Quick</span>
                </button>
              ) : (
                <button
                  onClick={() => setStage('SUMMARY')}
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>View Pack Summary</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* =================================================================
            STAGE 5: SUMMARY (Newly acquired, Duplicate Wax Seals, Set Completion)
        ================================================================= */}
        {stage === 'SUMMARY' && packResult && (
          <div className="flex-1 flex flex-col justify-between py-2 space-y-4 animate-in fade-in duration-300">
            {/* Set Completion Banner if 5/5 completed */}
            {packResult.newlyUnlockedCardBacks.length > 0 && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/25 via-yellow-400/20 to-amber-500/25 border-2 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.35)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={getCardBackDefinition(packResult.newlyUnlockedCardBacks[0]).imageUrl}
                    alt="Unlocked Card Back"
                    className="w-14 h-20 rounded-lg object-cover border-2 border-amber-300 shadow"
                  />
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                      <Award className="w-4 h-4" />
                      <span>Set Completed — Signature Card Back &amp; Felt Unlocked!</span>
                    </div>
                    <h4 className="text-base font-black text-white mt-0.5">
                      {packResult.newlyUnlockedCardBacks.map((id) => getCardBackDefinition(id).name).join(', ')}
                    </h4>
                  </div>
                </div>
                {onEquipCardBack && (
                  <button
                    onClick={() => {
                      const cbId = packResult.newlyUnlockedCardBacks[0];
                      onEquipCardBack(cbId);
                      setEquippedInSummary((prev) => ({ ...prev, [cbId]: true }));
                      sounds.playUiClick();
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer flex-shrink-0"
                  >
                    {equippedInSummary[packResult.newlyUnlockedCardBacks[0]] ? 'Equipped!' : 'Equip Now'}
                  </button>
                )}
              </div>
            )}

            {/* Wax Seals duplicate conversion notice */}
            {totalSealsEarned > 0 && (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-500/50 flex items-center justify-between px-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🪙</span>
                  <div>
                    <div className="text-xs font-black text-amber-300 uppercase">
                      Duplicate Protection: +{totalSealsEarned} Wax Seals Earned
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Duplicates converted to Crafting Dust. Spend 100 Wax Seals in Vault to craft missing cards!
                    </div>
                  </div>
                </div>
                <div className="text-xs font-black text-amber-300 bg-amber-500/20 px-3 py-1 rounded-lg border border-amber-400/40">
                  Total: {currentWaxSeals} 🪙
                </div>
              </div>
            )}

            {/* Revealed 5 Cards Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 justify-items-center">
              {packResult.cards.map((card, idx) => (
                <RevealCardItem
                  key={`sum_${card.cardId}_${idx}`}
                  card={card}
                  index={idx}
                  isRevealed={true}
                  onReveal={() => {}}
                  onInspect={() => {
                    sounds.playUiClick();
                    setInspectedCard(card);
                  }}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3 border-t border-slate-800">
              {packResult.remainingUnopenedPacks > 0 && (
                <button
                  onClick={handleOpenAnother}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  <span>Open Another Pack ({packResult.remainingUnopenedPacks} left)</span>
                </button>
              )}
              {onOpenCollection && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenCollection();
                  }}
                  className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-2"
                >
                  <Layers className="w-4 h-4" />
                  <span>View in Vault</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm cursor-pointer"
              >
                Collect &amp; Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// RevealCardItem: Smooth 3D Flip Card with Rarity Rim Glows & Bower Gold Badges
// =========================================================================
interface RevealCardItemProps {
  card: DrawnCardResult;
  index: number;
  isRevealed: boolean;
  onReveal: () => void;
  onInspect: () => void;
}

const RevealCardItem: React.FC<RevealCardItemProps> = ({
  card,
  index,
  isRevealed,
  onReveal,
  onInspect,
}) => {
  const col = getCollectionDefinition(card.collectionId);
  const rarity = RARITY_META[card.rarity];
  const isBower = card.identity === 'J';

  // Rarity aura styling for face-down card
  const getFacedownGlow = () => {
    switch (card.rarity) {
      case 'legendary':
        return 'shadow-[0_0_25px_rgba(251,191,36,0.85)] ring-2 ring-amber-400 animate-pulse';
      case 'epic':
        return 'shadow-[0_0_22px_rgba(192,132,252,0.7)] ring-2 ring-purple-400';
      case 'rare':
        return 'shadow-[0_0_18px_rgba(56,189,248,0.6)] ring-2 ring-emerald-400';
      default:
        return 'shadow-[0_0_12px_rgba(255,255,255,0.2)]';
    }
  };

  return (
    <div
      onClick={!isRevealed ? onReveal : onInspect}
      className="group relative w-36 sm:w-40 aspect-[360/500] cursor-pointer select-none"
      style={{ perspective: '1000px' }}
    >
      <div
        className="relative w-full h-full transition-transform duration-700"
        style={{
          transformStyle: 'preserve-3d',
          transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* FACE-DOWN CARD (Pulsing Rim Glow) */}
        <div
          className={`absolute inset-0 rounded-2xl overflow-hidden border-2 ${rarity.borderClass} bg-slate-950 ${getFacedownGlow()} transition-all`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          <img
            src="/assets/card-backs/dark_royalty.webp"
            alt="Facedown Card"
            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/40 flex flex-col items-center justify-end p-2.5">
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${rarity.badgeClass}`}
            >
              {rarity.label}
            </span>
            <span className="text-[10px] text-amber-200 font-bold mt-1 flex items-center gap-1 animate-pulse">
              <Sparkles className="w-3 h-3" />
              <span>Tap to Flip</span>
            </span>
          </div>
        </div>

        {/* FACE-UP REVEALED CARD */}
        <div
          className={`absolute inset-0 rounded-2xl overflow-hidden border-2 ${rarity.borderClass} bg-slate-950 shadow-2xl flex flex-col`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <img
            src={card.imageUrl}
            alt={card.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />

          {/* Golden BOWER Reveal Badge for Jacks */}
          {isBower && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 text-slate-950 font-black text-[10px] tracking-wider uppercase border border-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.95)] animate-pulse flex items-center gap-1 z-20">
              <span>👑</span>
              <span>BOWER</span>
              <span>👑</span>
            </div>
          )}

          {/* Top Identity & Duplicate Pill */}
          <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-1 z-10">
            <span className="px-1.5 py-0.5 rounded-md bg-slate-950/85 border border-white/20 text-[10px] font-black text-amber-300">
              {card.identity}
            </span>
            {card.wasDuplicate ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-slate-950 shadow flex items-center gap-0.5">
                <span>+{WAX_SEALS_CONFIG.duplicateSeals[card.rarity] || 10}</span>
                <span>🪙</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-400 text-slate-950 shadow animate-pulse">
                NEW!
              </span>
            )}
          </div>

          {/* Bottom Card Title Banner */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent p-2 text-center z-10">
            <div className={`text-[9px] font-black uppercase ${rarity.textClass}`}>
              {rarity.label}
            </div>
            <div className="text-[11px] font-black text-white leading-tight truncate">
              {card.name}
            </div>
            <div className="text-[9px] text-slate-400 truncate">
              {col?.name} Set
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackOpeningModal;
