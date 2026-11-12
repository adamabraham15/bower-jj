import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractInviteCodeFromUrl } from '../../src/App';
import { MultiplayerClient } from '../../src/services/multiplayerClient';

describe('Invite Link Parsing and Authentication Queue Suite', () => {
  const originalWindow = global.window;

  afterEach(() => {
    global.window = originalWindow;
  });

  describe('extractInviteCodeFromUrl', () => {
    it('extracts uppercase code from query search parameter ?join=ABCDEF', () => {
      (global as any).window = {
        location: {
          search: '?join=ABCDEF',
          hash: '',
          href: 'https://bower-jj.vercel.app/?join=ABCDEF',
        },
      };
      expect(extractInviteCodeFromUrl()).toBe('ABCDEF');
    });

    it('extracts and uppercases lowercase code ?join=ab12cd', () => {
      (global as any).window = {
        location: {
          search: '?join=ab12cd',
          hash: '',
          href: 'https://bower-jj.vercel.app/?join=ab12cd',
        },
      };
      expect(extractInviteCodeFromUrl()).toBe('AB12CD');
    });

    it('extracts code from ?room=F5E4D3', () => {
      (global as any).window = {
        location: {
          search: '?room=F5E4D3',
          hash: '',
          href: 'https://bower-jj.vercel.app/?room=F5E4D3',
        },
      };
      expect(extractInviteCodeFromUrl()).toBe('F5E4D3');
    });

    it('extracts code from hash query string #/?join=789ABC', () => {
      (global as any).window = {
        location: {
          search: '',
          hash: '#/?join=789ABC',
          href: 'https://bower-jj.vercel.app/#/?join=789ABC',
        },
      };
      expect(extractInviteCodeFromUrl()).toBe('789ABC');
    });

    it('extracts code from direct hash parameter #join=123456', () => {
      (global as any).window = {
        location: {
          search: '',
          hash: '#join=123456',
          href: 'https://bower-jj.vercel.app/#join=123456',
        },
      };
      expect(extractInviteCodeFromUrl()).toBe('123456');
    });

    it('handles query parameters mixed with UTM tracking', () => {
      (global as any).window = {
        location: {
          search: '?utm_source=discord&join=B1B2B3&channel=general',
          hash: '',
          href: 'https://bower-jj.vercel.app/?utm_source=discord&join=B1B2B3&channel=general',
        },
      };
      expect(extractInviteCodeFromUrl()).toBe('B1B2B3');
    });

    it('returns null when no room code is present or invalid length', () => {
      (global as any).window = {
        location: {
          search: '',
          hash: '',
          href: 'https://bower-jj.vercel.app/',
        },
      };
      expect(extractInviteCodeFromUrl()).toBeNull();

      (global as any).window = {
        location: {
          search: '?join=short',
          hash: '',
          href: 'https://bower-jj.vercel.app/?join=short',
        },
      };
      expect(extractInviteCodeFromUrl()).toBeNull();
    });
  });

  describe('MultiplayerClient Auth State and Queueing', () => {
    it('buffers joinRoom until client is authenticated', () => {
      const client = new MultiplayerClient();
      expect(client.isAuthed()).toBe(false);
      expect(client.isPendingJoin()).toBe(false);

      client.joinRoom('ABC123');
      expect(client.isPendingJoin()).toBe(true);
      expect(client.getPendingJoinCode()).toBe('ABC123');
    });
  });
});
