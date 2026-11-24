// Lock times (slice A-01-07, improvement b): what is left of a lock as m:ss and the clock time it
// ends, in the device's time zone (the sign-in page knows no clinic; Syria and Türkiye are UTC+3
// all year), 24-hour, Western digits (OD-20).
import { FORMAT_LOCALE } from '@shifa/i18n/runtime';

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
