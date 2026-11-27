// Read-only support access (A-02 criteria 11–14, OD-111, OD-112; ADR-0050; slice A-02-05). A super
// admin opens a reasoned, time-boxed grant on one clinic; a single-use hand-off token (its SHA-256
// here, 2 minutes) opens a support session in clinic web (`session.support_grant_id`). The grant
// ends at its expiry, by the super admin or by an owner; it is never deleted.
// - shifa_app reads its clinic's grants (as setup links, the hash of a single-use token included)
//   and ends an open one as the owner
//   (UPDATE of ended_at, ended_by, end_reason only, restrictive policy);
// - shifa_platform opens, issues hand-offs, ends and closes expired grants in support actions only;
// - shifa_auth reads the grant of its hash or of the signed-in super admin, consumes the hash and
//   closes an expired grant.
// Policies and grants: migration a02_support_policies (reasons in classification.ts).
import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { SHA256_HEX_CHECK } from './columns.ts';
import { tenant } from './platform.ts';

const at = (name: string) => timestamp(name, { withTimezone: true });

/** Who ended a grant: the super admin, an owner of the clinic, or its expiry. */
export const SUPPORT_END_REASONS = ['admin', 'owner', 'expiry'] as const;
export type SupportEndReason = (typeof SUPPORT_END_REASONS)[number];

/** The durations a grant may have, in minutes (criterion 11). */
export const SUPPORT_MINUTES = [30, 60, 120, 240] as const;
export type SupportMinutes = (typeof SUPPORT_MINUTES)[number];

export const supportAccessGrant = pgTable(
  'support_access_grant',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    /** The super admin (a user id; no foreign key: the log outlives accounts). */
    adminUserId: uuid('admin_user_id').notNull(),
    /**
     * The super admin's name when the grant was opened: the owner's banner and log show it, and
     * neither shifa_app nor shifa_platform may read other people's accounts.
     */
    adminName: text('admin_name').notNull(),
    /** Why (10–500 characters after trimming); shown to the owner, never logged or audited. */
    reason: text('reason').notNull(),
    openedAt: at('opened_at').notNull().defaultNow(),
    expiresAt: at('expires_at').notNull(),
    endedAt: at('ended_at'),
    /** The person who ended it (the super admin or an owner); null at its expiry. */
    endedBy: uuid('ended_by'),
    /** Their name at that moment (the ended page says «أنهاه المالك: …»); null at its expiry. */
    endedByName: text('ended_by_name'),
    endReason: text('end_reason').$type<SupportEndReason>(),
    /** SHA-256 of the current hand-off token, cleared when used; the super admin never reads it. */
    handoffTokenHash: text('handoff_token_hash'),
    handoffExpiresAt: at('handoff_expires_at'),
  },
  (t) => [
    // One open grant per super admin per clinic (criterion 11: 409 `support_active`).
    uniqueIndex('support_access_grant_tenant_id_admin_user_id_open_key')
      .on(t.tenantId, t.adminUserId)
      .where(sql`${t.endedAt} is null`),
    index('support_access_grant_tenant_id_opened_at_idx').on(t.tenantId, t.openedAt),
    index('support_access_grant_tenant_id_handoff_token_hash_idx').on(
      t.tenantId,
      t.handoffTokenHash,
    ),
    check(
      'support_access_grant_reason_check',
      sql`char_length(${t.reason}) between 10 and 500 and ${t.reason} = btrim(${t.reason})`,
    ),
    check(
      'support_access_grant_duration_check',
      sql`${t.expiresAt} > ${t.openedAt} and ${t.expiresAt} <= ${t.openedAt} + interval '4 hours'`,
    ),
    check(
      'support_access_grant_end_check',
      sql`(${t.endedAt} is null) = (${t.endReason} is null)
          and (${t.endReason} is null or ${t.endReason} in ('admin', 'owner', 'expiry'))
          and ((${t.endReason} = 'expiry') = (${t.endReason} is not null and ${t.endedBy} is null))
          and (${t.endedAt} is not null or (${t.endedBy} is null and ${t.endedByName} is null))`,
    ),
    check(
      'support_access_grant_names_check',
      sql`char_length(${t.adminName}) between 1 and 200
          and (${t.endedByName} is null or char_length(${t.endedByName}) between 1 and 200)`,
    ),
    // A hash may outlive the grant's end (the owner cannot clear it); using it needs an open grant.
    check(
      'support_access_grant_handoff_check',
      sql`${t.handoffTokenHash} is null or ${t.handoffTokenHash} ~ ${sql.raw(SHA256_HEX_CHECK)}`,
    ),
  ],
);
