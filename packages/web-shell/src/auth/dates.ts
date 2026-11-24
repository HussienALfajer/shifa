// Dates of the signed-out pages (slice A-01-07): dd/mm/yyyy and HH:mm on the device's clock, and
// a relative phrase («بعد يومين»), Western digits (OD-20, OD-61).
import { FORMAT_LOCALE } from '@shifa/i18n/runtime';
import { clockTime } from './lock.ts';

const pad = (n: number) => String(n).padStart(2, '0');

/** `26/11/2026`. */
export function dayDate(at: number): string {
  const d = new Date(at);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear())}`;
}

export { clockTime };

const RELATIVE = new Intl.RelativeTimeFormat(FORMAT_LOCALE, { numeric: 'auto' });

/** «بعد يومين», «بعد 5 ساعات», «بعد 20 دقيقة»: how long until `at`, roughly. */
export function fromNow(at: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((at - now) / 60_000));
  if (minutes >= 24 * 60) return RELATIVE.format(Math.round(minutes / (24 * 60)), 'day');
  if (minutes >= 60) return RELATIVE.format(Math.round(minutes / 60), 'hour');
  return RELATIVE.format(minutes, 'minute');
}
