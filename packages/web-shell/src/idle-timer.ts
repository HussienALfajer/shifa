// The idle limit on the client (slice A-01-06, A-01a criterion 9). Pure state from the session's
// two limits and the clock: `active`, `warning` one minute before the end, `expired` at it. The
// session ends at the earlier limit; activity refreshes GET /auth/session (which moves the idle
// limit) at most once a minute; the absolute limit never moves. Tabs share refreshes, so activity
// in one keeps the others.

export const WARNING_MS = 60_000;
export const REFRESH_EVERY_MS = 60_000;

/** The session's limits as epoch milliseconds. */
export interface SessionExpiry {
  idleExpiresAt: number;
  absoluteExpiresAt: number;
}

export type IdleState =
  | { kind: 'active' }
  | { kind: 'warning'; secondsLeft: number }
  | { kind: 'expired' };

/** What tabs tell each other (BroadcastChannel). */
export interface IdleMessage extends SessionExpiry {
  type: 'session';
}

/** Another tab's message, checked: the channel carries whatever a tab of this origin posts. */
export function isIdleMessage(value: unknown): value is IdleMessage {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    m['type'] === 'session' &&
    Number.isFinite(m['idleExpiresAt']) &&
    Number.isFinite(m['absoluteExpiresAt'])
  );
}

export function idleState(expiry: SessionExpiry, now: number): IdleState {
  const end = Math.min(expiry.idleExpiresAt, expiry.absoluteExpiresAt);
  const left = end - now;
  if (left <= 0) return { kind: 'expired' };
  if (left <= WARNING_MS) return { kind: 'warning', secondsLeft: Math.ceil(left / 1000) };
  return { kind: 'active' };
}

export interface IdleTrackerOptions {
  expiry: SessionExpiry;
  now: () => number;
  /** Asks the server again; the new limits, or null when the session is gone. */
  refresh: () => Promise<SessionExpiry | null>;
  /** Sends a message to the other tabs. */
  post: (message: IdleMessage) => void;
}

export interface IdleTracker {
  state(): IdleState;
  expiry(): SessionExpiry;
  /** The person did something (pointer, key, wheel, scroll, touch). */
  activity(): void;
  /**
   * Called every second: refreshes for activity the once-a-minute limit held back, so the last
   * real activity always moves the idle limit (a trailing refresh).
   */
  tick(): void;
  /** True once a refresh found no session: the 401 rule, not the idle timer, ends the page. */
  gone(): boolean;
  /** Another tab refreshed. */
  receive(message: unknown): void;
}

export function createIdleTracker(options: IdleTrackerOptions): IdleTracker {
  const absolute = options.expiry.absoluteExpiresAt;
  let current: SessionExpiry = { ...options.expiry };
  let ended = false;
  let lastRefresh = Number.NEGATIVE_INFINITY;
  let lastActivity = Number.NEGATIVE_INFINITY;

  /** Takes a later idle limit; the absolute one stays what the session started with. */
  const take = (idleExpiresAt: number): boolean => {
    if (idleExpiresAt <= current.idleExpiresAt) return false;
    current = { idleExpiresAt, absoluteExpiresAt: absolute };
    return true;
  };

  const refresh = () => {
    const now = options.now();
    if (ended || now - lastRefresh < REFRESH_EVERY_MS) return;
    if (idleState(current, now).kind === 'expired') return;
    lastRefresh = now;
    void options.refresh().then(
      (next) => {
        if (next === null) {
          ended = true;
          return;
        }
        if (take(next.idleExpiresAt)) options.post({ type: 'session', ...current });
      },
      // A failed refresh changes nothing: the limits stay, the next activity asks again.
      () => {
        lastRefresh = Number.NEGATIVE_INFINITY;
      },
    );
  };

  return {
    state: () => (ended ? { kind: 'expired' } : idleState(current, options.now())),
    expiry: () => ({ ...current }),
    activity() {
      lastActivity = options.now();
      refresh();
    },
    tick() {
      if (lastActivity > lastRefresh) refresh();
    },
    gone: () => ended,
    receive(message) {
      if (isIdleMessage(message)) take(message.idleExpiresAt);
    },
  };
}

/**
 * What the page does on a tick: sign out once when the limit is reached; nothing when a refresh
 * found the session already gone (the 401 rule then names the real reason, not `idle`).
 */
export function idleAction(
  state: IdleState,
  { gone, ended }: { gone: boolean; ended: boolean },
): 'none' | 'sign-out' {
  return state.kind === 'expired' && !gone && !ended ? 'sign-out' : 'none';
}

/**
 * How far the server's clock is ahead of this browser's, from a session answer: every
 * authenticated request sets the session's last activity to the server's now, so
 * `idleExpiresAt − idleMinutes` is the server's now when the answer left (A-01-02). Compare the
 * limits with `Date.now() + offset`, never `Date.now()` alone: a clinic PC whose clock runs
 * 40 minutes fast would otherwise sign out at once.
 */
export function clockOffset(
  session: { idleExpiresAt: string; idleMinutes: number },
  clientNow: number,
): number {
  const serverNow = Date.parse(session.idleExpiresAt) - session.idleMinutes * 60_000;
  return Number.isFinite(serverNow) ? serverNow - clientNow : 0;
}
