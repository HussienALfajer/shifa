// Criterion 5 (MSG-15, MSG-19): the pure scheduler over a simulated day with 200 queued
// messages: no gap under 20 s, no rolling 60 minutes over the cap, nothing in quiet hours
// (21:00–08:00, Asia/Damascus), the night backlog and a bulk notice spread rather than burst,
// and every wording variant used.
import { createRandom } from '@shifa/testing';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PACING, nextSendAt, type SendState, typingMs } from '../src/scheduler.ts';
import { pickVariant, TEMPLATES } from '../src/templates.ts';

const TZ = 'Asia/Damascus';
const config = { ...DEFAULT_PACING, timeZone: TZ };
const at = (local: string) => Date.parse(`${local}+03:00`);
const localHour = (t: number) =>
  Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(t),
  );

/** FIFO through the scheduler: each message waits for the previous one and for its arrival. */
function simulate(arrivals: number[], seed: number): number[] {
  const random = createRandom(seed);
  const state: SendState = { lastSendAt: null, recent: [] };
  const sends: number[] = [];
  let free = 0;
  for (const arrival of [...arrivals].sort((a, b) => a - b)) {
    const t = nextSendAt(state, Math.max(arrival, free), () => random.next(), config);
    sends.push(t);
    state.lastSendAt = t;
    state.recent = [...state.recent.filter((s) => s > t - config.windowMs), t];
    free = t + typingMs(80, config);
  }
  return sends;
}

describe('pacing over a simulated day', () => {
  const random = createRandom(7);
  const arrivals: number[] = [];
  // 40 queued overnight (22:00–07:00), 60 as one bulk delay notice at 14:00, 100 across the day.
  for (let i = 0; i < 40; i++)
    arrivals.push(at('2026-11-17T22:00:00') + random.int(0, 9 * 3_600_000));
  for (let i = 0; i < 60; i++) arrivals.push(at('2026-11-18T14:00:00'));
  for (let i = 0; i < 100; i++)
    arrivals.push(at('2026-11-18T08:00:00') + random.int(0, 12 * 3_600_000));
  const sends = simulate(arrivals, 11);

  it('sends all 200 messages', () => {
    expect(sends).toHaveLength(200);
  });

  it('never leaves less than 20 s between two sends', () => {
    for (let i = 1; i < sends.length; i++) {
      expect((sends[i] ?? 0) - (sends[i - 1] ?? 0)).toBeGreaterThanOrEqual(20_000);
    }
  });

  it('never exceeds the cap in any rolling 60 minutes', () => {
    for (const t of sends) {
      const inWindow = sends.filter((s) => s > t - 3_600_000 && s <= t);
      expect(inWindow.length).toBeLessThanOrEqual(config.capPerWindow);
    }
    expect(config.capPerWindow).toBe(30);
  });

  it('sends nothing between 21:00 and 08:00 clinic time', () => {
    for (const t of sends) {
      const hour = localHour(t);
      expect(hour >= 8 && hour < 21, new Date(t).toISOString()).toBe(true);
    }
  });

  it('spreads the overnight backlog after 08:00 instead of releasing it at once', () => {
    const morning = sends.filter(
      (t) => t >= at('2026-11-18T08:00:00') && t < at('2026-11-18T12:00:00'),
    );
    const first = morning[0] ?? 0;
    expect(first).toBeGreaterThan(at('2026-11-18T08:00:00'));
    expect(first).toBeLessThanOrEqual(at('2026-11-18T08:00:00') + config.deferSpreadMs);
    expect(morning.filter((t) => t < at('2026-11-18T08:05:00')).length).toBeLessThanOrEqual(15);
  });

  it('spreads a bulk notice to 60 patients', () => {
    const bulk = sends.filter((t) => t >= at('2026-11-18T14:00:00'));
    expect(bulk.filter((t) => t < at('2026-11-18T14:10:00')).length).toBeLessThanOrEqual(30);
  });

  it('uses every wording variant', () => {
    const r = createRandom(3);
    for (const [key, template] of Object.entries(TEMPLATES)) {
      const used = new Set(Array.from({ length: 200 }, () => pickVariant(key, () => r.next())));
      expect(used.size, key).toBe(template.variants.length);
      expect(template.variants.length).toBeGreaterThanOrEqual(3);
      expect(template.variants.length).toBeLessThanOrEqual(5);
    }
  });
});

describe('quiet-hours boundaries', () => {
  const fixed = () => 0.5;

  it('defers a send that would land at 21:00 to after 08:00 the next morning', () => {
    const state: SendState = { lastSendAt: at('2026-11-17T20:59:50'), recent: [] };
    const t = nextSendAt(state, at('2026-11-17T20:59:55'), fixed, config);
    expect(t).toBeGreaterThanOrEqual(at('2026-11-18T08:00:00'));
    expect(t).toBeLessThanOrEqual(at('2026-11-18T08:00:00') + config.deferSpreadMs);
  });

  it('allows a send at 20:59 and at 08:00 sharp', () => {
    const empty: SendState = { lastSendAt: null, recent: [] };
    expect(nextSendAt(empty, at('2026-11-17T20:59:00'), fixed, config)).toBe(
      at('2026-11-17T20:59:00'),
    );
    expect(nextSendAt(empty, at('2026-11-18T08:00:00'), fixed, config)).toBe(
      at('2026-11-18T08:00:00'),
    );
  });

  it('waits for the oldest send to leave the window when the cap is reached mid-batch', () => {
    const base = at('2026-11-17T10:00:00');
    const recent = Array.from({ length: 30 }, (_, i) => base + i * 60_000);
    const t = nextSendAt(
      { lastSendAt: recent[29] ?? 0, recent },
      base + 30 * 60_000,
      fixed,
      config,
    );
    expect(t).toBeGreaterThanOrEqual(base + 3_600_000);
  });

  it('types longer for longer text, within bounds', () => {
    expect(typingMs(200, config)).toBeGreaterThan(typingMs(20, config));
    expect(typingMs(100_000, config)).toBe(config.typing.maxMs);
    expect(typingMs(0, config)).toBe(config.typing.minMs);
  });
});
