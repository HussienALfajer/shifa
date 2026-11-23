// The typed date's error (slice 0.4-13 criterion 16, OD-72): one text or none from the segments,
// `min`, `max` and the direction. In order: a missing part; a year under four digits (the
// century is never guessed); a day past the month's end; before `min`; after `max` (or the
// caller's `maxMessage`, such as «تاريخ الميلاد لا يكون بعد اليوم»). Arabic in RTL, English in
// LTR.
import type { Direction } from '../providers/direction-provider.tsx';
import { DATE_UNITS, type DateFields, type DateUnit, daysInMonth, toIso } from './date-fields.ts';
import { monthName, shortDate } from './date-text.ts';

const MISSING: Record<Direction, Record<DateUnit, string>> = {
  rtl: {
    day: 'أكمل التاريخ: اليوم ناقص',
    month: 'أكمل التاريخ: الشهر ناقص',
    year: 'أكمل التاريخ: السنة ناقصة',
  },
  ltr: {
    day: 'Complete the date: the day is missing',
    month: 'Complete the date: the month is missing',
    year: 'Complete the date: the year is missing',
  },
};

const FOUR_DIGITS: Record<Direction, string> = {
  rtl: 'اكتب السنة بأربعة أرقام: 1987',
  ltr: 'Write the year with four digits: 1987',
};

export interface DateErrorInput {
  fields: DateFields;
  dir: Direction;
  /** ISO dates. */
  min?: string | undefined;
  max?: string | undefined;
  /** Said instead of «اختر تاريخاً حتى …» for a date after `max`. */
  maxMessage?: string | undefined;
}

/** The error to show for these segments, or null when there is none (or nothing typed). */
export function dateError({ fields, dir, min, max, maxMessage }: DateErrorInput): string | null {
  const missing = DATE_UNITS.filter((unit) => fields[unit] === null);
  if (missing.length === DATE_UNITS.length) return null;
  const first = missing[0];
  if (first !== undefined) return MISSING[dir][first];
  const { day, month, year } = fields as { day: number; month: number; year: number };
  if (year < 1000) return FOUR_DIGITS[dir];
  const days = daysInMonth(year, month);
  if (day > days) {
    const name = `${monthName(month, dir)} ${String(year)}`;
    return dir === 'rtl' ? `${name} فيه ${String(days)} يوماً` : `${name} has ${String(days)} days`;
  }
  const iso = toIso(fields);
  if (iso === null) return null;
  if (min !== undefined && iso < min) {
    return dir === 'rtl'
      ? `اختر تاريخاً من ${shortDate(min)} فصاعداً`
      : `Choose a date from ${shortDate(min)} onwards`;
  }
  if (max !== undefined && iso > max) {
    if (maxMessage !== undefined) return maxMessage;
    return dir === 'rtl'
      ? `اختر تاريخاً حتى ${shortDate(max)}`
      : `Choose a date up to ${shortDate(max)}`;
  }
  return null;
}

/** True when every part is typed and the day is past its month's end: shown at once. */
export function isImpossible(fields: DateFields): boolean {
  const { day, month, year } = fields;
  return (
    day !== null &&
    month !== null &&
    year !== null &&
    year >= 1000 &&
    day > daysInMonth(year, month)
  );
}
