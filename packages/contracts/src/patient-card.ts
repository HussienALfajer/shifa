// A chart in an answer (A-03 screen contract, "A chart in an answer"), shared by search, family
// lists and duplicate candidates, and by the 409 `possible_duplicate` envelope (errors.ts), so it
// lives apart from patients.ts (which imports errors.ts). Slice A-03-04.
import { z } from 'zod';

/** `YYYY-MM-DD`, kept a string on the wire (see patients.ts). */
const CalendarDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);

export const Sex = z.enum(['male', 'female']).meta({ id: 'Sex' });
export type Sex = z.infer<typeof Sex>;

export const PatientState = z.enum(['active', 'archived', 'merged']).meta({ id: 'PatientState' });
export type PatientState = z.infer<typeof PatientState>;

/**
 * The relation to the phone's holder (criterion 9; OD-138): «صاحب الهاتف، ابن، ابنة، زوج، زوجة،
 * أب، أم، أخ، أخت، آخر». The screens label the keys through i18n.
 */
export const PATIENT_RELATIONS = [
  'holder',
  'son',
  'daughter',
  'husband',
  'wife',
  'father',
  'mother',
  'brother',
  'sister',
  'other',
] as const;
export const PatientRelation = z.enum(PATIENT_RELATIONS).meta({ id: 'PatientRelation' });
export type PatientRelation = z.infer<typeof PatientRelation>;

/** A chart in an answer: the age is worked out on the client from `birthDate`. */
export const PatientCard = z
  .object({
    id: z.uuid(),
    /** Given, father, family. */
    displayName: z.string(),
    fileNumber: z.int().min(1),
    sex: Sex,
    birthDate: CalendarDate,
    birthDateEstimated: z.boolean(),
    /** E.164. */
    contactPhone: z.string(),
    state: PatientState,
  })
  .meta({ id: 'PatientCard' });
export type PatientCard = z.infer<typeof PatientCard>;

/** A chart of a family with its relation to the phone's holder (null: not given). */
export const FamilyMember = PatientCard.extend({ relation: PatientRelation.nullable() }).meta({
  id: 'FamilyMember',
});
export type FamilyMember = z.infer<typeof FamilyMember>;

/**
 * A treating doctor (criterion 10): a doctor member of the clinic, by membership id. `active`:
 * the member is active and still holds the doctor role; an inactive one stays on charts that list
 * them («غير نشط») and is not offered.
 */
export const TreatingDoctor = z
  .object({ memberId: z.uuid(), name: z.string(), active: z.boolean() })
  .meta({ id: 'TreatingDoctor' });
export type TreatingDoctor = z.infer<typeof TreatingDoctor>;

/** Why a chart is a candidate (criterion 7). */
export const DuplicateReason = z
  .enum(['same_phone_similar_name', 'similar_name_near_birth_year'])
  .meta({ id: 'DuplicateReason' });
export type DuplicateReason = z.infer<typeof DuplicateReason>;

/**
 * A possible duplicate (criteria 7, 11). `visible`: the member may open it, and `card` is its
 * card; otherwise (hidden by "my patients only", A-03-07) `card` is null and only the file number
 * is shown («ملف مشابه لدى طبيب آخر · 1188»). Archived ones carry `state: "archived"` in the card.
 */
export const DuplicateCandidate = z
  .object({
    visible: z.boolean(),
    fileNumber: z.int().min(1),
    reason: DuplicateReason,
    card: PatientCard.nullable(),
  })
  .meta({ id: 'DuplicateCandidate' });
export type DuplicateCandidate = z.infer<typeof DuplicateCandidate>;
