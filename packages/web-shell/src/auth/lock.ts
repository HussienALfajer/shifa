// Lock times (slice A-01-07, improvement b): what is left of a lock as m:ss and the clock time it
// ends, in the device's time zone (the sign-in page knows no clinic; Syria and Türkiye are UTC+3
// all year), 24-hour, Western digits (OD-20). Shared by sign-in (phone and network locks) and the
// MFA screens (`mfa_locked`).
import { FORMAT_LOCALE } from '@shifa/i18n/runtime';
import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

/** `14:59` for 899 s left; never below `0:00`. Seconds round up, so 0:00 shows only at the end. */
export function remaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60))}:${pad(total % 60)}`;
}

const CLOCK = new Intl.DateTimeFormat(FORMAT_LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** `10:42`: the end of a lock on the device's clock. */
export function clockTime(at: number): string {
  return CLOCK.format(at);
}

/** A lock the server answered: `until` on the server's clock (shown), `endsAt` on this device's. */
export interface Lock<Code extends string = string> {
  code: Code;
  until: number;
  endsAt: number;
}

/**
 * The server's clock minus this device's, from the answer's `Date` header (0 without one): a lock
 * counts down to the server's `until` even on a clinic computer whose clock is off.
 */
export function serverOffset(response: Response): number {
  const date = Date.parse(response.headers.get('date') ?? '');
  return Number.isFinite(date) ? date - Date.now() : 0;
}

/** The lock of an answer with `until`, on both clocks. */
export function lockOf<Code extends string>(
  code: Code,
  until: number,
  response: Response,
): Lock<Code> {
  return { code, until, endsAt: until - serverOffset(response) };
}

/** The time now, read on every render; while `active`, a render each second. */
export function useNow(active: boolean): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => {
      setTick((n) => n + 1);
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [active]);
  return Date.now();
}

/**
 * The lock still running, or null; a lock that ran out clears itself (improvement b): the form
 * comes back on without a reload.
 */
export function useLock<Code extends string>(
  lock: Lock<Code> | null,
  clear: () => void,
): { lock: Lock<Code> | null; now: number } {
  const now = useNow(lock !== null);
  const ended = lock !== null && now >= lock.endsAt;
  useEffect(() => {
    if (ended) clear();
  }, [ended, clear]);
  return { lock: ended ? null : lock, now };
}
