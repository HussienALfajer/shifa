// The identity inputs of a chart as typed (spec A-03 criterion 1), shared by registration, edit and
// the duplicate check (A-03-04). Internal to the package: index.ts exports the named schemas and
// functions through patients.ts, never these unnamed field schemas.
import { z } from 'zod';

const LETTER = /^[\p{L}\p{M}]$/u;
const SCRIPT = /^[\p{sc=Arabic}\p{sc=Latin}\p{sc=Inherited}]$/u;
const IS_LETTER = /^\p{L}$/u;
const SEPARATORS = new Set([' ', '-', "'", '’']);
/** Control, format, unassigned and line or paragraph separator characters (NUL, bidi, zero-width). */
const HIDDEN = /[\p{C}\p{Zl}\p{Zp}]/u;

/**
 * One part of a patient's name (criterion 1): Arabic or Latin letters (with their marks), spaces,
 * hyphens and apostrophes, with at least one letter. The 1–40 length is the schema's. Shared by
 * the browser and the server.
 */
export function isPatientNamePart(value: string): boolean {
  let letters = 0;
  for (const char of value) {
    if (SEPARATORS.has(char)) continue;
    if (!LETTER.test(char) || !SCRIPT.test(char)) return false;
    if (IS_LETTER.test(char)) letters += 1;
  }
  return letters > 0;
}

/** A name part as stored: trimmed, runs of spaces as one. */
export function cleanPatientNamePart(value: string): string {
  return value.trim().replace(/ {2,}/g, ' ');
}

/** The display name (criterion 1): given, father, family; empty parts left out. */
export function patientDisplayName(parts: {
  givenName: string;
  fatherName: string | null;
  familyName: string | null;
}): string {
  return [parts.givenName, parts.fatherName, parts.familyName]
    .filter((p): p is string => p !== null)
    .map(cleanPatientNamePart)
    .filter((p) => p !== '')
    .join(' ');
}

export const NamePart = z.string().min(1).max(40).refine(isPatientNamePart);

/**
 * A calendar date, `YYYY-MM-DD`, kept a string on the wire (as in platform.ts: generated clients
 * would turn `format: date` into a timestamp).
 */
export const CalendarDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);

/** A date that exists (no 30 February). */
function isRealDate(day: string): boolean {
  const [y = 0, m = 0, d = 0] = day.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}
export const BirthDateInput = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { abort: true })
  .refine(isRealDate);
/** As typed; normalised to E.164 by the server (400 on its path when invalid; +963 and +90). */
export const PhoneInput = z.string().min(1).max(32);
/**
 * The paper file number as typed: 1–40 characters, not only spaces; kept trimmed. No hidden
 * characters: they reach the database as errors or make two numbers look alike (security review
 * L1).
 */
export const PreviousFileNumber = z
  .string()
  .max(40)
  .regex(/\S/)
  .refine((v) => !HIDDEN.test(v));

export const AgeUnit = z.enum(['years', 'months']).meta({ id: 'AgeUnit' });
export type AgeUnit = z.infer<typeof AgeUnit>;

/** An age as typed (criterion 1): 2–130 years, or 0–23 months under 2. */
export const PatientAge = z
  .object({ value: z.int(), unit: AgeUnit })
  .refine(
    (a) => (a.unit === 'years' ? a.value >= 2 && a.value <= 130 : a.value >= 0 && a.value <= 23),
    {
      path: ['value'],
    },
  )
  .meta({ id: 'PatientAge' });
export type PatientAge = z.infer<typeof PatientAge>;
