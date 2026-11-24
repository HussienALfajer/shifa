// Identity tables (A-01-01, A-01a criterion 1): Better Auth's schema for better-auth 1.7.27 with
// the phone-number and two-factor plugins, keys switched to uuid (`advanced.database.generateId:
// 'uuid'` in A-01-02), column names in snake_case. Global (a person is one account across
// clinics, ADR-0006) and personal data: shifa_auth has full access, shifa_app reads only the
// signed-in person's rows (app.user_id) and never a secret column (ADR-0043).
// Plus `auth_throttle` (A-01a criterion 7): keyed by an HMAC, never the phone or IP itself.
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, E164_CHECK, SHA256_HEX_CHECK, updatedAt } from './columns.ts';
import { tenant } from './platform.ts';

const at = (name: string) => timestamp(name, { withTimezone: true });

export const user = pgTable(
  'user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** Required and unique by Better Auth; the phone plugin fills a placeholder (A-01-02). */
    email: text('email').notNull().unique('user_email_key'),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    /** E.164, one account per phone (A-01a criterion 6). */
    phoneNumber: text('phone_number').unique('user_phone_number_key'),
    phoneNumberVerified: boolean('phone_number_verified'),
    twoFactorEnabled: boolean('two_factor_enabled').default(false),
  },
  (t) => [check('user_phone_number_check', sql`${t.phoneNumber} ~ ${sql.raw(E164_CHECK)}`)],
);

export const session = pgTable(
  'session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    expiresAt: at('expires_at').notNull(),
    token: text('token').notNull().unique('session_token_key'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** The clinic and branch this session works in (A-01b switcher); checked by the API. */
    activeTenantId: uuid('active_tenant_id').references(() => tenant.id),
    activeBranchId: uuid('active_branch_id'),
    /** Idle expiry (OD-77): refreshed by the API, compared with the clinic's idle minutes. */
    lastActiveAt: at('last_active_at'),
    /** When this session passed the TOTP challenge or enrolment (A-01-03); null: not yet. */
    mfaVerifiedAt: at('mfa_verified_at'),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: at('access_token_expires_at'),
    refreshTokenExpiresAt: at('refresh_token_expires_at'),
    scope: text('scope'),
    /** scrypt hash (A-01a criterion 8). */
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: at('expires_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

export const twoFactor = pgTable(
  'two_factor',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    verified: boolean('verified').default(true),
    failedVerificationCount: integer('failed_verification_count').default(0),
    lockedUntil: at('locked_until'),
    /** The last TOTP time step accepted (A-01a criterion 12): never accepted again or earlier. */
    lastUsedStep: bigint('last_used_step', { mode: 'number' }),
    /** When enrolment was confirmed (A-01a 12a, My account); null before, and for older rows. */
    enrolledAt: at('enrolled_at'),
    /**
     * A self re-enrolment's new secret, sealed like `secret` (OD-98, A-01-11): the old one stays
     * in use until a code from the new app confirms it; null when none is pending.
     */
    pendingSecret: text('pending_secret'),
    /**
     * The pending secret's own replay state, until it replaces `secret`. Null today: the one
     * accepted code moves its step to `last_used_step` as the secret is swapped; kept so a later
     * check of the new app (before the confirm) has its own state, never the old secret's.
     */
    pendingLastUsedStep: bigint('pending_last_used_step', { mode: 'number' }),
  },
  (t) => [
    index('two_factor_secret_idx').on(t.secret),
    index('two_factor_user_id_idx').on(t.userId),
  ],
);

/**
 * Super admins (A-01a criterion 13): written only by the seed command on the platform path
 * (`platform.admin_created`); no route creates one. Read by the auth path to build the principal.
 */
export const platformAdmin = pgTable('platform_admin', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
});

export const AUTH_THROTTLE_KINDS = ['phone', 'ip'] as const;

/** Sign-in failure windows per phone and per IP (A-01a criterion 7). */
export const authThrottle = pgTable(
  'auth_throttle',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').$type<(typeof AUTH_THROTTLE_KINDS)[number]>().notNull(),
    /** HMAC-SHA-256 of the phone or IP with a server key, as hex: never the value itself. */
    keyHash: text('key_hash').notNull(),
    windowStart: at('window_start').notNull(),
    failures: integer('failures').notNull().default(0),
    lockedUntil: at('locked_until'),
  },
  (t) => [
    unique('auth_throttle_kind_key_hash_key').on(t.kind, t.keyHash),
    check('auth_throttle_kind_check', sql`${t.kind} in ('phone', 'ip')`),
    check('auth_throttle_key_hash_check', sql`${t.keyHash} ~ ${sql.raw(SHA256_HEX_CHECK)}`),
    check('auth_throttle_failures_check', sql`${t.failures} >= 0`),
  ],
);
