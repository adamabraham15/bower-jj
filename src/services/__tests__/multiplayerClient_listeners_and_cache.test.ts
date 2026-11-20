/**
 * BOWER JJ — Multiplayer Client Multi-Subscriber & Presence Auto-Refresh Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { MultiplayerClient } from '../multiplayerClient';
import { UserAccount, PlayerCollectionState, FriendSummary } from '../../../server/types';

describe('MultiplayerClient Multi-Subscriber & Real-Time Presence', () => {
  it('supports multiple independent listeners without child modals clobbering App.tsx listeners', () => {
    const client = new MultiplayerClient();

    const appNotices: string[] = [];
    const modalNotices: string[] = [];

    // Root App.tsx registers onNotice
    const unsubscribeApp = client.setCallbacks({
      onNotice: (msg) => {
        appNotices.push(`app:${msg}`);
      },
    });

    // Child Modal mounts and registers onNotice
    const unsubscribeModal = client.setCallbacks({
      onNotice: (msg) => {
        modalNotices.push(`modal:${msg}`);
      },
    });

    // Simulate incoming NOTICE server message
    (client as any).handleMessage({
      type: 'NOTICE',
      message: 'Friend request accepted!',
    });

    expect(appNotices).toEqual(['app:Friend request accepted!']);
    expect(modalNotices).toEqual(['modal:Friend request accepted!']);

    // Child Modal unmounts
    unsubscribeModal();

    // Another notice arrives
    (client as any).handleMessage({
      type: 'NOTICE',
      message: 'Match found!',
    });

    // App listener must STILL be active and receiving messages!
    expect(appNotices).toEqual(['app:Friend request accepted!', 'app:Match found!']);
    // Modal listener did not receive the new message
    expect(modalNotices).toEqual(['modal:Friend request accepted!']);

    unsubscribeApp();
  });

  it('preserves onAuth, onCollection, and onPartyInvite across modal unmounts', () => {
    const client = new MultiplayerClient();

    let appAuthCalled = false;
    let appCollectionReceived: PlayerCollectionState | null = null;
    let appInviteReceived: any = null;

    // Root App callbacks
    const unsubApp = client.setCallbacks({
      onAuth: () => {
        appAuthCalled = true;
      },
      onCollection: (col) => {
        appCollectionReceived = col;
      },
      onPartyInvite: (inv) => {
        appInviteReceived = inv;
      },
    });

    // Sub-modal registers temporary callbacks
    const unsubModal = client.setCallbacks({
      onAuth: () => {},
      onCollection: () => {},
      onPartyInvite: () => {},
    });

    // Modal immediately unmounts
    unsubModal();

    const mockUser = {
      id: 'usr_123',
      username: 'TestHero',
      avatarIcon: 'the_outlaw',
      equippedCosmetics: {},
      friends: [],
      friendRequests: [],
      recentMatches: [],
      waxSeals: 200,
    } as unknown as UserAccount;

    const mockCollection = {
      unopenedPacksCount: 3,
      cards: [],
      unlockedAvatars: ['the_outlaw'],
      unlockedCardBacks: ['classic_midnight'],
      waxSeals: 200,
    } as unknown as PlayerCollectionState;

    // Simulate AUTH_SUCCESS
    (client as any).handleMessage({
      type: 'AUTH_SUCCESS',
      user: mockUser,
      sessionToken: 'tok_abc',
    });

    expect(appAuthCalled).toBe(true);

    // Simulate COLLECTION_STATE
    (client as any).handleMessage({
      type: 'COLLECTION_STATE',
      collection: mockCollection,
    });

    expect(appCollectionReceived).toEqual(mockCollection);

    // Simulate PARTY_INVITE_RECEIVED
    (client as any).handleMessage({
      type: 'PARTY_INVITE_RECEIVED',
      fromUsername: 'PartnerJack',
      fromAvatar: '🤠',
      roomCode: 'JJ9900',
    });

    expect(appInviteReceived).toEqual({
      type: 'PARTY_INVITE_RECEIVED',
      fromUsername: 'PartnerJack',
      fromAvatar: '🤠',
      roomCode: 'JJ9900',
    });

    unsubApp();
  });

  it('dispatches to onAuth listeners allowing automatic fetchFriends and fetchCollectionState sync', () => {
    const client = new MultiplayerClient();
    const sentMessages: any[] = [];

    (client as any).send = (msg: any) => {
      sentMessages.push(msg);
    };

    client.setCallbacks({
      onAuth: () => {
        client.fetchFriends();
        client.fetchCollectionState();
      },
    });

    const mockUser = {
      id: 'usr_456',
      username: 'EuchreChamp',
      avatarIcon: 'the_outlaw',
      equippedCosmetics: {},
      friends: [],
      friendRequests: [],
      recentMatches: [],
      waxSeals: 100,
    } as unknown as UserAccount;

    (client as any).handleMessage({
      type: 'AUTH_SUCCESS',
      user: mockUser,
      sessionToken: 'session_789',
    });

    const hasFriendsFetch = sentMessages.some(m => m.type === 'GET_FRIENDS');
    const hasCollectionFetch = sentMessages.some(m => m.type === 'GET_COLLECTION_STATE');

    expect(hasFriendsFetch).toBe(true);
    expect(hasCollectionFetch).toBe(true);
  });

  it('presence auto-refresh schedules polling and can be stopped cleanly', () => {
    vi.useFakeTimers();
    const client = new MultiplayerClient();
    const fetchFriendsSpy = vi.spyOn(client, 'fetchFriends').mockImplementation(() => {});
    vi.spyOn(client, 'isConnected').mockReturnValue(true);
    vi.spyOn(client, 'isAuthed').mockReturnValue(true);

    const stop = client.startPresenceAutoRefresh(3000);

    vi.advanceTimersByTime(3000);
    expect(fetchFriendsSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3000);
    expect(fetchFriendsSpy).toHaveBeenCalledTimes(2);

    stop();
    vi.advanceTimersByTime(6000);
    expect(fetchFriendsSpy).toHaveBeenCalledTimes(2); // no further calls after stop

    vi.useRealTimers();
  });
});
