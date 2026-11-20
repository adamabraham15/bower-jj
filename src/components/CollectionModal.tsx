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
import { VaultCollections } from './vault/VaultCollections';
import { sounds } from '../audio/sound';

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'packs' | 'collections' | 'avatars';
  collectionState?: PlayerCollectionState;
  equippedAvatarId: string;
  equippedCardBackId: string;
  equippedTableFeltId?: string;
  waxSealsBalance?: number;
  playerLevel: number;
  playerWins: number;
  onOpenPackModal: () => void;
  onEquipAvatar: (avatarId: string) => void;
  onEquipCardBack: (cardBackId: string) => void;
  onEquipTableFelt?: (feltId: string) => void;
  onUpdateWaxSeals?: (newBalance: number) => void;
  onCardCrafted?: (cardId: string) => void;
}

export const CollectionModal: React.FC<CollectionModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'packs',
  collectionState,
  equippedAvatarId,
  equippedCardBackId,
  equippedTableFeltId = 'midnight_navy',
  waxSealsBalance = 150,
  playerLevel,
  playerWins,
  onOpenPackModal,
  onEquipAvatar,
  onEquipCardBack,
  onEquipTableFelt = () => {},
  onUpdateWaxSeals = () => {},
  onCardCrafted = () => {},
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
      <div className="relative w-full max-w-5xl h-[92dvh] max-h-[92dvh] bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-3 px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-950/80 flex-shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/40 flex-shrink-0">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-xl font-black text-white tracking-wide truncate">
                COLLECTIBLE VAULT &amp; ARMORY
              </h2>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                Lvl {playerLevel} • {totalUniqueCardsOwned}/{totalCardsPossible} Cards • {unlockedCardBackSet.size}/{CARD_BACK_CATALOG.length} Backs • {unlockedAvatarSet.size}/{AVATAR_CATALOG.length} Avatars
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex-shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex-shrink-0 border-b border-slate-800 bg-slate-950/95 px-2 sm:px-6">
          <div className="grid grid-cols-3 sm:flex sm:gap-2">
            <button
              onClick={() => {
                sounds.playUiClick();
                setActiveTab('packs');
              }}
              className={`py-2.5 sm:py-3 px-1 sm:px-4 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'packs'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Card Packs</span>
              <span className="sm:hidden">Packs</span>
              {unopenedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                  {unopenedCount > 99 ? '99+' : unopenedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                sounds.playUiClick();
                setActiveTab('collections');
              }}
              className={`py-2.5 sm:py-3 px-1 sm:px-4 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'collections'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Card Collections &amp; Backs</span>
              <span className="sm:hidden">Collections</span>
            </button>

            <button
              onClick={() => {
                sounds.playUiClick();
                setActiveTab('avatars');
              }}
              className={`py-2.5 sm:py-3 px-1 sm:px-4 text-xs sm:text-sm font-black border-b-2 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'avatars'
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Illustrated Avatars</span>
              <span className="sm:hidden">Avatars</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 pb-16">
          {/* TAB 1: CARD PACKS */}
          {activeTab === 'packs' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/60 border border-amber-500/30 p-3.5 sm:p-7">
                <div className="flex flex-row items-center sm:items-start gap-3.5 sm:gap-6">
                  {/* Booster Pack Artwork */}
                  <div className="relative w-24 sm:w-44 aspect-[520/740] flex-shrink-0">
                    <img
                      src={PACK_ARTWORK_URL}
                      alt="Bower JJ Booster Pack"
                      className={`w-full h-full object-cover rounded-xl sm:rounded-2xl border-2 border-amber-400/70 shadow-2xl ${
                        unopenedCount > 0 ? '' : 'grayscale opacity-60'
                      }`}
                    />
                    <div className="absolute -top-2 -right-2 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] sm:text-xs shadow-lg border-2 border-slate-950">
                      x{unopenedCount}
                    </div>
                  </div>

                  {/* Content & Action */}
                  <div className="flex-1 min-w-0 space-y-2 sm:space-y-4">
                    <div>
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-amber-400 block">
                        Level-Up Progression Reward
                      </span>
                      <h3 className="text-base sm:text-2xl font-black text-white leading-tight truncate">
                        {unopenedCount > 0
                          ? `${unopenedCount} Unopened Pack${unopenedCount > 1 ? 's' : ''}`
                          : 'Earn Card Packs by Leveling Up'}
                      </h3>
                      <p className="text-[11px] sm:text-sm text-slate-300 mt-1 leading-relaxed hidden sm:block">
                        Every qualifying Level-Up awards 1 sealed Collectible Card Pack containing 5 illustrated cards.
                        Collect all 5 unique identities (<strong className="text-amber-300">10, J, Q, K, A</strong>) of any
                        collection to permanently unlock its signature Card Back!
                      </p>
                      <p className="text-[10px] text-slate-400 sm:hidden">
                        5 cards per pack • Collect 10, J, Q, K, A to unlock signature Card Backs!
                      </p>
                    </div>

                    {/* Drop Rate Odds */}
                    <div className="flex flex-wrap gap-1 sm:gap-2">
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
                          className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[9px] sm:text-[11px] font-bold border ${RARITY_META[tier].badgeClass}`}
                        >
                          {RARITY_META[tier].label}: {rate}%
                        </span>
                      ))}
                    </div>

                    {/* Action CTA */}
                    <div className="pt-1 flex flex-wrap items-center gap-2 sm:gap-3">
                      {unopenedCount > 0 ? (
                        <button
                          onClick={() => {
                            sounds.playUiClick();
                            onOpenPackModal();
                          }}
                          className="w-full sm:w-auto px-4 sm:px-7 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm shadow-[0_0_24px_rgba(245,158,11,0.45)] cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Sparkles className="w-4 h-4 flex-shrink-0" />
                          <span>Open Card Pack Now</span>
                        </button>
                      ) : (
                        <div className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] sm:text-xs text-slate-300 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                          <span>Next Pack at Level {playerLevel + 1}</span>
                        </div>
                      )}
                      <button
                        onClick={() => setActiveTab('collections')}
                        className="hidden sm:inline-flex px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-sm cursor-pointer"
                      >
                        Browse All 10 Collections
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Pack Drops Log */}
              <div className="space-y-2.5 sm:space-y-3">
                <h4 className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-400">
                  Recent Pack Openings
                </h4>
                {!collectionState?.recentDrops || collectionState.recentDrops.length === 0 ? (
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                    No packs opened yet. Open a pack to see your pull history!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
                    {collectionState.recentDrops.slice(0, 6).map((drop) => (
                      <div
                        key={drop.packId}
                        className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5 sm:space-y-2"
                      >
                        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400">
                          <span className="font-bold text-amber-300">
                            {drop.earnedLevel ? `Level ${drop.earnedLevel} Reward Pack` : 'Bonus Pack'}
                          </span>
                          <span>{new Date(drop.openedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {drop.cards.map((c, i) => {
                            const def = getCollectibleCardDefinition(c.cardId);
                            const rm = RARITY_META[c.rarity];
                            return (
                              <span
                                key={`${drop.packId}_${i}`}
                                className={`px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold border ${rm.badgeClass}`}
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
            <div className="space-y-4 sm:space-y-6">
              {/* Starter Card Backs */}
              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-slate-400">
                  Starter Decks (Always Unlocked)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {starterBacks.map((back) => {
                    const isEquipped = canonicalCardBack === back.id;
                    return (
                      <div
                        key={back.id}
                        className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border flex items-center gap-3 bg-slate-950/75 ${
                          isEquipped ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-slate-800'
                        }`}
                      >
                        <img
                          src={back.imageUrl}
                          alt={back.name}
                          className="w-10 h-15 sm:w-14 sm:h-20 rounded-lg object-cover border border-slate-700 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs sm:text-sm font-black text-white truncate">{back.name}</div>
                          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 line-clamp-1">{back.description}</p>
                        </div>
                        <button
                          onClick={() => {
                            sounds.playUiClick();
                            onEquipCardBack(back.id);
                          }}
                          disabled={isEquipped}
                          className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black flex-shrink-0 cursor-pointer transition-all ${
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

              {/* 5-Card Vault Sets, Wax Seal Crafting & Custom Table Felts */}
              <VaultCollections
                collectionState={collectionState}
                equippedCardBackId={canonicalCardBack}
                equippedTableFeltId={equippedTableFeltId}
                waxSealsBalance={waxSealsBalance}
                onEquipCardBack={onEquipCardBack}
                onEquipTableFelt={onEquipTableFelt}
                onUpdateWaxSeals={onUpdateWaxSeals}
                onCardCrafted={onCardCrafted}
              />
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
