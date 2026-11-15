import React, { useMemo, useState } from 'react';
import {
  Package,
  Layers,
  UserCheck,
  Sparkles,
  Check,
  Lock,
  X,
  Trophy,
  Info,
} from 'lucide-react';
import {
  AVATAR_CATALOG,
  CARD_BACK_CATALOG,
  CARD_COLLECTIONS,
  CARD_IDENTITIES,
  COLLECTIBLE_CARDS,
  PACK_ARTWORK_URL,
  RARITY_META,
  getCardBackDefinition,
  getCollectibleCardDefinition,
  resolveAvatarId,
  resolveCardBackId,
} from '../config/collectiblesCatalog';
import { PlayerCollectionState } from '../../server/types';
import { AvatarPortrait } from './AvatarPortrait';
import { sounds } from '../audio/sound';

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'packs' | 'collections' | 'avatars';
  collectionState?: PlayerCollectionState;
  equippedAvatarId: string;
  equippedCardBackId: string;
  playerLevel: number;
  playerWins: number;
  onOpenPackModal: () => void;
  onEquipAvatar: (avatarId: string) => void;
  onEquipCardBack: (cardBackId: string) => void;
}

export const CollectionModal: React.FC<CollectionModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'packs',
  collectionState,
  equippedAvatarId,
  equippedCardBackId,
  playerLevel,
  playerWins,
  onOpenPackModal,
  onEquipAvatar,
  onEquipCardBack,
}) => {
  const [activeTab, setActiveTab] = useState<'packs' | 'collections' | 'avatars'>(initialTab);
  const [avatarFilter, setAvatarFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const canonicalAvatar = resolveAvatarId(equippedAvatarId);
  const canonicalCardBack = resolveCardBackId(equippedCardBackId);

  const ownedCardMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of collectionState?.cards || []) {
      map.set(c.cardId, c.quantity);
    }
    return map;
  }, [collectionState]);

  const unlockedCardBackSet = useMemo(() => {
    const set = new Set<string>(['classic_blue', 'classic_red']);
    for (const id of collectionState?.unlockedCardBacks || []) {
      set.add(resolveCardBackId(id));
    }
    return set;
  }, [collectionState]);

  const unlockedAvatarSet = useMemo(() => {
    const set = new Set<string>();
    for (const av of AVATAR_CATALOG) {
      if (av.unlockedByDefault) set.add(av.id);
      if (av.unlockLevel !== undefined && playerLevel >= av.unlockLevel) set.add(av.id);
      if (av.unlockWins !== undefined && playerWins >= av.unlockWins) set.add(av.id);
      if (av.unlockCollectionId && unlockedCardBackSet.has(av.unlockCollectionId)) set.add(av.id);
    }
    for (const id of collectionState?.unlockedAvatars || []) {
      set.add(resolveAvatarId(id));
    }
    return set;
  }, [collectionState, playerLevel, playerWins, unlockedCardBackSet]);

  if (!isOpen) return null;

  const unopenedCount = collectionState?.unopenedPacksCount ?? 0;
  const dropRates = collectionState?.dropRates || { common: 65, rare: 23, epic: 10, legendary: 2 };
  const totalUniqueCardsOwned = ownedCardMap.size;
  const totalCardsPossible = COLLECTIBLE_CARDS.length;
  const starterBacks = CARD_BACK_CATALOG.filter((b) => b.isStarter);
  const previewCard = previewCardId ? getCollectibleCardDefinition(previewCardId) : null;

  const filteredAvatars = AVATAR_CATALOG.filter((av) => {
    const unlocked = unlockedAvatarSet.has(av.id);
    if (avatarFilter === 'unlocked') return unlocked;
    if (avatarFilter === 'locked') return !unlocked;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-2 sm:p-4">
      <div className="relative w-full max-w-5xl max-h-[92dvh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/40">
              <Layers className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
                COLLECTIBLE VAULT &amp; ARMORY
              </h2>
              <p className="text-xs text-slate-400">
                Level {playerLevel} • {totalUniqueCardsOwned}/{totalCardsPossible} Unique Cards •{' '}
                {unlockedCardBackSet.size}/{CARD_BACK_CATALOG.length} Card Backs •{' '}
                {unlockedAvatarSet.size}/{AVATAR_CATALOG.length} Avatars
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/90 px-4 sm:px-6 gap-2 overflow-x-auto">
          <button
            onClick={() => {
              sounds.playUiClick();
              setActiveTab('packs');
            }}
            className={`px-4 py-3 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'packs'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Card Packs</span>
            {unopenedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
                {unopenedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              sounds.playUiClick();
              setActiveTab('collections');
            }}
            className={`px-4 py-3 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'collections'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Card Collections &amp; Backs</span>
          </button>

          <button
            onClick={() => {
              sounds.playUiClick();
              setActiveTab('avatars');
            }}
            className={`px-4 py-3 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'avatars'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Illustrated Avatars</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: CARD PACKS */}
          {activeTab === 'packs' && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/60 border border-amber-500/30 p-5 sm:p-7 flex flex-col md:flex-row items-center gap-6">
                <div className="relative w-40 sm:w-48 aspect-[520/740] flex-shrink-0">
                  <img
                    src={PACK_ARTWORK_URL}
                    alt="Bower JJ Booster Pack"
                    className={`w-full h-full object-cover rounded-2xl border-2 border-amber-400/70 shadow-2xl ${
                      unopenedCount > 0 ? '' : 'grayscale opacity-60'
                    }`}
                  />
                  <div className="absolute -top-2.5 -right-2.5 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-lg border-2 border-slate-950">
                    x{unopenedCount} Ready
                  </div>
                </div>

                <div className="flex-1 space-y-4 text-center md:text-left">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                      Level-Up Progression Reward
                    </span>
                    <h3 className="text-2xl font-black text-white mt-1">
                      {unopenedCount > 0
                        ? `You have ${unopenedCount} Unopened Card Pack${unopenedCount > 1 ? 's' : ''}!`
                        : 'Earn Card Packs by Leveling Up'}
                    </h3>
                    <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
                      Every qualifying Level-Up awards 1 sealed Collectible Card Pack containing 5 illustrated cards.
                      Collect all 5 unique identities (<strong className="text-amber-300">10, J, Q, K, A</strong>) of any
                      collection to permanently unlock its signature Card Back!
                    </p>
                  </div>

                  {/* Drop Rate Odds */}
                  <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    {(
                      [
                        ['common', dropRates.common],
                        ['rare', dropRates.rare],
                        ['epic', dropRates.epic],
                        ['legendary', dropRates.legendary],
                      ] as const
                    ).map(([tier, rate]) => (
                      <span
                        key={tier}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${RARITY_META[tier].badgeClass}`}
                      >
                        {RARITY_META[tier].label}: {rate}%
                      </span>
                    ))}
                  </div>

                  <div className="pt-1 flex flex-wrap justify-center md:justify-start gap-3">
                    {unopenedCount > 0 ? (
                      <button
                        onClick={() => {
                          sounds.playUiClick();
                          onOpenPackModal();
                        }}
                        className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm shadow-[0_0_24px_rgba(245,158,11,0.45)] cursor-pointer flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Open Card Pack Now</span>
                      </button>
                    ) : (
                      <div className="px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
                        <Info className="w-4 h-4 text-sky-400" />
                        <span>Next Pack unlocks at Level {playerLevel + 1} (1,000 XP per level)</span>
                      </div>
                    )}
                    <button
                      onClick={() => setActiveTab('collections')}
                      className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-sm cursor-pointer"
                    >
                      Browse All 10 Collections
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Pack Drops Log */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Recent Pack Openings
                </h4>
                {!collectionState?.recentDrops || collectionState.recentDrops.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                    No packs opened yet. Open a pack to see your pull history!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {collectionState.recentDrops.slice(0, 6).map((drop) => (
                      <div
                        key={drop.packId}
                        className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-bold text-amber-300">
                            {drop.earnedLevel ? `Level ${drop.earnedLevel} Reward Pack` : 'Bonus Pack'}
                          </span>
                          <span>{new Date(drop.openedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {drop.cards.map((c, i) => {
                            const def = getCollectibleCardDefinition(c.cardId);
                            const rm = RARITY_META[c.rarity];
                            return (
                              <span
                                key={`${drop.packId}_${i}`}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${rm.badgeClass}`}
                              >
                                {def ? def.name : c.cardId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CARD COLLECTIONS & CARD BACKS */}
          {activeTab === 'collections' && (
            <div className="space-y-6">
              {/* Starter Card Backs */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                  Starter Decks (Always Unlocked)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {starterBacks.map((back) => {
                    const isEquipped = canonicalCardBack === back.id;
                    return (
                      <div
                        key={back.id}
                        className={`p-3.5 rounded-2xl border flex items-center gap-3.5 bg-slate-950/75 ${
                          isEquipped ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-slate-800'
                        }`}
                      >
                        <img
                          src={back.imageUrl}
                          alt={back.name}
                          className="w-14 h-20 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-black text-white">{back.name}</div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{back.description}</p>
                        </div>
                        <button
                          onClick={() => {
                            sounds.playUiClick();
                            onEquipCardBack(back.id);
                          }}
                          disabled={isEquipped}
                          className={`px-3.5 py-2 rounded-xl text-xs font-black flex-shrink-0 cursor-pointer transition-all ${
                            isEquipped
                              ? 'bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 cursor-default'
                              : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-white'
                          }`}
                        >
                          {isEquipped ? 'Equipped' : 'Equip'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 10 Collectible Card-Back Sets */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  10 Collectible Card-Back Collections
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {CARD_COLLECTIONS.map((col) => {
                    const rarity = RARITY_META[col.rarity];
                    const ownedCount = CARD_IDENTITIES.filter((id) =>
                      ownedCardMap.has(`${col.id}_${id}`)
                    ).length;
                    const isUnlocked = unlockedCardBackSet.has(col.cardBackId) || ownedCount === 5;
                    const isEquipped = canonicalCardBack === col.cardBackId;

                    return (
                      <div
                        key={col.id}
                        className={`p-4 rounded-2xl border bg-slate-950/85 space-y-4 ${
                          isEquipped
                            ? 'border-amber-400 ring-1 ring-amber-400/50'
                            : isUnlocked
                            ? 'border-emerald-500/50'
                            : 'border-slate-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="relative w-16 h-24 rounded-xl overflow-hidden border border-slate-700 flex-shrink-0">
                              <img
                                src={col.cardBackImageUrl}
                                alt={col.name}
                                className={`w-full h-full object-cover ${
                                  isUnlocked ? '' : 'grayscale brightness-50'
                                }`}
                              />
                              {!isUnlocked && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45">
                                  <Lock className="w-5 h-5 text-slate-200" />
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-black text-white">{col.name}</h4>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${rarity.badgeClass}`}
                                >
                                  {rarity.label}
                                </span>
                                {isUnlocked && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>Unlocked</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-1">{col.description}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="w-32 h-2 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all"
                                    style={{ width: `${(ownedCount / 5) * 100}%` }}
                                  />
                                </div>
                                <span className="text-[11px] font-black text-amber-300">
                                  {ownedCount}/5 Cards
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-center">
                            {isUnlocked ? (
                              <button
                                onClick={() => {
                                  sounds.playUiClick();
                                  onEquipCardBack(col.cardBackId);
                                }}
                                disabled={isEquipped}
                                className={`px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                                  isEquipped
                                    ? 'bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 cursor-default'
                                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg'
                                }`}
                              >
                                {isEquipped ? 'Equipped' : 'Equip Card Back'}
                              </button>
                            ) : (
                              <span className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-400">
                                Collect 5/5 to Unlock Back
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 5 Card Identities Row */}
                        <div className="grid grid-cols-5 gap-2 sm:gap-3">
                          {CARD_IDENTITIES.map((ident) => {
                            const cardId = `${col.id}_${ident}`;
                            const def = getCollectibleCardDefinition(cardId)!;
                            const qty = ownedCardMap.get(cardId) || 0;
                            const cRarity = RARITY_META[def.rarity];

                            return (
                              <button
                                key={cardId}
                                onClick={() => {
                                  if (qty > 0) setPreviewCardId(cardId);
                                }}
                                className={`relative rounded-xl overflow-hidden border transition-all text-left group ${
                                  qty > 0
                                    ? `${cRarity.borderClass} bg-slate-900 cursor-pointer hover:scale-[1.03]`
                                    : 'border-slate-800 bg-slate-900/40 cursor-default opacity-50'
                                }`}
                              >
                                <div className="aspect-[360/510] w-full relative">
                                  <img
                                    src={def.imageUrl}
                                    alt={def.name}
                                    loading="lazy"
                                    className={`w-full h-full object-cover ${qty > 0 ? '' : 'grayscale brightness-40'}`}
                                  />
                                  {qty === 0 && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/55">
                                      <Lock className="w-3.5 h-3.5 text-slate-400 mb-0.5" />
                                      <span className="text-[10px] font-black text-slate-300">{ident}</span>
                                    </div>
                                  )}
                                  {qty > 1 && (
                                    <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-slate-950/90 border border-amber-400/60 text-[9px] font-black text-amber-300">
                                      x{qty}
                                    </span>
                                  )}
                                </div>
                                <div className="p-1.5 text-center bg-slate-950/95">
                                  <div className="text-[10px] font-bold text-white truncate">
                                    {def.identityName}
                                  </div>
                                  <div className={`text-[9px] font-black ${cRarity.textClass}`}>
                                    {cRarity.label}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ILLUSTRATED AVATARS */}
          {activeTab === 'avatars' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-400">
                  Earn rare, epic, and legendary portraits by leveling up, winning matches, or completing card collections.
                </p>
                <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['all', 'unlocked', 'locked'] as const).map((flt) => (
                    <button
                      key={flt}
                      onClick={() => setAvatarFilter(flt)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                        avatarFilter === flt
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {flt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredAvatars.map((av) => {
                  const unlocked = unlockedAvatarSet.has(av.id);
                  const isEquipped = canonicalAvatar === av.id;
                  const rarity = RARITY_META[av.rarity];

                  return (
                    <div
                      key={av.id}
                      className={`p-3.5 rounded-2xl border bg-slate-950/85 flex items-center gap-3.5 transition-all ${
                        isEquipped
                          ? 'border-amber-400 ring-1 ring-amber-400/50'
                          : unlocked
                          ? 'border-slate-700 hover:border-slate-500'
                          : 'border-slate-800/80 opacity-75'
                      }`}
                    >
                      <AvatarPortrait avatarId={av.id} size="lg" locked={!unlocked} showRarityGem />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-black text-white truncate">{av.name}</span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black border ${rarity.badgeClass}`}>
                            {rarity.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-300/90 font-semibold mt-0.5">
                          {av.theme} • {av.titleTag}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          {!unlocked && <Trophy className="w-3 h-3 text-slate-500 flex-shrink-0" />}
                          <span>{av.unlockHint}</span>
                        </div>
                        {unlocked && (
                          <button
                            onClick={() => {
                              sounds.playUiClick();
                              onEquipAvatar(av.id);
                            }}
                            disabled={isEquipped}
                            className={`mt-2 px-3 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                              isEquipped
                                ? 'bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 cursor-default'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            }`}
                          >
                            {isEquipped ? 'Equipped' : 'Equip Avatar'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Card Zoom Preview */}
      {previewCard && (
        <div
          onClick={() => setPreviewCardId(null)}
          className="fixed inset-0 z-[60] bg-slate-950/90 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-xs w-full bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-4 space-y-3 text-center shadow-2xl"
          >
            <img
              src={previewCard.imageUrl}
              alt={previewCard.name}
              className="w-full rounded-2xl border border-slate-700 shadow-lg"
            />
            <div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${RARITY_META[previewCard.rarity].badgeClass}`}>
                {RARITY_META[previewCard.rarity].label}
              </span>
              <h4 className="text-lg font-black text-white mt-1.5">{previewCard.name}</h4>
              <p className="text-xs text-slate-400">
                {previewCard.collectionName} Collection • Owned: x{ownedCardMap.get(previewCard.id) || 0}
              </p>
            </div>
            <button
              onClick={() => setPreviewCardId(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionModal;
