// Criterion 8 (OD-52): FCM stays primary if every graded state and the one-day run have ≥ 95% of
// pushes shown within 60 s and no message is lost; excluded states are not graded but must be
// detectable from the device state; an inbox-only message is not lost.
import { describe, expect, it } from 'vitest';
import { classify } from '../src/join.ts';
import { evaluate } from '../src/rule.ts';
import { type RunResult } from '../src/types.ts';

function result(over: Partial<RunResult>): RunResult {
  return {
    run: 'r',
    state: 'doze',
    app: 'compliant',
    serial: 'emulator-5554',
    sdk: 33,
    kind: 'state',
    grading: 'graded',
    n: 20,
    expected: 20,
    shown: 20,
    within60: 20,
    within60Pct: 100,
    p50S: 1.2,
    p95S: 3.4,
    maxS: 5,
    collapsed: 0,
    expired: 0,
    inboxOnly: 0,
    lost: [],
    skewFlagged: false,
    ...over,
  };
}

describe('evaluate', () => {
  it('passes when every graded state and the day run are at or above 95% with nothing lost', () => {
    const verdict = evaluate([
      result({ state: 'doze' }),
      result({ state: 'background', within60: 19, within60Pct: 95 }),
      result({
        state: 'day',
        kind: 'day',
        n: 53,
        expected: 53,
        shown: 53,
        within60: 51,
        within60Pct: 96.2,
      }),
    ]);
    expect(verdict).toEqual({ pass: true, reasons: [] });
  });

  it('94% within 60 s fails', () => {
    const verdict = evaluate([
      result({ state: 'bucket-rare', expected: 50, shown: 50, within60: 47, within60Pct: 94 }),
    ]);
    expect(verdict.pass).toBe(false);
    expect(verdict.reasons.join('\n')).toMatch(/bucket-rare.*94/);
  });

  it('the day run is graded too', () => {
    const verdict = evaluate([
      result({ state: 'day', kind: 'day', expected: 53, within60: 40, within60Pct: 75.5 }),
    ]);
    expect(verdict.pass).toBe(false);
  });

  it('one lost message fails even at 100% on time, in any run', () => {
    expect(evaluate([result({ lost: ['s7-9'] })]).pass).toBe(false);
    const excludedLost = evaluate([
      result({
        state: 'force-stopped',
        grading: 'excluded',
        exclusion: 'force-stopped',
        detectability: 'last seen only',
        shown: 0,
        within60: 0,
        within60Pct: 0,
        lost: ['s7-10'],
      }),
    ]);
    expect(excludedLost.pass).toBe(false);
    expect(excludedLost.reasons.join('\n')).toMatch(/s7-10/);
  });

  it('excluded and recorded states are not graded on time', () => {
    const verdict = evaluate([
      result({
        state: 'permission-denied',
        grading: 'excluded',
        exclusion: 'permission-denied',
        detectability: 'permission in device state',
        shown: 0,
        within60: 0,
        within60Pct: 0,
        inboxOnly: 20,
      }),
      result({ state: 'pending-limit', grading: 'recorded', n: 120, within60Pct: 10 }),
      result({ state: 'foreground', app: 'noshow', grading: 'recorded', within60Pct: 0 }),
    ]);
    expect(verdict).toEqual({ pass: true, reasons: [] });
  });

  it('an excluded state the backend cannot detect fails', () => {
    const verdict = evaluate([
      result({
        state: 'channel-off',
        grading: 'excluded',
        exclusion: 'channel-off',
        detectability: 'not detectable',
        within60Pct: 0,
      }),
    ]);
    expect(verdict.pass).toBe(false);
    expect(verdict.reasons.join('\n')).toMatch(/channel-off/);
  });

  it('no graded run at all is not a pass', () => {
    expect(evaluate([]).pass).toBe(false);
  });
});

describe('classify', () => {
  it('an inbox-only message is not lost', () => {
    expect(classify({ shown: false, inInbox: true, expired: false, collapsedLater: false })).toBe(
      'inboxOnly',
    );
    expect(classify({ shown: false, inInbox: false, expired: false, collapsedLater: false })).toBe(
      'lost',
    );
    expect(classify({ shown: true, inInbox: true, expired: false, collapsedLater: false })).toBe(
      'shown',
    );
    expect(classify({ shown: false, inInbox: true, expired: true, collapsedLater: true })).toBe(
      'expired',
    );
    expect(classify({ shown: false, inInbox: true, expired: false, collapsedLater: true })).toBe(
      'collapsed',
    );
  });
});
