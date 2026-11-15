import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Package, CheckCircle2, Layers, Award, Eye, RotateCw, X } from 'lucide-react';
import {
  PACK_ARTWORK_URL,
  RARITY_META,
  RarityTier,
  getCardBackDefinition,
  getAvatarDefinition,
  getCollectionDefinition,
} from '../config/collectiblesCatalog';
import { PackOpenResult, DrawnCardResult } from '../../server/types';
import { AvatarPortrait } from './AvatarPortrait';
import { sounds } from '../audio/sound';

interface PackOpeningModalProps {
  isOpen: boolean;
  onClose: () => void;
  unopenedCount: number;
  isOpening: boolean;
  packResult: PackOpenResult | null;
  onRequestOpenPack: () => void;
  onResetPackResult: () => void;
  onEquipCardBack?: (cardBackId: string) => void;
  onOpenCollection?: () => void;
}

type RitualPhase = 'sealed' | 'charging' | 'burst' | 'reveal' | 'summary';

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
}

const RARITY_COLOR_MAP: Record<RarityTier, string> = {
  common: '#94a3b8',
  rare: '#38bdf8',
  epic: '#c084fc',
  legendary: '#fbbf24',
};

export const PackOpeningModal: React.FC<PackOpeningModalProps> = ({
  isOpen,
  onClose,
  unopenedCount,
  isOpening,
  packResult,
  onRequestOpenPack,
  onResetPackResult,
  onEquipCardBack,
  onOpenCollection,
}) => {
  const [phase, setPhase] = useState<RitualPhase>('sealed');
  const [revealedIndices, setRevealedIndices] = useState<boolean[]>([false, false, false, false, false]);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; shineX: number; shineY: number }>({
    rx: 0,
    ry: 0,
    shineX: 50,
    shineY: 35,
  });
  const [equippedInSummary, setEquippedInSummary] = useState<Record<string, boolean>>({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<BurstParticle[]>([]);
  const chargeStartRef = useRef<number>(0);

  // Reset modal ritual when opened freshly
  useEffect(() => {
    if (!isOpen) return;
    if (packResult) {
      setRevealedIndices([false, false, false, false, false]);
      setPhase('reveal');
    } else {
      setPhase('sealed');
      setRevealedIndices([false, false, false, false, false]);
    }
    setEquippedInSummary({});
  }, [isOpen]);

  // Spawn Canvas particle bursts
  const spawnParticles = (count: number, color: string, speedMultiplier = 1) => {
    const canvas = canvasRef.current;
    const cx = canvas ? canvas.width / 2 : 450;
    const cy = canvas ? canvas.height / 2 : 320;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (1.5 + Math.random() * 6.5) * speedMultiplier;
      particlesRef.current.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 40,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 0.8,
        size: 1.5 + Math.random() * 3.8,
        alpha: 1,
        decay: 0.012 + Math.random() * 0.016,
        color,
      });
    }
  };

  // Ambient + Burst Canvas Loop
  useEffect(() => {
    if (!isOpen) return;
    let rafId = 0;
    let tick = 0;

    const renderFrame = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
          canvas.width = Math.max(320, Math.floor(rect.width));
          canvas.height = Math.max(280, Math.floor(rect.height));
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          tick++;
          if (tick % 4 === 0 && particlesRef.current.length < 140) {
            particlesRef.current.push({
              x: Math.random() * canvas.width,
              y: canvas.height + 8,
              vx: (Math.random() - 0.5) * 0.6,
              vy: -0.6 - Math.random() * 1.1,
              size: 1 + Math.random() * 2,
              alpha: 0.55,
              decay: 0.004,
              color: phase === 'charging' ? '#fbbf24' : '#cbd5e1',
            });
          }

          particlesRef.current = particlesRef.current.filter((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.04;
            p.alpha -= p.decay;
            if (p.alpha <= 0) return false;
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            return true;
          });
          ctx.globalAlpha = 1;
        }
      }
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, phase]);

  // Transition charging -> burst -> reveal once packResult arrives from server
  useEffect(() => {
    if (phase !== 'charging' || !packResult) return;
    const elapsed = Date.now() - chargeStartRef.current;
    const waitMore = Math.max(0, 650 - elapsed);
    const burstTimer = setTimeout(() => {
      setPhase('burst');
      sounds.playPackBurst();
      const hasLeg = packResult.cards.some((c) => c.rarity === 'legendary');
      const hasEpic = packResult.cards.some((c) => c.rarity === 'epic');
      spawnParticles(95, hasLeg ? '#fbbf24' : hasEpic ? '#c084fc' : '#38bdf8', 1.45);
      spawnParticles(45, '#ffffff', 1.1);
      setTimeout(() => {
        setRevealedIndices([false, false, false, false, false]);
        setPhase('reveal');
      }, 620);
    }, waitMore);

    return () => clearTimeout(burstTimer);
  }, [phase, packResult]);

  // If server returned error / stopped opening before packResult came back
  useEffect(() => {
    if (phase === 'charging' && !isOpening && !packResult) {
      const failTimer = setTimeout(() => {
        if (!packResult) setPhase('sealed');
      }, 2000);
      return () => clearTimeout(failTimer);
    }
  }, [phase, isOpening, packResult]);

  if (!isOpen) return null;

  const handleStartOpen = () => {
    if (phase !== 'sealed' || isOpening || unopenedCount <= 0) return;
    chargeStartRef.current = Date.now();
    setPhase('charging');
    sounds.playPackCharge();
    spawnParticles(36, '#fbbf24', 0.85);
    onRequestOpenPack();
  };

  const handleRevealCard = (index: number) => {
    if (!packResult || revealedIndices[index]) return;
    const card = packResult.cards[index];
    setRevealedIndices((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
    if (card) {
      sounds.playCardFlipReveal(card.rarity);
      spawnParticles(
        card.rarity === 'legendary' ? 56 : card.rarity === 'epic' ? 36 : card.rarity === 'rare' ? 22 : 10,
        RARITY_COLOR_MAP[card.rarity],
        card.rarity === 'legendary' ? 1.3 : 0.9
      );
    }
  };

  const handleRevealNextOrAll = () => {
    if (!packResult) return;
    const nextIdx = revealedIndices.findIndex((r) => !r);
    if (nextIdx >= 0) {
      handleRevealCard(nextIdx);
    } else {
      setPhase('summary');
    }
  };

  const handleRevealAll = () => {
    if (!packResult) return;
    packResult.cards.forEach((c, idx) => {
      if (!revealedIndices[idx]) {
        setTimeout(() => handleRevealCard(idx), idx * 140);
      }
    });
  };

  const handleOpenAnother = () => {
    onResetPackResult();
    setRevealedIndices([false, false, false, false, false]);
    setEquippedInSummary({});
    setPhase('sealed');
  };

  const allRevealed = Boolean(packResult) && revealedIndices.every(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      {/* Particle Overlay Canvas */}
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 w-full h-full z-0" />

      {/* Radial Stage Vignette */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-60 transition-all duration-700"
        style={{
          background:
            phase === 'burst'
              ? 'radial-gradient(circle at center, rgba(251,191,36,0.45) 0%, rgba(15,23,42,0) 65%)'
              : phase === 'charging'
              ? 'radial-gradient(circle at center, rgba(245,158,11,0.32) 0%, rgba(15,23,42,0) 60%)'
              : 'radial-gradient(circle at center, rgba(56,189,248,0.16) 0%, rgba(15,23,42,0) 68%)',
        }}
      />

      {/* Top Close & Counter Bar */}
      <div className="relative z-10 w-full max-w-5xl bg-slate-900/75 border border-amber-500/30 rounded-3xl shadow-2xl p-4 sm:p-6 my-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-400/40">
              <Package className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-wide flex items-center gap-2">
                <span>BOWER JJ CARD PACKS</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/20 border border-amber-400/50 text-amber-300 font-bold">
                  {packResult ? packResult.remainingUnopenedPacks : unopenedCount} Unopened
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                5 collectible cards per pack • Collect all 5 identities (10, J, Q, K, A) to unlock Card Backs
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Close Pack Opener"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PHASE 1: SEALED / CHARGING / BURST */}
        {(phase === 'sealed' || phase === 'charging' || phase === 'burst') && (
          <div className="flex flex-col items-center justify-center py-6 sm:py-10 min-h-[380px]">
            {unopenedCount <= 0 && phase === 'sealed' ? (
              <div className="text-center space-y-4 max-w-md py-8">
                <div className="w-24 h-36 mx-auto rounded-2xl overflow-hidden border border-slate-700 opacity-50 grayscale">
                  <img src={PACK_ARTWORK_URL} alt="Card Pack" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl font-black text-white">No Unopened Packs</h3>
                <p className="text-sm text-slate-400">
                  Play matches to earn XP! Every time you level up, a fresh 5-card Bower JJ Booster Pack is added to your inventory.
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm cursor-pointer"
                >
                  Back to Table
                </button>
              </div>
            ) : (
              <>
                <div
                  onMouseMove={(e) => {
                    if (phase !== 'sealed') return;
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
                  onClick={handleStartOpen}
                  className={`relative w-52 sm:w-64 aspect-[520/740] cursor-pointer select-none transition-all duration-300 ${
                    phase === 'charging'
                      ? 'animate-[wiggle_0.16s_infinite] scale-110 brightness-125'
                      : phase === 'burst'
                      ? 'scale-150 opacity-0 duration-500'
                      : 'hover:scale-105'
                  }`}
                  style={{
                    transform:
                      phase === 'sealed'
                        ? `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`
                        : undefined,
                    filter:
                      phase === 'charging'
                        ? 'drop-shadow(0 0 38px rgba(251,191,36,0.95))'
                        : 'drop-shadow(0 22px 35px rgba(0,0,0,0.75))',
                  }}
                >
                  <img
                    src={PACK_ARTWORK_URL}
                    alt="Bower JJ Collectible Booster Pack"
                    draggable={false}
                    className="w-full h-full object-cover rounded-2xl border-2 border-amber-400/70"
                  />
                  {/* Dynamic holographic sheen */}
                  <div
                    className="pointer-events-none absolute inset-0 rounded-2xl mix-blend-overlay opacity-70 transition-opacity"
                    style={{
                      background: `radial-gradient(circle at ${tilt.shineX}% ${tilt.shineY}%, rgba(255,255,255,0.65) 0%, rgba(251,191,36,0.2) 35%, transparent 70%)`,
                    }}
                  />
                  {phase === 'charging' && (
                    <div className="pointer-events-none absolute inset-0 rounded-2xl border-4 border-amber-300 animate-ping opacity-75" />
                  )}
                </div>

                <div className="mt-7 text-center space-y-3">
                  <button
                    onClick={handleStartOpen}
                    disabled={phase !== 'sealed' || isOpening}
                    className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-base shadow-[0_0_28px_rgba(245,158,11,0.5)] active:scale-95 transition-all cursor-pointer flex items-center gap-2 mx-auto disabled:opacity-60"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>{phase === 'charging' ? 'Unsealing Pack...' : phase === 'burst' ? 'Bursting Open!' : 'Crack Pack Open'}</span>
                  </button>
                  <p className="text-xs text-slate-400">
                    Click or tap the 3D foil pack to unveil 5 collectible cards
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* PHASE 2: SEQUENTIAL 5-CARD 3D FLIP REVEAL */}
        {phase === 'reveal' && packResult && (
          <div className="py-4 space-y-6">
            <div className="text-center">
              <h3 className="text-lg sm:text-xl font-black text-amber-300 tracking-wide">
                {allRevealed ? 'ALL 5 CARDS REVEALED!' : 'TAP EACH CARD TO FLIP & REVEAL'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Cards glow with their hidden rarity aura — look for Purple Epic &amp; Gold Legendary pulls!
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 justify-items-center">
              {packResult.cards.map((card, idx) => (
                <FlippableDrawnCard
                  key={`${card.cardId}_${idx}`}
                  card={card}
                  isRevealed={revealedIndices[idx]}
                  onFlip={() => handleRevealCard(idx)}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {!allRevealed ? (
                <>
                  <button
                    onClick={handleRevealNextOrAll}
                    className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-lg cursor-pointer flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Reveal Next Card</span>
                  </button>
                  <button
                    onClick={handleRevealAll}
                    className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-sm cursor-pointer flex items-center gap-2"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>Reveal All 5</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setPhase('summary')}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-slate-950 font-black text-sm shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>View Pack Summary</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* PHASE 3: FINAL PACK SUMMARY + COLLECTION UNLOCKS */}
        {phase === 'summary' && packResult && (
          <div className="py-3 space-y-5">
            {/* Newly Unlocked Card Backs / Collection Completions */}
            {packResult.newlyUnlockedCardBacks.length > 0 && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 border-2 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.3)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img
                    src={getCardBackDefinition(packResult.newlyUnlockedCardBacks[0]).imageUrl}
                    alt="Unlocked Card Back"
                    className="w-16 h-24 rounded-lg object-cover border-2 border-amber-300 shadow-lg"
                  />
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                      <Award className="w-4 h-4" />
                      <span>Collection Completed — Card Back Unlocked!</span>
                    </div>
                    <h4 className="text-lg font-black text-white mt-0.5">
                      {packResult.newlyUnlockedCardBacks.map((id) => getCardBackDefinition(id).name).join(', ')}
                    </h4>
                    <p className="text-xs text-slate-300">
                      Permanently added to your Card Back inventory.
                    </p>
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
                    className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer flex-shrink-0"
                  >
                    {equippedInSummary[packResult.newlyUnlockedCardBacks[0]] ? 'Equipped!' : 'Equip Card Back'}
                  </button>
                )}
              </div>
            )}

            {/* Newly Unlocked Milestone Avatars */}
            {packResult.newlyUnlockedAvatars.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-400/50 flex flex-wrap items-center gap-3">
                <span className="text-xs font-black text-purple-300 uppercase tracking-wider">
                  New Illustrated Avatar Unlocked:
                </span>
                {packResult.newlyUnlockedAvatars.map((avId) => {
                  const av = getAvatarDefinition(avId);
                  return (
                    <div key={avId} className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-purple-400/40">
                      <AvatarPortrait avatarId={avId} size="xs" />
                      <span className="text-xs font-bold text-white">{av.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 5 Cards Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 justify-items-center">
              {packResult.cards.map((card, idx) => (
                <FlippableDrawnCard key={`sum_${card.cardId}_${idx}`} card={card} isRevealed={true} onFlip={() => {}} />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-slate-800">
              {packResult.remainingUnopenedPacks > 0 && (
                <button
                  onClick={handleOpenAnother}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-sm shadow-lg cursor-pointer flex items-center gap-2"
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
                  className="px-5 py-3 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white font-bold text-sm cursor-pointer flex items-center gap-2"
                >
                  <Layers className="w-4 h-4" />
                  <span>View Collections</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const FlippableDrawnCard: React.FC<{
  card: DrawnCardResult;
  isRevealed: boolean;
  onFlip: () => void;
}> = ({ card, isRevealed, onFlip }) => {
  const rarity = RARITY_META[card.rarity];
  const col = getCollectionDefinition(card.collectionId);

  return (
    <div
      onClick={!isRevealed ? onFlip : undefined}
      className={`group relative w-36 sm:w-40 flex flex-col items-center ${!isRevealed ? 'cursor-pointer' : ''}`}
      style={{ perspective: '1000px' }}
    >
      <div
        className="relative w-36 sm:w-40 aspect-[360/510] transition-transform duration-700"
        style={{
          transformStyle: 'preserve-3d',
          transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* CARD BACK (Facedown before click, glows gently with rarity hint) */}
        <div
          className={`absolute inset-0 rounded-2xl overflow-hidden border-2 ${rarity.borderClass} bg-slate-950 shadow-xl transition-transform group-hover:-translate-y-1.5`}
          style={{
            backfaceVisibility: 'hidden',
            boxShadow: card.rarity === 'legendary' || card.rarity === 'epic' ? rarity.glowStyle : undefined,
          }}
        >
          <img
            src="/assets/card-backs/dark_royalty.webp"
            alt="Sealed Collectible Card"
            draggable={false}
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/30 flex flex-col items-center justify-end p-2.5">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${rarity.badgeClass}`}>
              {rarity.label} Glow
            </span>
            <span className="text-[10px] text-amber-200 font-bold mt-1 animate-pulse">Tap to Flip</span>
          </div>
        </div>

        {/* CARD FRONT (Revealed Artwork) */}
        <div
          className={`absolute inset-0 rounded-2xl overflow-hidden border-2 ${rarity.borderClass} bg-slate-950 shadow-2xl flex flex-col`}
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            boxShadow: rarity.glowStyle,
          }}
        >
          <img
            src={card.imageUrl}
            alt={card.name}
            draggable={false}
            className="w-full h-full object-cover"
          />

          {/* Top-Left NEW or DUPLICATE pill */}
          <div className="absolute top-2 right-2">
            {card.wasDuplicate ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-900/90 border border-slate-500 text-slate-200 shadow">
                DUPE x{card.newQuantity}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-slate-950 shadow-lg">
                NEW!
              </span>
            )}
          </div>

          {/* Bottom Collection Banner */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent p-2 text-center">
            <div className={`text-[9px] font-black uppercase tracking-widest ${rarity.textClass}`}>
              {rarity.label}
            </div>
            <div className="text-[11px] font-black text-white leading-tight truncate">{card.name}</div>
            <div className="text-[9px] text-slate-400 truncate">{col?.name} Set</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackOpeningModal;
