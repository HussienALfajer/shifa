// Announcements (A-02 criteria 16, 22; OD-115, PLT-18; slice A-02-07).
// - `announcement` (global, no clinic data): the super admin's plain-text banner, its level,
//   start, optional end and target; written by shifa_platform in its actions only, never deleted.
//   shifa_app reads a few columns of the active ones aimed at its clinic (policy).
// - `announcement_target` (tenant, FORCE RLS, isolation case): the clinics a `selected` one is
//   for; read-only for shifa_app, written by shifa_platform in announcement.created and edited.
// - `announcement_dismissal` (global: a person's own, across clinics; no clinic data): who hid
//   which version; shifa_app writes and reads only the signed-in person's rows, never deletes.
// Status is not stored: scheduled before starts_at, ended from ends_at, active between.
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './columns.ts';
import { user } from './identity.ts';
import { tenant } from './platform.ts';

export const ANNOUNCEMENT_LEVELS = ['info', 'warning'] as const;
export const ANNOUNCEMENT_TARGETS = ['all', 'selected'] as const;

const at = (name: string) => timestamp(name, { withTimezone: true });

export const announcement = pgTable(
  'announcement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    version: integer('version').notNull().default(1),
    /** Plain text, 1–280 characters; never in logs or audit data. */
    body: text('body').notNull(),
    level: text('level').$type<(typeof ANNOUNCEMENT_LEVELS)[number]>().notNull(),
    startsAt: at('starts_at').notNull(),
    endsAt: at('ends_at'),
    target: text('target').$type<(typeof ANNOUNCEMENT_TARGETS)[number]>().notNull(),
    endedEarly: boolean('ended_early').notNull().default(false),
    /** Super admins' user ids and names as they were (shifa_platform reads no account). */
    endedBy: uuid('ended_by'),
    endedByName: text('ended_by_name'),
    createdBy: uuid('created_by').notNull(),
    createdByName: text('created_by_name'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('announcement_body_check', sql`char_length(btrim(${t.body})) between 1 and 280`),
    check('announcement_level_check', sql`${t.level} in ('info', 'warning')`),
    check('announcement_target_check', sql`${t.target} in ('all', 'selected')`),
    check('announcement_version_check', sql`${t.version} >= 1`),
    check(
      'announcement_ended_by_check',
      sql`(${t.endedEarly} and ${t.endedBy} is not null and ${t.endsAt} is not null)
          or (not ${t.endedEarly} and ${t.endedBy} is null)`,
    ),
    index('announcement_starts_at_idx').on(t.startsAt),
  ],
);

export const announcementTarget = pgTable(
  'announcement_target',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id),
    announcementId: uuid('announcement_id')
      .notNull()
      .references(() => announcement.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.announcementId] })],
);

export const announcementDismissal = pgTable(
  'announcement_dismissal',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
    announcementId: uuid('announcement_id')
      .notNull()
      .references(() => announcement.id),
    /** The version the person hid; a later version shows to them again. */
    version: integer('version').notNull(),
    dismissedAt: at('dismissed_at').notNull().defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.announcementId] }),
    check('announcement_dismissal_version_check', sql`${t.version} >= 1`),
    index('announcement_dismissal_announcement_id_idx').on(t.announcementId),
  ],
);
