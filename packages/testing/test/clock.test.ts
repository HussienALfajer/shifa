import { describe, expect, it } from 'vitest';
import { FixedClock } from '../src/index.ts';

describe('FixedClock', () => {
  it('returns the start time until moved', () => {
    const clock = new FixedClock('2026-11-08T09:00:00+03:00');
    expect(clock.now().toISOString()).toBe('2026-11-08T06:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-11-08T06:00:00.000Z');
  });

  it('advances by milliseconds', () => {
    const clock = new FixedClock('2026-11-08T06:00:00Z');
    clock.advanceBy(15 * 60_000);
    expect(clock.now().toISOString()).toBe('2026-11-08T06:15:00.000Z');
  });

  it('returns a copy so callers cannot mutate the clock', () => {
    const clock = new FixedClock('2026-11-08T06:00:00Z');
    clock.now().setFullYear(2000);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects advanceBy(%s)', (ms) => {
    const clock = new FixedClock('2026-11-08T06:00:00Z');
    expect(() => {
      clock.advanceBy(ms);
    }).toThrow(RangeError);
  });

  it('refuses to move backwards or to an invalid time', () => {
    const clock = new FixedClock('2026-11-08T06:00:00Z');
    expect(() => {
      clock.set('2026-11-07T06:00:00Z');
    }).toThrow(RangeError);
    expect(() => new FixedClock('not a date')).toThrow(RangeError);
  });
});
