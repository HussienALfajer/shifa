// Platform table (A-01-01, PLT-01): one row per subscription account. Global (no tenant_id):
// shifa_platform manages it, shifa_app reads only its own row (`id = current_tenant_id()`),
// shifa_auth only the tenants of the signed-in person's memberships (ADR-0043). The idle sign-out
// lives in the settings cascade (`session.idle_minutes`, A-02-04); its column went in A-02-06.
import { sql } from 'drizzle-orm';
import { check, date, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './columns.ts';

export const TENANT_TYPES = ['solo', 'multi_doctor', 'multi_branch'] as const;
export type TenantType = (typeof TENANT_TYPES)[number];
export const TENANT_STATUSES = ['trial', 'active', 'suspended'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const tenant = pgTable(
  'tenant',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: text('type').$type<TenantType>().notNull(),
    status: text('status').$type<TenantStatus>().notNull().default('trial'),
    /** No automatic effect in A-01 (A-01a criterion 3). */
    subscriptionEnd: date('subscription_end'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('tenant_name_check', sql`char_length(btrim(${t.name})) between 1 and 200`),
    check('tenant_type_check', sql`${t.type} in ('solo', 'multi_doctor', 'multi_branch')`),
    check('tenant_status_check', sql`${t.status} in ('trial', 'active', 'suspended')`),
  ],
);
