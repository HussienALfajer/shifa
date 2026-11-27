// A chart's date of birth (spec A-03 criterion 1): an exact date as typed, or an age turned into an
// estimated date on today's Damascus day (years, or months under 2). Days travel as `YYYY-MM-DD`.
import type { PatientAge } from '@shifa/contracts';
import type { Clock } from '../../platform/clock.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { damascusDay } from '../usage/index.ts';

/** The oldest date of birth accepted, in years before today. */
const MAX_YEARS = 130;

export interface BirthInput {
  readonly birthDate?: string | undefined;
  readonly age?: PatientAge | undefined;
}

export interface Birth {
  readonly birthDate: string;
  readonly estimated: boolean;
}

/** Today's calendar day in Damascus, whatever the server's zone. */
export function damascusToday(clock: Clock): string {
  return damascusDay(clock.now());
}

function partsOf(day: string): [number, number, number] {
  const [y = 1970, m = 1, d = 1] = day.split('-').map(Number);
  return [y, m, d];
}

/** `day` minus whole months; a day the earlier month lacks falls on its last day. */
function monthsBefore(day: string, months: number): string {
  const [y, m, d] = partsOf(day);
  const index = y * 12 + (m - 1) - months;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(Math.min(d, last), 2)}`;
}

/**
 * The birth an input asks for on `today`: undefined when it gives none (an edit that keeps it).
 * A date after today or more than 130 years back answers 400 on body.birthDate.
 */
export function birthOf(input: { birthDate: string } | { age: PatientAge }, today: string): Birth;
export function birthOf(input: BirthInput, today: string): Birth | undefined;
export function birthOf(input: BirthInput, today: string): Birth | undefined {
  if (input.age !== undefined) {
    const months = input.age.unit === 'years' ? input.age.value * 12 : input.age.value;
    return { birthDate: monthsBefore(today, months), estimated: true };
  }
  if (input.birthDate === undefined) return undefined;
  if (input.birthDate > today || input.birthDate < monthsBefore(today, MAX_YEARS * 12)) {
    throw new RequestValidationError([{ path: 'body.birthDate', code: 'invalid_value' }]);
  }
  return { birthDate: input.birthDate, estimated: false };
}
