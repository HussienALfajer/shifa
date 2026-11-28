// Custom field definitions of a clinic's charts (spec A-03 criteria 14–17, 37–39; slice A-03-05;
// ADR-0008). Tenant tables: tenant_id leads every key and index, ENABLE + FORCE RLS with the tenant
// policy (custom migration), an isolation case each. A field is never deleted: on purge (30 days
// after archive) its row stays as a tombstone (`state = 'purged'`), so its key is never given
// again; a choice is never deleted either, only archived. Labels are what the owner typed: they
// never reach audit data, logs or errors. Values on charts are A-03-06's.
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './columns.ts';
import { patient } from './patients.ts';
import { tenant } from './platform.ts';

export const PATIENT_FIELD_TYPES = [
  'text',
  'long_text',
  'number',
  'date',
  'single_choice',
  'multi_choice',
  'yes_no',
  'phone',
] as const;
export const PATIENT_FIELD_STATES = ['active', 'archived', 'purged'] as const;
/** The clinic roles a field may be viewed and edited by (as `SessionRole` in @shifa/contracts). */
export const PATIENT_FIELD_ROLES = [
  'owner',
  'doctor',
  'receptionist',
  'assistant',
  'accountant',
] as const;

const quoted = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

/**
 * The rules of a field as stored: its validation (`minLength`, `maxLength`, `min`, `max`,
 * `pattern`) and its default (a choice's by option id). Checked by the API against
 * `patientFieldRuleProblems` of @shifa/contracts; the table checks the shape and size.
 */
export interface StoredFieldRules {
  validation: {
    minLength: number | null;
    maxLength: number | null;
    min: number | null;
    max: number | null;
    pattern: { preset: 'any' | 'digits' | 'letters' | 'custom'; expression: string | null } | null;
  };
  default: string | number | boolean | string[] | null;
}

export const patientField = pgTable(
  'patient_field',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    /** The field's number in the clinic, from 1, never reused (tombstones keep theirs). */
    number: integer('number').notNull(),
    /** `cf_` and the number: immutable. */
    key: text('key').notNull(),
    label: text('label').notNull(),
    labelEn: text('label_en'),
    type: text('type').$type<(typeof PATIENT_FIELD_TYPES)[number]>().notNull(),
    required: boolean('required').notNull().default(false),
    rules: jsonb('rules').$type<StoredFieldRules>().notNull(),
    section: text('section').notNull(),
    /** The place within its section, from 0. */
    position: integer('position').notNull(),
    viewRoles: text('view_roles').array().notNull(),
    editRoles: text('edit_roles').array().notNull(),
    sensitive: boolean('sensitive').notNull().default(false),
    searchable: boolean('searchable').notNull().default(false),
    /** Shown in print (stored; A-08 uses it). */
    print: boolean('print').notNull().default(false),
    state: text('state').$type<(typeof PATIENT_FIELD_STATES)[number]>().notNull().default('active'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    purgedAt: timestamp('purged_at', { withTimezone: true }),
    /** User ids of who added and who last saved (audit actors; no foreign key). */
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('patient_field_tenant_id_id_key').on(t.tenantId, t.id),
    unique('patient_field_tenant_id_key_key').on(t.tenantId, t.key),
    unique('patient_field_tenant_id_number_key').on(t.tenantId, t.number),
    index('patient_field_tenant_id_state_idx').on(t.tenantId, t.state),
    check('patient_field_number_check', sql`${t.number} between 1 and 999999`),
    check('patient_field_key_check', sql`${t.key} = 'cf_' || ${t.number}::text`),
    check(
      'patient_field_label_check',
      sql`char_length(${t.label}) between 1 and 60 and ${t.label} = btrim(${t.label})`,
    ),
    check(
      'patient_field_label_en_check',
      sql`char_length(${t.labelEn}) between 1 and 60 and ${t.labelEn} = btrim(${t.labelEn})`,
    ),
    check('patient_field_type_check', sql`${t.type} in (${sql.raw(quoted(PATIENT_FIELD_TYPES))})`),
    check(
      'patient_field_rules_check',
      sql`jsonb_typeof(${t.rules}) = 'object' and jsonb_typeof(${t.rules} -> 'validation') = 'object' and ${t.rules} ? 'default' and octet_length(${t.rules}::text) <= 16384`,
    ),
    check(
      'patient_field_section_check',
      sql`char_length(${t.section}) between 1 and 40 and ${t.section} = btrim(${t.section})`,
    ),
    check('patient_field_position_check', sql`${t.position} between 0 and 999`),
    check(
      'patient_field_roles_check',
      sql`cardinality(${t.viewRoles}) between 1 and 5 and ${t.viewRoles} <@ array[${sql.raw(quoted(PATIENT_FIELD_ROLES))}]::text[] and ${t.editRoles} <@ ${t.viewRoles}`,
    ),
    // Criterion 15: a sensitive field is never searchable.
    check('patient_field_sensitive_check', sql`not (${t.sensitive} and ${t.searchable})`),
    check(
      'patient_field_state_check',
      sql`${t.state} in (${sql.raw(quoted(PATIENT_FIELD_STATES))})`,
    ),
    check(
      'patient_field_archived_check',
      sql`(${t.state} = 'active') = (${t.archivedAt} is null) and (${t.state} = 'purged') = (${t.purgedAt} is not null)`,
    ),
    check('patient_field_updated_at_check', sql`${t.updatedAt} >= ${t.createdAt}`),
  ],
);

/**
 * One chart's value of one custom field (spec A-03 criteria 4, 16, 17; slice A-03-06): personal
 * data. The value as stored (text, number, `YYYY-MM-DD`, option id or ids, yes/no, E.164), at
 * most 16 kB (above anything the shared validator accepts: 250 choice ids, 2,000 characters of
 * 4 bytes; review B1); `search_key` the shared key of it (`searchKeyOfPatientFieldValue` in
 * @shifa/contracts) for every type that has one, searchable or not: search filters on the field
 * being searchable when it runs, so turning search on or off rewrites nothing. An empty value is
 * no row; a purged field's rows are deleted. A chart foreign key: A-03-08's merge moves them.
 */
export const patientFieldValue = pgTable(
  'patient_field_value',
  {
    /** Row key (every table's primary key is a uuid; schema-keys test). */
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    patientId: uuid('patient_id').notNull(),
    fieldId: uuid('field_id').notNull(),
    value: jsonb('value').$type<string | number | boolean | string[]>().notNull(),
    searchKey: text('search_key'),
    /** The user who saved it last (an audit actor; no foreign key). */
    updatedBy: uuid('updated_by').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('patient_field_value_chart_field_key').on(t.tenantId, t.patientId, t.fieldId),
    foreignKey({
      name: 'patient_field_value_patient_fk',
      columns: [t.tenantId, t.patientId],
      foreignColumns: [patient.tenantId, patient.id],
    }),
    foreignKey({
      name: 'patient_field_value_field_fk',
      columns: [t.tenantId, t.fieldId],
      foreignColumns: [patientField.tenantId, patientField.id],
    }),
    // Search: equality on the key within the field (criterion 4).
    index('patient_field_value_tenant_id_search_idx')
      .on(t.tenantId, t.fieldId, t.searchKey)
      .where(sql`${t.searchKey} is not null`),
    // Chart counts per field and choice, and the purge.
    index('patient_field_value_tenant_id_field_id_idx').on(t.tenantId, t.fieldId),
    check(
      'patient_field_value_value_check',
      sql`jsonb_typeof(${t.value}) in ('string', 'number', 'boolean', 'array') and pg_column_size(${t.value}) <= 16384`,
    ),
    check(
      'patient_field_value_search_key_check',
      sql`char_length(${t.searchKey}) between 1 and 100`,
    ),
  ],
);

/** A choice of a single or multiple choice field (criteria 14, 37): archived, never deleted. */
export const patientFieldOption = pgTable(
  'patient_field_option',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    fieldId: uuid('field_id').notNull(),
    label: text('label').notNull(),
    /** The place within the field's choices, from 0. */
    position: integer('position').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique('patient_field_option_tenant_id_id_key').on(t.tenantId, t.id),
    foreignKey({
      name: 'patient_field_option_field_fk',
      columns: [t.tenantId, t.fieldId],
      foreignColumns: [patientField.tenantId, patientField.id],
    }),
    index('patient_field_option_tenant_id_field_id_idx').on(t.tenantId, t.fieldId),
    check(
      'patient_field_option_label_check',
      sql`char_length(${t.label}) between 1 and 60 and ${t.label} = btrim(${t.label})`,
    ),
    check('patient_field_option_position_check', sql`${t.position} between 0 and 999`),
  ],
);
