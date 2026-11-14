import React from 'react';

/**
 * Prominent pill badge placed on the current dealer's table avatar so it stands out immediately.
 */
export const DealerAvatarBadge: React.FC = () => (
  <div
    title="Current Dealer"
    className="absolute -top-2 -right-3 px-1.5 py-0.5 rounded-full bg-amber-400 border-2 border-slate-900 text-slate-950 font-black text-[8px] sm:text-[9px] leading-none tracking-wider shadow-lg shadow-amber-500/30 uppercase"
  >
    DEALER
  </div>
);

interface ModalDealerBannerProps {
  dealerName: string;
  dealerAvatar?: string;
  isSelfDealer: boolean;
  isPartnerDealer: boolean;
}

/**
 * Displays who currently holds the deal right inside Round 1 / Round 2 bidding overlays,
 * since the modal backdrop can obscure table badges on smaller viewports.
 */
export const ModalDealerBanner: React.FC<ModalDealerBannerProps> = ({
  dealerName,
  dealerAvatar,
  isSelfDealer,
  isPartnerDealer,
}) => {
  const containerTheme = isSelfDealer
    ? 'bg-amber-500/15 border-amber-400/60 text-amber-100'
    : isPartnerDealer
    ? 'bg-emerald-500/10 border-emerald-400/50 text-emerald-100'
    : 'bg-rose-500/10 border-rose-400/50 text-rose-100';

  const relationTheme = isSelfDealer
    ? 'bg-amber-400/20 text-amber-300'
    : isPartnerDealer
    ? 'bg-emerald-400/20 text-emerald-300'
    : 'bg-rose-400/20 text-rose-300';

  return (
    <div
      className={`w-full px-3 py-2 rounded-2xl border flex items-center justify-between gap-2 text-xs ${containerTheme}`}
    >
      <div className="flex items-center space-x-2 min-w-0">
        <span className="px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wider flex-shrink-0 shadow-sm">
          Dealer
        </span>
        {dealerAvatar && <span className="text-sm flex-shrink-0">{dealerAvatar}</span>}
        <span className="font-bold truncate">{isSelfDealer ? 'You' : dealerName}</span>
      </div>
      <span
        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${relationTheme}`}
      >
        {isSelfDealer ? 'You Deal' : isPartnerDealer ? 'Partner' : 'Opponent'}
      </span>
    </div>
  );
};

interface GoAloneControlProps {
  allowAloneCalls: boolean;
  checked: boolean;
  forcedCanadianLoner?: boolean;
  onChange: (checked: boolean) => void;
  pointsLabel?: string;
}

/**
 * Shared Go Alone toggle used in bidding overlays. Automatically checks and locks the checkbox
 * with an explanation banner when Canadian Loner forces going alone on a partner order-up.
 */
export const GoAloneControl: React.FC<GoAloneControlProps> = ({
  allowAloneCalls,
  checked,
  forcedCanadianLoner = false,
  onChange,
  pointsLabel = ' (+4 Pts)',
}) => {
  if (!allowAloneCalls) return null;

  return (
    <div className="w-full flex flex-col items-center space-y-2">
      {forcedCanadianLoner && (
        <div className="w-full p-2.5 bg-amber-500/15 border border-amber-400/60 rounded-xl text-[11px] text-amber-200 text-center font-bold leading-snug">
          🇨🇦 Canadian Loner: Ordering up your partner automatically means you{' '}
          <strong className="text-amber-300">Go Alone!</strong> Your partner sits this hand out.
        </div>
      )}

      <label
        className={`flex items-center justify-center space-x-2 px-3 py-1.5 rounded-xl border transition-colors ${
          forcedCanadianLoner
            ? 'bg-amber-500/15 border-amber-400/70 cursor-not-allowed'
            : 'bg-slate-800/80 border-slate-700 hover:border-amber-400 cursor-pointer'
        }`}
      >
        <input
          type="checkbox"
          checked={forcedCanadianLoner || checked}
          disabled={forcedCanadianLoner}
          onChange={e => onChange(e.target.checked)}
          className="rounded text-amber-500 accent-amber-400 focus:ring-0 disabled:opacity-100"
        />
        <span className="text-xs font-bold text-amber-300">Go Alone! 🚀{pointsLabel}</span>
        {forcedCanadianLoner && (
          <span className="text-[9px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md">
            Auto
          </span>
        )}
      </label>
    </div>
  );
};
