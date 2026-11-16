import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  isActiveDecisionPhase,
  CenterKittyDisplay,
  TurnedDownNoticeChip,
  DealerAvatarBadge,
  DealerDeckStack,
  LeadSuitBadge,
  TurnActiveDot,
  computeTrickProgress,
  TrickProgressStrip,
} from '../BiddingModalHelpers';
import { evaluateTutorialPracticeCard } from '../TutorialModal';
import { Card } from '../../engine/types';
import { BOT_PLAYER_NAMES, pickRandomBotNames } from '../../config/collectiblesCatalog';
import { sounds, loadSavedAudioPreferences } from '../../audio/sound';
import { RoomManager } from '../../../server/roomManager';

const SAMPLE_UPCARD: Card = { id: 'hearts-K', suit: 'hearts', rank: 'K' };

describe('Table UI & Tutorial Helpers', () => {
  it('marks bidding and play phases as active turn decision phases', () => {
    expect(isActiveDecisionPhase('bidding_round_1')).toBe(true);
    expect(isActiveDecisionPhase('bidding_round_2')).toBe(true);
    expect(isActiveDecisionPhase('dealer_discard')).toBe(true);
    expect(isActiveDecisionPhase('playing')).toBe(true);

    expect(isActiveDecisionPhase('idle')).toBe(false);
    expect(isActiveDecisionPhase('dealing')).toBe(false);
    expect(isActiveDecisionPhase('trick_resolving')).toBe(false);
    expect(isActiveDecisionPhase('hand_scored')).toBe(false);
    expect(isActiveDecisionPhase('game_over')).toBe(false);
  });

  it('evaluates tutorial practice cards accurately', () => {
    const winResult = evaluateTutorialPracticeCard('spades-A');
    expect(winResult.isSuccess).toBe(true);
    expect(winResult.type).toBe('success');

    const warnResult = evaluateTutorialPracticeCard('spades-9');
    expect(warnResult.isSuccess).toBe(false);
    expect(warnResult.type).toBe('warn');

    const illegalResult = evaluateTutorialPracticeCard('hearts-9');
    expect(illegalResult.isSuccess).toBe(false);
    expect(illegalResult.type).toBe('error');
  });

  it('renders Turned-Up Card in Round 1 and Turned-Down Card in Round 2', () => {
    const r1Html = renderToStaticMarkup(
      <CenterKittyDisplay phase="bidding_round_1" upCard={SAMPLE_UPCARD} canCallTurnedDownSuit={false} />
    );
    expect(r1Html).toContain('Turned-Up Card');
    expect(r1Html).toContain('HEARTS');

    const r2Html = renderToStaticMarkup(
      <CenterKittyDisplay phase="bidding_round_2" upCard={SAMPLE_UPCARD} canCallTurnedDownSuit={false} />
    );
    expect(r2Html).toContain('Turned Down');
    expect(r2Html).toContain('TURNED DOWN');
    expect(r2Html).toContain('Suit Blocked');

    const playHtml = renderToStaticMarkup(
      <CenterKittyDisplay phase="playing" upCard={SAMPLE_UPCARD} canCallTurnedDownSuit={false} />
    );
    expect(playHtml).toBe('');
  });

  it('renders TurnedDownNoticeChip inside Round 2 bidding modal', () => {
    const html = renderToStaticMarkup(
      <TurnedDownNoticeChip upCard={SAMPLE_UPCARD} canCallTurnedDownSuit={false} />
    );
    expect(html).toContain('Turned Down:');
    expect(html).toContain('K♥');
    expect(html).toContain('Blocked');
  });

  it('renders DealerDeckStack, DealerAvatarBadge, LeadSuitBadge, and pulsing turn dot cleanly', () => {
    for (const pos of ['top', 'left', 'right', 'bottom'] as const) {
      const html = renderToStaticMarkup(<DealerDeckStack relativePos={pos} cardBackSkin="classic_blue" />);
      expect(html).toContain('DECK');
    }

    const topInlineHtml = renderToStaticMarkup(
      <DealerDeckStack relativePos="top" cardBackSkin="classic_blue" inline />
    );
    expect(topInlineHtml).toContain('relative flex-shrink-0');
    expect(topInlineHtml).toContain('DECK');

    const leftDeckHtml = renderToStaticMarkup(
      <DealerDeckStack relativePos="left" cardBackSkin="classic_blue" />
    );
    expect(leftDeckHtml).toContain('top-full');

    const dealerBadgeHtml = renderToStaticMarkup(<DealerAvatarBadge />);
    expect(dealerBadgeHtml).toContain('left-1/2');
    expect(dealerBadgeHtml).toContain('DEALER');

    const leadHtml = renderToStaticMarkup(<LeadSuitBadge leadSuit="hearts" showFollowHint />);
    expect(leadHtml).toContain('Lead:');
    expect(leadHtml).toContain('hearts');
    expect(leadHtml).toContain('z-30');
    expect(leadHtml).toContain('Follow');

    const dotHtml = renderToStaticMarkup(<TurnActiveDot />);
    expect(dotHtml).toContain('animate-ping');
  });

  it('computes and renders visible mobile TrickProgressStrip accurately across hand progression', () => {
    // Start of hand during bidding: 0 tricks won -> Trick 1 of 5
    const startProgress = computeTrickProgress([0, 0], 'bidding_round_1');
    expect(startProgress.currentTrick).toBe(1);
    expect(startProgress.totalTricks).toBe(5);
    expect(startProgress.team1Tricks).toBe(0);
    expect(startProgress.team2Tricks).toBe(0);
    expect(startProgress.isBiddingOrDiscard).toBe(true);

    // Mid-hand example: Team 1 has 2 tricks, Team 2 has 0 tricks -> Trick 3 of 5
    const midProgress = computeTrickProgress([2, 0], 'playing');
    expect(midProgress.currentTrick).toBe(3);
    expect(midProgress.totalTricks).toBe(5);
    expect(midProgress.team1Tricks).toBe(2);
    expect(midProgress.team2Tricks).toBe(0);
    expect(midProgress.isBiddingOrDiscard).toBe(false);

    const stripHtml = renderToStaticMarkup(
      <TrickProgressStrip tricksWon={[2, 0]} phase="playing" yourTeam={0} />
    );
    expect(stripHtml).toContain('Trick 3 of 5');
    expect(stripHtml).toContain('Team 1:');
    expect(stripHtml).toContain('2');
    expect(stripHtml).toContain('Team 2:');
    expect(stripHtml).toContain('0');

    // Hand complete: 3 + 2 = 5 tricks
    const endProgress = computeTrickProgress([3, 2], 'hand_scored');
    expect(endProgress.currentTrick).toBe(5);
    expect(endProgress.completedTricks).toBe(5);
    expect(endProgress.isHandComplete).toBe(true);
  });

  it('assigns unique, realistic Euchre usernames to bots from a large pool', () => {
    expect(BOT_PLAYER_NAMES.length).toBeGreaterThanOrEqual(75);
    const picked = pickRandomBotNames(3, ['HostPlayer']);
    expect(picked.length).toBe(3);
    expect(new Set(picked).size).toBe(3);
    picked.forEach((name) => {
      expect(name).not.toMatch(/^Bot \d+$/i);
      expect(name.toLowerCase()).not.toBe('hostplayer');
    });

    // Verify RoomManager.fillWithAI assigns unique realistic bot names while keeping isAI = true
    const rm = new RoomManager();
    rm.registerConnection('host_1', {
      ws: { readyState: 1, send: () => {} } as any,
      userId: 'host_1',
      username: 'HostPlayer',
      avatarIcon: 'the_outlaw',
    });
    const room = rm.createRoom('host_1', undefined, 'custom');
    expect(room).not.toBeNull();
    rm.fillWithAI('host_1', 'medium');

    const aiSlots = room!.slots.filter((s) => s && s.isAI);
    expect(aiSlots.length).toBe(3);
    const aiNames = aiSlots.map((s) => s!.username);
    expect(new Set(aiNames).size).toBe(3);
    aiNames.forEach((n) => {
      expect(BOT_PLAYER_NAMES).toContain(n);
    });
    rm.destroy();
  });

  it('synchronizes private lobby pendingInvites when players leave, decline, or invites expire', async () => {
    const rm = new RoomManager();
    (rm as any).inviteExpiryMs = 80; // Fast 80ms expiry for test

    const hostMsgs: any[] = [];
    const friendMsgs: any[] = [];

    rm.registerConnection('host_u', {
      ws: { readyState: 1, send: (raw: string) => hostMsgs.push(JSON.parse(raw)) } as any,
      userId: 'host_u',
      username: 'HostCaptain',
      avatarIcon: 'the_outlaw',
    });
    rm.registerConnection('friend_u', {
      ws: { readyState: 1, send: (raw: string) => friendMsgs.push(JSON.parse(raw)) } as any,
      userId: 'friend_u',
      username: 'BuddyEuchre',
      avatarIcon: 'clever_fox',
    });
    rm.registerConnection('friend_exp', {
      ws: { readyState: 1, send: () => {} } as any,
      userId: 'friend_exp',
      username: 'SlowResponder',
      avatarIcon: 'cyber_bot',
    });

    const room = rm.createRoom('host_u', undefined, 'custom')!;
    expect(room.pendingInvites).toEqual({});

    // 1. Host invites friend_u -> pendingInvites contains friend_u
    rm.inviteFriendToParty('host_u', 'friend_u', 'custom');
    expect(room.pendingInvites?.['friend_u']).toBeGreaterThan(Date.now());

    // 2. friend_u declines -> pendingInvites['friend_u'] is immediately cleared
    rm.declinePartyInvite('friend_u', room.code);
    expect(room.pendingInvites?.['friend_u']).toBeUndefined();

    // 3. Re-invite friend_u and have them join -> pendingInvites cleared and seat assigned
    rm.inviteFriendToParty('host_u', 'friend_u', 'custom');
    expect(room.pendingInvites?.['friend_u']).toBeDefined();
    rm.joinRoom('friend_u', room.code);
    expect(room.pendingInvites?.['friend_u']).toBeUndefined();
    expect(room.slots.some((s) => s?.userId === 'friend_u')).toBe(true);

    // 4. friend_u leaves room -> slot becomes null immediately and ROOM_UPDATE is broadcast
    rm.leaveRoom('friend_u');
    expect(room.slots.some((s) => s?.userId === 'friend_u')).toBe(false);
    expect(room.slots.filter((s) => s !== null).length).toBe(1);

    // 5. Invite friend_exp and let the invite expire -> automatically removed from pendingInvites
    rm.inviteFriendToParty('host_u', 'friend_exp', 'custom');
    expect(room.pendingInvites?.['friend_exp']).toBeDefined();
    await new Promise((r) => setTimeout(r, 130));
    expect(room.pendingInvites?.['friend_exp']).toBeUndefined();

    rm.destroy();
  });

  it('persists independent background music and SFX preferences in SoundEngine', () => {
    sounds.setMusicEnabled(false);
    sounds.setMusicVolume(0.55);
    sounds.setSfxVolume(0.7);
    sounds.setSfxMuted(true);

    const prefs = sounds.getAudioPreferences();
    expect(prefs.musicEnabled).toBe(true); // setMusicVolume(0.55) > 0 enables music
    expect(prefs.musicVolume).toBeCloseTo(0.55);
    expect(prefs.sfxVolume).toBeCloseTo(0.7);
    expect(prefs.sfxMuted).toBe(true);

    sounds.setMusicEnabled(false);
    expect(sounds.getAudioPreferences().musicEnabled).toBe(false);
    expect(loadSavedAudioPreferences().musicVolume).toBeCloseTo(0.55);
  });
});
