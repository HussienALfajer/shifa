// Pacing (criterion 5, MSG-15, OD-46) as a pure function: when may the next message of a
// session be sent, given its recent sends, the time, a random source and the config? The queue
// runs one message at a time per session and asks this before each send.
import type { PacingConfig } from './config.ts';

export interface SendState {
  /** When the previous sendText was called (null: never). */
  lastSendAt: number | null;
  /** sendText call times inside the last window (any order). */
  recent: number[];
}

export type ScheduleConfig = PacingConfig & { timeZone: string };

export const DEFAULT_PACING: PacingConfig = {
  minGapMs: 20_000,
  maxGapMs: 60_000,
  capPerWindow: 30,
  windowMs: 60 * 60_000,
  quiet: { kind: 'daily', start: '21:00', end: '08:00' },
  deferSpreadMs: 15 * 60_000,
  typing: { perCharMs: 60, minMs: 1_500, maxMs: 8_000 },
  inlineWaitMaxMs: 65_000,
};

export function typingMs(length: number, config: PacingConfig): number {
  const { perCharMs, minMs, maxMs } = config.typing;
  return Math.min(maxMs, Math.max(minMs, Math.round(length * perCharMs)));
}

const minutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const formatters = new Map<string, Intl.DateTimeFormat>();
/** Seconds since local midnight in the time zone (with the ms fraction of t). */
function localSecondOfDay(t: number, timeZone: string): number {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  const parts = Object.fromEntries(f.formatToParts(t).map((p) => [p.type, p.value]));
  const ms = ((t % 1000) + 1000) % 1000;
  return (
    Number(parts['hour']) * 3600 +
    Number(parts['minute']) * 60 +
    Number(parts['second']) +
    ms / 1000
  );
}

/** End of the quiet window containing t, or null when t is not in quiet hours. */
export function quietEnd(t: number, config: ScheduleConfig): number | null {
  const quiet = config.quiet;
  switch (quiet.kind) {
    case 'none':
      return null;
    case 'window':
      return t >= quiet.from && t < quiet.to ? quiet.to : null;
    case 'daily': {
      const start = minutes(quiet.start) * 60;
      const end = minutes(quiet.end) * 60;
      const s = localSecondOfDay(t, config.timeZone);
      const inside = start > end ? s >= start || s < end : s >= start && s < end;
      if (!inside) return null;
      const toEnd = (end - s + 86_400) % 86_400;
      return t + Math.round(toEnd * 1000);
    }
  }
}

/**
 * Earliest send time ≥ now: at least a random gap after the previous send, no more than
 * `capPerWindow` sends in any rolling window, outside quiet hours (a send that falls inside
 * them is deferred to their end plus a random spread, so a backlog is not released at once).
 */
export function nextSendAt(
  state: SendState,
  now: number,
  random: () => number,
  config: ScheduleConfig,
): number {
  let t = now;
  if (state.lastSendAt !== null) {
    const gap = config.minGapMs + random() * (config.maxGapMs - config.minGapMs);
    t = Math.max(t, state.lastSendAt + Math.round(gap));
  }
  const recent = [...state.recent].sort((a, b) => a - b);
  for (let i = 0; i < 20; i++) {
    const inWindow = recent.filter((s) => s > t - config.windowMs && s <= t);
    if (inWindow.length >= config.capPerWindow) {
      // The oldest send that keeps the count at the cap must leave the window first.
      const leaving = inWindow[inWindow.length - config.capPerWindow] ?? t;
      t = leaving + config.windowMs;
      continue;
    }
    const end = quietEnd(t, config);
    if (end !== null) {
      t = end + Math.round(random() * config.deferSpreadMs);
      continue;
    }
    return t;
  }
  throw new Error('scheduler did not settle');
}
