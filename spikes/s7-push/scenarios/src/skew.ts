// One clock (spec edge case "clock skew"): the emulator's offset from the host is measured with
// `date +%s%N` before and after each run. Of several samples the one with the shortest round trip
// is used, against the midpoint of its host readings. Skew = emulator − host.
import { type Device } from './adb.ts';

export interface Skew {
  skewMs: number;
  rttMs: number;
}

export interface SkewRecord {
  beforeMs: number;
  afterMs: number;
  /** Mean of before and after; used to put emulator times on the host clock. */
  skewMs: number;
  driftMs: number;
  /** Drift over 50 ms within a run. */
  flagged: boolean;
}

export const DRIFT_LIMIT_MS = 50;

const toMs = (ns: bigint) => Number(ns) / 1e6;

export async function measureSkew(
  dev: Device,
  opts: { hostNs: () => bigint; samples?: number },
): Promise<Skew> {
  let best: Skew | undefined;
  let bestRtt: bigint | undefined;
  for (let i = 0; i < (opts.samples ?? 5); i += 1) {
    const t0 = opts.hostNs();
    const out = (await dev.shell('date +%s%N')).trim();
    const t1 = opts.hostNs();
    if (!/^\d+$/.test(out)) throw new Error(`emulator date gave "${out}", not ns`);
    const rtt = t1 - t0;
    if (bestRtt === undefined || rtt < bestRtt) {
      bestRtt = rtt;
      best = { skewMs: toMs(BigInt(out) - (t0 + t1) / 2n), rttMs: toMs(rtt) };
    }
  }
  if (!best) throw new Error('no skew sample');
  return best;
}

export function checkDrift(before: Skew, after: Skew): SkewRecord {
  const driftMs = Math.abs(after.skewMs - before.skewMs);
  return {
    beforeMs: before.skewMs,
    afterMs: after.skewMs,
    skewMs: (before.skewMs + after.skewMs) / 2,
    driftMs,
    flagged: driftMs > DRIFT_LIMIT_MS,
  };
}
