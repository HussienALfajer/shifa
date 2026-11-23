// Platform table (A-01-01, PLT-01): one row per subscription account. Global (no tenant_id):
// shifa_platform manages it, shifa_app reads only its own row (`id = current_tenant_id()`),
// shifa_auth only the tenants of the signed-in person's memberships (ADR-0043).
import { sql } from 'drizzle-orm';
import { check, date, pgTable, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './columns.ts';

export const TENANT_TYPES = ['solo', 'multi_doctor', 'multi_branch'] as const;
export type TenantType = (typeof TENANT_TYPES)[number];
export const TENANT_STATUSES = ['trial', 'active', 'suspended'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];
/** Automatic sign-out after this many idle minutes (OD-77); default 30. */
export const IDLE_MINUTES = [15, 30, 60] as const;

export const tenant = pgTable(
  'tenant',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: text('type').$type<TenantType>().notNull(),
    status: text('status').$type<TenantStatus>().notNull().default('trial'),
    /** No automatic effect in A-01 (A-01a criterion 3). */
    subscriptionEnd: date('subscription_end'),
    idleMinutes: smallint('idle_minutes').notNull().default(30),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('tenant_name_check', sql`char_length(btrim(${t.name})) between 1 and 200`),
    check('tenant_type_check', sql`${t.type} in ('solo', 'multi_doctor', 'multi_branch')`),
    check('tenant_status_check', sql`${t.status} in ('trial', 'active', 'suspended')`),
    check('tenant_idle_minutes_check', sql`${t.idleMinutes} in (15, 30, 60)`),
  ],
);
