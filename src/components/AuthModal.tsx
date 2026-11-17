/**
 * BOWER JJ — Production Authentication Modal
 * Supabase Auth: Simple Username & Password (No Email required).
 * Supports new user registration and existing user account login.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { authService, isSupabaseConfigured } from '../services/supabaseClient';
import { AvatarPortrait } from './AvatarPortrait';
import { sounds } from '../audio/sound';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: any, token?: string) => void;
  onContinueAsGuest: () => void;
  onSignupActivated?: (user: any, token?: string) => void;
  initialTab?: 'login' | 'register';
  initialEmail?: string;
  reason?: string;
}

const STARTER_AVATARS = [
  { id: 'the_outlaw', name: 'The Outlaw' },
  { id: 'elven_trickster', name: 'Elven Trickster' },
  { id: 'cyber_bot', name: 'Cyber Bot' },
  { id: 'clever_fox', name: 'Clever Fox' },
  { id: 'velvet_gentleman', name: 'Velvet Gentleman' },
  { id: 'iron_tactician', name: 'Iron Tactician' },
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  onContinueAsGuest,
  onSignupActivated,
  initialTab = 'register',
  initialEmail,
  reason,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab === 'login' ? 'login' : 'register');
  const [username, setUsername] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('the_outlaw');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUsernameValidating, setIsUsernameValidating] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'available' | 'taken' | 'invalid' | null>(null);

  // Sync initial tab & username when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialTab) setTab(initialTab === 'login' ? 'login' : 'register');
      if (initialEmail) setUsername(initialEmail);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialTab, initialEmail]);

  // Debounced username availability check for registration
  useEffect(() => {
    if (tab !== 'register' || !username.trim()) {
      setUsernameStatus(null);
      return;
    }

    const clean = username.trim();
    if (clean.length < 3 || clean.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(clean)) {
      setUsernameStatus('invalid');
      return;
    }

    const timer = setTimeout(async () => {
      setIsUsernameValidating(true);
      const available = await authService.isUsernameAvailable(clean);
      setIsUsernameValidating(false);
      setUsernameStatus(available ? 'available' : 'taken');
    }, 350);

    return () => clearTimeout(timer);
  }, [username, tab]);

  if (!isOpen) return null;

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setUsernameStatus(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = username.trim();
    if (!cleanName || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    sounds.playUiClick();

    const { user, session, error } = await authService.login(cleanName, password);
    setIsLoading(false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    if (user && session) {
      sounds.playVictoryFanfare();
      onAuthSuccess(user, session.access_token);
      onClose();
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = username.trim();
    if (!cleanName || !password) {
      setErrorMessage('Please choose a username and password.');
      return;
    }

    if (cleanName.length < 3 || cleanName.length > 20) {
      setErrorMessage('Username must be between 3 and 20 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(cleanName)) {
      setErrorMessage('Username can only contain letters, numbers, underscores, and hyphens.');
      return;
    }

    if (usernameStatus === 'taken') {
      setErrorMessage(`Username "${cleanName}" is already taken.`);
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your password.');
      return;
    }

    setIsLoading(true);
    sounds.playUiClick();

    const { user, session, error } = await authService.register(
      cleanName,
      password,
      selectedAvatar
    );
    setIsLoading(false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    if (user) {
      sounds.playVictoryFanfare();
      onAuthSuccess(user, session?.access_token);
      onSignupActivated?.(user, session?.access_token);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header Ribbon */}
        <div className="relative bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 p-4 sm:p-5 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-950/40 border border-slate-900/50 flex items-center justify-center text-white shadow-inner">
              <ShieldCheck className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-950 tracking-wide uppercase leading-tight">
                {tab === 'login' ? 'Player Sign In' : 'Create Account'}
              </h2>
              <p className="text-[11px] text-amber-950 font-bold">
                {tab === 'login'
                  ? 'Access your BOWER JJ profile, stats & rank'
                  : 'Join competitive matchmaking & save progress'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sounds.playUiClick();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-950/20 hover:bg-slate-950/40 text-slate-950 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reason Prompt Banner */}
        {reason && (
          <div className="px-4 py-2.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-xs font-semibold flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="leading-tight">{reason}</span>
          </div>
        )}

        {/* Supabase Status Notice */}
        {!isSupabaseConfigured && (
          <div className="px-5 py-2.5 bg-blue-950/40 border-b border-blue-800/40 text-[11px] text-blue-200 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>Offline mode active. Local guest play is supported.</span>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 text-xs font-black">
          <button
            onClick={() => {
              sounds.playUiClick();
              setTab('login');
              resetForm();
            }}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${
              tab === 'login'
                ? 'border-amber-400 text-amber-400 bg-slate-800/40'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            SIGN IN
          </button>
          <button
            onClick={() => {
              sounds.playUiClick();
              setTab('register');
              resetForm();
            }}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${
              tab === 'register'
                ? 'border-amber-400 text-amber-400 bg-slate-800/40'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            CREATE ACCOUNT
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-950/50 border border-red-500/50 rounded-2xl flex items-start space-x-2 text-xs text-red-200 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-500/50 rounded-2xl flex items-start space-x-2 text-xs text-emerald-200 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* SIGN IN TAB */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase mb-1">
                  Account Name (Username)
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
              >
                {isLoading ? (
                  <span className="animate-pulse">Signing In...</span>
                ) : (
                  <>
                    <span>Sign In to Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* REGISTER TAB */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[11px] font-bold text-gray-300 uppercase">
                    Choose Username
                  </label>
                  {isUsernameValidating && (
                    <span className="text-[10px] text-gray-400 animate-pulse font-mono">Checking...</span>
                  )}
                  {usernameStatus === 'available' && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Available</span>
                    </span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className="text-[10px] text-red-400 font-bold flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Taken</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="BowerChampion"
                    required
                    maxLength={20}
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase mb-1">
                  Choose Password (min. 6 characters)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Starter Avatar Picker */}
              <div>
                <label className="block text-[11px] font-bold text-gray-300 uppercase mb-1.5">
                  Choose Your Starter Avatar
                </label>
                <div className="grid grid-cols-6 gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                  {STARTER_AVATARS.map(avatar => {
                    const isSelected = selectedAvatar === avatar.id;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => {
                          sounds.playUiClick();
                          setSelectedAvatar(avatar.id);
                        }}
                        className={`relative rounded-xl p-1 transition-all flex flex-col items-center group ${
                          isSelected
                            ? 'ring-2 ring-amber-400 bg-amber-400/10 scale-105'
                            : 'hover:bg-slate-800/60 opacity-80 hover:opacity-100'
                        }`}
                        title={avatar.name}
                      >
                        <AvatarPortrait avatarId={avatar.id} size="sm" shape="rounded" />
                        <span className="text-[9px] font-semibold text-gray-300 truncate w-full text-center mt-1">
                          {avatar.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || usernameStatus === 'taken'}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
              >
                {isLoading ? (
                  <span className="animate-pulse">Creating Account...</span>
                ) : (
                  <>
                    <span>Create Free Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative py-2 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <span className="relative px-3 bg-slate-900 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Or
            </span>
          </div>

          {/* Guest Play Button */}
          <button
            onClick={() => {
              sounds.playUiClick();
              onContinueAsGuest();
              onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-gray-300 hover:text-white font-bold text-xs transition-colors flex items-center justify-center space-x-2"
          >
            <span>Continue as Guest (Local Offline Play)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
