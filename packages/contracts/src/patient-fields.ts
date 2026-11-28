// Custom field definitions (spec A-03 criteria 14–17, 37–39; slice A-03-05; ADR-0008, OD-144;
// contract rows `GET /patients/fields`, `GET /patients/fields/definitions`, `POST /patients/fields`,
// `PATCH /patients/fields/:key`, `PUT /patients/fields/order`, archive and restore). Paths carry
// the field key (`cf_…`) only; labels and values travel in bodies and never reach a URL, a log or
// an audit row. Values on charts are A-03-06's.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';
import { SessionRole } from './identity.ts';
import {
  PATIENT_FIELD_PATTERN_PRESETS,
  PATIENT_FIELD_RULES,
  PATIENT_FIELD_TYPES,
} from './patient-field-rules.ts';

export {
  checkPatientFieldPattern,
  checkPatientFieldValue,
  PATIENT_FIELD_RULES,
  PATIENT_FIELD_SEARCHABLE_TYPES,
  type PatientFieldRuleProblem,
  type PatientFieldRules,
  patientFieldRuleProblems,
  searchKeyOfPatientFieldValue,
  storedPatientFieldValue,
} from './patient-field-rules.ts';

/** The eight types; fixed after creation (criterion 14). */
export const PatientFieldType = z.enum(PATIENT_FIELD_TYPES).meta({ id: 'PatientFieldType' });
export type PatientFieldType = z.infer<typeof PatientFieldType>;

/** A text field's value shape: any text, digits only, letters only, or a custom expression. */
export const PatientFieldPatternPreset = z
  .enum(PATIENT_FIELD_PATTERN_PRESETS)
  .meta({ id: 'PatientFieldPatternPreset' });
export type PatientFieldPatternPreset = z.infer<typeof PatientFieldPatternPreset>;

/** `expression` only with `custom` (RE2 syntax, at most 100; the server says when it is unsafe). */
export const PatientFieldPattern = z
  .object({ preset: PatientFieldPatternPreset, expression: z.string().max(200).nullable() })
  .meta({ id: 'PatientFieldPattern' });
export type PatientFieldPattern = z.infer<typeof PatientFieldPattern>;

const lengthRule = z.number().int().min(0).max(PATIENT_FIELD_RULES.longTextMax);
const rangeRule = z.number().min(-1e15).max(1e15);

/** Lengths (text, long text), a range (number), a pattern (text); a rule left out is none. */
export const PatientFieldValidationInput = z
  .object({
    minLength: lengthRule.nullable().optional(),
    maxLength: lengthRule.nullable().optional(),
    min: rangeRule.nullable().optional(),
    max: rangeRule.nullable().optional(),
    pattern: PatientFieldPattern.nullable().optional(),
  })
  .meta({ id: 'PatientFieldValidationInput' });
export type PatientFieldValidationInput = z.infer<typeof PatientFieldValidationInput>;

export const PatientFieldValidation = z
  .object({
    minLength: z.number().int().nullable(),
    maxLength: z.number().int().nullable(),
    min: z.number().nullable(),
    max: z.number().nullable(),
    pattern: PatientFieldPattern.nullable(),
  })
  .meta({ id: 'PatientFieldValidation' });
export type PatientFieldValidation = z.infer<typeof PatientFieldValidation>;

/**
 * A default value by type: text, number, date (`YYYY-MM-DD`), yes/no, phone. A choice's default is
 * sent as its label (or labels) and answered as option ids. Inline, not a component: the Dart
 * generator makes a named primitive union an empty class (as SettingValue).
 */
const PatientFieldDefaultValue = z.union([
  z.string().max(PATIENT_FIELD_RULES.longTextMax),
  z.number(),
  z.boolean(),
  z.array(z.string().max(PATIENT_FIELD_RULES.labelMax)).max(PATIENT_FIELD_RULES.optionsMax),
]);

/** A choice in a request: with `id` an existing one (renamed, reordered, archived), else new. */
export const PatientFieldOptionInput = z
  .object({
    id: z.uuid().optional(),
    label: z.string().min(1).max(PATIENT_FIELD_RULES.labelMax),
    archived: z.boolean().optional(),
  })
  .meta({ id: 'PatientFieldOptionInput' });
export type PatientFieldOptionInput = z.infer<typeof PatientFieldOptionInput>;

const definitionFields = {
  label: z.string().min(1).max(PATIENT_FIELD_RULES.labelMax),
  labelEn: z.string().min(1).max(PATIENT_FIELD_RULES.labelMax).nullable().optional(),
  section: z.string().min(1).max(PATIENT_FIELD_RULES.sectionMax),
  required: z.boolean().optional(),
  validation: PatientFieldValidationInput.optional(),
  default: PatientFieldDefaultValue.nullable().optional(),
  /** In order; 2 to 250 for a choice field (unique after folding), none for other types. */
  options: z.array(PatientFieldOptionInput).max(PATIENT_FIELD_RULES.optionsMax).optional(),
  viewRoles: z.array(SessionRole).min(1).max(5),
  /** A subset of `viewRoles`. */
  editRoles: z.array(SessionRole).max(5).optional(),
  sensitive: z.boolean().optional(),
  searchable: z.boolean().optional(),
  /** Shown in print (stored now; A-08 uses it). */
  print: z.boolean().optional(),
};

export const CreatePatientFieldRequest = z
  .object({ ...definitionFields, type: PatientFieldType })
  .meta({ id: 'CreatePatientFieldRequest' });
export type CreatePatientFieldRequest = z.infer<typeof CreatePatientFieldRequest>;

/** Every field of the create but the key; `type` sent answers 400 `type_fixed`. */
export const UpdatePatientFieldRequest = z
  .object({
    label: definitionFields.label.optional(),
    labelEn: definitionFields.labelEn,
    section: definitionFields.section.optional(),
    required: definitionFields.required,
    validation: definitionFields.validation,
    default: definitionFields.default,
    options: definitionFields.options,
    viewRoles: definitionFields.viewRoles.optional(),
    editRoles: definitionFields.editRoles,
    sensitive: definitionFields.sensitive,
    searchable: definitionFields.searchable,
    print: definitionFields.print,
    type: PatientFieldType.optional(),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .meta({ id: 'UpdatePatientFieldRequest' });
export type UpdatePatientFieldRequest = z.infer<typeof UpdatePatientFieldRequest>;

/** A field key as generated: `cf_` and its number in the clinic, never reused. */
export const PatientFieldKey = z
  .string()
  .regex(/^cf_[0-9]{1,6}$/)
  .meta({ id: 'PatientFieldKey' });

export const PatientFieldKeyParams = z
  .object({ key: PatientFieldKey })
  .meta({ id: 'PatientFieldKeyParams' });

export const PatientFieldOption = z
  .object({
    id: z.uuid(),
    label: z.string(),
    archived: z.boolean(),
    order: z.number().int(),
    /** Live charts (active, archived) holding this choice (A-03-06, improvement 8). */
    chartCount: z.number().int(),
  })
  .meta({ id: 'PatientFieldOption' });
export type PatientFieldOption = z.infer<typeof PatientFieldOption>;

export const PatientFieldState = z.enum(['active', 'archived']).meta({ id: 'PatientFieldState' });

/** The owner's view of a definition (contract row "List"; `chartCount` from A-03-06). */
export const PatientFieldDefinition = z
  .object({
    key: PatientFieldKey,
    label: z.string(),
    labelEn: z.string().nullable(),
    type: PatientFieldType,
    required: z.boolean(),
    validation: PatientFieldValidation,
    default: PatientFieldDefaultValue.nullable(),
    options: z.array(PatientFieldOption),
    viewRoles: z.array(SessionRole),
    editRoles: z.array(SessionRole),
    section: z.string(),
    /** The place within its section, from 0. */
    order: z.number().int(),
    sensitive: z.boolean(),
    searchable: z.boolean(),
    print: z.boolean(),
    /** Live charts (active, archived; not merged) holding a value (A-03-06, improvement 8). */
    chartCount: z.number().int(),
    state: PatientFieldState,
    archivedAt: z.iso.datetime().nullable(),
    /** When an archived field and its values are removed (30 days after `archivedAt`). */
    purgeAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'PatientFieldDefinition' });
export type PatientFieldDefinition = z.infer<typeof PatientFieldDefinition>;

/** `used`: active fields and those archived within 30 days, against `max` (the plan's limit). */
export const PatientFieldLimits = z
  .object({
    used: z.number().int(),
    max: z.number().int(),
    searchableUsed: z.number().int(),
    searchableMax: z.number().int(),
  })
  .meta({ id: 'PatientFieldLimits' });

/**
 * By section in creation order, then by order; archived fields included. `listUpdatedAt` is the
 * `expectedUpdatedAt` of the order route (null with no field yet).
 */
export const PatientFieldDefinitions = z
  .object({
    fields: z.array(PatientFieldDefinition),
    limits: PatientFieldLimits,
    listUpdatedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'PatientFieldDefinitions' });
export type PatientFieldDefinitions = z.infer<typeof PatientFieldDefinitions>;

/**
 * A value as stored (A-03-06; criterion 16): text (trimmed), a number, a date `YYYY-MM-DD`, a
 * choice's option id, several option ids, yes/no, a phone in E.164. Inline, not a component (as
 * the default value).
 */
const PatientFieldValueShape = z.union([
  z.string().max(PATIENT_FIELD_RULES.longTextMax),
  z.number(),
  z.boolean(),
  z.array(z.string().max(64)).max(PATIENT_FIELD_RULES.optionsMax),
]);

/**
 * A chart's values in a registration or an edit (contract rows "Save new", "Edit"): by field
 * key, at most 20; `null` clears. 400 `validation_failed` at `body.fields.<key>` (a misfit, an
 * unknown or archived key, a required field left empty); 403 `field_not_editable` (with
 * `fieldKeys`) for a key the member's roles may not edit.
 */
export const PatientFieldValues = z
  .record(PatientFieldKey, PatientFieldValueShape.nullable())
  .refine((values) => Object.keys(values).length <= 20, { message: 'at most 20 fields' })
  .meta({ id: 'PatientFieldValues' });
export type PatientFieldValues = z.infer<typeof PatientFieldValues>;

/** A choice a chart field shows: the active ones and any archived one the chart holds. */
export const PatientChartFieldOption = z
  .object({ id: z.uuid(), label: z.string(), archived: z.boolean() })
  .meta({ id: 'PatientChartFieldOption' });

/**
 * A field on the summary (contract row "Summary"; criterion 16): an active field the member's
 * roles may view, with the chart's value (null when empty). `options`: for a choice field, its
 * active choices and the archived ones the chart holds (criterion 17); empty for other types.
 */
export const PatientChartField = z
  .object({
    key: PatientFieldKey,
    label: z.string(),
    section: z.string(),
    /** The place within its section among the fields shown, from 0. */
    order: z.number().int(),
    type: PatientFieldType,
    value: PatientFieldValueShape.nullable(),
    sensitive: z.boolean(),
    options: z.array(PatientChartFieldOption),
  })
  .meta({ id: 'PatientChartField' });
export type PatientChartField = z.infer<typeof PatientChartField>;

export const PatientFormFieldOption = z
  .object({ id: z.uuid(), label: z.string() })
  .meta({ id: 'PatientFormFieldOption' });

/** A field in the registration form (the member's view): active ones their roles may view. */
export const PatientFormField = z
  .object({
    key: PatientFieldKey,
    label: z.string(),
    type: PatientFieldType,
    required: z.boolean(),
    validation: PatientFieldValidation,
    default: PatientFieldDefaultValue.nullable(),
    /** Active choices only. */
    options: z.array(PatientFormFieldOption),
    section: z.string(),
    order: z.number().int(),
    /** False: shown read-only to this member. */
    editable: z.boolean(),
    sensitive: z.boolean(),
  })
  .meta({ id: 'PatientFormField' });
export type PatientFormField = z.infer<typeof PatientFormField>;

export const PatientFormFields = z
  .object({ fields: z.array(PatientFormField) })
  .meta({ id: 'PatientFormFields' });
export type PatientFormFields = z.infer<typeof PatientFormFields>;

export const PatientFieldOrderSection = z
  .object({
    title: z.string().min(1).max(PATIENT_FIELD_RULES.sectionMax),
    keys: z.array(PatientFieldKey).max(50),
  })
  .meta({ id: 'PatientFieldOrderSection' });

/** Every active field once, each in its own section (criterion 38). */
export const PatientFieldOrderRequest = z
  .object({
    sections: z.array(PatientFieldOrderSection).max(50),
    expectedUpdatedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'PatientFieldOrderRequest' });
export type PatientFieldOrderRequest = z.infer<typeof PatientFieldOrderRequest>;

export const patientFieldsForm = defineContract({
  operationId: 'patientFieldsForm',
  method: 'GET',
  path: '/patients/fields',
  summary: 'The clinic’s fields this member may view, for the registration form',
  responses: { 200: PatientFormFields },
});

export const patientFieldsDefinitions = defineContract({
  operationId: 'patientFieldsDefinitions',
  method: 'GET',
  path: '/patients/fields/definitions',
  summary: 'The clinic’s field definitions with the limits (owner)',
  responses: { 200: PatientFieldDefinitions },
});

export const patientFieldsCreate = defineContract({
  operationId: 'patientFieldsCreate',
  method: 'POST',
  path: '/patients/fields',
  summary: 'Adds a field to the clinic’s charts',
  request: { body: CreatePatientFieldRequest },
  // 409 `limit_reached` (with `limitReached`), `searchable_limit`.
  responses: { 201: PatientFieldDefinition, 400: ErrorEnvelope, 409: ErrorEnvelope },
});

export const patientFieldsUpdate = defineContract({
  operationId: 'patientFieldsUpdate',
  method: 'PATCH',
  path: '/patients/fields/:key',
  summary: 'Edits a field (its type is fixed)',
  request: { params: PatientFieldKeyParams, body: UpdatePatientFieldRequest },
  // 400 `type_fixed`; 409 `stale`, `searchable_limit`.
  responses: {
    200: PatientFieldDefinition,
    400: ErrorEnvelope,
    404: ErrorEnvelope,
    409: ErrorEnvelope,
  },
});

export const patientFieldsOrder = defineContract({
  operationId: 'patientFieldsOrder',
  method: 'PUT',
  path: '/patients/fields/order',
  summary: 'Orders the fields within their sections',
  request: { body: PatientFieldOrderRequest },
  responses: { 200: PatientFieldDefinitions, 400: ErrorEnvelope, 409: ErrorEnvelope },
});

export const patientFieldsArchive = defineContract({
  operationId: 'patientFieldsArchive',
  method: 'POST',
  path: '/patients/fields/:key/archive',
  summary: 'Archives a field: hidden, not required, purged with its values after 30 days',
  request: { params: PatientFieldKeyParams },
  responses: { 200: PatientFieldDefinition, 404: ErrorEnvelope },
});

export const patientFieldsRestore = defineContract({
  operationId: 'patientFieldsRestore',
  method: 'POST',
  path: '/patients/fields/:key/restore',
  summary: 'Restores a field archived within 30 days',
  request: { params: PatientFieldKeyParams },
  // 400 `validation_failed` on `body.label` (an active field took it); 409 `searchable_limit`.
  responses: {
    200: PatientFieldDefinition,
    400: ErrorEnvelope,
    404: ErrorEnvelope,
    409: ErrorEnvelope,
  },
});
