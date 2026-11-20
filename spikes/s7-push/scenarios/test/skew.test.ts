// Edge case "clock skew": latency uses one clock; the emulator's offset from the host is measured
// with `date +%s%N` before and after each run, and a drift over 50 ms is flagged.
import { describe, expect, it } from 'vitest';
import { device } from '../src/adb.ts';
import { checkDrift, measureSkew } from '../src/skew.ts';
import { createFakeAdb } from './fakes/adb.ts';

describe('measureSkew', () => {
  it('uses the sample with the shortest round trip and the midpoint of its host times', async () => {
    const adb = createFakeAdb();
    // Host ns readings, two per sample (before and after the adb call).
    const host = [
      1_000_000_000_000n,
      1_000_080_000_000n, // 80 ms round trip
      1_001_000_000_000n,
      1_001_010_000_000n, // 10 ms round trip: chosen
      1_002_000_000_000n,
      1_002_040_000_000n, // 40 ms
    ];
    const deviceNs = ['1000290000000\n', '1001255000000\n', '1002300000000\n'];
    let i = 0;
    adb.answer(/shell date \+%s%N$/, () => deviceNs[i++] ?? '');
    let h = 0;
    const skew = await measureSkew(device(adb, 'emulator-5554'), {
      hostNs: () => host[h++] ?? 0n,
      samples: 3,
    });
    // Device 1001.255 s − host midpoint 1001.005 s = +250 ms.
    expect(skew).toEqual({ skewMs: 250, rttMs: 10 });
    expect(adb.calls).toHaveLength(3);
  });

  it('fails on output that is not a nanosecond time', async () => {
    const adb = createFakeAdb();
    adb.answer(/date/, '%N\n');
    let t = 0n;
    await expect(
      measureSkew(device(adb, 'emulator-5554'), { hostNs: () => (t += 1_000_000n), samples: 1 }),
    ).rejects.toThrow(/date/);
  });
});

describe('checkDrift', () => {
  it('flags a drift over 50 ms between the before and after skew', () => {
    expect(checkDrift({ skewMs: 250, rttMs: 4 }, { skewMs: 290, rttMs: 5 })).toEqual({
      beforeMs: 250,
      afterMs: 290,
      skewMs: 270,
      driftMs: 40,
      flagged: false,
    });
    expect(checkDrift({ skewMs: 250, rttMs: 4 }, { skewMs: 190, rttMs: 5 }).flagged).toBe(true);
    expect(checkDrift({ skewMs: 0, rttMs: 4 }, { skewMs: 50, rttMs: 5 }).flagged).toBe(false);
  });
});
