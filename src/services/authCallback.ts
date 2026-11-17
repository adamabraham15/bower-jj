/**
 * BOWER JJ — Supabase Email Confirmation & Auth Redirect Callback Parser
 * Captures and classifies auth redirect URLs before Supabase SDK clears hash fragments.
 */

export type AuthRedirectKind =
  | 'none'
  | 'token_hash'
  | 'signup_confirmed'
  | 'pkce_code'
  | 'link_error'
  | 'recovery';

export interface ParsedAuthRedirect {
  kind: AuthRedirectKind;
  tokenHash?: string;
  otpType?: 'signup' | 'email' | 'recovery';
  code?: string;
  hasSessionTokens?: boolean;
  error?: string;
  errorCode?: string;
  errorDescription?: string;
  rawType?: string;
}

const SIGNUP_LIKE_TYPES = new Set(['signup', 'email', 'email_change']);

/**
 * Pure parser for email confirmation, PKCE, token_hash, recovery, and error redirect URLs.
 */
export function parseAuthRedirectUrl(href: string): ParsedAuthRedirect {
  if (!href) return { kind: 'none' };

  try {
    const parsed = new URL(href, 'https://bowerjj.com');
    const searchParams = new URLSearchParams(parsed.search);
    const rawHash = parsed.hash.replace(/^#\/?/, '');
    const hashQuery = rawHash.includes('?') ? rawHash.substring(rawHash.indexOf('?') + 1) : rawHash;
    const hashParams = new URLSearchParams(hashQuery);

    const getParam = (key: string): string | undefined => {
      const fromSearch = searchParams.get(key);
      if (fromSearch !== null && fromSearch !== '') return fromSearch;
      const fromHash = hashParams.get(key);
      if (fromHash !== null && fromHash !== '') return fromHash;
      return undefined;
    };

    const error = getParam('error');
    const errorCode = getParam('error_code');
    const errorDescription = getParam('error_description');

    if (error || errorCode) {
      return {
        kind: 'link_error',
        error,
        errorCode,
        errorDescription,
      };
    }

    const rawType = (getParam('type') || '').toLowerCase();
    const tokenHash = getParam('token_hash');

    if (tokenHash) {
      if (rawType === 'recovery') {
        return {
          kind: 'recovery',
          tokenHash,
          otpType: 'recovery',
          rawType,
        };
      }
      return {
        kind: 'token_hash',
        tokenHash,
        otpType: rawType === 'email' ? 'email' : 'signup',
        rawType: rawType || 'signup',
      };
    }

    if (rawType === 'recovery' || parsed.hash.includes('reset-password')) {
      return {
        kind: 'recovery',
        rawType: rawType || 'recovery',
      };
    }

    const accessToken = getParam('access_token');
    const hasSessionTokens = Boolean(accessToken);

    if (hasSessionTokens && (SIGNUP_LIKE_TYPES.has(rawType) || !rawType)) {
      return {
        kind: 'signup_confirmed',
        hasSessionTokens: true,
        rawType: rawType || 'signup',
      };
    }

    const code = getParam('code');
    if (code) {
      return {
        kind: 'pkce_code',
        code,
        rawType: rawType || undefined,
      };
    }

    if (SIGNUP_LIKE_TYPES.has(rawType)) {
      return {
        kind: 'signup_confirmed',
        hasSessionTokens: false,
        rawType,
      };
    }

    return { kind: 'none' };
  } catch {
    return { kind: 'none' };
  }
}

let capturedRedirect: ParsedAuthRedirect | null = null;

/**
 * Synchronously captures the browser URL auth callback before Supabase initializes and strips hashes.
 */
export function captureInitialAuthRedirect(): ParsedAuthRedirect {
  if (capturedRedirect !== null) return capturedRedirect;

  if (typeof window === 'undefined') {
    capturedRedirect = { kind: 'none' };
    return capturedRedirect;
  }

  capturedRedirect = parseAuthRedirectUrl(window.location.href);
  return capturedRedirect;
}

export function getCapturedAuthRedirect(): ParsedAuthRedirect {
  return captureInitialAuthRedirect();
}

export function clearCapturedAuthRedirect(): void {
  capturedRedirect = { kind: 'none' };
}

/**
 * Strips sensitive auth tokens or stale Supabase error fragments from the address bar cleanly.
 */
export function cleanAuthParamsFromBrowserUrl(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const cleanPath = window.location.pathname === '/activate' ? '/' : (window.location.pathname || '/');
    window.history.replaceState({}, document.title, cleanPath);
  } catch {
    // Ignore history API restrictions in embedded webviews
  }
}

/**
 * Normalizes Supabase Auth / GoTrue errors into readable messages,
 * preventing empty `{}` or `[object Object]` strings from surfacing to players.
 */
export function formatAuthError(err: unknown, fallback: string): string {
  if (!err) return fallback;

  const raw =
    typeof err === 'string'
      ? err
      : typeof (err as any)?.message === 'string'
        ? (err as any).message
        : typeof (err as any)?.error_description === 'string'
          ? (err as any).error_description
          : typeof (err as any)?.msg === 'string'
            ? (err as any).msg
            : '';

  const trimmed = raw.trim();
  const status = typeof (err as any)?.status === 'number' ? (err as any).status : undefined;

  if (!trimmed || trimmed === '{}' || trimmed === '[object Object]') {
    if (status && status >= 500) {
      return 'Account service encountered a database or server error while saving your account. Please try again shortly.';
    }
    return fallback;
  }

  if (trimmed.toLowerCase().includes('database error saving new user')) {
    return 'Account setup could not complete in the database. Please try again shortly.';
  }

  return trimmed;
}
