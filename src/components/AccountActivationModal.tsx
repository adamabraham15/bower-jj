/**
 * BOWER JJ — Professional Account Activation Screen
 * Renders a branded confirmation experience after email verification or expired/scanned link redirects.
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Mail,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Trophy,
  Users,
  History,
  X,
} from 'lucide-react';
import { authService } from '../services/supabaseClient';
import { sounds } from '../audio/sound';

export type AccountActivationStatus = 'verifying' | 'activated' | 'link_used_or_expired';

export interface AccountActivationState {
  status: AccountActivationStatus;
  username?: string;
  email?: string;
  errorMessage?: string;
}

interface AccountActivationModalProps {
  activation: AccountActivationState | null;
  onClose: () => void;
  onOpenSignIn: (prefillEmail?: string) => void;
}

export const AccountActivationModal: React.FC<AccountActivationModalProps> = ({
  activation,
  onClose,
  onOpenSignIn,
}) => {
  const [resendEmail, setResendEmail] = useState(activation?.email || '');
  const [isResending, setIsResending] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  if (!activation) return null;

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = resendEmail.trim();
    if (!targetEmail) {
      setResendFeedback({ ok: false, text: 'Enter the email address you registered with.' });
      return;
    }

    setIsResending(true);
    setResendFeedback(null);
    sounds.playUiClick();

    const { success, error } = await authService.resendConfirmationEmail(targetEmail);
    setIsResending(false);

    if (success) {
      setResendFeedback({
        ok: true,
        text: `Fresh activation email sent to ${targetEmail}. Check your inbox or spam folder.`,
      });
    } else {
      setResendFeedback({
        ok: false,
        text: error || 'Could not resend confirmation email. Try signing in directly if already confirmed.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div
          className={`p-5 flex items-center justify-between shadow-md ${
            activation.status === 'activated'
              ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400'
              : 'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950/30 border border-slate-950/30 flex items-center justify-center shadow-inner">
              {activation.status === 'verifying' ? (
                <Loader2 className="w-5 h-5 text-slate-950 animate-spin" />
              ) : activation.status === 'activated' ? (
                <CheckCircle2 className="w-6 h-6 text-slate-950" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-slate-950" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-950 tracking-wide uppercase leading-tight">
                {activation.status === 'verifying'
                  ? 'Activating Account'
                  : activation.status === 'activated'
                  ? 'Account Activated'
                  : 'Verification Link Status'}
              </h2>
              <p className="text-[11px] text-slate-950/80 font-bold">
                {activation.status === 'verifying'
                  ? 'Confirming your BOWER JJ credentials...'
                  : activation.status === 'activated'
                  ? 'Email verified • Profile ready for play'
                  : 'Already confirmed or link expired'}
              </p>
            </div>
          </div>

          {activation.status !== 'verifying' && (
            <button
              onClick={() => {
                sounds.playUiClick();
                onClose();
              }}
              aria-label="Close activation modal"
              className="p-1.5 rounded-lg bg-slate-950/20 hover:bg-slate-950/35 text-slate-950 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {activation.status === 'verifying' && (
            <div className="py-8 flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              </div>
              <div className="text-sm font-black text-white">Activating your BOWER JJ account...</div>
              <p className="text-xs text-gray-400 max-w-xs">
                Finalizing email verification and syncing your competitive profile. This only takes a moment.
              </p>
            </div>
          )}

          {activation.status === 'activated' && (
            <>
              <div className="flex flex-col items-center text-center space-y-2.5">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border-2 border-emerald-400/60 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Sparkles className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-black text-white tracking-tight">
                  Your Account Has Been Activated!
                </h3>
                <p className="text-xs text-gray-300 leading-relaxed max-w-sm">
                  Welcome to the table{activation.username ? `, ${activation.username}` : ''}! Your email is confirmed and your permanent BOWER JJ profile is active.
                </p>

                {activation.email && (
                  <div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-emerald-300 font-mono">
                    {activation.email}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 text-xs">
                <div className="flex items-center space-x-2.5 text-gray-200">
                  <Trophy className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>Competitive Ranked Play &amp; LP progression unlocked</span>
                </div>
                <div className="flex items-center space-x-2.5 text-gray-200">
                  <Users className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>Friends List, Party Lobbies &amp; Friendly Rivalry active</span>
                </div>
                <div className="flex items-center space-x-2.5 text-gray-200">
                  <History className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Permanent match history &amp; cloud progression synced</span>
                </div>
              </div>

              <button
                onClick={() => {
                  sounds.playUiClick();
                  onClose();
                }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/25 transition-all active:scale-98 flex items-center justify-center space-x-2"
              >
                <span>Continue to BOWER JJ</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {activation.status === 'link_used_or_expired' && (
            <>
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-start space-x-3 text-xs text-amber-100">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1.5 leading-relaxed">
                  <div className="font-black text-amber-300 uppercase tracking-wide text-[11px]">
                    Link Already Used or Expired
                  </div>
                  <p className="text-gray-200">
                    Your account may <strong>already be activated</strong>! Many email providers automatically pre-scan confirmation links for security, which consumes the single-use link while activating your account.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  sounds.playUiClick();
                  onOpenSignIn(resendEmail.trim() || activation.email);
                }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-all active:scale-98 flex items-center justify-center space-x-2"
              >
                <span>Sign In to My Account</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <form onSubmit={handleResend} className="pt-2 border-t border-slate-800 space-y-2.5">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Still need a fresh activation link?
                </div>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                    <input
                      type="email"
                      value={resendEmail}
                      onChange={e => setResendEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isResending}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 disabled:opacity-50 whitespace-nowrap"
                  >
                    {isResending ? 'Sending...' : 'Resend Link'}
                  </button>
                </div>

                {resendFeedback && (
                  <div
                    className={`p-2.5 rounded-xl text-[11px] font-semibold ${
                      resendFeedback.ok
                        ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
                        : 'bg-red-950/60 border border-red-500/40 text-red-200'
                    }`}
                  >
                    {resendFeedback.text}
                  </div>
                )}
              </form>

              <button
                onClick={() => {
                  sounds.playUiClick();
                  onClose();
                }}
                className="w-full py-2 text-center text-xs font-bold text-gray-400 hover:text-white transition-colors"
              >
                Return to Main Menu
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
