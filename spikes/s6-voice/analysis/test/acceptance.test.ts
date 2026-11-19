// OD-51: SILMA alone. With one voice there is no comparison: it is accepted with no wrong number
// and a mean naturalness of at least 3.5.
import { describe, expect, it } from 'vitest';
import { ACCEPT_MEAN, decide, summarise } from '../src/rule.ts';
import { makeFixture } from './fixtures/build.ts';

const S = 'silma/default';

describe('single-voice acceptance (OD-51)', () => {
  it('accepts a voice with no wrong number at the bar', () => {
    expect(ACCEPT_MEAN).toBe(3.5);
    const { key, results } = makeFixture({ [S]: { score: { 'room-1': 3, 'number-001': 4 } } });
    // Scores: 4, then 3 for the other seven clips → mean 3.125; lift four to 4 for exactly 3.5.
    for (const r of results.ratings.slice(0, 4)) r.naturalness = 4;
    const decision = decide(summarise(results, key).voices);
    expect(decision).toMatchObject({ kind: 'accepted', voiceId: S, mean: 3.5, wrongNumbers: [] });
  });

  it('does not accept a voice below the bar', () => {
    const { key, results } = makeFixture({ [S]: { score: 3 } });
    const decision = decide(summarise(results, key).voices);
    expect(decision).toMatchObject({ kind: 'not-accepted', mean: 3 });
    expect(decision.kind === 'not-accepted' && decision.reason).toContain('below 3.5');
  });

  it('does not accept a natural voice that got a number wrong, and lists it', () => {
    const { key, results } = makeFixture({ [S]: { score: 5, wrong: ['number-111'] } });
    const decision = decide(summarise(results, key).voices);
    expect(decision).toMatchObject({ kind: 'not-accepted', wrongNumbers: ['number-111'] });
    expect(decision.kind === 'not-accepted' && decision.reason).toContain('corrected text');
  });

  it('still compares when there are two voices or more', () => {
    const { key, results } = makeFixture({ [S]: { score: 4 }, 'azure/x': { score: 3 } });
    expect(decide(summarise(results, key).voices).kind).toBe('winner');
  });
});
