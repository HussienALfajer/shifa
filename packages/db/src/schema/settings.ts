// The settings cascade (A-02 criteria 8–10, PLT-22 to PLT-24; slice A-02-04). Settings are declared
// in code (apps/api modules/settings: key, schema, default, overridable scopes, lockable); these
// tables only hold values. Scopes, nearest wins: platform → plan → specialty pack → organization →
// branch → practitioner → user; a locked value stops every scope below it.
// - `platform_setting_value` (global, no clinic data): a value for every clinic (`platform`) or for
//   one plan (`plan`, by clinic type). Written by migrations alone.
// - `setting_value` (tenant, FORCE RLS, isolation case): a clinic's values at its own scopes. The
//   clinic writes its own unlocked values; only the super admin writes `locked` (column grants and
//   restrictive policies, approved at A-02-04's /db-migration).
import { sql } from 'drizzle-orm';
import { boolean, check, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { type TenantType, tenant } from './platform.ts';

const KEY_CHECK = sql.raw(`'^[a-z][a-z_]*(\\.[a-z][a-z_]*)+$'`);

/** A stored value: any JSON the key's schema accepts (checked by the API on write and read). */
export type StoredSettingValue = number | string | boolean;

export const PLATFORM_SETTING_SCOPES = ['platform', 'plan'] as const;
export type PlatformSettingScope = (typeof PLATFORM_SETTING_SCOPES)[number];

export const TENANT_SETTING_SCOPES = ['organization', 'branch', 'practitioner', 'user'] as const;
export type TenantSettingScope = (typeof TENANT_SETTING_SCOPES)[number];

export const platformSettingValue = pgTable(
  'platform_setting_value',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scope: text('scope').$type<PlatformSettingScope>().notNull(),
    /** The plan (a clinic type) of a `plan` value; null for `platform`. */
    planType: text('plan_type').$type<TenantType>(),
    key: text('key').notNull(),
    value: jsonb('value').$type<StoredSettingValue>().notNull(),
    locked: boolean('locked').notNull().default(false),
    setAt: timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('platform_setting_value_scope_plan_type_key_key')
      .on(t.scope, t.planType, t.key)
      .nullsNotDistinct(),
    check('platform_setting_value_key_check', sql`${t.key} ~ ${KEY_CHECK}`),
    check('platform_setting_value_scope_check', sql`${t.scope} in ('platform', 'plan')`),
    check(
      'platform_setting_value_plan_check',
      sql`(${t.scope} = 'plan') = (${t.planType} is not null)`,
    ),
    check(
      'platform_setting_value_plan_type_check',
      sql`${t.planType} is null or ${t.planType} in ('solo', 'multi_doctor', 'multi_branch')`,
    ),
  ],
);

export const settingValue = pgTable(
  'setting_value',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    scope: text('scope').$type<TenantSettingScope>().notNull(),
    /**
     * The branch, practitioner (membership) or user the value is for; null for `organization` (a
     * clinic has one organization). No foreign key: the scope says which table it names.
     */
    scopeId: uuid('scope_id'),
    key: text('key').notNull(),
    value: jsonb('value').$type<StoredSettingValue>().notNull(),
    /** Set by the super admin with its value («مقفل من الإدارة»): no scope below overrides it. */
    locked: boolean('locked').notNull().default(false),
    /** Who set it (a user id, no foreign key); null: the A-02-04 backfill. */
    setBy: uuid('set_by'),
    setAt: timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('setting_value_tenant_id_scope_scope_id_key_key')
      .on(t.tenantId, t.scope, t.scopeId, t.key)
      .nullsNotDistinct(),
    check('setting_value_key_check', sql`${t.key} ~ ${KEY_CHECK}`),
    check(
      'setting_value_scope_check',
      sql`${t.scope} in ('organization', 'branch', 'practitioner', 'user')`,
    ),
    check(
      'setting_value_scope_id_check',
      sql`(${t.scope} = 'organization') = (${t.scopeId} is null)`,
    ),
  ],
);
