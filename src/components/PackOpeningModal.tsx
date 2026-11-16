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
} from 'lucide-react';
import confetti from 'canvas-confetti';
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

type RitualPhase = 'sealed' | 'charging' | 'tearing' | 'burst' | 'reveal' | 'summary';

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
  shape: 'circle' | 'diamond';
  rotation: number;
  vRot: number;
}

interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  lineWidth: number;
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
  const [justRevealedIndex, setJustRevealedIndex] = useState<number | null>(null);
  const [spotlightRarity, setSpotlightRarity] = useState<RarityTier | null>(null);
  const [inspectedCard, setInspectedCard] = useState<DrawnCardResult | null>(null);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; shineX: number; shineY: number }>({
    rx: 0,
    ry: 0,
    shineX: 50,
    shineY: 35,
  });
  const [equippedInSummary, setEquippedInSummary] = useState<Record<string, boolean>>({});
  const [tearProgress, setTearProgress] = useState<number>(0);
  const [isTearDragging, setIsTearDragging] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tearStripRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<BurstParticle[]>([]);
  const shockwavesRef = useRef<ShockwaveRing[]>([]);
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
    setTearProgress(0);
    setIsTearDragging(false);
    setJustRevealedIndex(null);
    setSpotlightRarity(null);
    setInspectedCard(null);
    setEquippedInSummary({});
  }, [isOpen]);

  const spawnShockwave = (color: string, maxRadius = 380, lineWidth = 4) => {
    const canvas = canvasRef.current;
    const cx = canvas ? canvas.width / 2 : 450;
    const cy = canvas ? canvas.height / 2 : 320;
    shockwavesRef.current.push({
      x: cx,
      y: cy,
      radius: 24,
      maxRadius,
      alpha: 0.95,
      color,
      lineWidth,
    });
  };

  // Spawn Canvas particle bursts
  const spawnParticles = (count: number, color: string, speedMultiplier = 1, diamondRatio = 0.45) => {
    const canvas = canvasRef.current;
    const cx = canvas ? canvas.width / 2 : 450;
    const cy = canvas ? canvas.height / 2 : 320;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (1.6 + Math.random() * 7.2) * speedMultiplier;
      particlesRef.current.push({
        x: cx + (Math.random() - 0.5) * 44,
        y: cy + (Math.random() - 0.5) * 44,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1.0,
        size: 1.8 + Math.random() * 4.4,
        alpha: 1,
        decay: 0.011 + Math.random() * 0.015,
        color,
        shape: Math.random() < diamondRatio ? 'diamond' : 'circle',
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.14,
      });
    }
  };

  // Ambient + Burst + Shockwave Canvas Loop
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

          // Ambient floating stage particles
          if (tick % 3 === 0 && particlesRef.current.length < 160) {
            const isCharging = phase === 'charging' || phase === 'tearing';
            particlesRef.current.push({
              x: Math.random() * canvas.width,
              y: canvas.height + 10,
              vx: (Math.random() - 0.5) * 0.7,
              vy: isCharging ? -1.8 - Math.random() * 2.2 : -0.6 - Math.random() * 1.1,
              size: 1.2 + Math.random() * 2.4,
              alpha: isCharging ? 0.8 : 0.5,
              decay: 0.0035,
              color: isCharging ? '#fbbf24' : Math.random() < 0.35 ? '#38bdf8' : '#fde68a',
              shape: Math.random() < 0.5 ? 'diamond' : 'circle',
              rotation: Math.random() * Math.PI,
              vRot: 0.04,
            });
          }

          // Render expanding shockwave rings
          shockwavesRef.current = shockwavesRef.current.filter((ring) => {
            ring.radius += (ring.maxRadius - ring.radius) * 0.12 + 3.5;
            ring.alpha *= 0.92;
            if (ring.alpha <= 0.02 || ring.radius >= ring.maxRadius) return false;
            ctx.save();
            ctx.globalAlpha = Math.max(0, ring.alpha);
            ctx.strokeStyle = ring.color;
            ctx.lineWidth = ring.lineWidth;
            ctx.shadowColor = ring.color;
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            return true;
          });

          // Render particles
          particlesRef.current = particlesRef.current.filter((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.035;
            p.rotation += p.vRot;
            p.alpha -= p.decay;
            if (p.alpha <= 0) return false;

            ctx.save();
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;

            if (p.shape === 'diamond') {
              ctx.translate(p.x, p.y);
              ctx.rotate(p.rotation);
              const s = p.size * 1.25;
              ctx.beginPath();
              ctx.moveTo(0, -s);
              ctx.lineTo(s * 0.75, 0);
              ctx.lineTo(0, s);
              ctx.lineTo(-s * 0.75, 0);
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
            return true;
          });
        }
      }
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, phase]);

  // Choreography: charging -> tearing (foil rip) -> burst -> reveal once packResult arrives from server
  useEffect(() => {
    if (phase !== 'charging' || !packResult) return;
    const elapsed = Date.now() - chargeStartRef.current;
    const waitToTear = Math.max(0, 480 - elapsed);

    const tearTimer = setTimeout(() => {
      setPhase('tearing');
      sounds.playPackTear();
      spawnParticles(45, '#fde047', 1.1, 0.7);
      spawnShockwave('#fbbf24', 280, 3);

      setTimeout(() => {
        setPhase('burst');
        sounds.playPackBurst();
        const hasLeg = packResult.cards.some((c) => c.rarity === 'legendary');
        const hasEpic = packResult.cards.some((c) => c.rarity === 'epic');
        const primaryColor = hasLeg ? '#fbbf24' : hasEpic ? '#c084fc' : '#38bdf8';

        spawnShockwave(primaryColor, 520, 6);
        spawnShockwave('#ffffff', 380, 3);
        spawnParticles(120, primaryColor, 1.55, 0.65);
        spawnParticles(60, '#ffffff', 1.2, 0.5);

        setTimeout(() => {
          setRevealedIndices([false, false, false, false, false]);
          setPhase('reveal');
        }, 560);
      }, 360);
    }, waitToTear);

    return () => clearTimeout(tearTimer);
  }, [phase, packResult]);

  // If server returned error / stopped opening before packResult came back
  useEffect(() => {
    if ((phase === 'charging' || phase === 'tearing') && !isOpening && !packResult) {
      const failTimer = setTimeout(() => {
        if (!packResult) setPhase('sealed');
      }, 2200);
      return () => clearTimeout(failTimer);
    }
  }, [phase, isOpening, packResult]);

  if (!isOpen) return null;

  const handleStartOpen = () => {
    if (phase !== 'sealed' || isOpening || unopenedCount <= 0) return;
    setTearProgress(1);
    chargeStartRef.current = Date.now();
    setPhase('charging');
    sounds.playPackCharge();
    spawnParticles(42, '#fbbf24', 0.95);
    spawnShockwave('#f59e0b', 220, 2.5);
    onRequestOpenPack();
  };

  const processTearPointer = (clientX: number) => {
    if (!tearStripRef.current || phase !== 'sealed' || isOpening || unopenedCount <= 0) return;
    const rect = tearStripRef.current.getBoundingClientRect();
    const rawRatio = (clientX - rect.left) / rect.width;
    const ratio = Math.max(0, Math.min(1, rawRatio));
    setTearProgress(ratio);

    if (Math.random() < 0.4) {
      spawnParticles(2, '#fbbf24', 0.8, 0.65);
    }

    if (ratio >= 0.72) {
      completeTearGesture();
    }
  };

  const handleTearPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== 'sealed' || isOpening || unopenedCount <= 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsTearDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    processTearPointer(e.clientX);
  };

  const handleTearPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTearDragging || phase !== 'sealed') return;
    processTearPointer(e.clientX);
  };

  const handleTearPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTearDragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    setIsTearDragging(false);
    if (tearProgress >= 0.4) {
      completeTearGesture();
    } else {
      setTearProgress(0);
    }
  };

  const completeTearGesture = () => {
    setIsTearDragging(false);
    setTearProgress(1);
    handleStartOpen();
  };

  const handleRevealCard = (index: number) => {
    if (!packResult || revealedIndices[index]) return;
    const card = packResult.cards[index];
    setRevealedIndices((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
    setJustRevealedIndex(index);

    if (card) {
      sounds.playCardFlipReveal(card.rarity);
      const rarityColor = RARITY_COLOR_MAP[card.rarity];
      spawnParticles(
        card.rarity === 'legendary' ? 90 : card.rarity === 'epic' ? 55 : card.rarity === 'rare' ? 30 : 14,
        rarityColor,
        card.rarity === 'legendary' ? 1.5 : card.rarity === 'epic' ? 1.25 : 0.95,
        card.rarity === 'legendary' || card.rarity === 'epic' ? 0.75 : 0.4
      );

      if (card.rarity === 'legendary' || card.rarity === 'epic' || card.rarity === 'rare') {
        spawnShockwave(
          rarityColor,
          card.rarity === 'legendary' ? 460 : card.rarity === 'epic' ? 360 : 240,
          card.rarity === 'legendary' ? 5 : 3
        );
      }

      if (card.rarity === 'legendary' || card.rarity === 'epic') {
        setSpotlightRarity(card.rarity);
        setTimeout(() => {
          setSpotlightRarity((curr) => (curr === card.rarity ? null : curr));
        }, 1800);

        try {
          confetti({
            particleCount: card.rarity === 'legendary' ? 70 : 35,
            spread: card.rarity === 'legendary' ? 80 : 55,
            origin: { y: 0.55 },
            colors:
              card.rarity === 'legendary'
                ? ['#fbbf24', '#fde047', '#ffffff', '#f59e0b']
                : ['#c084fc', '#e879f9', '#a855f7', '#ffffff'],
          });
        } catch {
          // Ignore confetti errors in headless test environments
        }
      }
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
    packResult.cards.forEach((_, idx) => {
      if (!revealedIndices[idx]) {
        setTimeout(() => handleRevealCard(idx), idx * 170);
      }
    });
  };

  const handleOpenAnother = () => {
    onResetPackResult();
    setRevealedIndices([false, false, false, false, false]);
    setJustRevealedIndex(null);
    setSpotlightRarity(null);
    setInspectedCard(null);
    setEquippedInSummary({});
    setPhase('sealed');
  };

  const allRevealed = Boolean(packResult) && revealedIndices.every(Boolean);
  const revealedCount = revealedIndices.filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-2 sm:p-4 overflow-y-auto">
      {/* Particle & Shockwave Overlay Canvas */}
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 w-full h-full z-0" />

      {/* Dynamic Stage Spotlight & Rarity Flash */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-all duration-700"
        style={{
          background:
            spotlightRarity === 'legendary'
              ? 'radial-gradient(circle at center, rgba(251,191,36,0.42) 0%, rgba(245,158,11,0.14) 40%, rgba(2,6,23,0) 72%)'
              : spotlightRarity === 'epic'
              ? 'radial-gradient(circle at center, rgba(192,132,252,0.36) 0%, rgba(147,51,234,0.12) 40%, rgba(2,6,23,0) 72%)'
              : phase === 'burst'
              ? 'radial-gradient(circle at center, rgba(251,191,36,0.5) 0%, rgba(15,23,42,0) 68%)'
              : phase === 'charging' || phase === 'tearing'
              ? 'radial-gradient(circle at center, rgba(245,158,11,0.34) 0%, rgba(15,23,42,0) 62%)'
              : 'radial-gradient(circle at center, rgba(56,189,248,0.14) 0%, rgba(245,158,11,0.06) 38%, rgba(15,23,42,0) 70%)',
        }}
      />

      {/* Main Stage Container */}
      <div className="relative z-10 w-full max-w-5xl bg-gradient-to-b from-slate-900/90 via-slate-950/92 to-slate-900/90 border border-amber-500/35 rounded-3xl shadow-[0_25px_90px_rgba(0,0,0,0.85)] p-3.5 sm:p-6 my-auto overflow-hidden">
        {/* Top Ambient Stage Rim Light */}
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800/90 pb-3 mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-600/10 border border-amber-400/50 shadow-inner">
              <Package className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-black text-white tracking-wider flex flex-wrap items-center gap-2">
                <span>BOWER JJ VAULT PACKS</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-amber-500/20 border border-amber-400/50 text-amber-300 font-black shadow-sm">
                  {packResult ? packResult.remainingUnopenedPacks : unopenedCount} Unopened
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                5 collectible cards per pack • Complete 5-card sets (10, J, Q, K, A) to unlock custom Card Backs
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title="Close Pack Opener"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PHASE 1: SEALED / CHARGING / TEARING / BURST */}
        {(phase === 'sealed' || phase === 'charging' || phase === 'tearing' || phase === 'burst') && (
          <div className="relative flex flex-col items-center justify-center py-4 sm:py-8 min-h-[400px] sm:min-h-[440px]">
            {unopenedCount <= 0 && phase === 'sealed' ? (
              <div className="text-center space-y-4 max-w-md py-8">
                <div className="w-28 h-40 mx-auto rounded-2xl overflow-hidden border-2 border-slate-700 opacity-55 grayscale shadow-xl">
                  <img src={PACK_ARTWORK_URL} alt="Card Pack" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-xl font-black text-white">No Unopened Packs in Vault</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Play matches to earn XP! Every time you level up, a fresh 5-card Bower JJ Booster Pack is added to your vault.
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm cursor-pointer"
                >
                  Back to Arena
                </button>
              </div>
            ) : (
              <>
                {/* Rotating Ambient Halo Behind Booster Pack */}
                <div
                  className={`pointer-events-none absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full transition-all duration-500 ${
                    phase === 'charging' || phase === 'tearing'
                      ? 'scale-125 opacity-95'
                      : phase === 'burst'
                      ? 'scale-175 opacity-0'
                      : 'scale-100 opacity-60'
                  }`}
                  style={{
                    background:
                      'conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.22) 60deg, transparent 120deg, rgba(56,189,248,0.18) 240deg, transparent 360deg)',
                    filter: 'blur(24px)',
                  }}
                />

                {/* Visual Finger Swipe / Click to Tear Prompt */}
                {phase === 'sealed' && (
                  <div
                    onClick={completeTearGesture}
                    className="mb-3 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center gap-2 text-amber-300 text-xs font-black cursor-pointer hover:bg-amber-500/30 transition-all select-none animate-pulse"
                    title="Click or drag to rip open"
                  >
                    <Scissors className="w-4 h-4 text-amber-300 rotate-90" />
                    <span>Swipe finger across or click seam to tear open!</span>
                  </div>
                )}

                {/* 3D Interactive Foil Booster Pack */}
                <div
                  onMouseEnter={() => {
                    if (phase === 'sealed') sounds.playPackHover();
                  }}
                  onMouseMove={(e) => {
                    if (phase !== 'sealed') return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const px = ((e.clientX - rect.left) / rect.width) * 100;
                    const py = ((e.clientY - rect.top) / rect.height) * 100;
                    setTilt({
                      rx: ((py - 50) / 50) * -15,
                      ry: ((px - 50) / 50) * 18,
                      shineX: px,
                      shineY: py,
                    });
                  }}
                  onMouseLeave={() => setTilt({ rx: 0, ry: 0, shineX: 50, shineY: 35 })}
                  onClick={handleStartOpen}
                  className={`group relative w-52 sm:w-64 aspect-[520/740] cursor-pointer select-none transition-all duration-300 ${
                    phase === 'charging'
                      ? 'scale-108 brightness-115'
                      : phase === 'tearing'
                      ? 'scale-112 brightness-125'
                      : phase === 'burst'
                      ? 'scale-150 opacity-0 duration-500'
                      : 'hover:scale-105'
                  }`}
                  style={{
                    transform:
                      phase === 'sealed'
                        ? `perspective(950px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`
                        : phase === 'charging'
                        ? 'perspective(950px) rotateZ(-1.5deg) scale(1.06)'
                        : phase === 'tearing'
                        ? 'perspective(950px) rotateZ(1.5deg) scale(1.1)'
                        : undefined,
                    filter:
                      phase === 'charging' || phase === 'tearing'
                        ? 'drop-shadow(0 0 45px rgba(251,191,36,0.95))'
                        : 'drop-shadow(0 26px 42px rgba(0,0,0,0.85))',
                  }}
                >
                  {/* Top Metallic Crimp Foil Strip (Peels off dynamically during swipe/drag or tear phase) */}
                  <div
                    className={`pointer-events-none absolute inset-x-0 top-0 h-8 z-30 rounded-t-2xl overflow-hidden border-t-2 border-x-2 border-amber-300/80 transition-all duration-300 ${
                      phase === 'tearing' || phase === 'burst'
                        ? '-translate-y-12 rotate-6 translate-x-8 opacity-0 scale-105'
                        : 'translate-y-0 opacity-100'
                    }`}
                    style={{
                      background:
                        'repeating-linear-gradient(90deg, rgba(251,191,36,0.35) 0px, rgba(251,191,36,0.35) 3px, rgba(15,23,42,0.85) 3px, rgba(15,23,42,0.85) 6px)',
                      transform:
                        phase === 'tearing' || phase === 'burst'
                          ? undefined
                          : tearProgress > 0
                          ? `translateY(-${tearProgress * 14}px) rotate(${tearProgress * 7}deg) translateX(${tearProgress * 10}px)`
                          : undefined,
                    }}
                  >
                    <div className="w-full h-full bg-gradient-to-b from-amber-300/35 via-amber-500/15 to-slate-950/80 flex items-center justify-center">
                      <span className="text-[9px] font-black tracking-[0.22em] text-amber-200 uppercase drop-shadow">
                        ★ FACTORY SEALED FOIL ★
                      </span>
                    </div>
                  </div>

                  {/* Interactive Tear Seam Strip (Touch & Drag across, or Click to Tear) */}
                  {phase === 'sealed' && (
                    <div
                      ref={tearStripRef}
                      onPointerDown={handleTearPointerDown}
                      onPointerMove={handleTearPointerMove}
                      onPointerUp={handleTearPointerUp}
                      onPointerCancel={handleTearPointerUp}
                      onClick={(e) => {
                        e.stopPropagation();
                        completeTearGesture();
                      }}
                      className="absolute inset-x-0 top-5 h-10 z-40 cursor-ew-resize select-none flex items-center px-2 group/tear"
                      title="Drag finger or click across to tear open!"
                    >
                      {/* Dotted Perforation Seam Line */}
                      <div className="w-full h-0.5 border-t-2 border-dashed border-amber-300/90 relative">
                        {/* Light Eruption Laser Beam following tear finger */}
                        <div
                          className="absolute left-0 -top-[1.5px] h-1.5 bg-white shadow-[0_0_20px_#ffffff,0_0_35px_#fbbf24] transition-all duration-75 rounded-full"
                          style={{ width: `${Math.max(0, tearProgress * 100)}%` }}
                        />
                      </div>

                      {/* Tactile Pull Tab with Scissors Icon */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-[9px] shadow-[0_0_16px_rgba(251,191,36,0.95)] border border-amber-200 transition-transform active:scale-110 pointer-events-none"
                        style={{
                          left: `${Math.max(4, Math.min(88, tearProgress * 100))}%`,
                        }}
                      >
                        <Scissors className="w-3 h-3 rotate-90" />
                        <span className="tracking-wider uppercase">TEAR</span>
                        <ChevronRight className="w-3 h-3 -ml-0.5 animate-pulse" />
                      </div>
                    </div>
                  )}

                  {/* Static Seam line when not in sealed phase */}
                  {phase !== 'sealed' && (
                    <div className="pointer-events-none absolute inset-x-2 top-8 z-30 flex items-center justify-center transition-all duration-300">
                      <div
                        className={`w-full h-0.5 transition-all duration-300 ${
                          phase === 'tearing'
                            ? 'h-1.5 bg-white shadow-[0_0_24px_#ffffff,0_0_40px_#fbbf24]'
                            : phase === 'charging'
                            ? 'h-1 bg-amber-300 shadow-[0_0_16px_#fbbf24]'
                            : 'border-t border-dashed border-amber-300/70'
                        }`}
                      />
                    </div>
                  )}

                  {/* Main Booster Pack Foil Body */}
                  <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-amber-400/80 bg-slate-950 shadow-2xl">
                    <img
                      src={PACK_ARTWORK_URL}
                      alt="Bower JJ Collectible Booster Pack"
                      draggable={false}
                      className="w-full h-full object-cover"
                    />

                    {/* Dynamic 3D Specular Foil Sheen */}
                    <div
                      className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-75 transition-opacity"
                      style={{
                        background: `radial-gradient(circle at ${tilt.shineX}% ${tilt.shineY}%, rgba(255,255,255,0.75) 0%, rgba(251,191,36,0.28) 32%, rgba(56,189,248,0.16) 55%, transparent 75%)`,
                      }}
                    />

                    {/* Diagonal Holographic Foil Sweep */}
                    <div
                      className="pointer-events-none absolute inset-0 opacity-35 group-hover:opacity-60 transition-opacity"
                      style={{
                        background:
                          'linear-gradient(125deg, transparent 20%, rgba(255,255,255,0.28) 42%, rgba(251,191,36,0.35) 50%, rgba(56,189,248,0.25) 58%, transparent 80%)',
                      }}
                    />

                    {/* Bottom Metallic Crimp Ridge */}
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-3.5 opacity-75"
                      style={{
                        background:
                          'repeating-linear-gradient(90deg, rgba(251,191,36,0.28) 0px, rgba(251,191,36,0.28) 3px, rgba(2,6,23,0.9) 3px, rgba(2,6,23,0.9) 6px)',
                      }}
                    />
                  </div>

                  {/* Internal Light Eruption During Charging & Tearing */}
                  {(phase === 'charging' || phase === 'tearing') && (
                    <div className="pointer-events-none absolute -inset-1 rounded-2xl border-2 border-amber-200 shadow-[0_0_50px_rgba(251,191,36,0.9)] animate-pulse" />
                  )}
                </div>

                {/* Call to Action Controls */}
                <div className="mt-6 sm:mt-7 text-center space-y-2.5 relative z-10">
                  <button
                    onClick={handleStartOpen}
                    disabled={phase !== 'sealed' || isOpening}
                    className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm sm:text-base uppercase tracking-wider shadow-[0_0_32px_rgba(245,158,11,0.55)] active:scale-95 transition-all cursor-pointer flex items-center gap-2.5 mx-auto disabled:opacity-60"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>
                      {phase === 'charging'
                        ? 'Charging Vault Seal...'
                        : phase === 'tearing'
                        ? 'Tearing Foil Seal...'
                        : phase === 'burst'
                        ? 'Unleashing Cards!'
                        : 'Tear Open Booster Pack'}
                    </span>
                  </button>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    Tap the booster pack or click above to unseal 5 Sovereign Edition collectible cards
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* PHASE 2: SEQUENTIAL 5-CARD 3D FLIP REVEAL */}
        {phase === 'reveal' && packResult && (
          <div className="py-2 sm:py-4 space-y-5 animate-in fade-in duration-300">
            {/* Reveal Status & Progress Header */}
            <div className="text-center space-y-1.5">
              {spotlightRarity === 'legendary' ? (
                <div className="inline-flex items-center space-x-2 px-4 py-1 rounded-full bg-amber-500/25 border border-amber-300 text-amber-200 text-xs sm:text-sm font-black uppercase tracking-widest shadow-[0_0_25px_rgba(251,191,36,0.5)] animate-bounce">
                  <Crown className="w-4 h-4 text-amber-300" />
                  <span>Legendary Pull Revealed!</span>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
              ) : spotlightRarity === 'epic' ? (
                <div className="inline-flex items-center space-x-2 px-4 py-1 rounded-full bg-purple-500/25 border border-purple-300 text-purple-200 text-xs sm:text-sm font-black uppercase tracking-widest shadow-[0_0_25px_rgba(192,132,252,0.5)] animate-bounce">
                  <Zap className="w-4 h-4 text-purple-300" />
                  <span>Epic Pull Revealed!</span>
                  <Sparkles className="w-4 h-4 text-purple-300" />
                </div>
              ) : (
                <h3 className="text-base sm:text-xl font-black text-amber-300 tracking-wider uppercase">
                  {allRevealed
                    ? 'All 5 Collectible Cards Revealed!'
                    : `Tap Each Card to Reveal (${revealedCount} / 5)`}
                </h3>
              )}
              <p className="text-[11px] sm:text-xs text-slate-400">
                {allRevealed
                  ? 'Tap any revealed card to inspect its 3D foil artwork and set details'
                  : 'Each card pulses with its rarity aura — watch for Purple Epic & Gold Legendary pulls!'}
              </p>
            </div>

            {/* 5-Card Stage Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 justify-items-center py-1">
              {packResult.cards.map((card, idx) => (
                <FlippableDrawnCard
                  key={`${card.cardId}_${idx}`}
                  card={card}
                  index={idx}
                  isRevealed={revealedIndices[idx]}
                  isJustRevealed={justRevealedIndex === idx}
                  onFlip={() => handleRevealCard(idx)}
                  onInspect={() => {
                    sounds.playUiClick();
                    setInspectedCard(card);
                  }}
                />
              ))}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {!allRevealed ? (
                <>
                  <button
                    onClick={handleRevealNextOrAll}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 cursor-pointer flex items-center gap-2 active:scale-95 transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Reveal Next Card ({revealedCount + 1}/5)</span>
                  </button>
                  <button
                    onClick={handleRevealAll}
                    className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-2 active:scale-95 transition-all"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span>Reveal All 5</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    sounds.playUiClick();
                    setPhase('summary');
                  }}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/30 cursor-pointer flex items-center gap-2 active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Continue to Pack Summary</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* PHASE 3: FINAL PACK SUMMARY + COLLECTION UNLOCKS */}
        {phase === 'summary' && packResult && (
          <div className="py-2 sm:py-3 space-y-5 animate-in fade-in duration-200">
            {/* Newly Unlocked Card Backs / Collection Completions */}
            {packResult.newlyUnlockedCardBacks.length > 0 && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 border-2 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.35)] flex flex-col sm:flex-row items-center justify-between gap-4">
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
                      Permanently unlocked in your Card Back vault.
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
                    <div
                      key={avId}
                      className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900/90 border border-purple-400/40"
                    >
                      <AvatarPortrait avatarId={avId} size="xs" />
                      <span className="text-xs font-bold text-white">{av.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 5 Cards Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 justify-items-center">
              {packResult.cards.map((card, idx) => (
                <FlippableDrawnCard
                  key={`sum_${card.cardId}_${idx}`}
                  card={card}
                  index={idx}
                  isRevealed={true}
                  isJustRevealed={false}
                  onFlip={() => {}}
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
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm shadow-lg cursor-pointer flex items-center gap-2"
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
                  className="px-5 py-3 rounded-xl bg-indigo-600/85 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-2"
                >
                  <Layers className="w-4 h-4" />
                  <span>View Collections</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3D Close-Up Card Showcase Lightbox */}
      {inspectedCard && (
        <CardShowcaseLightbox
          card={inspectedCard}
          onClose={() => {
            sounds.playUiClick();
            setInspectedCard(null);
          }}
        />
      )}
    </div>
  );
};

const FlippableDrawnCard: React.FC<{
  card: DrawnCardResult;
  index: number;
  isRevealed: boolean;
  isJustRevealed?: boolean;
  onFlip: () => void;
  onInspect?: () => void;
}> = ({ card, index, isRevealed, isJustRevealed, onFlip, onInspect }) => {
  const rarity = RARITY_META[card.rarity];
  const col = getCollectionDefinition(card.collectionId);
  const [cardTilt, setCardTilt] = useState<{ rx: number; ry: number; sx: number; sy: number }>({
    rx: 0,
    ry: 0,
    sx: 50,
    sy: 30,
  });

  const isHighTier = card.rarity === 'legendary' || card.rarity === 'epic';

  return (
    <div
      onMouseEnter={() => {
        if (!isRevealed) sounds.playPackHover();
      }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * 100;
        const py = ((e.clientY - rect.top) / rect.height) * 100;
        setCardTilt({
          rx: ((py - 50) / 50) * -10,
          ry: ((px - 50) / 50) * 12,
          sx: px,
          sy: py,
        });
      }}
      onMouseLeave={() => setCardTilt({ rx: 0, ry: 0, sx: 50, sy: 30 })}
      onClick={!isRevealed ? onFlip : onInspect}
      style={{
        perspective: '1100px',
        animationDelay: `${index * 70}ms`,
      }}
      className="group relative w-36 sm:w-42 flex flex-col items-center cursor-pointer select-none animate-in fade-in zoom-in-95 duration-300"
    >
      {/* Rotating Sunbeam Halo Behind Revealed Legendary / Epic Cards */}
      {isRevealed && isHighTier && (
        <div
          className="pointer-events-none absolute -inset-3 rounded-3xl opacity-75 blur-md transition-opacity duration-500"
          style={{
            background:
              card.rarity === 'legendary'
                ? 'conic-gradient(from 0deg, rgba(251,191,36,0.55), rgba(253,224,71,0.1), rgba(251,191,36,0.55), rgba(253,224,71,0.1), rgba(251,191,36,0.55))'
                : 'conic-gradient(from 0deg, rgba(192,132,252,0.5), rgba(232,121,249,0.1), rgba(192,132,252,0.5), rgba(232,121,249,0.1), rgba(192,132,252,0.5))',
          }}
        />
      )}

      <div
        className={`relative w-36 sm:w-42 aspect-[360/510] transition-transform duration-700 ${
          isJustRevealed && isHighTier ? 'scale-105' : ''
        }`}
        style={{
          transformStyle: 'preserve-3d',
          transform: isRevealed
            ? `rotateY(180deg) rotateX(${cardTilt.rx}deg) rotateZ(${cardTilt.ry * 0.15}deg)`
            : `rotateY(0deg) rotateX(${cardTilt.rx}deg) rotateY(${cardTilt.ry}deg)`,
        }}
      >
        {/* CARD BACK (Facedown before click, pulses with rarity aura) */}
        <div
          className={`absolute inset-0 rounded-2xl overflow-hidden border-2 ${rarity.borderClass} bg-slate-950 shadow-xl transition-transform group-hover:-translate-y-1.5`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            boxShadow:
              card.rarity === 'legendary' || card.rarity === 'epic' || card.rarity === 'rare'
                ? rarity.glowStyle
                : undefined,
          }}
        >
          <img
            src="/assets/card-backs/dark_royalty.webp"
            alt="Sealed Collectible Card"
            draggable={false}
            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
          />

          {/* Rarity Shimmer Overlay on Facedown Card */}
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background: `radial-gradient(circle at ${cardTilt.sx}% ${cardTilt.sy}%, ${RARITY_COLOR_MAP[card.rarity]}44 0%, transparent 65%)`,
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/20 to-slate-950/40 flex flex-col items-center justify-end p-2.5">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider border shadow-sm ${rarity.badgeClass}`}
            >
              {rarity.label} Aura
            </span>
            <span className="text-[10px] text-amber-200 font-bold mt-1 flex items-center gap-1 animate-pulse">
              <Sparkles className="w-3 h-3" />
              <span>Tap to Reveal</span>
            </span>
          </div>
        </div>

        {/* CARD FRONT (Revealed Collectible Artwork) */}
        <div
          className={`absolute inset-0 rounded-2xl overflow-hidden border-2 ${rarity.borderClass} bg-slate-950 shadow-2xl flex flex-col`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
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

          {/* Holographic Foil Sheen on Revealed Card */}
          <div
            className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-70"
            style={{
              background: `radial-gradient(circle at ${cardTilt.sx}% ${cardTilt.sy}%, rgba(255,255,255,0.65) 0%, ${RARITY_COLOR_MAP[card.rarity]}33 40%, transparent 72%)`,
            }}
          />

          {/* Top-Left Identity Badge & Top-Right NEW / DUPE Pill */}
          <div className="absolute top-2 inset-x-2 flex items-center justify-between gap-1">
            <span className="px-1.5 py-0.5 rounded-md bg-slate-950/85 border border-white/20 text-[10px] font-black text-amber-300 shadow">
              {card.identity}
            </span>
            {card.wasDuplicate ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-900/90 border border-slate-500 text-slate-200 shadow">
                ×{card.newQuantity}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-400 text-slate-950 shadow-lg animate-pulse">
                NEW!
              </span>
            )}
          </div>

          {/* Bottom Collection Banner */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent p-2.5 text-center">
            <div className={`text-[9px] font-black uppercase tracking-widest ${rarity.textClass}`}>
              {rarity.label}
            </div>
            <div className="text-[11px] sm:text-xs font-black text-white leading-tight truncate">
              {card.name}
            </div>
            <div className="text-[9px] text-slate-300/90 truncate flex items-center justify-center gap-1 mt-0.5">
              <span>{col?.name} Set</span>
              <ZoomIn className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CardShowcaseLightbox: React.FC<{
  card: DrawnCardResult;
  onClose: () => void;
}> = ({ card, onClose }) => {
  const rarity = RARITY_META[card.rarity];
  const col = getCollectionDefinition(card.collectionId);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, sx: 50, sy: 35 });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-sm w-full bg-slate-900/95 border border-slate-700 rounded-3xl p-5 flex flex-col items-center text-center space-y-4 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300"
          title="Close Preview"
        >
          <X className="w-4 h-4" />
        </button>

        <div
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * 100;
            const py = ((e.clientY - rect.top) / rect.height) * 100;
            setTilt({
              rx: ((py - 50) / 50) * -14,
              ry: ((px - 50) / 50) * 16,
              sx: px,
              sy: py,
            });
          }}
          onMouseLeave={() => setTilt({ rx: 0, ry: 0, sx: 50, sy: 35 })}
          className="relative w-56 sm:w-64 aspect-[360/510] rounded-2xl overflow-hidden border-2 transition-transform duration-200"
          style={{
            transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            boxShadow: rarity.glowStyle,
            borderColor: RARITY_COLOR_MAP[card.rarity],
          }}
        >
          <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
          <div
            className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-75"
            style={{
              background: `radial-gradient(circle at ${tilt.sx}% ${tilt.sy}%, rgba(255,255,255,0.75) 0%, transparent 65%)`,
            }}
          />
        </div>

        <div className="space-y-1">
          <span className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${rarity.badgeClass}`}>
            {rarity.label} • Identity {card.identity}
          </span>
          <h4 className="text-lg font-black text-white">{card.name}</h4>
          <p className="text-xs text-amber-300 font-bold">{col?.name} Collection</p>
          {col?.description && (
            <p className="text-xs text-slate-400 max-w-xs mx-auto pt-1">{col.description}</p>
          )}
          <div className="text-[11px] text-slate-400 pt-1">
            Owned in Vault: <strong className="text-white">×{card.newQuantity}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackOpeningModal;
