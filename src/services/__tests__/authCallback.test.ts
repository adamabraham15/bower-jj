/**
 * Unit tests for Supabase confirmation redirect & activation URL parsing
 */

import { describe, it, expect } from 'vitest';
import { parseAuthRedirectUrl } from '../authCallback';

describe('parseAuthRedirectUrl', () => {
  it('detects scanner-proof token_hash confirmation links', () => {
    const res = parseAuthRedirectUrl('https://bower-jj.vercel.app/?token_hash=pkce_abc123&type=signup');
    expect(res).toEqual({
      kind: 'token_hash',
      tokenHash: 'pkce_abc123',
      otpType: 'signup',
      rawType: 'signup',
    });
  });

  it('detects /activate route token_hash links', () => {
    const res = parseAuthRedirectUrl('https://bower-jj.vercel.app/activate?token_hash=xyz789&type=email');
    expect(res).toEqual({
      kind: 'token_hash',
      tokenHash: 'xyz789',
      otpType: 'email',
      rawType: 'email',
    });
  });

  it('detects implicit hash confirmation success with access_token and type=signup', () => {
    const res = parseAuthRedirectUrl(
      'https://bower-jj.vercel.app/#access_token=jwt_tok&expires_in=3600&refresh_token=ref&token_type=bearer&type=signup'
    );
    expect(res).toEqual({
      kind: 'signup_confirmed',
      hasSessionTokens: true,
      rawType: 'signup',
    });
  });

  it('detects otp_expired / access_denied errors from pre-scanned or double-clicked links', () => {
    const res = parseAuthRedirectUrl(
      'http://localhost:3000/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb='
    );
    expect(res).toEqual({
      kind: 'link_error',
      error: 'access_denied',
      errorCode: 'otp_expired',
      errorDescription: 'Email link is invalid or has expired',
    });
  });

  it('detects PKCE authorization codes cleanly', () => {
    const res = parseAuthRedirectUrl('https://bower-jj.vercel.app/?code=auth_code_123');
    expect(res).toEqual({
      kind: 'pkce_code',
      code: 'auth_code_123',
      rawType: undefined,
    });
  });

  it('detects password recovery links separately from account activation', () => {
    const res = parseAuthRedirectUrl('https://bower-jj.vercel.app/#access_token=tok&type=recovery');
    expect(res.kind).toBe('recovery');
  });

  it('ignores normal menu visits and lobby invite URLs', () => {
    expect(parseAuthRedirectUrl('https://bower-jj.vercel.app/?join=ABC123').kind).toBe('none');
    expect(parseAuthRedirectUrl('https://bower-jj.vercel.app/').kind).toBe('none');
  });
});
