// audit_event (PLT-47, A-01a criterion 14): append-only for every application role (no UPDATE or
// DELETE privilege, plus a statement trigger that refuses even the owner). `tenant_id` null =
// a platform or sign-in event, invisible to shifa_app. Only ids and a small `data` object; never
// phones, tokens, passwords, codes or cookies.
import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const auditEvent = pgTable(
  'audit_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Null for platform and pre-tenant (sign-in) events. No foreign key: the log outlives rows. */
    tenantId: uuid('tenant_id'),
    actorId: uuid('actor_id'),
    targetId: uuid('target_id'),
    /** One of the names in src/audit.ts; the database checks the dotted lower-case form. */
    event: text('event').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    requestId: text('request_id'),
    /**
     * Small allowlisted details (ids, enum values; A-03-04: lists of ids, such as the candidate
     * charts registered anyway); at most 1 kB.
     */
    data: jsonb('data')
      .$type<Record<string, string | number | boolean | null | readonly string[]>>()
      .notNull()
      .default({}),
  },
  (t) => [
    index('audit_event_tenant_id_at_idx').on(t.tenantId, t.at),
    check('audit_event_event_check', sql`${t.event} ~ '^[a-z][a-z_]*(\\.[a-z][a-z_]*)+$'`),
    check('audit_event_request_id_check', sql`${t.requestId} ~ '^[A-Za-z0-9._:-]{1,64}$'`),
    check(
      'audit_event_data_check',
      sql`jsonb_typeof(${t.data}) = 'object' and octet_length(${t.data}::text) <= 1024`,
    ),
  ],
);
