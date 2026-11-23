// The only way a super admin comes to exist (A-01a criterion 13): `pnpm --filter @shifa/api
// seed:super-admin` (scripts/seed-super-admin.ts) calls this with a phone and a name. It creates
// the person without a password, marks them in platform_admin (audited
// `platform.admin_created`) and returns a one-time setup link valid 72 h; its token is stored
// hashed in Better Auth's verification table (a super admin has no clinic, so no setup_link row).
import { normalisePhone } from '@shifa/contracts';
import {
  type AuthDb,
  account,
  membership,
  type PlatformDb,
  platformAdmin,
  registerPlatformAdmin,
  verification,
} from '@shifa/db';
import { and, eq, isNotNull } from 'drizzle-orm';
import { type Clock, systemClock } from '../../platform/clock.ts';
import { createPerson, userIdByPhone } from './accounts.ts';
import { ADMIN_SETUP_IDENTIFIER, LINK_TTL_MS, linkUrls, newLinkToken } from './links.ts';

export interface SeedSuperAdminInput {
  authDb: AuthDb;
  platformDb: PlatformDb;
  /** As typed; normalised to E.164 (+963, +90). */
  phone: string;
  name: string;
  clinicWebUrl: string;
  clock?: Clock;
}

export interface SeededSuperAdmin {
  userId: string;
  /** Shown once; the token is not stored. */
  setupUrl: string;
  expiresAt: Date;
}

export class SeedError extends Error {
  override name = 'SeedError';
}

export interface SeedArgs {
  phone: string;
  name: string;
}

/**
 * `--phone <phone> --name <name> [--allow-production]`. Refuses NODE_ENV=production unless
 * `--allow-production` is given (a super admin in production is a deliberate act).
 */
export function parseSeedArgs(argv: readonly string[], nodeEnv: string | undefined): SeedArgs {
  const value = (flag: string) => {
    const at = argv.indexOf(flag);
    const found = at >= 0 ? argv[at + 1] : undefined;
    return found && !found.startsWith('--') ? found : undefined;
  };
  const phone = value('--phone');
  const name = value('--name');
  if (!phone || !name) {
    throw new SeedError(
      'usage: seed:super-admin --phone <phone> --name <name> [--allow-production]',
    );
  }
  if (nodeEnv === 'production' && !argv.includes('--allow-production')) {
    throw new SeedError('refused in NODE_ENV=production without --allow-production');
  }
  return { phone, name };
}

export async function seedSuperAdmin(input: SeedSuperAdminInput): Promise<SeededSuperAdmin> {
  const phone = normalisePhone(input.phone);
  if (!phone.ok) throw new SeedError('the phone is not a valid +963 or +90 number');
  const name = input.name.trim();
  if (name.length === 0 || name.length > 200)
    throw new SeedError('the name must be 1 to 200 characters');
  const now = (input.clock ?? systemClock).now();
  const { token, hash } = newLinkToken();
  const expiresAt = new Date(now.getTime() + LINK_TTL_MS);
  const unfinished = await unfinishedSeed(input.authDb, phone.e164);
  const userId = await input.authDb.withAuth(async (tx) => {
    // Never takes over an account in use (that would reset someone's password); only a run that
    // stopped before platform_admin was written is picked up again (review 5).
    const existing = await userIdByPhone(tx, phone.e164);
    if (existing !== null && existing !== unfinished) {
      throw new SeedError('an account with this phone already exists');
    }
    const id = existing ?? (await createPerson(tx, { name, phoneE164: phone.e164, now }));
    await tx
      .delete(verification)
      .where(eq(verification.identifier, `${ADMIN_SETUP_IDENTIFIER}:${id}`));
    await tx.insert(verification).values({
      identifier: `${ADMIN_SETUP_IDENTIFIER}:${id}`,
      value: hash,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  });
  await input.platformDb.withPlatformAdmin(
    { actorId: userId, event: 'platform.admin_created', targetId: userId },
    (tx) => registerPlatformAdmin(tx, userId),
  );
  return { userId, setupUrl: linkUrls(input.clinicWebUrl, token).url, expiresAt };
}

/**
 * The account an earlier seed run left behind (created, then the platform step failed): no
 * password, no membership, not yet a super admin. Null for any other account or none.
 */
async function unfinishedSeed(authDb: AuthDb, phoneE164: string): Promise<string | null> {
  const found = await authDb.withAuth(async (tx) => {
    const id = await userIdByPhone(tx, phoneE164);
    if (id === null) return null;
    const [password] = await tx
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, id), isNotNull(account.password)));
    const [admin] = await tx
      .select({ id: platformAdmin.userId })
      .from(platformAdmin)
      .where(eq(platformAdmin.userId, id));
    return password || admin ? null : id;
  });
  if (found === null) return null;
  const memberships = await authDb.withUser(found, (tx) =>
    tx.select({ id: membership.id }).from(membership),
  );
  return memberships.length === 0 ? found : null;
}
