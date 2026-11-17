import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RoomManager } from '../roomManager';
import { ClientConnection } from '../types';

describe('Forfeit & Abandon Match Instance Cleanup', () => {
  let rm: RoomManager;
  let mockWs1: any;
  let mockWs2: any;
  let sentTo1: any[] = [];
  let sentTo2: any[] = [];

  beforeEach(() => {
    rm = new RoomManager();
    sentTo1 = [];
    sentTo2 = [];

    mockWs1 = {
      readyState: 1,
      send: (data: string) => sentTo1.push(JSON.parse(data)),
    };
    mockWs2 = {
      readyState: 1,
      send: (data: string) => sentTo2.push(JSON.parse(data)),
    };
  });

  afterEach(() => {
    // clean up timers
  });

  it('permanently deletes match instance on forfeit when no other human players remain (e.g. Bot game)', () => {
    const conn: ClientConnection = {
      ws: mockWs1,
      userId: 'user_solo_1',
      username: 'SoloPlayer',
      avatarIcon: 'the_outlaw',
    };
    rm.registerConnection('user_solo_1', conn);

    // Create room with 3 bots
    const room = rm.createRoom('user_solo_1', undefined, 'custom');
    rm.fillWithAI('user_solo_1', 'medium');
    rm.startGame('user_solo_1');

    expect(room.status).toBe('playing');
    expect(rm.getRoom(room.code)).toBeDefined();
    expect(rm.getGameState(room.code)).toBeDefined();

    // Player forfeits the match
    rm.handleForfeit('user_solo_1');

    // Instance MUST be completely deleted from memory
    expect(rm.getRoom(room.code)).toBeUndefined();
    expect(rm.getGameState(room.code)).toBeUndefined();

    // Reconnection / page reload MUST NOT rejoin or rehydrate the forfeited game
    sentTo1 = [];
    const newConn: ClientConnection = {
      ws: mockWs1,
      userId: 'user_solo_1',
      username: 'SoloPlayer',
      avatarIcon: 'the_outlaw',
    };
    rm.registerConnection('user_solo_1', newConn);

    const gameSync = sentTo1.find(m => m.type === 'GAME_SYNC');
    expect(gameSync).toBeUndefined();
    expect(newConn.roomCode).toBeUndefined();
  });

  it('marks player abandoned and does NOT rehydrate match on reconnect in multi-human game', () => {
    const conn1: ClientConnection = {
      ws: mockWs1,
      userId: 'human_1',
      username: 'HumanOne',
      avatarIcon: 'the_outlaw',
    };
    const conn2: ClientConnection = {
      ws: mockWs2,
      userId: 'human_2',
      username: 'HumanTwo',
      avatarIcon: 'the_outlaw',
    };
    rm.registerConnection('human_1', conn1);
    rm.registerConnection('human_2', conn2);

    const room = rm.createRoom('human_1', undefined, 'custom');
    rm.joinRoom('human_2', room.code);
    rm.fillWithAI('human_1', 'medium');
    rm.startGame('human_1');

    expect(room.status).toBe('playing');

    // Human 1 forfeits
    rm.handleForfeit('human_1');

    expect(room.abandonedUserIds).toContain('human_1');
    const slot0 = room.slots[0]!;
    expect(slot0.abandoned).toBe(true);
    expect(slot0.isAI).toBe(true);

    // When Human 1 reloads the page (reconnects), they must NOT be rehydrated into the game
    sentTo1 = [];
    const reloadedConn1: ClientConnection = {
      ws: mockWs1,
      userId: 'human_1',
      username: 'HumanOne',
      avatarIcon: 'the_outlaw',
    };
    rm.registerConnection('human_1', reloadedConn1);

    const reconnectedGameSync = sentTo1.find(m => m.type === 'GAME_SYNC');
    expect(reconnectedGameSync).toBeUndefined();
    expect(reloadedConn1.roomCode).toBeUndefined();
  });
});
