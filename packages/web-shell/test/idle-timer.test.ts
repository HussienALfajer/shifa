// Slice A-01-06, A-01a criterion 9 on the client: the idle state on a fake clock. Active until the
// idle limit − 60 s, a warning counting 60…1, expired at the limit; activity refreshes the session
// at most once a minute, and the refresh moves the idle limit; the absolute limit never moves and
// wins; another tab's refresh resets this one.
import { describe, expect, it } from 'vitest';
import {
  createIdleTracker,
  type IdleMessage,
  idleState,
  type SessionExpiry,
} from '../src/idle-timer.ts';

const T0 = Date.parse('2026-11-24T10:00:00.000Z');
const MIN = 60_000;
const expiry = (idleMin: number, absoluteMin = 12 * 60): SessionExpiry => ({
  idleExpiresAt: T0 + idleMin * MIN,
  absoluteExpiresAt: T0 + absoluteMin * MIN,
});

describe('idleState', () => {
  it('is active until one minute before the idle limit', () => {
    expect(idleState(expiry(15), T0)).toEqual({ kind: 'active' });
    expect(idleState(expiry(15), T0 + 14 * MIN - 1)).toEqual({ kind: 'active' });
  });

  it('warns with the seconds left, 60 down to 1', () => {
    expect(idleState(expiry(15), T0 + 14 * MIN)).toEqual({ kind: 'warning', secondsLeft: 60 });
    expect(idleState(expiry(15), T0 + 14 * MIN + 500)).toEqual({
      kind: 'warning',
      secondsLeft: 60,
    });
    expect(idleState(expiry(15), T0 + 15 * MIN - 1)).toEqual({ kind: 'warning', secondsLeft: 1 });
  });

  it('is expired at the limit and after', () => {
    expect(idleState(expiry(15), T0 + 15 * MIN)).toEqual({ kind: 'expired' });
    expect(idleState(expiry(15), T0 + 20 * MIN)).toEqual({ kind: 'expired' });
  });

  it('lets the absolute limit win over a later idle limit', () => {
    const e = expiry(15, 10);
    expect(idleState(e, T0 + 9 * MIN)).toEqual({ kind: 'warning', secondsLeft: 60 });
    expect(idleState(e, T0 + 10 * MIN)).toEqual({ kind: 'expired' });
  });
});

function harness(initial = expiry(15)) {
  const clock = { now: T0 };
  const sent: IdleMessage[] = [];
  let refreshes = 0;
  let next: SessionExpiry | null = null;
  const tracker = createIdleTracker({
    expiry: initial,
    now: () => clock.now,
    refresh: () => {
      refreshes += 1;
      return Promise.resolve(next);
    },
    post: (message) => sent.push(message),
  });
  return {
    tracker,
    clock,
    sent,
    refreshes: () => refreshes,
    answer: (e: SessionExpiry | null) => (next = e),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createIdleTracker', () => {
  it('refreshes on activity and moves the idle limit, keeping the absolute one', async () => {
    const h = harness();
    h.clock.now = T0 + 5 * MIN;
    h.answer({ idleExpiresAt: T0 + 20 * MIN, absoluteExpiresAt: T0 + 12 * 60 * MIN });
    h.tracker.activity();
    await flush();
    expect(h.refreshes()).toBe(1);
    h.clock.now = T0 + 15 * MIN;
    expect(h.tracker.state()).toEqual({ kind: 'active' });
    expect(h.tracker.expiry().absoluteExpiresAt).toBe(T0 + 12 * 60 * MIN);
  });

  it('refreshes at most once a minute', async () => {
    const h = harness();
    h.answer(expiry(16));
    h.clock.now = T0 + 1000;
    h.tracker.activity();
    h.tracker.activity();
    h.clock.now = T0 + 30_000;
    h.tracker.activity();
    await flush();
    expect(h.refreshes()).toBe(1);
    h.clock.now = T0 + 1000 + MIN;
    h.tracker.activity();
    await flush();
    expect(h.refreshes()).toBe(2);
  });

  it('activity during the warning resets it', async () => {
    const h = harness();
    h.clock.now = T0 + 14 * MIN + 30_000;
    expect(h.tracker.state()).toEqual({ kind: 'warning', secondsLeft: 30 });
    h.answer({ idleExpiresAt: T0 + 29 * MIN + 30_000, absoluteExpiresAt: T0 + 12 * 60 * MIN });
    h.tracker.activity();
    await flush();
    expect(h.tracker.state()).toEqual({ kind: 'active' });
  });

  it('never moves the absolute limit, whatever a refresh or a message says', async () => {
    const h = harness(expiry(15, 20));
    h.answer({ idleExpiresAt: T0 + 30 * MIN, absoluteExpiresAt: T0 + 40 * MIN });
    h.clock.now = T0 + 2 * MIN;
    h.tracker.activity();
    await flush();
    h.tracker.receive({
      type: 'session',
      idleExpiresAt: T0 + 35 * MIN,
      absoluteExpiresAt: T0 + 50 * MIN,
    });
    expect(h.tracker.expiry().absoluteExpiresAt).toBe(T0 + 20 * MIN);
    h.clock.now = T0 + 20 * MIN;
    expect(h.tracker.state()).toEqual({ kind: 'expired' });
  });

  it('tells the other tabs about a refresh, and takes theirs', async () => {
    const h = harness();
    h.answer(expiry(20));
    h.clock.now = T0 + 5 * MIN;
    h.tracker.activity();
    await flush();
    expect(h.sent).toEqual([
      { type: 'session', idleExpiresAt: T0 + 20 * MIN, absoluteExpiresAt: T0 + 12 * 60 * MIN },
    ]);

    const other = harness();
    other.clock.now = T0 + 14 * MIN + 30_000;
    expect(other.tracker.state().kind).toBe('warning');
    other.tracker.receive(h.sent[0]);
    expect(other.tracker.state()).toEqual({ kind: 'active' });
  });

  it('ignores a message with an earlier idle limit', () => {
    const h = harness(expiry(20));
    h.tracker.receive({ type: 'session', idleExpiresAt: T0 + MIN, absoluteExpiresAt: T0 + MIN });
    expect(h.tracker.expiry().idleExpiresAt).toBe(T0 + 20 * MIN);
  });

  it('reports a refresh that found no session as expired', async () => {
    const h = harness();
    h.answer(null);
    h.clock.now = T0 + 2 * MIN;
    h.tracker.activity();
    await flush();
    expect(h.tracker.state()).toEqual({ kind: 'expired' });
  });
});
