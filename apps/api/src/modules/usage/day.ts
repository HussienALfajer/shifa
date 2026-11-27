// The usage day (A-02 criterion 17): the calendar day in Damascus, where the clinics are, whatever
// the server's zone. Days travel as `YYYY-MM-DD` strings, compared and stepped in UTC.

const DAMASCUS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Damascus',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The Damascus calendar day of `at`, `YYYY-MM-DD`. */
export function damascusDay(at: Date): string {
  return DAMASCUS.format(at);
}

/** `day` moved by `days` (negative: earlier). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}
