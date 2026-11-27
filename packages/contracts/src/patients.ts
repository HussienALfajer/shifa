// Patients (spec A-03; slice A-03-02): a clinic's chart and its identity. Reception registers a
// chart (the id is the client's, so a retry or A-05's offline registration needs no new id),
// gets the clinic's next file number, opens and edits it; the owner archives and restores it.
// Later A-03 slices add the relation, treating doctors, custom fields, search and the read audit.
// Privacy (spec, "Money, abuse and privacy"): names, phones, dates of birth and previous numbers
// travel in bodies only; paths carry chart ids.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';

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

const NamePart = z.string().min(1).max(40).refine(isPatientNamePart);

/**
 * A calendar date, `YYYY-MM-DD`, kept a string on the wire (as in platform.ts: generated clients
 * would turn `format: date` into a timestamp).
 */
const CalendarDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);

/** A date that exists (no 30 February). */
function isRealDate(day: string): boolean {
  const [y = 0, m = 0, d = 0] = day.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}
const BirthDateInput = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { abort: true })
  .refine(isRealDate);
/** As typed; normalised to E.164 by the server (400 on its path when invalid; +963 and +90). */
const PhoneInput = z.string().min(1).max(32);
/**
 * The paper file number as typed: 1–40 characters, not only spaces; kept trimmed. No hidden
 * characters: they reach the database as errors or make two numbers look alike (security review
 * L1).
 */
const PreviousFileNumber = z
  .string()
  .max(40)
  .regex(/\S/)
  .refine((v) => !HIDDEN.test(v));

export const Sex = z.enum(['male', 'female']).meta({ id: 'Sex' });
export type Sex = z.infer<typeof Sex>;

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

export const PatientState = z.enum(['active', 'archived', 'merged']).meta({ id: 'PatientState' });
export type PatientState = z.infer<typeof PatientState>;

export const PatientBranch = z
  .object({ id: z.uuid(), name: z.string() })
  .meta({ id: 'PatientBranch' });

/** The chart a merged chart leads to (A-03-08). */
export const PatientMergedInto = z
  .object({ id: z.uuid(), fileNumber: z.int() })
  .meta({ id: 'PatientMergedInto' });

/**
 * A chart's summary, identity part (criteria 12, 32; contract `GET /patients/:id`). The age is
 * worked out on the client from `birthDate` and the Damascus day; «~» when estimated.
 */
export const PatientChart = z
  .object({
    id: z.uuid(),
    /** Given, father, family. */
    displayName: z.string(),
    /** The clinic's file number: one counter for all its branches, from 1, never reused. */
    fileNumber: z.int().min(1),
    sex: Sex,
    /** `YYYY-MM-DD`. */
    birthDate: CalendarDate,
    birthDateEstimated: z.boolean(),
    /** E.164. */
    contactPhone: z.string(),
    state: PatientState,
    givenName: z.string(),
    fatherName: z.string().nullable(),
    familyName: z.string().nullable(),
    motherName: z.string().nullable(),
    /** E.164. */
    secondPhone: z.string().nullable(),
    previousFileNumber: z.string().nullable(),
    /** Where it was registered; null when the session had no branch and the clinic several. */
    registeredBranch: PatientBranch.nullable(),
    createdAt: z.iso.datetime(),
    createdByName: z.string().nullable(),
    updatedAt: z.iso.datetime(),
    updatedByName: z.string().nullable(),
    archivedAt: z.iso.datetime().nullable(),
    archivedByName: z.string().nullable(),
    mergedInto: PatientMergedInto.nullable(),
  })
  .meta({ id: 'PatientChart' });
export type PatientChart = z.infer<typeof PatientChart>;

const identityFields = {
  fatherName: NamePart.nullable().optional(),
  familyName: NamePart.nullable().optional(),
  motherName: NamePart.nullable().optional(),
  secondPhone: PhoneInput.nullable().optional(),
  birthDate: BirthDateInput.optional(),
  age: PatientAge.optional(),
  previousFileNumber: PreviousFileNumber.nullable().optional(),
};

/** Registration (criteria 1–3; contract `POST /patients`): a date of birth or an age, not both. */
export const CreatePatientRequest = z
  .object({
    /** Chosen by the client and kept across retries (criterion 3). */
    id: z.uuid(),
    givenName: NamePart,
    contactPhone: PhoneInput,
    sex: Sex,
    ...identityFields,
  })
  .superRefine((input, ctx) => {
    if ((input.birthDate === undefined) === (input.age === undefined)) {
      ctx.addIssue({ code: 'custom', path: ['birthDate'], message: 'a date of birth or an age' });
    }
  })
  .meta({ id: 'CreatePatientRequest' });
export type CreatePatientRequest = z.infer<typeof CreatePatientRequest>;

/**
 * An edit (criteria 12, 28; contract `PATCH /patients/:id`): only the fields given change, `null`
 * clears an optional one; a date of birth or an age, not both. `expectedUpdatedAt` is the
 * `updatedAt` the form was filled from (409 `stale` when someone saved since).
 */
export const UpdatePatientRequest = z
  .object({
    expectedUpdatedAt: z.iso.datetime(),
    givenName: NamePart.optional(),
    contactPhone: PhoneInput.optional(),
    sex: Sex.optional(),
    ...identityFields,
  })
  .superRefine((input, ctx) => {
    if (input.birthDate !== undefined && input.age !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['birthDate'], message: 'a date of birth or an age' });
    }
  })
  .meta({ id: 'UpdatePatientRequest' });
export type UpdatePatientRequest = z.infer<typeof UpdatePatientRequest>;

/** Archive or restore (criteria 13, 28): the `updatedAt` the screen shows. */
export const PatientStateChangeRequest = z
  .object({ expectedUpdatedAt: z.iso.datetime() })
  .meta({ id: 'PatientStateChangeRequest' });
export type PatientStateChangeRequest = z.infer<typeof PatientStateChangeRequest>;

/** The page line and the first-patient state (criterion 22). Visibility comes with A-03-07. */
export const PatientCount = z
  .object({
    active: z.int().min(0),
    /** 0 for a member who may not archive (only the owner sees archived charts). */
    archived: z.int().min(0),
  })
  .meta({ id: 'PatientCount' });
export type PatientCount = z.infer<typeof PatientCount>;

export const PatientIdParams = z.object({ id: z.uuid() }).meta({ id: 'PatientIdParams' });

/**
 * A search (criteria 4, 21; contract `POST /patients/search`): the term travels in the body
 * only. A name needs 2 letters, digits search from 1 for a file number and from 7 for a phone
 * tail (400 `validation_failed` on `body.term` otherwise). `includeArchived` needs
 * `patients.archive` (403 otherwise).
 */
export const PatientSearchRequest = z
  .object({
    term: z.string().max(100).regex(/\S/u),
    includeArchived: z.boolean().optional(),
  })
  .meta({ id: 'PatientSearchRequest' });
export type PatientSearchRequest = z.infer<typeof PatientSearchRequest>;

/** Why a result matched (criterion 24); `custom_field` comes with A-03-06. */
export const PatientMatchKind = z
  .enum([
    'name',
    'name_variant',
    'name_order',
    'phone',
    'phone_tail',
    'file_number',
    'previous_file_number',
    'custom_field',
  ])
  .meta({ id: 'PatientMatchKind' });
export type PatientMatchKind = z.infer<typeof PatientMatchKind>;

/**
 * One search result (criteria 4, 24): the chart's card, why it matched, and which display-name
 * parts matched (0 given, 1 father, 2 family; empty for a number or phone). `mergedFileNumber`:
 * the merged chart's number that led here (A-03-08), else null. `familySize` and `relation`
 * come with A-03-04.
 */
export const PatientSearchResult = z
  .object({
    id: z.uuid(),
    displayName: z.string(),
    fileNumber: z.int().min(1),
    sex: Sex,
    /** `YYYY-MM-DD`. */
    birthDate: CalendarDate,
    birthDateEstimated: z.boolean(),
    /** E.164. */
    contactPhone: z.string(),
    state: PatientState,
    archivedAt: z.iso.datetime().nullable(),
    matchedBy: PatientMatchKind,
    matchedParts: z.array(z.int().min(0).max(2)),
    mergedFileNumber: z.int().min(1).nullable(),
  })
  .meta({ id: 'PatientSearchResult' });
export type PatientSearchResult = z.infer<typeof PatientSearchResult>;

/** At most 20 results, best first; `truncated` when more charts matched (criterion 21). */
export const PatientSearchResults = z
  .object({ results: z.array(PatientSearchResult).max(20), truncated: z.boolean() })
  .meta({ id: 'PatientSearchResults' });
export type PatientSearchResults = z.infer<typeof PatientSearchResults>;

export const patientsCount = defineContract({
  operationId: 'patientsCount',
  method: 'GET',
  path: '/patients/count',
  summary: 'How many active and archived charts the clinic holds',
  responses: { 200: PatientCount },
});

export const patientsSearch = defineContract({
  operationId: 'patientsSearch',
  method: 'POST',
  path: '/patients/search',
  summary: 'Find charts by name, phone, file number or previous file number',
  request: { body: PatientSearchRequest },
  // 400 `validation_failed` (`body.term` too short); 403 `forbidden` (`includeArchived` without
  // `patients.archive`); 429 `rate_limited`. A read: allowed in a support session.
  responses: { 200: PatientSearchResults, 400: ErrorEnvelope, 429: ErrorEnvelope },
});

export const patientsCreate = defineContract({
  operationId: 'patientsCreate',
  method: 'POST',
  path: '/patients',
  summary: 'Register a chart; the same id and body again returns the stored chart',
  request: { body: CreatePatientRequest },
  // 400 `validation_failed` (a name part, a phone, the birth); 409 `previous_file_number_taken`
  // or `patient_id_taken` (the id holds another chart of this clinic).
  responses: { 201: PatientChart, 400: ErrorEnvelope, 409: ErrorEnvelope },
});

export const patientsGet = defineContract({
  operationId: 'patientsGet',
  method: 'GET',
  path: '/patients/:id',
  summary: 'A chart’s summary (identity part)',
  request: { params: PatientIdParams },
  responses: { 200: PatientChart, 404: ErrorEnvelope },
});

export const patientsUpdate = defineContract({
  operationId: 'patientsUpdate',
  method: 'PATCH',
  path: '/patients/:id',
  summary: 'Edit a chart’s identity',
  request: { params: PatientIdParams, body: UpdatePatientRequest },
  // 409 `stale` (with `stale`), `patient_archived`, `patient_merged`, `previous_file_number_taken`.
  responses: { 200: PatientChart, 400: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const patientsArchive = defineContract({
  operationId: 'patientsArchive',
  method: 'POST',
  path: '/patients/:id/archive',
  summary: 'Archive a chart (never deleted)',
  request: { params: PatientIdParams, body: PatientStateChangeRequest },
  // 409 `stale` (with `stale`), `patient_archived`, `patient_merged`.
  responses: { 200: PatientChart, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const patientsRestore = defineContract({
  operationId: 'patientsRestore',
  method: 'POST',
  path: '/patients/:id/restore',
  summary: 'Restore an archived chart',
  request: { params: PatientIdParams, body: PatientStateChangeRequest },
  // 409 `stale` (with `stale`), `patient_not_archived`.
  responses: { 200: PatientChart, 404: ErrorEnvelope, 409: ErrorEnvelope },
});
