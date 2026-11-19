// Criterion 6: the OD-50 decision rule. Among voices with no wrong number the best mean naturalness
// wins; a difference under 0.05 goes to fewer wrong names; if every voice has a wrong number there
// is no eligible winner. Tashkeel: error rate of the 20 names heard in both forms only.
import { describe, expect, it } from 'vitest';
import { decide, summarise } from '../src/rule.ts';
import { makeFixture } from './fixtures/build.ts';

const A = 'azure/ar-SY-LaithNeural';
const G = 'google/ar-XA-Chirp3-HD-Kore';
const S = 'silma/default';

describe('decision rule', () => {
  it('names the clear winner with its margin over the runner-up', () => {
    const { key, results } = makeFixture({
      [A]: { score: 4 },
      [G]: { score: 3 },
      [S]: { score: 2 },
    });
    const summary = summarise(results, key);
    const a = summary.voices.find((v) => v.voiceId === A);
    expect(a?.naturalness.all).toEqual({ n: 8, mean: 4, sd: 0 });
    expect(decide(summary.voices)).toEqual({
      kind: 'winner',
      voiceId: A,
      runnerUp: G,
      margin: 1,
      reason: 'highest mean naturalness among voices with no wrong number',
    });
  });

  it('passes over the best-sounding voice when it got a number wrong', () => {
    const { key, results } = makeFixture({
      [A]: { score: 5, wrong: ['number-111'] },
      [G]: { score: 4 },
      [S]: { score: 3 },
    });
    const summary = summarise(results, key);
    expect(summary.voices.find((v) => v.voiceId === A)?.wrongNumbers).toEqual([
      { clipId: 'number-111', text: 'الرقم مئة وأحد عشر', note: 'number-111 misread' },
    ]);
    const decision = decide(summary.voices);
    expect(decision.kind).toBe('winner');
    expect(decision.kind === 'winner' && decision.voiceId).toBe(G);
    expect(decision.kind === 'winner' && decision.excluded).toEqual([A]);
  });

  it('breaks a tie under 0.05 by fewer wrong names', () => {
    // A sounds as natural as G but misreads two names: G wins on the tie-break.
    const tied = makeFixture({
      [A]: { score: 4, wrong: ['name-m01', 'name-f01'] },
      [G]: { score: 4 },
    });
    expect(decide(summarise(tied.results, tied.key).voices)).toMatchObject({
      kind: 'winner',
      voiceId: G,
      tieBrokenBy: 'fewer wrong names',
    });
    // One rating of 5 lifts A's mean by 0.125 (≥ 0.05): no tie, A wins despite its wrong names.
    const apart = makeFixture({
      [A]: { score: { 'room-1': 5 }, wrong: ['name-m01', 'name-f01'] },
      [G]: { score: 3 },
    });
    for (const r of apart.results.ratings) {
      const e = apart.key.codes[r.code];
      if (!(e?.clipId === 'room-1' && e.voice === 'ar-SY-LaithNeural')) r.naturalness = 4;
    }
    const decision = decide(summarise(apart.results, apart.key).voices);
    expect(decision).toMatchObject({ kind: 'winner', voiceId: A, margin: 0.125 });
    expect(decision).not.toHaveProperty('tieBrokenBy');
  });

  it('reports a tie when naturalness and wrong names are both level', () => {
    const { key, results } = makeFixture({ [A]: { score: 4 }, [G]: { score: 4 } });
    expect(decide(summarise(results, key).voices)).toEqual({ kind: 'tie', voiceIds: [A, G] });
  });

  it('has no eligible winner when every voice got a number wrong, and lists them', () => {
    const { key, results } = makeFixture({
      [A]: { score: 5, wrong: ['number-001'] },
      [G]: { score: 4, wrong: ['number-111', 'number-001'] },
    });
    expect(decide(summarise(results, key).voices)).toEqual({
      kind: 'no-eligible-winner',
      wrongNumbers: [
        { voiceId: A, clipIds: ['number-001'] },
        { voiceId: G, clipIds: ['number-001', 'number-111'] },
      ],
    });
  });

  it('compares diacritised and plain error rates on the names heard in both forms only', () => {
    const { key, results } = makeFixture({
      // name-m02 has no plain form: its error must not count.
      [A]: { score: 4, wrong: ['name-m02', 'name-plain-m01'] },
      [G]: { score: 4, wrong: ['name-f01'] },
    });
    const summary = summarise(results, key);
    // Two voices × two names in both forms = 4 judgements per form.
    expect(summary.tashkeel.all).toEqual({
      diacritised: { judged: 4, wrong: 1, rate: 0.25 },
      plain: { judged: 4, wrong: 1, rate: 0.25 },
    });
    expect(summary.tashkeel.byVoice[A]).toEqual({
      diacritised: { judged: 2, wrong: 0, rate: 0 },
      plain: { judged: 2, wrong: 1, rate: 0.5 },
    });
    expect(summary.voices.find((v) => v.voiceId === A)?.wrongNames.map((w) => w.clipId)).toEqual([
      'name-m02',
      'name-plain-m01',
    ]);
  });
});
