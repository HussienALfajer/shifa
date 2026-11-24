// A-01-11 security review M1: a clinic can hold a pending co-owner the set-up owner invited (an
// owner role on a pending membership). The phone edit is for a clinic's only owner, never that
// co-owner: shifa_platform's owner.phone_changed policies refuse it; a sole pending owner in
// another clinic still changes.
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { changeOwnerPhone, createClinic } from '../src/index.ts';
import { membership, roleAssignment } from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  insertMembership,
  insertUser,
  superuserDb,
  syntheticPhones,
  testAuthDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const ADMIN = fixtureId('owner-phone co-owner admin');
const [OWNER = '', CO_OWNER = '', NEW_PHONE = '', SOLE = ''] = syntheticPhones(7712, 4);
const LATER = () => new Date(Date.now() + 3_600_000);
const su = () => superuserDb(workerDatabaseName());

const newClinic = (phone: string, hash: string) =>
  testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'clinic.created' }, (tx) =>
    createClinic(tx, {
      name: 'عيادة',
      type: 'solo',
      owner: {
        displayName: 'مالك',
        phoneE164: phone,
        link: { purpose: 'owner_setup', tokenHash: hash, expiresAt: LATER() },
      },
    }),
  );

const edit = (tenantId: string, membershipId: string) =>
  testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'owner.phone_changed' }, (tx) =>
    changeOwnerPhone(tx, { tenantId, membershipId, phoneE164: NEW_PHONE }),
  );

let tenantId: string;
let coOwnerId: string;

beforeEach(async () => {
  await createTestTenants();
  const created = await newClinic(OWNER, 'd4'.repeat(32));
  tenantId = created.tenantId;
  // The owner sets up an account (bound, active), then invites a co-owner (pending, owner role).
  const ownerUser = randomUUID();
  await testAuthDb().withAuth((tx) => insertUser(tx, { id: ownerUser, phone: OWNER }));
  await su()
    .update(membership)
    .set({ userId: ownerUser, status: 'active' })
    .where(eq(membership.id, created.ownerMembershipId ?? ''));
  coOwnerId = randomUUID();
  await testDb().withTenant({ tenantId, userId: ownerUser }, async (tx) => {
    await insertMembership(tx, { id: coOwnerId, tenantId, phone: CO_OWNER });
    await tx.insert(roleAssignment).values({ tenantId, membershipId: coOwnerId, role: 'owner' });
  });
});

describe('a pending co-owner (security review M1)', () => {
  it('is never changed in owner.phone_changed', async () => {
    expect(await edit(tenantId, coOwnerId)).toBe(false);
    const [row] = await su()
      .select({ p: membership.phoneE164 })
      .from(membership)
      .where(eq(membership.id, coOwnerId));
    expect(row?.p).toBe(CO_OWNER);
  });

  it('a sole pending owner of another clinic still changes', async () => {
    const other = await newClinic(SOLE, 'e5'.repeat(32));
    expect(await edit(other.tenantId, other.ownerMembershipId ?? '')).toBe(true);
  });
});
