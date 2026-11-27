// Daily usage counters (A-02 criteria 17, 19, 21; OD-116, PLT-16; slice A-02-07): one integer per
// clinic, Damascus day and key. Later specs add keys (the API's USAGE_KEYS); A-02 writes
// `sign_ins`, `members_signed_in`, `active_members`, `active_branches` and `last_activity_minute`
// (the clinic's latest request, as minutes since the epoch, kept with greatest()). Tenant table:
// FORCE RLS, isolation case; shifa_app writes its own clinic's rows, shifa_platform reads every
// clinic's in the clinics list and the usage view only (policies in the migration).
import { sql } from 'drizzle-orm';
import { check, date, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { updatedAt } from './columns.ts';
import { tenant } from './platform.ts';

export const usageDaily = pgTable(
  'usage_daily',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    /** The Damascus calendar day. */
    day: date('day', { mode: 'string' }).notNull(),
    key: text('key').notNull(),
    value: integer('value').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('usage_daily_tenant_id_day_key_key').on(t.tenantId, t.day, t.key),
    check('usage_daily_key_check', sql`${t.key} ~ '^[a-z][a-z0-9_]{0,63}$'`),
    check('usage_daily_value_check', sql`${t.value} >= 0`),
  ],
);
