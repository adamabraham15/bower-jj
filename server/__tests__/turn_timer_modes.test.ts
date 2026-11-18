import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomManager } from '../roomManager';

describe('Turn Timer House Rules: Ranked vs Custom Modes', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  afterEach(() => {
    roomManager.destroy();
  });

  const setupUser = (userId: string, name: string) => {
    const fakeWs = { send: () => {}, readyState: 1 } as any;
    roomManager.registerConnection(userId, {
      ws: fakeWs,
      userId,
      username: name,
      avatarIcon: '🎴',
    });
  };

  it('forces 15s turn timer in Ranked Solo matchmaking rooms', () => {
    const userId = 'u_ranked_solo';
    setupUser(userId, 'RankedSoloHost');

    const room = roomManager.createRoom(userId, {
      turnTimeLimitSeconds: 0, // Even if requested 0, ranked must strictly enforce 15s
    }, 'solo');

    expect(room.queueMode).toBe('solo');
    expect(room.rules.turnTimeLimitSeconds).toBe(15);
  });

  it('forces 15s turn timer in Ranked Duo matchmaking rooms', () => {
    const userId = 'u_ranked_duo';
    setupUser(userId, 'RankedDuoHost');

    const room = roomManager.createRoom(userId, undefined, 'duo');

    expect(room.queueMode).toBe('duo');
    expect(room.rules.turnTimeLimitSeconds).toBe(15);
  });

  it('defaults to 0s (Chill / No Timer) in Custom lobbies', () => {
    const userId = 'u_custom_chill';
    setupUser(userId, 'ChillHost');

    const room = roomManager.createRoom(userId, undefined, 'custom');

    expect(room.queueMode).toBe('custom');
    expect(room.rules.turnTimeLimitSeconds).toBe(0);
  });

  it('allows custom lobbies to configure 30s or 15s turn timers if desired', () => {
    const userId1 = 'u_custom_30s';
    setupUser(userId1, 'Custom30sHost');
    const room30s = roomManager.createRoom(userId1, {
      turnTimeLimitSeconds: 30,
    }, 'custom');
    expect(room30s.rules.turnTimeLimitSeconds).toBe(30);

    const userId2 = 'u_custom_15s';
    setupUser(userId2, 'Custom15sHost');
    const room15s = roomManager.createRoom(userId2, {
      turnTimeLimitSeconds: 15,
    }, 'custom');
    expect(room15s.rules.turnTimeLimitSeconds).toBe(15);
  });

  it('allows custom lobby host to update turn timer dynamically', () => {
    const userId = 'u_custom_update';
    setupUser(userId, 'CustomHost');

    const room = roomManager.createRoom(userId, undefined, 'custom');
    expect(room.rules.turnTimeLimitSeconds).toBe(0);

    const updatedRoom = roomManager.updateRoomRules(userId, {
      ...room.rules,
      turnTimeLimitSeconds: 30,
    });
    expect(updatedRoom.rules.turnTimeLimitSeconds).toBe(30);

    const fetchedRoom = roomManager.getRoom(room.code);
    expect(fetchedRoom?.rules.turnTimeLimitSeconds).toBe(30);
  });
});
