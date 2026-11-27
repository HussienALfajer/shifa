// A clinic's charts (spec A-03 criteria 1–3, 12, 13; slice A-03-02; ADR-0006, ADR-0031). Tenant
// tables: tenant_id leads every key and index, ENABLE + FORCE RLS with the tenant policy (custom
// migration), an isolation case each. Personal data: names, phones and the date of birth stay
// on these rows and never reach audit data, logs or errors. A chart is never deleted (shifa_app
// holds no DELETE privilege on it). `(tenant_id, id)` is the key every later chart foreign key
// points at; the id is the client's (criterion 3).
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, E164_CHECK, SHA256_HEX_CHECK, updatedAt } from './columns.ts';
import { tenant } from './platform.ts';
import { branch } from './tenancy.ts';

export const PATIENT_SEXES = ['male', 'female'] as const;
export const PATIENT_STATES = ['active', 'archived', 'merged'] as const;

/** A name part as stored: 1–40 characters, trimmed (the API checks the letters). */
const namePart = (name: string, column: AnyPgColumn) =>
  check(
    `patient_${name}_check`,
    sql`char_length(${column}) between 1 and 40 and ${column} = btrim(${column})`,
  );

export const patient = pgTable(
  'patient',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    /** Chosen by the client (criterion 3); unique within the clinic. */
    id: uuid('id').notNull(),
    /** The clinic's file number (criterion 2): from patient_file_counter, never reused. */
    fileNumber: integer('file_number').notNull(),
    /** The paper file number, trimmed; unique within the clinic. */
    previousFileNumber: text('previous_file_number'),
    givenName: text('given_name').notNull(),
    fatherName: text('father_name'),
    familyName: text('family_name'),
    motherName: text('mother_name'),
    /** E.164 (+963, +90). */
    contactPhone: text('contact_phone').notNull(),
    secondPhone: text('second_phone'),
    sex: text('sex').$type<(typeof PATIENT_SEXES)[number]>().notNull(),
    birthDate: date('birth_date', { mode: 'string' }).notNull(),
    /** True when worked out from an age (shown with «~»). */
    birthDateEstimated: boolean('birth_date_estimated').notNull().default(false),
    /** Where it was registered; null when the session had no branch and the clinic several. */
    registeredBranchId: uuid('registered_branch_id'),
    state: text('state').$type<(typeof PATIENT_STATES)[number]>().notNull().default('active'),
    /** The chart a merged chart leads to (A-03-08). */
    mergedIntoId: uuid('merged_into_id'),
    /** The relation to the phone's holder (A-03-04). */
    relation: text('relation'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    archivedBy: uuid('archived_by'),
    /** SHA-256 of the registration request, so a replay with the same body is recognised. */
    createHash: text('create_hash').notNull(),
    /** User ids of who registered and who last saved (audit actors; no foreign key). */
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ name: 'patient_pkey', columns: [t.tenantId, t.id] }),
    unique('patient_tenant_id_file_number_key').on(t.tenantId, t.fileNumber),
    unique('patient_tenant_id_previous_file_number_key').on(t.tenantId, t.previousFileNumber),
    foreignKey({
      name: 'patient_registered_branch_fk',
      columns: [t.tenantId, t.registeredBranchId],
      foreignColumns: [branch.tenantId, branch.id],
    }),
    foreignKey({
      name: 'patient_merged_into_fk',
      columns: [t.tenantId, t.mergedIntoId],
      foreignColumns: [t.tenantId, t.id],
    }),
    check('patient_file_number_check', sql`${t.fileNumber} >= 1`),
    check(
      'patient_previous_file_number_check',
      sql`char_length(${t.previousFileNumber}) between 1 and 40 and ${t.previousFileNumber} = btrim(${t.previousFileNumber})`,
    ),
    namePart('given_name', t.givenName),
    namePart('father_name', t.fatherName),
    namePart('family_name', t.familyName),
    namePart('mother_name', t.motherName),
    check('patient_contact_phone_check', sql`${t.contactPhone} ~ ${sql.raw(E164_CHECK)}`),
    check('patient_second_phone_check', sql`${t.secondPhone} ~ ${sql.raw(E164_CHECK)}`),
    check('patient_sex_check', sql`${t.sex} in ('male', 'female')`),
    check('patient_state_check', sql`${t.state} in ('active', 'archived', 'merged')`),
    check(
      'patient_merged_check',
      sql`(${t.state} = 'merged') = (${t.mergedIntoId} is not null) and ${t.mergedIntoId} is distinct from ${t.id}`,
    ),
    check(
      'patient_archived_check',
      sql`(${t.state} = 'archived') = (${t.archivedAt} is not null) and (${t.archivedAt} is null) = (${t.archivedBy} is null)`,
    ),
    check('patient_relation_check', sql`${t.relation} ~ '^[a-z][a-z_]{0,31}$'`),
    check('patient_create_hash_check', sql`${t.createHash} ~ ${sql.raw(SHA256_HEX_CHECK)}`),
    check('patient_updated_at_check', sql`${t.updatedAt} >= ${t.createdAt}`),
  ],
);

/**
 * The clinic's next file number (criterion 2): one row per clinic, taken with an upsert that
 * locks the row until the registration commits, so concurrent saves never share a number and a
 * failed save rolls its number back.
 */
export const patientFileCounter = pgTable(
  'patient_file_counter',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenant.id),
    next: integer('next').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [check('patient_file_counter_next_check', sql`${t.next} >= 1`)],
);
