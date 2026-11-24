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
  /** The person did something (pointer, key). */
  activity(): void;
  /** Another tab refreshed. */
  receive(message: unknown): void;
}

export function createIdleTracker(options: IdleTrackerOptions): IdleTracker {
  const absolute = options.expiry.absoluteExpiresAt;
  let current: SessionExpiry = { ...options.expiry };
  let ended = false;
  let lastRefresh = Number.NEGATIVE_INFINITY;

  /** Takes a later idle limit; the absolute one stays what the session started with. */
  const take = (idleExpiresAt: number): boolean => {
    if (idleExpiresAt <= current.idleExpiresAt) return false;
    current = { idleExpiresAt, absoluteExpiresAt: absolute };
    return true;
  };

  return {
    state: () => (ended ? { kind: 'expired' } : idleState(current, options.now())),
    expiry: () => ({ ...current }),
    activity() {
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
    },
    receive(message) {
      if (isIdleMessage(message)) take(message.idleExpiresAt);
    },
  };
}
