// Texts about a date (slice 0.4-13 criterion 16, OD-72): the short form dd/mm/yyyy, the month's
// name, the confirmation line under the field («السبت 14 آذار 1987») and the age for birth
// dates («39 سنة»). Levantine month names and Western digits (OD-61, OD-20).
import type { Direction } from '../providers/direction-provider.tsx';
import { DATE_LOCALE } from './date-locale.ts';

const utc = (year: number, month: number, day = 1) => Date.UTC(year, month - 1, day);

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(dir: Direction, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${dir}|${JSON.stringify(options)}`;
  let found = formatters.get(key);
  if (found === undefined) {
    found = new Intl.DateTimeFormat(DATE_LOCALE[dir], { ...options, timeZone: 'UTC' });
    formatters.set(key, found);
  }
  return found;
}

/** «شباط» or «February». */
export const monthName = (month: number, dir: Direction): string =>
  formatter(dir, { month: 'long' }).format(utc(2001, month));

/** An ISO date as dd/mm/yyyy (23/11/2026), in both languages. */
export function shortDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`;
}

/** «السبت 14 آذار 1987» or «Saturday 14 March 1987». */
export function dateLine(iso: string, dir: Direction): string {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  const parts = formatter(dir, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(utc(year, month, day));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return [part('weekday'), part('day'), part('month'), part('year')].join(' ');
}

/** Whole years from `birth` to `today` (ISO dates); null when `birth` is after today. */
function yearsBetween(birth: string, today: string): number | null {
  if (birth > today) return null;
  const years = Number(today.slice(0, 4)) - Number(birth.slice(0, 4));
  return today.slice(5) < birth.slice(5) ? years - 1 : years;
}

/** The age on `today`: «39 سنة», «6 سنوات», «سنتان», «سنة واحدة», «أقل من سنة»; or null. */
export function ageText(birth: string, today: string, dir: Direction): string | null {
  const years = yearsBetween(birth, today);
  if (years === null) return null;
  if (dir === 'ltr') {
    if (years === 0) return 'under 1 year';
    return years === 1 ? '1 year' : `${String(years)} years`;
  }
  if (years === 0) return 'أقل من سنة';
  if (years === 1) return 'سنة واحدة';
  if (years === 2) return 'سنتان';
  return years <= 10 ? `${String(years)} سنوات` : `${String(years)} سنة`;
}

/** Today as an ISO date, in the person's own time zone. */
export function todayIso(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
