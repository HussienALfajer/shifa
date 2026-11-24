// Tenant tables of A-01 (A-01-01; ADR-0004, ADR-0006): tenant_id leads every index and every
// composite key, ENABLE + FORCE RLS with policies on current_tenant_id() (custom migration),
// one isolation case each in test/isolation/cases/. Classification: ./classification.ts.
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, E164_CHECK, SHA256_HEX_CHECK, updatedAt } from './columns.ts';
import { user } from './identity.ts';
import { tenant } from './platform.ts';

const at = (name: string) => timestamp(name, { withTimezone: true });
const tenantId = () =>
  uuid('tenant_id')
    .notNull()
    .references(() => tenant.id);
const nameCheck = (table: string, column: AnyPgColumn) =>
  check(`${table}_name_check`, sql`char_length(btrim(${column})) between 1 and 200`);

/** The legal clinic or group of a tenant (ADR-0006): one per tenant in Release 1. */
export const organization = pgTable(
  'organization',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('organization_tenant_id_key').on(t.tenantId), nameCheck('organization', t.name)],
);

/**
 * Which database holds a tenant (PLT-02; `tenant_deployment` of ADR-0004). Every tenant is on
 * 'primary' until a large group moves to its own database. Read-only for shifa_app.
 */
export const deploymentRoute = pgTable(
  'deployment_route',
  {
    tenantId: tenantId().primaryKey(),
    databaseKey: text('database_key').notNull().default('primary'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('deployment_route_database_key_check', sql`${t.databaseKey} ~ '^[a-z][a-z0-9_]{0,62}$'`),
  ],
);

/** A location (PLT-03, PLT-04); the first one, «الفرع الرئيسي», comes with the clinic. */
export const branch = pgTable(
  'branch',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    address: text('address'),
    phone: text('phone'),
    archivedAt: at('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('branch_tenant_id_id_key').on(t.tenantId, t.id),
    nameCheck('branch', t.name),
    check('branch_phone_check', sql`${t.phone} ~ ${sql.raw(E164_CHECK)}`),
  ],
);

export const MEMBERSHIP_STATUSES = ['pending', 'active', 'deactivated'] as const;

/**
 * A person's place in one clinic (PLT-05, OD-76). `user_id` stays null until the invitation is
 * accepted; the phone and name are what the owner typed, so the owner never reads `user`.
 */
export const membership = pgTable(
  'membership',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    userId: uuid('user_id').references(() => user.id),
    phoneE164: text('phone_e164').notNull(),
    displayName: text('display_name').notNull(),
    status: text('status')
      .$type<(typeof MEMBERSHIP_STATUSES)[number]>()
      .notNull()
      .default('pending'),
    lastActiveAt: at('last_active_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('membership_tenant_id_id_key').on(t.tenantId, t.id),
    unique('membership_tenant_id_phone_e164_key').on(t.tenantId, t.phoneE164),
    unique('membership_tenant_id_user_id_key').on(t.tenantId, t.userId),
    // Target of setup_link's invited phone (A-01-05): an invitation names its member's phone.
    unique('membership_tenant_id_id_phone_e164_key').on(t.tenantId, t.id, t.phoneE164),
    check('membership_phone_e164_check', sql`${t.phoneE164} ~ ${sql.raw(E164_CHECK)}`),
    check(
      'membership_display_name_check',
      sql`char_length(btrim(${t.displayName})) between 1 and 200`,
    ),
    check('membership_status_check', sql`${t.status} in ('pending', 'active', 'deactivated')`),
    // A-01-05: only a bound membership is active (shifa_app may UPDATE `status`). A pending
    // invitation may still be deactivated while unbound (A-01-04).
    check('membership_active_is_bound', sql`${t.status} <> 'active' or ${t.userId} is not null`),
  ],
);

export const ROLES = ['owner', 'doctor', 'receptionist', 'assistant', 'accountant'] as const;
export type Role = (typeof ROLES)[number];

/** A role held tenant-wide (`branch_id` null) or in one branch (PLT-42, PLT-45). */
export const roleAssignment = pgTable(
  'role_assignment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    membershipId: uuid('membership_id').notNull(),
    role: text('role').$type<Role>().notNull(),
    branchId: uuid('branch_id'),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: 'role_assignment_membership_fk',
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [membership.tenantId, membership.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'role_assignment_branch_fk',
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branch.tenantId, branch.id],
    }),
    unique('role_assignment_tenant_id_membership_id_role_branch_id_key')
      .on(t.tenantId, t.membershipId, t.role, t.branchId)
      .nullsNotDistinct(),
    check(
      'role_assignment_role_check',
      sql`${t.role} in ('owner', 'doctor', 'receptionist', 'assistant', 'accountant')`,
    ),
  ],
);

/** A per-member switch of a sensitive permission key (PLT-43, PLT-46). */
export const permissionOverride = pgTable(
  'permission_override',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    membershipId: uuid('membership_id').notNull(),
    key: text('key').notNull(),
    granted: boolean('granted').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: 'permission_override_membership_fk',
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [membership.tenantId, membership.id],
    }).onDelete('cascade'),
    unique('permission_override_tenant_id_membership_id_key_key').on(
      t.tenantId,
      t.membershipId,
      t.key,
    ),
    check('permission_override_key_check', sql`${t.key} ~ '^[a-z][a-z_]*(\\.[a-z][a-z_]*)+$'`),
  ],
);

export const SETUP_LINK_PURPOSES = ['owner_setup', 'member_setup', 'invitation'] as const;

/**
 * A one-time setup or invitation link (A-01a criterion 4): only the SHA-256 of the token is
 * stored. shifa_auth finds a link by that hash alone (current_link_token_hash()).
 */
export const setupLink = pgTable(
  'setup_link',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    membershipId: uuid('membership_id').notNull(),
    purpose: text('purpose').$type<(typeof SETUP_LINK_PURPOSES)[number]>().notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: at('expires_at').notNull(),
    usedAt: at('used_at'),
    replacedAt: at('replaced_at'),
    /**
     * An invitation's phone, the member's own (foreign key): the signed-in account with this phone
     * sees and answers it from the clinic chooser without the link (A-01-05, OD-90).
     */
    invitedPhone: text('invited_phone'),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: 'setup_link_membership_fk',
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [membership.tenantId, membership.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'setup_link_invited_phone_fk',
      columns: [t.tenantId, t.membershipId, t.invitedPhone],
      foreignColumns: [membership.tenantId, membership.id, membership.phoneE164],
    })
      .onDelete('cascade')
      // A pending owner's phone corrected (OD-99, A-01-11): the owner's links follow it.
      .onUpdate('cascade'),
    check(
      'setup_link_invited_phone_check',
      sql`${t.invitedPhone} is null or ${t.purpose} = 'invitation'`,
    ),
    index('setup_link_tenant_id_token_hash_idx').on(t.tenantId, t.tokenHash),
    index('setup_link_tenant_id_membership_id_idx').on(t.tenantId, t.membershipId),
    check(
      'setup_link_purpose_check',
      sql`${t.purpose} in ('owner_setup', 'member_setup', 'invitation')`,
    ),
    check('setup_link_token_hash_check', sql`${t.tokenHash} ~ ${sql.raw(SHA256_HEX_CHECK)}`),
  ],
);
