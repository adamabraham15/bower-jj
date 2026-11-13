import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractInviteCodeFromUrl } from '../../src/App';
import { MultiplayerClient } from '../../src/services/multiplayerClient';
import { RoomManager } from '../roomManager';
import { ServerMessage } from '../types';

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

    it('sets isPendingJoin when party invite is sent until ROOM_UPDATE is received', () => {
      const client = new MultiplayerClient();
      expect(client.isPendingJoin()).toBe(false);

      // Inviting friend before room is created sets pending party create flag
      client.sendPartyInvite('friend_user_456', 'rivals');
      expect(client.isPendingJoin()).toBe(true);

      // When ROOM_UPDATE arrives, pending status clears and currentRoom is populated
      (client as any).handleMessage({
        type: 'ROOM_UPDATE',
        room: {
          code: 'RIV123',
          hostUserId: 'inviter_123',
          status: 'lobby',
          rules: {} as any,
          slots: [
            { position: 0, isAI: false, userId: 'inviter_123', username: 'Inviter', avatarIcon: '👑', rankTier: '9', connected: true, isReady: true },
            null, null, null
          ],
          isMatchmade: false,
          queueMode: 'rivals',
          createdAt: Date.now(),
          lastActionAt: Date.now(),
        },
        yourPosition: 0,
      });

      expect(client.isPendingJoin()).toBe(false);
      expect(client.getCurrentRoom()?.code).toBe('RIV123');
      expect(client.getMyPosition()).toBe(0);
    });
  });

  describe('Authoritative Room Invites, Lobby Redirection & Seat Synchronization', () => {
    it('sends ROOM_UPDATE immediately to inviter and PARTY_INVITE_RECEIVED with mode to invitee', () => {
      const rm = new RoomManager();
      const inviterMessages: ServerMessage[] = [];
      const inviteeMessages: ServerMessage[] = [];

      const inviterWs: any = {
        readyState: 1,
        send: (raw: string) => inviterMessages.push(JSON.parse(raw)),
      };
      const inviteeWs: any = {
        readyState: 1,
        send: (raw: string) => inviteeMessages.push(JSON.parse(raw)),
      };

      rm.registerConnection('user_inviter', {
        ws: inviterWs,
        userId: 'user_inviter',
        username: 'InviterPlayer',
        avatarIcon: '👑',
      });
      rm.registerConnection('user_invitee', {
        ws: inviteeWs,
        userId: 'user_invitee',
        username: 'InviteePlayer',
        avatarIcon: '⚔️',
      });

      // Inviter challenges Invitee to a rivals match
      rm.inviteFriendToParty('user_inviter', 'user_invitee', 'rivals');

      // 1. Inviter MUST receive ROOM_UPDATE with their new room and position 0
      const inviterRoomUpdate = inviterMessages.find(m => m.type === 'ROOM_UPDATE') as any;
      expect(inviterRoomUpdate).toBeDefined();
      expect(inviterRoomUpdate.yourPosition).toBe(0);
      expect(inviterRoomUpdate.room.queueMode).toBe('rivals');
      expect(inviterRoomUpdate.room.hostUserId).toBe('user_inviter');

      const roomCode = inviterRoomUpdate.room.code;

      // 2. Invitee MUST receive PARTY_INVITE_RECEIVED with the matching roomCode and mode
      const inviteMsg = inviteeMessages.find(m => m.type === 'PARTY_INVITE_RECEIVED') as any;
      expect(inviteMsg).toBeDefined();
      expect(inviteMsg.fromUsername).toBe('InviterPlayer');
      expect(inviteMsg.roomCode).toBe(roomCode);
      expect(inviteMsg.mode).toBe('rivals');

      // 3. Invitee accepts the invite and joins the exact room
      const joinedRoom = rm.joinRoom('user_invitee', inviteMsg.roomCode);
      expect(joinedRoom.code).toBe(roomCode);
      expect(joinedRoom.slots[0]?.userId).toBe('user_inviter');
      expect(joinedRoom.slots[1]?.userId).toBe('user_invitee'); // Team Red (opposing Host on Team Blue)

      // Both players are in the exact same lobby!
      expect(rm.getRoom(roomCode)?.slots[0]?.username).toBe('InviterPlayer');
      expect(rm.getRoom(roomCode)?.slots[1]?.username).toBe('InviteePlayer');

      rm.cleanup();
    });

    it('allows changing seats between Blue and Red teams in custom mode and cleans up on leaveRoom', () => {
      const rm = new RoomManager();
      const p1Messages: ServerMessage[] = [];
      const p2Messages: ServerMessage[] = [];

      rm.registerConnection('user_p1', {
        ws: { readyState: 1, send: (m: string) => p1Messages.push(JSON.parse(m)) } as any,
        userId: 'user_p1',
        username: 'P1',
        avatarIcon: '🔵',
      });
      rm.registerConnection('user_p2', {
        ws: { readyState: 1, send: (m: string) => p2Messages.push(JSON.parse(m)) } as any,
        userId: 'user_p2',
        username: 'P2',
        avatarIcon: '🔴',
      });

      // P1 creates custom room
      const room = rm.createRoom('user_p1');
      expect(room.slots[0]?.userId).toBe('user_p1'); // Seat 0 (Blue Team)

      // P2 joins room -> assigned to Seat 1 (Red Team)
      rm.joinRoom('user_p2', room.code);
      expect(room.slots[1]?.userId).toBe('user_p2');

      // P2 switches to Seat 2 (Partner on Blue Team with P1)
      rm.switchSeat('user_p2', 2);
      expect(room.slots[1]).toBeNull();
      expect(room.slots[2]?.userId).toBe('user_p2');
      expect(room.slots[0]?.userId).toBe('user_p1');

      // P1 switches to Seat 3 (Red Team)
      rm.switchSeat('user_p1', 3);
      expect(room.slots[0]).toBeNull();
      expect(room.slots[3]?.userId).toBe('user_p1');

      // P2 leaves the room
      rm.leaveRoom('user_p2');
      expect(room.slots[2]).toBeNull();
      expect(room.slots[3]?.userId).toBe('user_p1');

      // P1 leaves the room -> room is automatically cleaned up
      rm.leaveRoom('user_p1');
      expect(rm.getRoom(room.code)).toBeUndefined();

      rm.cleanup();
    });

    it('automatically leaves previous room when joining another room', () => {
      const rm = new RoomManager();
      rm.registerConnection('user_solo', {
        ws: { readyState: 1, send: () => {} } as any,
        userId: 'user_solo',
        username: 'Solo',
        avatarIcon: '🤠',
      });
      rm.registerConnection('user_host2', {
        ws: { readyState: 1, send: () => {} } as any,
        userId: 'user_host2',
        username: 'Host2',
        avatarIcon: '👑',
      });

      // Solo creates Room 1
      const room1 = rm.createRoom('user_solo');
      expect(room1.slots[0]?.userId).toBe('user_solo');

      // Host2 creates Room 2
      const room2 = rm.createRoom('user_host2');
      expect(room2.slots[0]?.userId).toBe('user_host2');

      // Solo accepts an invite / joins Room 2 while still sitting in Room 1
      rm.joinRoom('user_solo', room2.code);

      // Solo must be removed from Room 1, and Room 1 (having 0 humans) is deleted!
      expect(rm.getRoom(room1.code)).toBeUndefined();

      // Solo is now sitting in Room 2 at Seat 1
      expect(room2.slots[0]?.userId).toBe('user_host2');
      expect(room2.slots[1]?.userId).toBe('user_solo');

      rm.cleanup();
    });

    it('creates a fresh lobby room when re-inviting after a finished match and preserves custom mode', () => {
      const rm = new RoomManager();
      const inviterMessages: ServerMessage[] = [];
      const inviteeMessages: ServerMessage[] = [];

      rm.registerConnection('user_a', {
        ws: { readyState: 1, send: (m: string) => inviterMessages.push(JSON.parse(m)) } as any,
        userId: 'user_a',
        username: 'PlayerA',
        avatarIcon: '👑',
      });
      rm.registerConnection('user_b', {
        ws: { readyState: 1, send: (m: string) => inviteeMessages.push(JSON.parse(m)) } as any,
        userId: 'user_b',
        username: 'PlayerB',
        avatarIcon: '🎴',
      });

      // Play a finished room previously
      const oldRoom = rm.createRoom('user_a', undefined, 'custom');
      rm.joinRoom('user_b', oldRoom.code);
      oldRoom.status = 'finished';

      // Re-invite from finished state with custom mode -> must create a NEW lobby room (not reuse finished room!)
      rm.inviteFriendToParty('user_a', 'user_b', 'custom');

      const invite = inviteeMessages.find(m => m.type === 'PARTY_INVITE_RECEIVED') as any;
      expect(invite).toBeDefined();
      expect(invite.roomCode).not.toBe(oldRoom.code);
      expect(invite.mode).toBe('custom');

      // Invitee accepts the invite and enters the exact new room with InviterA, then starts with AI fill
      const joined = rm.joinRoom('user_b', invite.roomCode);
      expect(joined.status).toBe('lobby');
      expect(joined.queueMode).toBe('custom');
      expect(joined.slots.some(s => s?.userId === 'user_a')).toBe(true);
      expect(joined.slots.some(s => s?.userId === 'user_b')).toBe(true);

      const started = rm.startGame('user_a');
      expect(started.status).toBe('playing');
      expect(started.slots.every(s => s !== null)).toBe(true);

      rm.cleanup();
    });

    it('keeps reconnected user online for invites when their superseded socket closes', () => {
      const rm = new RoomManager();
      const ws1: any = { readyState: 1, send: () => {} };
      const ws2Messages: ServerMessage[] = [];
      const ws2: any = { readyState: 1, send: (m: string) => ws2Messages.push(JSON.parse(m)) };
      const inviterMessages: ServerMessage[] = [];

      rm.registerConnection('user_inviter', {
        ws: { readyState: 1, send: (m: string) => inviterMessages.push(JSON.parse(m)) } as any,
        userId: 'user_inviter',
        username: 'HostUser',
        avatarIcon: '👑',
      });

      // Invitee connects on ws1, then refreshes/reconnects on ws2 before ws1 closes
      rm.registerConnection('user_invitee', {
        ws: ws1,
        userId: 'user_invitee',
        username: 'FriendUser',
        avatarIcon: '⚔️',
      });
      rm.registerConnection('user_invitee', {
        ws: ws2,
        userId: 'user_invitee',
        username: 'FriendUser',
        avatarIcon: '⚔️',
      });

      // Old socket closes -> must NOT mark user_invitee offline
      rm.handleDisconnect('user_invitee', ws1);

      rm.inviteFriendToParty('user_inviter', 'user_invitee', 'rivals');

      const invite = ws2Messages.find(m => m.type === 'PARTY_INVITE_RECEIVED') as any;
      expect(invite).toBeDefined();
      expect(inviterMessages.some(m => m.type === 'ERROR')).toBe(false);

      rm.cleanup();
    });

    it('clears stale finished room on acceptPartyInvite and preserves multiple notice listeners', () => {
      const client = new MultiplayerClient();
      const appNotices: string[] = [];
      const modalNotices: string[] = [];
      const sent: any[] = [];

      (client as any).ws = { readyState: 1, send: (raw: string) => sent.push(JSON.parse(raw)) };
      (client as any).isAuthenticated = true;

      const unsubApp = client.setCallbacks({ onNotice: (msg) => appNotices.push(msg) });
      const unsubModal = client.setCallbacks({ onNotice: (msg) => modalNotices.push(msg) });

      (client as any).handleMessage({ type: 'NOTICE', message: 'First notice' });
      expect(appNotices).toEqual(['First notice']);
      expect(modalNotices).toEqual(['First notice']);

      // Closing child modal must not silence App's notice listener
      unsubModal();
      (client as any).handleMessage({ type: 'NOTICE', message: 'Second notice' });
      expect(appNotices).toEqual(['First notice', 'Second notice']);
      expect(modalNotices).toEqual(['First notice']);

      // Simulate stale finished room still cached before accepting new invite
      (client as any).currentRoom = { code: 'OLD999', status: 'finished' };
      client.acceptPartyInvite('NEW123');

      expect(client.getCurrentRoom()).toBeNull();
      expect(client.getPendingJoinCode()).toBe('NEW123');
      expect(sent.some(m => m.type === 'PARTY_INVITE_ACCEPT' && m.partyRoomCode === 'NEW123')).toBe(true);

      unsubApp();
    });
  });
});
