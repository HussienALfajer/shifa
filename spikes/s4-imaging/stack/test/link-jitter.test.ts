// The link shaper under jitter (0.3-S4c, before the bench). netem's jitter alone delays each
// packet independently, so packets leave out of order and TCP throughput collapses: in 0.3-S4b's
// fast suite P3 (25 Mbit/s, ± 20 ms jitter) opened images slower than P2 (10 Mbit/s, none).
// Jitter must keep packet order: a single TCP transfer on P3 reaches at least 70 % of the
// profile's rate in each direction.
import { describe, expect, it } from 'vitest';
import { PROFILES } from '../src/link.ts';
import { useStack } from './use-stack.ts';

const stack = useStack({ sink: true, profile: 'P3' });
const P3 = PROFILES.P3;
const MB = 1_000_000;

const sink = () => {
  if (!stack.link.sinkUrl) throw new Error('sink not started');
  return stack.link.sinkUrl;
};
const seconds = (bytes: number, mbit: number) => (bytes * 8) / (mbit * 1_000_000);

describe('link shaper with jitter (P3)', () => {
  it('downloads 20 MB at no less than 70 % of the P3 downlink', async () => {
    // Warm the connection pool so the measured transfer is one TCP stream past its handshake.
    await fetch(`${sink()}/ping`).then((r) => r.text());
    const start = performance.now();
    const res = await fetch(`${sink()}/download?bytes=${String(20 * MB)}`);
    expect((await res.arrayBuffer()).byteLength).toBe(20 * MB);
    const elapsed = (performance.now() - start) / 1000;
    expect(elapsed, `${String(elapsed)} s`).toBeLessThanOrEqual(
      seconds(20 * MB, P3.downMbit) / 0.7,
    );
  });

  it('uploads 8 MB at no less than 70 % of the P3 uplink', async () => {
    const start = performance.now();
    const res = await fetch(`${sink()}/upload`, { method: 'POST', body: new Uint8Array(8 * MB) });
    expect(((await res.json()) as { bytes: number }).bytes).toBe(8 * MB);
    const elapsed = (performance.now() - start) / 1000;
    expect(elapsed, `${String(elapsed)} s`).toBeLessThanOrEqual(seconds(8 * MB, P3.upMbit) / 0.7);
  });
});
