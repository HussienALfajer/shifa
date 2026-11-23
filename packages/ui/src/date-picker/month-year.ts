// The month and year panel's ranges (slice 0.4-13 criterion 14, spec edge case): the years the
// list holds and the months outside `min`/`max`. Pure, so the rules are tested apart from the UI.

export interface Bounds {
  /** ISO dates. */
  min?: string | undefined;
  max?: string | undefined;
}

/**
 * The years of the list: both bounds → min's year to max's year; only min → to ten years after
 * today; only max → from 120 years before max; neither → 1900 to ten years after today.
 */
export function yearRange({ min, max, todayYear }: Bounds & { todayYear: number }): {
  first: number;
  last: number;
} {
  const minYear = min === undefined ? undefined : Number(min.slice(0, 4));
  const maxYear = max === undefined ? undefined : Number(max.slice(0, 4));
  if (minYear !== undefined && maxYear !== undefined) return { first: minYear, last: maxYear };
  if (minYear !== undefined) return { first: minYear, last: todayYear + 10 };
  if (maxYear !== undefined) return { first: maxYear - 120, last: maxYear };
  return { first: 1900, last: todayYear + 10 };
}

const monthKey = (year: number, month: number) =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;

/** True when no day of the month is between `min` and `max`. */
export function isMonthDisabled(year: number, month: number, { min, max }: Bounds): boolean {
  const key = monthKey(year, month);
  if (min !== undefined && key < min.slice(0, 7)) return true;
  return max !== undefined && key > max.slice(0, 7);
}

/** «2026-11» from a year and a month. */
export const isoMonth = monthKey;
