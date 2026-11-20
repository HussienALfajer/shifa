// The quick variant of the one-day run (OD-55): the same 53 sends, a minute apart, in their own
// run directory so a later full-day run does not overwrite them.
import { describe, expect, it } from 'vitest';
import { quickSlots } from '../src/day.ts';
import { runDirName } from '../src/run-files.ts';
import { type RunRecord } from '../src/runner.ts';

const record = (gapS: number) =>
  ({
    meta: {
      kind: 'day',
      state: 'day',
      app: 'compliant',
      sdk: 33,
      serial: 'emulator-5554',
      gapS,
      startedAt: '2026-11-20T08:00:00.000Z',
    },
  }) as unknown as RunRecord;

describe('quick day run', () => {
  it('spaces 53 slots by the given seconds from the start', () => {
    const start = new Date('2026-11-20T11:00:00');
    const slots = quickSlots(start, 53, 60);
    expect(slots).toHaveLength(53);
    expect(slots[0]?.getTime()).toBe(start.getTime());
    expect((slots[52]?.getTime() ?? 0) - start.getTime()).toBe(52 * 60_000);
  });

  it('writes the quick run to its own directory, the full day to the usual one', () => {
    expect(runDirName(record(60))).toBe('2026-11-20-day-quick-api33');
    expect(runDirName(record(900))).toBe('2026-11-20-day-api33');
  });
});
