import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  isActiveDecisionPhase,
  CenterKittyDisplay,
  TurnedDownNoticeChip,
  DealerDeckStack,
  TurnActiveDot,
} from '../BiddingModalHelpers';
import { evaluateTutorialPracticeCard } from '../TutorialModal';
import { Card } from '../../engine/types';

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

  it('renders DealerDeckStack for every seat around the table and pulsing turn dot', () => {
    for (const pos of ['top', 'left', 'right', 'bottom'] as const) {
      const html = renderToStaticMarkup(<DealerDeckStack relativePos={pos} cardBackSkin="classic_blue" />);
      expect(html).toContain('DECK');
    }
    const dotHtml = renderToStaticMarkup(<TurnActiveDot />);
    expect(dotHtml).toContain('animate-ping');
  });
});
