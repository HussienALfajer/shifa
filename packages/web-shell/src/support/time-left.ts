// Time left of a support grant (slice A-02-10; criteria 13, 26): «حتى 14:12 (متبقٍّ 42 دقيقة)»
// from `expiresAt − now` of the server, so a wrong device clock does not change it. The page
// counts down on its own clock from the moment the answer came; no request is made for it (a
// request is activity, and only the person's activity may keep the session alive).
import { useEffect, useState } from 'react';
import { clockTime } from '../auth/lock.ts';

const MINUTE = 60_000;

export interface TimeLeft {
  /** «14:12» on this device. */
  until: string;
  /** Whole minutes left, rounded up; 0 once it ran out. */
  minutes: number;
}

/**
 * `serverNow` is the server's time when the answer was made, `receivedAt` the device's time when
 * it arrived.
 */
export function useTimeLeft(expiresAt: string, serverNow: string, receivedAt: number): TimeLeft {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      setTick(Date.now());
    }, 15_000);
    return () => {
      clearInterval(id);
    };
  }, []);
  const end = Date.parse(expiresAt);
  const skew = Date.parse(serverNow) - receivedAt;
  const left = end - (tick + (Number.isFinite(skew) ? skew : 0));
  // The end shown in this device's clock, so it matches the clock the person sees.
  const deviceEnd = end - (Number.isFinite(skew) ? skew : 0);
  return { until: clockTime(deviceEnd), minutes: Math.max(0, Math.ceil(left / MINUTE)) };
}
