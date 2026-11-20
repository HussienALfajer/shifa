// Join (criteria 4, 7, 8): per send, when it was shown on the host clock and what happened to it.
// Shown = the watcher's post time, or the probe's own receipt while in the foreground, both moved
// from the emulator clock to the host clock by the run's measured skew. Latency starts at the send,
// or when the network came back for a send made while offline. A message not shown is, in order:
// expired (its TTL ended before the network came back), collapsed (a later send for the same
// appointment was shown), in the inbox only, or lost (neither shown nor in the inbox).
import { type Detectability, type Run, type RunResult } from './types.ts';

export type Outcome = 'shown' | 'expired' | 'collapsed' | 'inboxOnly' | 'lost';

export function classify(m: {
  shown: boolean;
  inInbox: boolean;
  expired: boolean;
  collapsedLater: boolean;
}): Outcome {
  if (m.shown) return 'shown';
  if (m.expired) return 'expired';
  if (m.collapsedLater) return 'collapsed';
  return m.inInbox ? 'inboxOnly' : 'lost';
}

const ttlMs = (ttl: string) => Number(/^(\d+)s$/.exec(ttl)?.[1] ?? '0') * 1000;
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Nearest-rank percentile of sorted values. */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)] ?? null;
}

function detectability(run: Run): Detectability | undefined {
  const { exclusion, device } = run.meta;
  if (exclusion === undefined) return undefined;
  if (exclusion === 'permission-denied')
    return device?.permission === 'denied' ? 'permission in device state' : 'not detectable';
  if (exclusion === 'channel-off')
    return device?.channels.appointments === 'none' ? 'channel in device state' : 'not detectable';
  // Force-stopped and `restricted` apps run no code: only a stale "last seen" shows them.
  return 'last seen only';
}

export function joinRun(run: Run): RunResult {
  const { meta } = run;
  const skew = meta.skew.skewMs;
  const shownAt = new Map<string, number>();
  const note = (s7id: string, deviceMs: number) => {
    const host = deviceMs - skew;
    const prev = shownAt.get(s7id);
    if (prev === undefined || host < prev) shownAt.set(s7id, host);
  };
  for (const s of run.shown) note(s.s7id, s.postTimeMs);
  for (const r of run.receipts) {
    if (r.path === 'foreground' && r.appState === 'foreground')
      note(r.s7id, Date.parse(r.receivedAt));
  }
  const inInbox = new Set(run.inbox.map((i) => i.s7id));
  const backAt = meta.networkBackAt ? Date.parse(meta.networkBackAt) : undefined;

  const counts = { shown: 0, expired: 0, collapsed: 0, inboxOnly: 0 };
  const lost: string[] = [];
  const latencies: number[] = [];
  for (const send of run.sends) {
    const sent = Date.parse(send.sentAt);
    const shown = shownAt.get(send.s7id);
    const collapsedLater =
      send.collapse &&
      run.sends.some(
        (o) =>
          o.appointmentId === send.appointmentId &&
          Date.parse(o.sentAt) > sent &&
          shownAt.has(o.s7id),
      );
    const outcome = classify({
      shown: shown !== undefined,
      inInbox: inInbox.has(send.s7id),
      expired: backAt !== undefined && sent + ttlMs(send.ttl) < backAt,
      collapsedLater,
    });
    if (outcome === 'lost') lost.push(send.s7id);
    else counts[outcome] += 1;
    if (shown !== undefined) {
      const start = backAt !== undefined && sent < backAt ? backAt : sent;
      latencies.push(Math.max(0, shown - start) / 1000);
    }
  }
  latencies.sort((a, b) => a - b);
  const expected = run.sends.length - counts.collapsed - counts.expired;
  const within60 = latencies.filter((l) => l <= 60).length;
  const pct = (v: number | null) => (v === null ? null : round1(v));
  const det = detectability(run);
  return {
    run: run.dir,
    state: meta.state,
    app: meta.app,
    serial: meta.serial,
    sdk: meta.sdk,
    kind: meta.kind,
    grading: meta.grading,
    ...(meta.exclusion ? { exclusion: meta.exclusion } : {}),
    n: run.sends.length,
    expected,
    shown: counts.shown,
    within60,
    // Nothing due on the tray (every send expired or collapsed) means nothing was late.
    within60Pct: expected === 0 ? 100 : round1((within60 / expected) * 100),
    p50S: pct(percentile(latencies, 50)),
    p95S: pct(percentile(latencies, 95)),
    maxS: pct(latencies.at(-1) ?? null),
    collapsed: counts.collapsed,
    expired: counts.expired,
    inboxOnly: counts.inboxOnly,
    lost,
    ...(det ? { detectability: det } : {}),
    skewFlagged: meta.skew.flagged,
  };
}
