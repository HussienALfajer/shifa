// The link shaper (profiles P1–P3, used by 0.3-S4b criteria 8–11). Gate: sch_tbf and sch_netem
// load in this kernel. Under P2: upload and download rates hold within ± 15 %, six parallel
// uploads share the uplink (aggregate shaping, not per connection), the RTT is within ± 20 %,
// a 30 s cut stalls and then resumes a transfer, a reset kills open connections, and the
// counters see the bytes sent (payload plus TCP/IP framing, at most 6 % above it).
import { describe, expect, it } from 'vitest';
import { docker, sleep } from '../src/docker.ts';
import { PROFILES } from '../src/link.ts';
import { useStack } from './use-stack.ts';

const stack = useStack({ sink: true, profile: 'none' });
const P2 = PROFILES.P2;
const MB = 1_000_000;

const sink = () => {
  if (!stack.link.sinkUrl) throw new Error('sink not started');
  return stack.link.sinkUrl;
};

async function upload(bytes: number): Promise<number> {
  const start = performance.now();
  const res = await fetch(`${sink()}/upload`, { method: 'POST', body: new Uint8Array(bytes) });
  const body = (await res.json()) as { bytes: number };
  expect(body.bytes).toBe(bytes);
  return (performance.now() - start) / 1000;
}

const seconds = (bytes: number, mbit: number) => (bytes * 8) / (mbit * 1_000_000);
const near = (actual: number, expected: number, share: number) =>
  Math.abs(actual - expected) <= expected * share;

describe('link shaper', () => {
  it('loads tbf and netem on both link interfaces (kernel gate)', async () => {
    await stack.link.applyProfile('P2');
    const qdiscs = (await docker(['exec', stack.link.container, 'tc', 'qdisc', 'show'])).stdout;
    expect(qdiscs.match(/qdisc tbf/g)?.length).toBe(2);
    expect(qdiscs.match(/qdisc netem/g)?.length).toBe(2);
    expect(stack.link.events.some((e) => e.event === 'profile' && e.detail === 'P2')).toBe(true);
  });

  it('shapes a 5 MB upload to the P2 uplink and counts its bytes', async () => {
    const before = await stack.link.counters();
    const elapsed = await upload(5 * MB);
    const after = await stack.link.counters();
    expect(near(elapsed, seconds(5 * MB, P2.upMbit), 0.15), `${String(elapsed)} s`).toBe(true);
    const up = after.upBytes - before.upBytes;
    expect(up).toBeGreaterThanOrEqual(5 * MB);
    expect(up).toBeLessThanOrEqual(5 * MB * 1.06);
  });

  it('shapes a 5 MB download to the P2 downlink', async () => {
    const start = performance.now();
    const res = await fetch(`${sink()}/download?bytes=${String(5 * MB)}`);
    expect((await res.arrayBuffer()).byteLength).toBe(5 * MB);
    const elapsed = (performance.now() - start) / 1000;
    expect(near(elapsed, seconds(5 * MB, P2.downMbit), 0.15), `${String(elapsed)} s`).toBe(true);
  });

  it('shares the uplink across six parallel uploads (aggregate, not per connection)', async () => {
    const start = performance.now();
    await Promise.all(Array.from({ length: 6 }, () => upload(1 * MB)));
    const elapsed = (performance.now() - start) / 1000;
    expect(near(elapsed, seconds(6 * MB, P2.upMbit), 0.15), `${String(elapsed)} s`).toBe(true);
  });

  it('adds the P2 round-trip time within ± 20 %', async () => {
    await fetch(`${sink()}/ping`).then((r) => r.text());
    const samples: number[] = [];
    for (let i = 0; i < 15; i += 1) {
      const start = performance.now();
      await fetch(`${sink()}/ping`).then((r) => r.text());
      samples.push(performance.now() - start);
    }
    const median = samples.sort((x, y) => x - y)[7] ?? 0;
    expect(near(median, P2.rttMs, 0.2), `${String(median)} ms`).toBe(true);
  });

  it('stalls a transfer during a 30 s cut and resumes it afterwards', async () => {
    const transfer = upload(3 * MB);
    await sleep(2_000);
    const cut = stack.link.cut(30);
    await sleep(5_000);
    const during = await stack.link.counters();
    await sleep(20_000);
    const later = await stack.link.counters();
    expect(later.upBytes - during.upBytes).toBeLessThan(20_000);
    await cut;
    const elapsed = await transfer;
    expect(elapsed).toBeGreaterThan(30 + seconds(3 * MB, P2.upMbit) * 0.8);
    const events = stack.link.events.map((e) => e.event);
    expect(events).toContain('cut-start');
    expect(events).toContain('cut-end');
  });

  it('kills open connections on reset and accepts new ones', async () => {
    const pending = fetch(`${sink()}/download?bytes=${String(20 * MB)}`).then((r) =>
      r.arrayBuffer(),
    );
    await sleep(2_000);
    await stack.link.reset();
    await expect(pending).rejects.toThrow();
    await sleep(1_000);
    expect(await (await fetch(`${sink()}/ping`)).text()).toBe('ok');
  });
});
