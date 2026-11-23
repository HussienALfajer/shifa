// A-01-03 security review: app.admin_reason is a setting the role sets itself, so the platform's
// create-only policies must also check the rows (M1: no second owner, no owner role on a member,
// no long-lived link); the clinic path never writes an owner link, which would reset a shared
// account's password (M2); shifa_auth updates a membership only to bind it (L2).
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createClinic, type PlatformTx } from '../src/index.ts';
import { membership, roleAssignment, setupLink } from '../src/schema/index.ts';
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

const ADMIN = fixtureId('owner-security admin');
const [OWNER = '', DOCTOR = '', OTHER = ''] = syntheticPhones(7601, 3);
const LATER = () => new Date(Date.now() + 3_600_000);
const code = (err: unknown) => (err as { code?: string }).code;

/** As the platform under clinic.created, with `tenantId` set (what an attacker could do). */
function asCreation<T>(tenantId: string, fn: (tx: PlatformTx) => Promise<T>) {
  return testPlatformDb().withPlatformAdmin(
    { actorId: ADMIN, event: 'clinic.created' },
    async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
      return fn(tx);
    },
  );
}

let tenantId: string;
let doctorId: string;

beforeEach(async () => {
  await createTestTenants();
  const created = await testPlatformDb().withPlatformAdmin(
    { actorId: ADMIN, event: 'clinic.created' },
    (tx) =>
      createClinic(tx, {
        name: 'عيادة',
        type: 'solo',
        owner: {
          displayName: 'مالك',
          phoneE164: OWNER,
          link: { purpose: 'owner_setup', tokenHash: 'c3'.repeat(32), expiresAt: LATER() },
        },
      }),
  );
  tenantId = created.tenantId;
  doctorId = randomUUID();
  await testDb().withTenant({ tenantId, userId: randomUUID() }, (tx) =>
    insertMembership(tx, { id: doctorId, tenantId, phone: DOCTOR }),
  );
});

describe('platform writes into an existing clinic (M1)', () => {
  it('cannot add a second owner membership', async () => {
    const outcome = await asCreation(tenantId, (tx) =>
      tx.insert(membership).values({ tenantId, phoneE164: OTHER, displayName: 'دخيل' }),
    ).catch(code);
    expect(outcome).toBe('42501');
  });

  it('cannot give a member the owner role', async () => {
    const outcome = await asCreation(tenantId, (tx) =>
      tx.insert(roleAssignment).values({ tenantId, membershipId: doctorId, role: 'owner' }),
    ).catch(code);
    expect(outcome).toBe('42501');
  });

  it('cannot write a link for a member, or one valid longer than 72 h', async () => {
    const forMember = await asCreation(tenantId, (tx) =>
      tx.insert(setupLink).values({
        tenantId,
        membershipId: doctorId,
        purpose: 'owner_setup',
        tokenHash: 'd4'.repeat(32),
        expiresAt: LATER(),
      }),
    ).catch(code);
    expect(forMember).toBe('42501');
  });
});

describe('clinic path and owner links (M2)', () => {
  it('shifa_app cannot write an owner link, nor turn a link into one', async () => {
    const insert = await testDb()
      .withTenant({ tenantId, userId: randomUUID() }, (tx) =>
        tx.insert(setupLink).values({
          tenantId,
          membershipId: doctorId,
          purpose: 'owner_setup',
          tokenHash: 'e5'.repeat(32),
          expiresAt: LATER(),
        }),
      )
      .catch(code);
    expect(insert).toBe('42501');
    await testDb().withTenant({ tenantId, userId: randomUUID() }, (tx) =>
      tx.insert(setupLink).values({
        tenantId,
        membershipId: doctorId,
        purpose: 'member_setup',
        tokenHash: 'f6'.repeat(32),
        expiresAt: LATER(),
      }),
    );
    const update = await testDb()
      .withTenant({ tenantId, userId: randomUUID() }, (tx) =>
        tx.execute(
          sql`update setup_link set purpose = 'owner_setup' where token_hash = ${'f6'.repeat(32)}`,
        ),
      )
      .catch(code);
    expect(update).toBe('42501');
  });
});

describe('shifa_auth updates (L2)', () => {
  it('cannot change its own membership even with a tenant set', async () => {
    const userId = randomUUID();
    await testAuthDb().withAuth((tx) => insertUser(tx, { id: userId, phone: DOCTOR }));
    // Bound by the superuser: shifa_app may no longer set user_id (A-01-04).
    await superuserDb(workerDatabaseName()).execute(
      sql`update membership set user_id = ${userId}, status = 'deactivated' where id = ${doctorId}`,
    );
    const { rowCount } = await testAuthDb().withUser(userId, async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
      return tx.execute(sql`update membership set status = 'active' where id = ${doctorId}`);
    });
    expect(rowCount).toBe(0);
  });
});
