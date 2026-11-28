// Patients (spec A-03; slice A-03-02): a clinic's chart and its identity. Reception registers a
// chart (the id is the client's, so a retry or A-05's offline registration needs no new id),
// gets the clinic's next file number, opens and edits it; the owner archives and restores it.
// A-03-03 adds search; A-03-04 the relation, the family and treating doctors (their own routes in
// patient-links.ts). Later A-03 slices add custom fields and the read audit.
// Privacy (spec, "Money, abuse and privacy"): names, phones, dates of birth and previous numbers
// travel in bodies only; paths carry chart ids.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';
import {
  FamilyMember,
  PatientRelation,
  PatientState,
  Sex,
  TreatingDoctor,
} from './patient-card.ts';
import {
  BirthDateInput,
  CalendarDate,
  NamePart,
  PatientAge,
  PhoneInput,
  PreviousFileNumber,
} from './patient-input.ts';

export * from './patient-card.ts';
export {
  AgeUnit,
  cleanPatientNamePart,
  isPatientNamePart,
  PatientAge,
  patientDisplayName,
} from './patient-input.ts';

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
    /** The relation to the phone's holder (A-03-04; criterion 9). */
    relation: PatientRelation.nullable(),
    /** The other active charts on the contact phone, holder first (A-03-04). */
    family: z.array(FamilyMember),
    /** By name (A-03-04; criterion 10); inactive ones marked. */
    treatingDoctors: z.array(TreatingDoctor),
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
  /**
   * A-03-04 (criteria 9, 29): asked only when the phone has a holder (`holder` then refused); a
   * phone new to the clinic makes the chart its holder (any other value refused). 400 on
   * `body.relation`.
   */
  relation: PatientRelation.nullable().optional(),
  /**
   * A-03-04 (criterion 10): membership ids of doctor members (400 `doctor_not_member`); a doctor
   * who registers is added. On an edit, the whole list (an inactive doctor already on it may stay).
   */
  treatingDoctorIds: z.array(z.uuid()).max(20).optional(),
  /**
   * A-03-04 (criterion 7): the candidates the member checked; a candidate not listed answers 409
   * `possible_duplicate`. On an edit, checked only when a name part or the phone changes (contract
   * row "Edit").
   */
  acknowledgedCandidateIds: z.array(z.uuid()).max(5).optional(),
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
 * One search result (criteria 4, 24): the chart's card with its name parts, why it matched, and
 * which parts matched (0 `givenName`, 1 `fatherName`, 2 `familyName`; empty for a number, a phone
 * or a typo match), so the screen marks those parts' words in the display name. `mergedFileNumber`:
 * the merged chart's number that led here (A-03-08), else null.
 */
export const PatientSearchResult = z
  .object({
    id: z.uuid(),
    displayName: z.string(),
    givenName: z.string(),
    fatherName: z.string().nullable(),
    familyName: z.string().nullable(),
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
    /** A-03-04: active charts on the contact phone, this one included («العائلة»). */
    familySize: z.int().min(1),
    /** A-03-04: the relation to the phone's holder. */
    relation: PatientRelation.nullable(),
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
  // 400 `validation_failed` (a name part, a phone, the birth, the relation) or
  // `doctor_not_member`; 409 `previous_file_number_taken`, `patient_id_taken` (the id holds another
  // chart of this clinic) or `possible_duplicate` (with `candidates`; nothing saved).
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
  // 400 as for the create; 409 `stale` (with `stale`), `patient_archived`, `patient_merged`,
  // `previous_file_number_taken`, `possible_duplicate` (a name part or the phone changed).
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
