// The typed date's model (slice 0.4-13, OD-72): three numbers and the digits being typed into
// one of them. Our own, not UI SDK's `DateInput`, because UI SDK moves a day past its month's
// end back to the last day without a word (31/02 becomes 28/02); here the day stays as typed and
// the error names the month's length. Behaviour otherwise follows the UI SDK gate
// (`date-input.gate.test.tsx`): a digit that cannot start a longer number completes its segment;
// Up and Down step and wrap; an empty segment starts at today.

export type DateUnit = 'day' | 'month' | 'year';
export const DATE_UNITS: readonly DateUnit[] = ['day', 'month', 'year'];

export interface DateFields {
  day: number | null;
  month: number | null;
  year: number | null;
}

export interface Entry {
  fields: DateFields;
  /** The digits typed so far into one segment, before it is full. */
  buffer: { unit: DateUnit; text: string } | null;
}

export const EMPTY_FIELDS: DateFields = { day: null, month: null, year: null };
export const EMPTY_ENTRY: Entry = { fields: EMPTY_FIELDS, buffer: null };

/** The smallest and largest number a segment takes while typing. */
export const BOUNDS: Record<DateUnit, readonly [number, number]> = {
  day: [1, 31],
  month: [1, 12],
  year: [1, 9999],
};
const DIGITS: Record<DateUnit, number> = { day: 2, month: 2, year: 4 };
const PAGE: Record<DateUnit, number> = { day: 7, month: 3, year: 5 };
export const pageStep = (unit: DateUnit): number => PAGE[unit];

export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const pad = (value: number, length: number) => String(value).padStart(length, '0');

/** What a segment shows: the digits being typed, the padded number, or nothing. */
export function segmentText(entry: Entry, unit: DateUnit): string {
  if (entry.buffer?.unit === unit) return entry.buffer.text;
  const value = entry.fields[unit];
  if (value === null) return '';
  // A short year stays as typed («87»), for the error to ask for four digits; never «0087».
  return unit === 'year' ? String(value) : pad(value, DIGITS[unit]);
}

/** Types one digit into `unit`; `done` when the segment is full and focus should move on. */
export function typeDigit(
  entry: Entry,
  unit: DateUnit,
  digit: string,
): { entry: Entry; done: boolean } {
  const [min, max] = BOUNDS[unit];
  let text = entry.buffer?.unit === unit ? entry.buffer.text + digit : digit;
  if (text.length > DIGITS[unit] || Number(text) > max) text = digit;
  const number = Number(text);
  const done = text.length >= DIGITS[unit] || number * 10 > max;
  const value = number >= min && number <= max ? number : null;
  const fields = { ...entry.fields, [unit]: value };
  return { entry: { fields, buffer: done ? null : { unit, text } }, done };
}

/** Ends typing in a segment: the digits typed so far become its number. */
export const settle = (entry: Entry): Entry =>
  entry.buffer === null ? entry : { fields: entry.fields, buffer: null };

/** Backspace: drops the last typed digit, then empties the segment, then asks to move back. */
export function removeDigit(entry: Entry, unit: DateUnit): { entry: Entry; back: boolean } {
  const typing = entry.buffer?.unit === unit ? entry.buffer.text : null;
  if (typing !== null && typing.length > 1) {
    const text = typing.slice(0, -1);
    const number = Number(text);
    const value = number >= BOUNDS[unit][0] ? number : null;
    return {
      entry: { fields: { ...entry.fields, [unit]: value }, buffer: { unit, text } },
      back: false,
    };
  }
  if (entry.fields[unit] !== null || typing !== null) {
    return { entry: { fields: { ...entry.fields, [unit]: null }, buffer: null }, back: false };
  }
  return { entry, back: true };
}

/** A segment's range for stepping: the day stops at its month's last day once the month is known. */
function stepBounds(fields: DateFields, unit: DateUnit): readonly [number, number] {
  if (unit === 'day' && fields.month !== null) {
    return [1, daysInMonth(fields.year ?? 2000, fields.month)];
  }
  return BOUNDS[unit];
}

/** Up/Down (±1) or Page Up/Down: steps `unit`, wrapping; an empty segment starts at `today`. */
export function stepEntry(entry: Entry, unit: DateUnit, delta: number, today: DateFields): Entry {
  const { fields } = entry;
  const [min, max] = stepBounds(fields, unit);
  const current = fields[unit];
  const span = max - min + 1;
  const value =
    current === null
      ? Math.min(today[unit] ?? min, max)
      : min + ((((current - min + delta) % span) + span) % span);
  return { fields: { ...fields, [unit]: value }, buffer: null };
}

/** Home and End: the segment's first or last value. */
export function stepToEnd(entry: Entry, unit: DateUnit, end: 'min' | 'max'): Entry {
  const { fields } = entry;
  const [min, max] = stepBounds(fields, unit);
  return { fields: { ...fields, [unit]: end === 'min' ? min : max }, buffer: null };
}

/** True when every segment holds a number. */
export const isComplete = (fields: DateFields): boolean =>
  fields.day !== null && fields.month !== null && fields.year !== null;

/** True when no segment holds anything. */
export const isEmpty = (entry: Entry): boolean =>
  entry.buffer === null && DATE_UNITS.every((unit) => entry.fields[unit] === null);

/** The ISO date, or null unless the date exists and its year has four digits. */
export function toIso(fields: DateFields): string | null {
  const { day, month, year } = fields;
  if (day === null || month === null || year === null || year < 1000) return null;
  if (day > daysInMonth(year, month)) return null;
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** The fields of an ISO date; anything else is empty. */
export function fieldsFromIso(iso: string | null | undefined): DateFields {
  const match = typeof iso === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (match === null) return EMPTY_FIELDS;
  const fields = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return toIso(fields) === null ? EMPTY_FIELDS : fields;
}

export const entryFromIso = (iso: string | null | undefined): Entry => {
  const fields = fieldsFromIso(iso);
  return fields === EMPTY_FIELDS ? EMPTY_ENTRY : { fields, buffer: null };
};

/** Today's fields in the person's own time zone. */
export function todayFields(now = new Date()): DateFields {
  return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
}
