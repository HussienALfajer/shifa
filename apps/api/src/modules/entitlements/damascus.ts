// Damascus calendar days (A-02 criterion 3): an override's expiry is a date, in force to the end of
// that day in Asia/Damascus; today or a past date is refused.

const ZONE = 'Asia/Damascus';
const DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** The Damascus calendar day of `at`, `YYYY-MM-DD`. */
export function damascusDate(at: Date): string {
  return DAY.format(at);
}

/** Damascus's offset from UTC at `at`, in ms. */
function offsetAt(at: Date): number {
  const p = Object.fromEntries(PARTS.formatToParts(at).map((x) => [x.type, x.value]));
  const local = Date.UTC(
    Number(p['year']),
    Number(p['month']) - 1,
    Number(p['day']),
    Number(p['hour']),
    Number(p['minute']),
    Number(p['second']),
  );
  return local - Math.floor(at.getTime() / 1000) * 1000;
}

/** The first instant after Damascus day `date` (`YYYY-MM-DD`): 00:00 of the next day there. */
export function endOfDamascusDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + 1);
  const first = guess - offsetAt(new Date(guess));
  // Once more at the found instant, in case the offset changed in between (a DST change).
  return new Date(guess - offsetAt(new Date(first)));
}

/** The last Damascus day an expiry instant (from endOfDamascusDay()) counts. */
export function lastDamascusDay(expiresAt: Date): string {
  return damascusDate(new Date(expiresAt.getTime() - 1));
}

/** True when `date` is a real calendar date after the Damascus day of `now`. */
export function isAfterToday(date: string, now: Date): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const real = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).toISOString().slice(0, 10);
  return real === date && date > damascusDate(now);
}
