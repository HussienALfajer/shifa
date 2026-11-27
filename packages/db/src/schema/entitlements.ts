// Entitlements (A-02 criteria 1–3, 20; ADR-0007, OD-109, OD-110). Platform tables (no tenant_id,
// no clinic data): `plan` (one per clinic type; a clinic's plan is `tenant.type`), `plan_feature`
// (a plan's value per catalogue key) and `addon` (a replacing or incremental value, no screen).
// Tenant tables (FORCE RLS, isolation cases): `tenant_addon` (the add-ons a clinic holds),
// `tenant_override` (the super admin's override per key, with reason and expiry) and
// `tenant_override_event` (every change of a key, with its reason; append-only). Values are jsonb:
// a whole number for a limit, a boolean for a feature (the API checks the key's kind).
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt } from './columns.ts';
import { type TenantType, tenant } from './platform.ts';

const at = (name: string) => timestamp(name, { withTimezone: true });
const KEY_CHECK = `'^[a-z][a-z_]*(\\.[a-z][a-z_]*)+$'`;
const keyCheck = (table: string, column: Parameters<typeof sql>[1]) =>
  check(`${table}_key_check`, sql`${column} ~ ${sql.raw(KEY_CHECK)}`);
/** A limit (whole number ≥ 0) or a feature (boolean). */
const valueCheck = (name: string, column: Parameters<typeof sql>[1]) =>
  check(
    name,
    sql`jsonb_typeof(${column}) = 'boolean' or (jsonb_typeof(${column}) = 'number' and (${column})::numeric >= 0 and (${column})::numeric = trunc((${column})::numeric))`,
  );

/** One value per plan or override: a limit's number or a feature's on/off. */
export type EntitlementValue = number | boolean;

export const plan = pgTable(
  'plan',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').$type<TenantType>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique('plan_type_key').on(t.type),
    check('plan_type_check', sql`${t.type} in ('solo', 'multi_doctor', 'multi_branch')`),
  ],
);

export const planFeature = pgTable(
  'plan_feature',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planType: text('plan_type')
      .$type<TenantType>()
      .notNull()
      .references(() => plan.type),
    key: text('key').notNull(),
    value: jsonb('value').$type<EntitlementValue>().notNull(),
  },
  (t) => [
    unique('plan_feature_plan_type_key_key').on(t.planType, t.key),
    keyCheck('plan_feature', t.key),
    valueCheck('plan_feature_value_check', t.value),
  ],
);

export const ADDON_MODES = ['replace', 'increment'] as const;
export type AddonMode = (typeof ADDON_MODES)[number];

export const addon = pgTable(
  'addon',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    mode: text('mode').$type<AddonMode>().notNull(),
    value: jsonb('value').$type<EntitlementValue>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    keyCheck('addon', t.key),
    check('addon_mode_check', sql`${t.mode} in ('replace', 'increment')`),
    valueCheck('addon_value_check', t.value),
  ],
);

/** An add-on a clinic holds (no screen in A-02). */
export const tenantAddon = pgTable(
  'tenant_addon',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    addonId: uuid('addon_id')
      .notNull()
      .references(() => addon.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ name: 'tenant_addon_pkey', columns: [t.tenantId, t.addonId] })],
);

/** The super admin's override of one key for one clinic (PLT-13); one per key. */
export const tenantOverride = pgTable(
  'tenant_override',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    key: text('key').notNull(),
    value: jsonb('value').$type<EntitlementValue>().notNull(),
    /** Why (10–500 characters); returned to super admins, never in the audit log. */
    reason: text('reason').notNull(),
    /** First instant it no longer counts (the end of a Damascus day); null: no expiry. */
    expiresAt: at('expires_at'),
    /** The super admin's user id (no foreign key: the row outlives the account, name or not). */
    setBy: uuid('set_by').notNull(),
    setAt: at('set_at').notNull().defaultNow(),
  },
  (t) => [
    unique('tenant_override_tenant_id_key_key').on(t.tenantId, t.key),
    keyCheck('tenant_override', t.key),
    valueCheck('tenant_override_value_check', t.value),
    check('tenant_override_reason_check', sql`char_length(btrim(${t.reason})) between 10 and 500`),
  ],
);

export const OVERRIDE_EVENT_KINDS = ['set', 'changed', 'removed', 'type_changed'] as const;
export type OverrideEventKind = (typeof OVERRIDE_EVENT_KINDS)[number];

/** A key's value at one point: an override (value, expiry) or a plan value (type change). */
export interface OverrideState {
  value: EntitlementValue;
  /** The last Damascus day it counts, `YYYY-MM-DD`; null: none (always null for a plan value). */
  expiresAt: string | null;
}

/**
 * Every change of one key for one clinic (criterion 20), written in the transaction of the change.
 * An expiry is no write: the history derives it from the override that ran out.
 */
export const tenantOverrideEvent = pgTable(
  'tenant_override_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    key: text('key').notNull(),
    kind: text('kind').$type<OverrideEventKind>().notNull(),
    before: jsonb('before').$type<OverrideState>(),
    after: jsonb('after').$type<OverrideState>(),
    reason: text('reason'),
    /** The super admin's user id (no foreign key, as `tenant_override.set_by`). */
    by: uuid('by').notNull(),
    at: at('at').notNull().defaultNow(),
  },
  (t) => [
    index('tenant_override_event_tenant_id_key_at_idx').on(t.tenantId, t.key, t.at),
    keyCheck('tenant_override_event', t.key),
    check(
      'tenant_override_event_kind_check',
      sql`${t.kind} in ('set', 'changed', 'removed', 'type_changed')`,
    ),
  ],
);
