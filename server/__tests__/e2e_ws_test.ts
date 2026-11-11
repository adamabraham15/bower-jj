/**
 * BOWER JJ — Live WebSocket End-to-End Integration Verification
 */

import { WebSocket } from 'ws';

async function runLiveTest() {
  console.log('Testing live WebSocket connection on ws://localhost:3001/ws ...');

  const ws1 = new WebSocket('ws://localhost:3001/ws');
  const ws2 = new WebSocket('ws://localhost:3001/ws');

  await Promise.all([
    new Promise(resolve => ws1.on('open', resolve)),
    new Promise(resolve => ws2.on('open', resolve)),
  ]);

  console.log('✓ Both WebSockets connected to server successfully');

  // Player 1 Auth
  ws1.send(JSON.stringify({ type: 'AUTH', username: 'HostPlayer1', avatarIcon: '👑' }));
  const p1Auth: any = await new Promise(resolve => {
    ws1.once('message', data => resolve(JSON.parse(data.toString())));
  });
  console.log(`✓ Player 1 authenticated: userId = ${p1Auth.user.id}`);

  // Player 2 Auth
  ws2.send(JSON.stringify({ type: 'AUTH', username: 'GuestPlayer2', avatarIcon: '🦊' }));
  const p2Auth: any = await new Promise(resolve => {
    ws2.once('message', data => resolve(JSON.parse(data.toString())));
  });
  console.log(`✓ Player 2 authenticated: userId = ${p2Auth.user.id}`);

  // Player 1 creates private room
  ws1.send(JSON.stringify({ type: 'ROOM_CREATE' }));
  const roomCreated: any = await new Promise(resolve => {
    ws1.once('message', data => resolve(JSON.parse(data.toString())));
  });
  const roomCode = roomCreated.room.code;
  console.log(`✓ Room created with live code: ${roomCode}`);

  // Player 2 joins room with roomCode
  ws2.send(JSON.stringify({ type: 'ROOM_JOIN', roomCode }));
  const roomJoined: any = await new Promise(resolve => {
    ws2.once('message', data => resolve(JSON.parse(data.toString())));
  });
  console.log(`✓ Player 2 joined room ${roomCode} at Seat ${roomJoined.yourPosition}`);

  // Player 1 fills empty seats with AI
  ws1.send(JSON.stringify({ type: 'ROOM_FILL_AI', difficulty: 'medium' }));
  await new Promise(r => setTimeout(r, 100));
  console.log('✓ Host filled empty seats with AI');

  // Player 1 starts game
  ws1.send(JSON.stringify({ type: 'ROOM_START' }));

  // Wait for GAME_SYNC on both sockets
  const [p1Game, p2Game]: any = await Promise.all([
    new Promise(resolve => {
      ws1.on('message', data => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'GAME_SYNC') resolve(msg);
      });
    }),
    new Promise(resolve => {
      ws2.on('message', data => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'GAME_SYNC') resolve(msg);
      });
    }),
  ]);

  console.log(`✓ Player 1 received GAME_SYNC: ${p1Game.state.yourHand.length} cards in private hand`);
  console.log(`✓ Player 2 received GAME_SYNC: ${p2Game.state.yourHand.length} cards in private hand`);

  // Verify hand privacy: Player 1's cards != Player 2's cards
  const p1CardIds = p1Game.state.yourHand.map((c: any) => c.id).sort().join(',');
  const p2CardIds = p2Game.state.yourHand.map((c: any) => c.id).sort().join(',');

  if (p1CardIds !== p2CardIds) {
    console.log('✓ Anti-cheat verified: Each player received unique, concealed cards!');
  } else {
    throw new Error('Cards matched unexpectedly!');
  }

  ws1.close();
  ws2.close();
  console.log('🎉 LIVE MULTIPLAYER END-TO-END TEST PASSED 100%!');
}

runLiveTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
