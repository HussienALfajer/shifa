// A-01-03 grants (A-01a criteria 2, 4, 11, 13): the platform path writes a clinic's owner
// (pending membership, owner role, setup link) in the clinic.created transaction, re-issues an
// owner's link (replacing the earlier one) and reads only owner cards, never a token hash or
// another member; the auth path reads what a link's page shows (person, clinic) through that link
// alone and binds the link's membership once the link is used; super admins are listed in
// platform_admin, written only by the seed's platform event.
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createClinic,
  issueOwnerLink,
  type PlatformEvent,
  type PlatformTx,
  registerPlatformAdmin,
} from '../src/index.ts';
import {
  membership,
  platformAdmin,
  roleAssignment,
  setupLink,
  tenant,
} from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  insertMembership,
  insertUser,
  rawAppDb,
  superuserDb,
  syntheticPhones,
  testAuthDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const ADMIN = fixtureId('owner-links admin');
const HASH_A = 'a1'.repeat(32);
const HASH_B = 'b2'.repeat(32);
const [OWNER_PHONE = '', STAFF_PHONE = '', ADMIN_PHONE = ''] = syntheticPhones(7501, 3);
const LATER = new Date(Date.now() + 72 * 3_600_000);
const su = () => superuserDb(workerDatabaseName());

function platform<T>(event: PlatformEvent, fn: (tx: PlatformTx) => Promise<T>): Promise<T> {
  return testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, (tx) => fn(tx));
}

async function clinicWithOwner(name = 'عيادة المالك') {
  return platform('clinic.created', (tx) =>
    createClinic(tx, {
      name,
      type: 'multi_doctor',
      owner: {
        displayName: 'مالك تجريبي',
        phoneE164: OWNER_PHONE,
        link: { purpose: 'owner_setup', tokenHash: HASH_A, expiresAt: LATER },
      },
    }),
  );
}

const code = (err: unknown) => (err as { code?: string }).code;

beforeEach(async () => {
  await createTestTenants();
});

describe('clinic creation with its owner (criterion 2)', () => {
  it('writes the pending owner membership, the owner role and the link in one transaction', async () => {
    const created = await clinicWithOwner();
    expect(created.ownerMembershipId).toBeDefined();
    expect(await su().select().from(membership)).toMatchObject([
      { id: created.ownerMembershipId, status: 'pending', userId: null, phoneE164: OWNER_PHONE },
    ]);
    expect(await su().select().from(roleAssignment)).toMatchObject([
      { membershipId: created.ownerMembershipId, role: 'owner', branchId: null },
    ]);
    expect(await su().select().from(setupLink)).toMatchObject([
      { membershipId: created.ownerMembershipId, purpose: 'owner_setup', tokenHash: HASH_A },
    ]);
  });

  it('leaves nothing when the owner row fails', async () => {
    await expect(
      platform('clinic.created', (tx) =>
        createClinic(tx, {
          name: 'عيادة',
          type: 'solo',
          owner: {
            displayName: '  ',
            phoneE164: OWNER_PHONE,
            link: { purpose: 'owner_setup', tokenHash: HASH_A, expiresAt: LATER },
          },
        }),
      ),
    ).rejects.toMatchObject({ code: '23514' });
    expect(await su().select().from(tenant)).toHaveLength(0);
    expect(await su().select().from(setupLink)).toHaveLength(0);
  });

  it('refuses owner rows outside a clinic.created transaction', async () => {
    const { tenantId } = await clinicWithOwner();
    const outcome = await platform('owner.link_issued', async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
      await tx.insert(membership).values({
        tenantId,
        phoneE164: STAFF_PHONE,
        displayName: 'دخيل',
      });
    }).catch(code);
    expect(outcome).toBe('42501');
  });
});

describe('platform reads (criterion 13: no clinic data)', () => {
  it('sees owner cards only: no other member, no token hash', async () => {
    const { tenantId, ownerMembershipId } = await clinicWithOwner();
    await testDb().withTenant({ tenantId, userId: randomUUID() }, (tx) =>
      insertMembership(tx, { id: randomUUID(), tenantId, phone: STAFF_PHONE }),
    );
    const members = await platform('clinic.status_changed', (tx) =>
      tx.select({ id: membership.id, name: membership.displayName }).from(membership),
    );
    expect(members).toEqual([{ id: ownerMembershipId, name: 'مالك تجريبي' }]);
    const hash = await platform('clinic.status_changed', (tx) =>
      tx.select({ h: setupLink.tokenHash }).from(setupLink),
    ).catch(code);
    expect(hash).toBe('42501');
  });
});

describe('re-issuing an owner link (criteria 4, 13)', () => {
  it('replaces the earlier unused link and adds the new one', async () => {
    const { tenantId, ownerMembershipId } = await clinicWithOwner();
    await platform('owner.link_issued', (tx) =>
      issueOwnerLink(tx, {
        tenantId,
        membershipId: ownerMembershipId ?? '',
        purpose: 'owner_setup',
        tokenHash: HASH_B,
        expiresAt: LATER,
      }),
    );
    const rows = await su().select().from(setupLink).orderBy(setupLink.createdAt);
    expect(rows.find((r) => r.tokenHash === HASH_A)?.replacedAt).not.toBeNull();
    expect(rows.find((r) => r.tokenHash === HASH_B)?.replacedAt).toBeNull();
  });

  it('only in an owner.link_issued transaction', async () => {
    const { tenantId, ownerMembershipId } = await clinicWithOwner();
    const outcome = await platform('owner.mfa_reset', (tx) =>
      issueOwnerLink(tx, {
        tenantId,
        membershipId: ownerMembershipId ?? '',
        purpose: 'owner_setup',
        tokenHash: HASH_B,
        expiresAt: LATER,
      }),
    ).catch(code);
    expect(outcome).toBe('42501');
  });
});

describe('the auth path through a link (criteria 4, 5)', () => {
  it('reads the link’s person and clinic, and nothing without the link', async () => {
    const { tenantId, ownerMembershipId } = await clinicWithOwner('عيادة الرابط');
    const seen = await testAuthDb().withSetupLink(HASH_A, async (tx) => ({
      members: await tx
        .select({ id: membership.id, name: membership.displayName })
        .from(membership),
      clinics: await tx.select({ name: tenant.name }).from(tenant),
    }));
    expect(seen).toEqual({
      members: [{ id: ownerMembershipId, name: 'مالك تجريبي' }],
      clinics: [{ name: 'عيادة الرابط' }],
    });
    const other = await testAuthDb().withSetupLink(HASH_B, async (tx) => ({
      members: await tx.select().from(membership),
      clinics: await tx.select().from(tenant).where(eq(tenant.id, tenantId)),
    }));
    expect(other).toEqual({ members: [], clinics: [] });
  });

  it('binds the membership only after the link is used, and only once', async () => {
    const { ownerMembershipId } = await clinicWithOwner();
    const userId = randomUUID();
    await testAuthDb().withAuth((tx) => insertUser(tx, { id: userId, phone: OWNER_PHONE }));
    const bind = () =>
      testAuthDb().withSetupLink(HASH_A, (tx) =>
        tx
          .update(membership)
          .set({ userId, status: 'active' })
          .where(eq(membership.id, ownerMembershipId ?? ''))
          .returning({ id: membership.id }),
      );
    expect(await bind()).toHaveLength(0);
    await testAuthDb().withSetupLink(HASH_A, (tx) =>
      tx.execute(sql`update setup_link set used_at = now()`),
    );
    expect(await bind()).toHaveLength(1);
    expect(await bind()).toHaveLength(0);
  });
});

describe('platform_admin', () => {
  it('is written only by the seed event, read by shifa_auth, invisible to shifa_app', async () => {
    const userId = randomUUID();
    await testAuthDb().withAuth((tx) => insertUser(tx, { id: userId, phone: ADMIN_PHONE }));
    expect(
      await platform('clinic.created', (tx) => registerPlatformAdmin(tx, userId)).catch(code),
    ).toBe('42501');
    await testPlatformDb().withPlatformAdmin(
      { actorId: userId, event: 'platform.admin_created' },
      (tx) => registerPlatformAdmin(tx, userId),
    );
    expect(await testAuthDb().withAuth((tx) => tx.select().from(platformAdmin))).toMatchObject([
      { userId },
    ]);
    expect(
      await testAuthDb()
        .withAuth((tx) => tx.insert(platformAdmin).values({ userId: randomUUID() }))
        .catch(code),
    ).toBe('42501');
    expect(await rawAppDb().execute(sql`select * from platform_admin`).catch(code)).toBe('42501');
  });
});
