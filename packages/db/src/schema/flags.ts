// Feature flags (A-02 criterion 7, OD-114, PLT-25). `feature_flag` (global, no clinic data): the
// super admin's mode per flag key, with reason and who changed it; a flag without a row takes its
// default in code, a row for a key no longer in code is ignored. `feature_flag_tenant` (tenant,
// FORCE RLS, isolation case): the clinics a flag is on for, kept while the flag is on or off for
// all. Flags are declared in code (apps/api modules/flags), never here.
import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from './columns.ts';
import { tenant } from './platform.ts';

export const FLAG_MODES = ['off', 'on', 'selected'] as const;
export type FlagMode = (typeof FLAG_MODES)[number];

export const featureFlag = pgTable(
  'feature_flag',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull(),
    mode: text('mode').$type<FlagMode>().notNull(),
    /** Why (10–500 characters); returned to super admins, never in the audit log. */
    reason: text('reason').notNull(),
    /** The super admin's user id (no foreign key, as `tenant_override.set_by`). */
    changedBy: uuid('changed_by').notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('feature_flag_key_key').on(t.key),
    check('feature_flag_key_check', sql`${t.key} ~ '^[a-z][a-z_]*(\\.[a-z][a-z_]*)+$'`),
    check('feature_flag_mode_check', sql`${t.mode} in ('off', 'on', 'selected')`),
    check('feature_flag_reason_check', sql`char_length(btrim(${t.reason})) between 10 and 500`),
  ],
);

/** A clinic a flag is on for while its mode is `selected`. */
export const featureFlagTenant = pgTable(
  'feature_flag_tenant',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    flagKey: text('flag_key')
      .notNull()
      .references(() => featureFlag.key),
    createdAt: createdAt(),
  },
  (t) => [unique('feature_flag_tenant_tenant_id_flag_key_key').on(t.tenantId, t.flagKey)],
);
