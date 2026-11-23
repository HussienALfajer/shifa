// A pasted date (slice 0.4-13 criterion 15): day, month and year separated by `/`, `-`, `.` or
// spaces; an ISO date (year first); or eight digits ddmmyyyy. Arabic-Indic digits are read as
// Western ones (OD-20). A two-digit year is kept as typed: the century is never guessed
// (criterion 16), the error asks for four digits. A day past its month's end is kept too, for
// the error to name.
import { westernNumberText } from '../lib/use-western-digits.ts';

export interface DateParts {
  day: number;
  month: number;
  year: number;
}

const SEPARATED = /^(\d{1,2})[\s/.-]+(\d{1,2})[\s/.-]+(\d{2}|\d{4})$/;
const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const EIGHT_DIGITS = /^(\d{2})(\d{2})(\d{4})$/;

/** The parts of a pasted date, or null when it is not one of the formats above. */
export function parseDateText(text: string): DateParts | null {
  const western = westernNumberText(text).trim();
  const iso = ISO.exec(western);
  const match = iso === null ? (SEPARATED.exec(western) ?? EIGHT_DIGITS.exec(western)) : null;
  let parts: DateParts;
  if (iso !== null) {
    parts = { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  } else if (match !== null) {
    parts = { day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) };
  } else {
    return null;
  }
  const { day, month } = parts;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return parts;
}
