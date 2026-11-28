// Duplicates, family and treating doctors (spec A-03 criteria 7, 9, 10, 27, 29; slice A-03-04;
// contract rows `POST /patients/duplicates`, `POST /patients/family`, `GET /patients/doctors`).
// The duplicate check and the family preview carry names and phones, so they are reads by POST
// (the screen contract's privacy rule); neither writes an audit row.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';
import { DuplicateCandidate, FamilyMember, TreatingDoctor } from './patient-card.ts';
import { BirthDateInput, NamePart, PatientAge, PhoneInput } from './patient-input.ts';

/**
 * The registration fields so far (criterion 7), sent when the name, phone or birth settles. A
 * field not yet typed is left out; a phone that is not yet a valid number is ignored. Candidates:
 * the same contact phone with a similar given name, or a similar full name (two words or more)
 * with a birth year within 2 years. `excludeId`: the chart being edited.
 */
export const DuplicateCheckRequest = z
  .object({
    givenName: NamePart.optional(),
    fatherName: NamePart.nullable().optional(),
    familyName: NamePart.nullable().optional(),
    contactPhone: PhoneInput.optional(),
    birthDate: BirthDateInput.optional(),
    age: PatientAge.optional(),
    excludeId: z.uuid().nullable().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.birthDate !== undefined && input.age !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['birthDate'], message: 'a date of birth or an age' });
    }
  })
  .meta({ id: 'DuplicateCheckRequest' });
export type DuplicateCheckRequest = z.infer<typeof DuplicateCheckRequest>;

/** At most 5 candidates, phone matches first, then by file number. */
export const DuplicateCandidates = z
  .object({ candidates: z.array(DuplicateCandidate).max(5) })
  .meta({ id: 'DuplicateCandidates' });
export type DuplicateCandidates = z.infer<typeof DuplicateCandidates>;

/** The family on a phone (criteria 9, 29): any accepted format; `excludeId`, the chart edited. */
export const PatientFamilyRequest = z
  .object({ phone: PhoneInput, excludeId: z.uuid().nullable().optional() })
  .meta({ id: 'PatientFamilyRequest' });
export type PatientFamilyRequest = z.infer<typeof PatientFamilyRequest>;

/**
 * The active charts on the phone: its holder (the chart with `relation: "holder"`), and the
 * others by file number. No holder and no members: the phone is new to the clinic, and the chart
 * registered on it becomes its holder (no relation asked).
 */
export const PatientFamily = z
  .object({ holder: FamilyMember.nullable(), members: z.array(FamilyMember) })
  .meta({ id: 'PatientFamily' });
export type PatientFamily = z.infer<typeof PatientFamily>;

/** The clinic's doctor members (criterion 10): active ones are offered, inactive ones marked. */
export const PatientDoctors = z
  .object({ doctors: z.array(TreatingDoctor) })
  .meta({ id: 'PatientDoctors' });
export type PatientDoctors = z.infer<typeof PatientDoctors>;

export const patientsDuplicates = defineContract({
  operationId: 'patientsDuplicates',
  method: 'POST',
  path: '/patients/duplicates',
  summary: 'Charts that may be the patient being registered',
  request: { body: DuplicateCheckRequest },
  responses: { 200: DuplicateCandidates, 400: ErrorEnvelope },
});

export const patientsFamily = defineContract({
  operationId: 'patientsFamily',
  method: 'POST',
  path: '/patients/family',
  summary: 'The family on a contact phone',
  request: { body: PatientFamilyRequest },
  // 400 `validation_failed` on `body.phone` until the number is complete.
  responses: { 200: PatientFamily, 400: ErrorEnvelope },
});

export const patientsDoctors = defineContract({
  operationId: 'patientsDoctors',
  method: 'GET',
  path: '/patients/doctors',
  summary: 'The clinic’s doctors, to pick as treating doctors',
  responses: { 200: PatientDoctors },
});
