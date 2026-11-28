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
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, E164_CHECK, SHA256_HEX_CHECK, updatedAt } from './columns.ts';
import { tenant } from './platform.ts';
import { branch, membership } from './tenancy.ts';

export const PATIENT_SEXES = ['male', 'female'] as const;
export const PATIENT_STATES = ['active', 'archived', 'merged'] as const;
/** A-03-04: the relation to the phone's holder (as `PatientRelation` in @shifa/contracts). */
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
    /** The relation to the phone's holder (A-03-04); null: not given. */
    relation: text('relation').$type<(typeof PATIENT_RELATIONS)[number]>(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    archivedBy: uuid('archived_by'),
    /**
     * The display name's search key (ADR-0034, ADR-0052), written by the chart repository with
     * its name tokens; ranks the token matches by trigram similarity. Null until written.
     */
    nameKey: text('name_key'),
    /** The key version of `name_key` and the name tokens; 0: not written yet (backfilled). */
    nameKeyVersion: smallint('name_key_version').notNull().default(0),
    /** The last 7 digits of each phone, for a search by phone tail (criterion 4; ADR-0052). */
    contactPhoneTail: text('contact_phone_tail')
      .notNull()
      .generatedAlwaysAs(sql`right(contact_phone, 7)`),
    secondPhoneTail: text('second_phone_tail').generatedAlwaysAs(sql`right(second_phone, 7)`),
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
    // A-03-04 (criterion 9): one of the ten relations to the phone's holder.
    check(
      'patient_relation_value_check',
      sql`${t.relation} in (${sql.raw(PATIENT_RELATIONS.map((r) => `'${r}'`).join(', '))})`,
    ),
    check('patient_create_hash_check', sql`${t.createHash} ~ ${sql.raw(SHA256_HEX_CHECK)}`),
    check('patient_updated_at_check', sql`${t.updatedAt} >= ${t.createdAt}`),
    check(
      'patient_name_key_check',
      sql`char_length(${t.nameKey}) <= 200 and (${t.nameKey} is null) = (${t.nameKeyVersion} = 0)`,
    ),
    check('patient_name_key_version_check', sql`${t.nameKeyVersion} >= 0`),
    // Search (A-03-03): phone tails by equality; charts whose tokens need writing.
    index('patient_tenant_id_contact_phone_tail_idx').on(t.tenantId, t.contactPhoneTail),
    index('patient_tenant_id_second_phone_tail_idx').on(t.tenantId, t.secondPhoneTail),
    index('patient_tenant_id_name_key_version_idx').on(t.tenantId, t.nameKeyVersion),
    // A-03-04: a family is the charts on one contact phone; the duplicate check's phone rule.
    index('patient_tenant_id_contact_phone_idx').on(t.tenantId, t.contactPhone),
  ],
);

/**
 * The treating doctors of a chart (spec A-03 criterion 10; OD-140): doctor members of the clinic,
 * by membership id, so a deactivated doctor stays on the list. The list is replaced by deleting
 * and adding rows (shifa_app holds no UPDATE). A chart foreign key: A-03-08's merge joins the
 * lists. `added_by` is the user who added the doctor (an audit actor; no foreign key).
 */
export const patientTreatingDoctor = pgTable(
  'patient_treating_doctor',
  {
    /** Row key (every table's primary key is a uuid; schema-keys test). */
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    patientId: uuid('patient_id').notNull(),
    memberId: uuid('member_id').notNull(),
    addedBy: uuid('added_by').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('patient_treating_doctor_chart_member_key').on(t.tenantId, t.patientId, t.memberId),
    foreignKey({
      name: 'patient_treating_doctor_patient_fk',
      columns: [t.tenantId, t.patientId],
      foreignColumns: [patient.tenantId, patient.id],
    }),
    foreignKey({
      name: 'patient_treating_doctor_member_fk',
      columns: [t.tenantId, t.memberId],
      foreignColumns: [membership.tenantId, membership.id],
    }),
    // "My patients only" (A-03-07): a doctor's charts.
    index('patient_treating_doctor_tenant_id_member_id_idx').on(t.tenantId, t.memberId),
  ],
);

/**
 * The name tokens of a chart (spec A-03 criterion 5; ADR-0052, OD-42): every prefix of two letters
 * or more of every word of the given, father and family names' keys (`nameTokens` in
 * @shifa/contracts), so a typed word is found by equality on `(tenant_id, token)` inside RLS with
 * no operator that is not leakproof. Written by the chart repository in the transaction that
 * writes the chart, and rewritten on every name change; personal data (parts of names).
 */
export const patientNameToken = pgTable(
  'patient_name_token',
  {
    /** Row key (every table's primary key is a uuid; schema-keys test). */
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    patientId: uuid('patient_id').notNull(),
    /** 0 given, 1 father, 2 family: the index of the part in the display name. */
    part: smallint('part').notNull(),
    /** The word's place within its part. */
    word: smallint('word').notNull(),
    token: text('token').notNull(),
    /** True when the token is the whole word. */
    whole: boolean('whole').notNull(),
    keyVersion: smallint('key_version').notNull(),
  },
  (t) => [
    unique('patient_name_token_chart_key').on(t.tenantId, t.patientId, t.part, t.word, t.token),
    foreignKey({
      name: 'patient_name_token_patient_fk',
      columns: [t.tenantId, t.patientId],
      foreignColumns: [patient.tenantId, patient.id],
    }),
    // `whole` before the chart: a common prefix reads whole-word matches first, then stops.
    index('patient_name_token_tenant_id_token_idx').on(t.tenantId, t.token, t.whole, t.patientId),
    check('patient_name_token_part_check', sql`${t.part} between 0 and 2`),
    check('patient_name_token_word_check', sql`${t.word} between 0 and 40`),
    check('patient_name_token_token_check', sql`char_length(${t.token}) between 1 and 24`),
    check('patient_name_token_key_version_check', sql`${t.keyVersion} >= 1`),
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
