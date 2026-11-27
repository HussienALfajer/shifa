// Fixtures of the route matrix (route-matrix.test.ts): fresh phones, clinics with a pending or a
// set-up owner, and the calling person's TOTP put in a known state, so each sample request shows
// access only.
import { createClinic, membership, tenantOverride, twoFactor } from '@shifa/db';
import {
  fixtureId,
  superuserDb,
  syntheticPhones,
  testAuthDb,
  testPlatformDb,
  workerDatabaseName,
} from '@shifa/db/testing';
import { eq } from 'drizzle-orm';
import { newLinkToken } from '../../src/modules/identity/links.ts';
import { sealSecret } from '../../src/modules/identity/secret-box.ts';
import { base32Encode } from '../../src/modules/identity/totp.ts';
import { seedPerson } from '../identity/support.ts';
import { totpAt } from '../identity/totp.ts';
import { TEST_SECRETS } from '../support.ts';

/** Fresh phones for clinic owners and links (a used link's phone has an account). */
const spare = syntheticPhones(2026_11_28, 400);
let spareIndex = 0;
export const nextPhone = () => {
  const phone = spare[spareIndex];
  spareIndex += 1;
  if (!phone) throw new Error('out of spare phones');
  return phone;
};

/** A clinic with a pending owner and a fresh link; returns the link's token. */
export async function clinicWithLink(
  ownerPhone: string = nextPhone(),
): Promise<{ clinicId: string; token: string }> {
  const { token, hash } = newLinkToken();
  const created = await testPlatformDb().withPlatformAdmin(
    { actorId: fixtureId('matrix super admin'), event: 'clinic.created' },
    (tx) =>
      createClinic(tx, {
        name: 'عيادة المصفوفة',
        type: 'solo',
        owner: {
          displayName: 'مالك المصفوفة',
          phoneE164: ownerPhone,
          link: {
            purpose: 'owner_setup',
            tokenHash: hash,
            expiresAt: new Date(Date.now() + 3_600_000),
          },
        },
      }),
  );
  return { clinicId: created.tenantId, token };
}

/** A new clinic with an override of `limits.branches` (written as the superuser). */
export async function clinicWithOverride(): Promise<string> {
  const { clinicId } = await clinicWithLink();
  await superuserDb(workerDatabaseName())
    .insert(tenantOverride)
    .values({
      tenantId: clinicId,
      key: 'limits.branches',
      value: 2,
      reason: 'سبب تجريبي للمصفوفة',
      setBy: fixtureId('matrix super admin'),
    });
  return clinicId;
}

/**
 * The callers' clinic (A-02-03): the test feature on (so the gated probe shows a pass), and limits
 * high enough that the matrix's many adds and branches show access, never a full limit.
 */
export async function openLimitsAndTestFeature(tenantId: string): Promise<void> {
  const base = { tenantId, reason: 'سبب تجريبي للمصفوفة', setBy: fixtureId('matrix super admin') };
  await superuserDb(workerDatabaseName())
    .insert(tenantOverride)
    .values([
      { ...base, key: 'test.feature', value: true },
      { ...base, key: 'limits.practitioners', value: 100_000 },
      { ...base, key: 'limits.branches', value: 100_000 },
    ]);
}

/** A clinic whose owner set up an account (the owner membership bound and active). */
export async function clinicWithAccountOwner(): Promise<string> {
  const phone = nextPhone();
  const { userId } = await seedPerson(phone);
  const { clinicId: id } = await clinicWithLink(phone);
  await superuserDb(workerDatabaseName())
    .update(membership)
    .set({ userId, status: 'active' })
    .where(eq(membership.tenantId, id));
  return id;
}

/** A known TOTP key, so the matrix can send a valid code. */
const TOTP_KEY = Buffer.alloc(20, 7);

/** Puts `userId`'s TOTP in `state` and returns the current code. */
export async function totpState(
  userId: string | undefined,
  state: 'none' | 'unconfirmed' | 'enrolled' | 'reenrolling',
): Promise<string> {
  const code = totpAt(base32Encode(TOTP_KEY), new Date());
  if (userId === undefined) return code;
  await testAuthDb().withAuth(async (tx) => {
    await tx.delete(twoFactor).where(eq(twoFactor.userId, userId));
    if (state === 'none') return;
    await tx.insert(twoFactor).values({
      userId,
      secret: sealSecret(TOTP_KEY, TEST_SECRETS.betterAuthSecret),
      backupCodes: '[]',
      verified: state !== 'unconfirmed',
      failedVerificationCount: 0,
      // A re-enrolment pending with the same known key (OD-98), so the new app's code is known.
      pendingSecret:
        state === 'reenrolling' ? sealSecret(TOTP_KEY, TEST_SECRETS.betterAuthSecret) : null,
    });
  });
  return code;
}
