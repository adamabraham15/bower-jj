/**
 * BOWER JJ — 5-Card Vault Collections & Wax Seal Crafting System
 * Manages thematic 5-card sets (10, J, Q, K, A), set completion celebrations,
 * duplicate Wax Seal conversion, and on-demand card forging.
 */

import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  Award,
  Check,
  Lock,
  Hammer,
  Crown,
  Palette,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  CARD_COLLECTIONS,
  CARD_IDENTITIES,
  COLLECTIBLE_CARDS,
  RARITY_META,
  TABLE_FELTS,
  WAX_SEALS_CONFIG,
  getCraftCost,
  CardCollectionDefinition,
  CardIdentity,
  RarityTier,
  getCardBackDefinition,
  getTableFeltDefinition,
} from '../../config/collectiblesCatalog';
import { PlayerCollectionState } from '../../../server/types';
import { sfx_set_complete, sfx_card_flip, hapticTap, hapticLegendary } from '../../utils/soundEffects';
import { sounds } from '../../audio/sound';

interface VaultCollectionsProps {
  collectionState?: PlayerCollectionState;
  equippedCardBackId: string;
  equippedTableFeltId?: string;
  waxSealsBalance: number;
  onEquipCardBack: (cardBackId: string) => void;
  onEquipTableFelt: (feltId: string) => void;
  onUpdateWaxSeals: (newBalance: number) => void;
  onCardCrafted?: (cardId: string) => void;
}

export const VaultCollections: React.FC<VaultCollectionsProps> = ({
  collectionState,
  equippedCardBackId,
  equippedTableFeltId = 'midnight_navy',
  waxSealsBalance,
  onEquipCardBack,
  onEquipTableFelt,
  onUpdateWaxSeals,
  onCardCrafted,
}) => {
  const [activeThemeId, setActiveThemeId] = useState<string>(CARD_COLLECTIONS[0].id);
  const [completedSetCelebration, setCompletedSetCelebration] = useState<string | null>(null);
  const [craftingAnimationCardId, setCraftingAnimationCardId] = useState<string | null>(null);
  const [inspectedCraftCard, setInspectedCraftCard] = useState<{
    cardId: string;
    identity: CardIdentity;
    col: CardCollectionDefinition;
    rarityTier: RarityTier;
  } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'sets' | 'felts'>('sets');

  // Local state to track forged cards immediately without requiring a page refresh
  const [locallyForgedCards, setLocallyForgedCards] = useState<Set<string>>(new Set());

  // Owned cards map from collection state + locally forged cards
  const ownedCardsMap = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of collectionState?.cards || []) {
      map.set(item.cardId, item.quantity);
    }
    for (const cardId of locallyForgedCards) {
      if (!map.has(cardId)) {
        map.set(cardId, 1);
      }
    }
    return map;
  }, [collectionState, locallyForgedCards]);

  // Set completion map
  const setCompletionStatus = React.useMemo(() => {
    const statusMap = new Map<string, { ownedCount: number; isComplete: boolean }>();
    for (const col of CARD_COLLECTIONS) {
      let count = 0;
      for (const id of CARD_IDENTITIES) {
        if (ownedCardsMap.has(`${col.id}_${id}`)) {
          count++;
        }
      }
      statusMap.set(col.id, {
        ownedCount: count,
        isComplete: count === 5,
      });
    }
    return statusMap;
  }, [ownedCardsMap]);

  // Crafting a missing card using Wax Seals (scaled by rarity: Legendary > Rare > Common)
  const handleCraftCard = (
    cardId: string,
    col: CardCollectionDefinition,
    rarityTier: RarityTier
  ) => {
    const craftCost = getCraftCost(rarityTier);
    if (waxSealsBalance < craftCost) {
      sounds.playUiClick();
      alert(
        `You need ${craftCost} Wax Seals to forge this ${rarityTier.toUpperCase()} card. Current balance: ${waxSealsBalance} Wax Seals.`
      );
      return;
    }

    sounds.playUiClick();
    sfx_card_flip();
    hapticTap();

    // Instant local state update: card appears owned IMMEDIATELY with zero reload
    setLocallyForgedCards((prev) => new Set(prev).add(cardId));
    setCraftingAnimationCardId(cardId);
    setTimeout(() => setCraftingAnimationCardId(null), 1500);

    const newBalance = waxSealsBalance - craftCost;
    onUpdateWaxSeals(newBalance);

    if (onCardCrafted) {
      onCardCrafted(cardId);
    }

    // Check if this completes the set (was 4/5, now 5/5)
    const currentStatus = setCompletionStatus.get(col.id);
    const wasAlreadyComplete = currentStatus?.isComplete;
    const isNowComplete = (currentStatus?.ownedCount || 0) + 1 >= 5;

    if (!wasAlreadyComplete && isNowComplete) {
      triggerSetCompleteCelebration(col);
    }
  };

  const triggerSetCompleteCelebration = (col: CardCollectionDefinition) => {
    setCompletedSetCelebration(col.name);
    sfx_set_complete();
    hapticLegendary();

    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#38bdf8', '#10b981', '#ffffff'],
      });
    } catch {
      // Ignore in non-browser test environment
    }

    // Auto-unlock & equip Signature Card Back & Custom Table Felt
    onEquipCardBack(col.cardBackId);

    // If there is an associated custom table felt, equip it too
    const matchingFelt = TABLE_FELTS.find((f) => f.collectionId === col.id);
    if (matchingFelt) {
      onEquipTableFelt(matchingFelt.id);
    }

    setTimeout(() => {
      setCompletedSetCelebration(null);
    }, 4500);
  };

  const selectedCol = CARD_COLLECTIONS.find((c) => c.id === activeThemeId) || CARD_COLLECTIONS[0];
  const colStatus = setCompletionStatus.get(selectedCol.id) || { ownedCount: 0, isComplete: false };

  return (
    <div className="space-y-6">
      {/* Top Currency & Category Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#141b2a] border border-slate-700/80 shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sounds.playUiClick();
              setActiveSubTab('sets');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'sets'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            The 5-Card Vault Sets
          </button>
          <button
            onClick={() => {
              sounds.playUiClick();
              setActiveSubTab('felts');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'felts'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Custom Table Felts
          </button>
        </div>

        {/* Wax Seals Balance & Crafting Info */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/40 border border-amber-500/50 shadow-inner">
          <span className="text-base">🪙</span>
          <div>
            <div className="text-[10px] font-bold text-amber-300/80 uppercase leading-none">Wax Seals (Dust)</div>
            <div className="text-sm font-black text-amber-300 leading-tight">
              {waxSealsBalance} <span className="text-xs text-slate-400 font-semibold">• Forging Costs: 10 (40) • Q/K (100) • Bower/Ace (350)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Celebration Banner Overlay if Set Just Completed */}
      {completedSetCelebration && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/30 via-yellow-400/20 to-amber-500/30 border-2 border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.5)] flex items-center justify-between animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-2xl shadow-lg animate-bounce">
              👑
            </div>
            <div>
              <div className="text-xs font-black text-amber-300 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>SET COMPLETE!</span>
              </div>
              <h3 className="text-lg font-black text-white">{completedSetCelebration} 5/5 Finished</h3>
              <p className="text-xs text-slate-300">
                Signature Card Back and Custom Table Felt unlocked &amp; equipped!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* VIEW A: THE 5-CARD VAULT SETS */}
      {activeSubTab === 'sets' && (
        <div className="space-y-5">
          {/* Theme Selector Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {CARD_COLLECTIONS.map((col) => {
              const status = setCompletionStatus.get(col.id);
              const isSelected = col.id === activeThemeId;
              return (
                <button
                  key={col.id}
                  onClick={() => {
                    sounds.playUiClick();
                    setActiveThemeId(col.id);
                  }}
                  className={`px-3 py-2 rounded-xl border text-left flex items-center gap-2 flex-shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1b263b] border-amber-400 text-white shadow-md'
                      : 'bg-[#121926] border-slate-800 text-slate-400 hover:text-white hover:bg-[#162030]'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: col.accentHex }}
                  />
                  <span className="text-xs font-black whitespace-nowrap">{col.name}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      status?.isComplete
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {status?.ownedCount}/5
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Set Card Showcase */}
          <div className="rounded-3xl bg-[#121826] border border-slate-700/80 p-4 sm:p-6 space-y-5 relative overflow-hidden">
            {/* Glowing Set Complete Wax Stamp (When 5/5 complete) */}
            {colStatus.isComplete && (
              <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(251,191,36,0.6)] border border-amber-200 animate-in zoom-in-75">
                <span>★</span>
                <span>SET COMPLETE</span>
                <span>★</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 block">
                  {selectedCol.theme}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white">{selectedCol.name} Collection</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedCol.description}</p>
              </div>

              {/* Reward Signature Card Back preview */}
              <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#0f1420] border border-slate-800 flex-shrink-0">
                <img
                  src={selectedCol.cardBackImageUrl}
                  alt={selectedCol.name}
                  className="w-10 h-14 rounded-lg object-cover border border-amber-400/40 shadow"
                />
                <div className="text-left">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Set Completion Reward</div>
                  <div className="text-xs font-black text-white">{selectedCol.name} Back</div>
                  {colStatus.isComplete ? (
                    <button
                      onClick={() => onEquipCardBack(selectedCol.cardBackId)}
                      className={`text-[10px] font-black mt-1 px-2 py-0.5 rounded cursor-pointer ${
                        equippedCardBackId === selectedCol.cardBackId
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                      }`}
                    >
                      {equippedCardBackId === selectedCol.cardBackId ? 'Equipped' : 'Equip Back'}
                    </button>
                  ) : (
                    <span className="text-[10px] text-amber-400 font-bold block mt-0.5">
                      Collect 5/5 to Unlock
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* The 5 Cards Grid: 10, Jack, Queen, King, Ace */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 pt-2">
              {CARD_IDENTITIES.map((identity) => {
                const cardId = `${selectedCol.id}_${identity}`;
                const isOwned = ownedCardsMap.has(cardId);
                const quantity = ownedCardsMap.get(cardId) || 0;
                const rarityTier = selectedCol.cardRarities[identity];
                const rarity = RARITY_META[rarityTier];
                const craftCost = getCraftCost(rarityTier);
                const isCraftingThis = craftingAnimationCardId === cardId;

                return (
                  <div
                    key={cardId}
                    onClick={() => {
                      sounds.playUiClick();
                      setInspectedCraftCard({
                        cardId,
                        identity,
                        col: selectedCol,
                        rarityTier,
                      });
                    }}
                    className={`relative rounded-2xl p-2.5 border flex flex-col justify-between transition-all cursor-pointer group ${
                      isCraftingThis
                        ? 'ring-4 ring-amber-400 bg-amber-500/20 scale-105 shadow-[0_0_30px_rgba(251,191,36,0.8)]'
                        : isOwned
                        ? 'bg-[#162032] border-slate-700 shadow-md hover:border-amber-400/80 hover:scale-[1.02]'
                        : 'bg-[#0b101c] border-cyan-500/30 ring-1 ring-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.12)] hover:border-cyan-400 hover:scale-[1.02]'
                    }`}
                  >
                    {/* Top Identity & Quantity Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-6 h-6 rounded-md bg-slate-950 border border-slate-700 flex items-center justify-center font-black text-xs text-white">
                        {identity}
                      </span>
                      {isOwned ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          <span>x{quantity}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-cyan-300 font-bold bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-500/40 flex items-center gap-1 animate-pulse">
                          <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                          <span>Craftable</span>
                        </span>
                      )}
                    </div>

                    {/* Card Visual / Thumbnail */}
                    <div className="relative w-full aspect-[360/480] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 mb-2.5 flex items-center justify-center">
                      <img
                        src={`/assets/cards/${cardId}.webp`}
                        alt={`${identity} of ${selectedCol.name}`}
                        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                          !isOwned ? 'opacity-40 grayscale-[40%] contrast-125' : ''
                        }`}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      {!isOwned && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center bg-radial from-cyan-950/80 via-slate-950/85 to-slate-950">
                          <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center mb-1 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                            <Hammer className="w-4 h-4 text-cyan-300" />
                          </div>
                          <span className="text-[10px] font-black text-cyan-200 uppercase tracking-wider">
                            {rarity.label}
                          </span>
                          <span className="text-[9px] text-amber-300 font-bold mt-0.5">
                            {craftCost} Wax Seals
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card Title & Rarity */}
                    <div className="text-left mb-2">
                      <div className={`text-[9px] font-black uppercase ${rarity.textClass}`}>
                        {rarity.label}
                      </div>
                      <div className="text-xs font-black text-white truncate">
                        {identity === 'J' ? 'Jack (Bower)' : `${identity} of ${selectedCol.name}`}
                      </div>
                    </div>

                    {/* Crafting Button if missing */}
                    {!isOwned ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCraftCard(cardId, selectedCol, rarityTier);
                        }}
                        disabled={waxSealsBalance < craftCost}
                        className={`w-full py-1.5 px-2 rounded-xl text-[10px] font-black flex items-center justify-center gap-1 transition-all ${
                          waxSealsBalance >= craftCost
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 cursor-pointer shadow-md active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <Hammer className="w-3 h-3" />
                        <span>Forge ({craftCost} 🪙)</span>
                      </button>
                    ) : (
                      <div className="w-full py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[10px] text-center flex items-center justify-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>In Vault</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: CUSTOM TABLE FELTS */}
      {activeSubTab === 'felts' && (
        <div className="space-y-4">
          <div className="text-left">
            <h3 className="text-lg font-black text-white">Custom Table Felts</h3>
            <p className="text-xs text-slate-400">
              Customize your playing surface across solo and multiplayer matches.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {TABLE_FELTS.map((felt) => {
              const isEquipped = equippedTableFeltId === felt.id;
              const isUnlocked =
                felt.unlockedByDefault ||
                (felt.collectionId && setCompletionStatus.get(felt.collectionId)?.isComplete);

              return (
                <div
                  key={felt.id}
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                    isEquipped
                      ? 'bg-[#182338] border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                      : 'bg-[#121826] border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div>
                    {/* Felt Swatch & Texture preview */}
                    <div
                      className="w-full h-24 rounded-xl mb-3 border relative overflow-hidden flex items-center justify-center shadow-inner"
                      style={{
                        background: felt.bgGradient,
                        borderColor: felt.feltBorder,
                      }}
                    >
                      <div
                        className="w-16 h-16 rounded-full border border-dashed opacity-40"
                        style={{ borderColor: felt.feltBorder }}
                      />
                      {isEquipped && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] shadow">
                          Equipped
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-sm text-white">{felt.name}</h4>
                      <span className="text-[10px] font-bold uppercase text-slate-400">{felt.theme}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{felt.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800">
                    {isUnlocked ? (
                      <button
                        onClick={() => {
                          sounds.playUiClick();
                          onEquipTableFelt(felt.id);
                        }}
                        className={`w-full py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                          isEquipped
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md'
                        }`}
                      >
                        {isEquipped ? 'Currently Active' : 'Equip Felt'}
                      </button>
                    ) : (
                      <div className="text-[11px] text-amber-400 font-bold flex items-center gap-1.5 justify-center py-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Complete {felt.collectionId?.replace('_', ' ').toUpperCase()} Set</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hearthstone-Style Crafting Pedestal Lightbox */}
      {inspectedCraftCard && (() => {
        const { cardId, identity, col, rarityTier } = inspectedCraftCard;
        const isOwned = ownedCardsMap.has(cardId);
        const quantity = ownedCardsMap.get(cardId) || 0;
        const rarity = RARITY_META[rarityTier];
        const craftCost = getCraftCost(rarityTier);
        const canAfford = waxSealsBalance >= craftCost;

        return (
          <div
            onClick={() => setInspectedCraftCard(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-slate-900 via-[#0d1424] to-slate-950 border-2 border-cyan-500/50 p-5 shadow-[0_0_50px_rgba(6,182,212,0.35)] flex flex-col items-center text-center space-y-4"
            >
              <button
                onClick={() => setInspectedCraftCard(null)}
                className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Top Arcane Rune / Mode Header */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/50 shadow-inner">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span className="text-[11px] font-black uppercase tracking-wider text-cyan-200">
                  {isOwned ? 'Vault Showcase' : 'Hearthstone Crafting Pedestal'}
                </span>
              </div>

              {/* Floating 3D Card Artwork with Glowing Aura */}
              <div className="relative w-44 aspect-[360/500] rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-[0_0_30px_rgba(245,158,11,0.4)] group">
                <img
                  src={`/assets/cards/${cardId}.webp`}
                  alt={col.name}
                  className={`w-full h-full object-cover ${!isOwned ? 'contrast-115' : ''}`}
                />
                <div
                  className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-60"
                  style={{
                    background: `radial-gradient(circle at 50% 30%, rgba(255,255,255,0.7) 0%, transparent 60%)`,
                  }}
                />
                {/* Rarity Monogram Badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/90 border border-white/20 text-xs font-black text-amber-300">
                  {identity}
                </div>
              </div>

              {/* Title & Lore */}
              <div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${rarity.textClass}`}>
                  {rarity.label} Rarity
                </span>
                <h3 className="text-lg font-black text-white mt-0.5">
                  {identity === 'J' ? 'Jack (The Bower)' : `${identity} of ${col.name}`}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{col.name} 5-Card Vault Set</p>
              </div>

              {/* Status or Craft Action */}
              {isOwned ? (
                <div className="w-full p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Unlocked in Vault</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-black">
                    x{quantity}
                  </span>
                </div>
              ) : (
                <div className="w-full space-y-2.5">
                  <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-300">
                    <span>Forging Cost:</span>
                    <span className="text-amber-300 font-black flex items-center gap-1">
                      🪙 {craftCost} Wax Seals
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-2 text-[11px] font-medium text-slate-400">
                    <span>Your Balance:</span>
                    <span className="font-mono text-white">{waxSealsBalance} Wax Seals</span>
                  </div>

                  <button
                    onClick={() => handleCraftCard(cardId, col, rarityTier)}
                    disabled={!canAfford}
                    className={`w-full py-3 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all shadow-lg ${
                      canAfford
                        ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 shadow-amber-500/30 cursor-pointer active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    <Hammer className="w-4 h-4" />
                    <span>
                      {canAfford ? `Forge Card (${craftCost} Seals)` : `Need ${craftCost - waxSealsBalance} More Seals`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default VaultCollections;
