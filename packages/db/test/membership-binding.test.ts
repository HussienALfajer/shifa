// A-01-05 checkpoint 1 (backlog "Membership binding on INSERT": A-01-01 security review L4,
// A-01-04 security review L2): no role writes a membership already bound to an account by
// INSERT, so no clinic reaches a person's chooser unless that person accepted it. Binding stays
// an UPDATE on the auth path through a used link. An unbound membership is never active, and a
// bound one never goes back to pending (the accept policies match pending rows).
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createClinic, type Tx } from '../src/index.ts';
import { membership, roleAssignment } from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  insertMembership,
  insertTenantRow,
  insertUser,
  superuserDb,
  syntheticPhones,
  testAuthDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const TENANT = fixtureId('binding tenant');
const PERSON = fixtureId('binding person');
const SEEDER = fixtureId('binding seeder');
const ADMIN = fixtureId('binding admin');
const PENDING = fixtureId('binding pending membership');
const BOUND = fixtureId('binding bound membership');
const [PHONE = '', OTHER_PHONE = '', THIRD_PHONE = ''] = syntheticPhones(7901, 3);

const su = () => superuserDb(workerDatabaseName());
const inTenant = <T>(fn: (tx: Tx) => Promise<T>) =>
  testDb().withTenant({ tenantId: TENANT, userId: SEEDER }, fn);

/** SQLSTATE of the error `fn` rejects with (Drizzle wraps the pg error as its cause). */
async function sqlState(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
    return undefined;
  } catch (err) {
    const cause = (err as { cause?: { code?: string }; code?: string }).cause;
    return cause?.code ?? (err as { code?: string }).code;
  }
}

async function statusOf(id: string) {
  const { rows } = await su().execute<{ user_id: string | null; status: string }>(
    sql`select user_id, status from membership where id = ${id}`,
  );
  return rows[0];
}

beforeEach(async () => {
  await createTestTenants(TENANT);
  await testAuthDb().withAuth((tx) => insertUser(tx, { id: PERSON, phone: PHONE }));
  await inTenant((tx) =>
    insertMembership(tx, { id: PENDING, tenantId: TENANT, phone: OTHER_PHONE }),
  );
});

describe('INSERT by shifa_app (a clinic)', () => {
  it('refuses a membership bound to an account', async () => {
    const state = await sqlState(() =>
      inTenant((tx) =>
        tx.insert(membership).values({
          tenantId: TENANT,
          userId: PERSON,
          phoneE164: PHONE,
          displayName: 'مربوط',
          status: 'active',
        }),
      ),
    );
    expect(state).toBe('42501');
    expect(await statusOf(BOUND)).toBeUndefined();
  });

  it.each(['active', 'deactivated'] as const)(
    'refuses an unbound membership with status %s',
    async (status) => {
      const state = await sqlState(() =>
        inTenant((tx) =>
          tx
            .insert(membership)
            .values({ tenantId: TENANT, phoneE164: THIRD_PHONE, displayName: 'حالة', status }),
        ),
      );
      expect(state).toBe('42501');
    },
  );

  it('refuses a bound pending membership', async () => {
    const state = await sqlState(() =>
      inTenant((tx) =>
        tx.insert(membership).values({
          tenantId: TENANT,
          userId: PERSON,
          phoneE164: PHONE,
          displayName: 'مربوط',
          status: 'pending',
        }),
      ),
    );
    expect(state).toBe('42501');
  });

  it('refuses deleting a pending membership and re-inserting it bound', async () => {
    const state = await sqlState(() =>
      inTenant(async (tx) => {
        await tx.delete(membership).where(eq(membership.id, PENDING));
        await tx.insert(membership).values({
          id: PENDING,
          tenantId: TENANT,
          userId: PERSON,
          phoneE164: OTHER_PHONE,
          displayName: 'مربوط',
          status: 'active',
        });
      }),
    );
    expect(state).toBe('42501');
    expect(await statusOf(PENDING)).toEqual({ user_id: null, status: 'pending' });
  });

  it('still adds a pending, unbound member (team add)', async () => {
    await inTenant((tx) =>
      tx
        .insert(membership)
        .values({ tenantId: TENANT, phoneE164: THIRD_PHONE, displayName: 'جديد' }),
    );
    const rows = await su().select().from(membership).where(eq(membership.phoneE164, THIRD_PHONE));
    expect(rows.map((r) => [r.userId, r.status])).toEqual([[null, 'pending']]);
  });
});

describe('status of an unbound or bound membership', () => {
  beforeEach(async () => {
    await inTenant((tx) =>
      insertMembership(tx, { id: BOUND, tenantId: TENANT, phone: PHONE, userId: PERSON }),
    );
  });

  it('the fixture writes a bound member outside the tenant path', async () => {
    expect(await statusOf(BOUND)).toEqual({ user_id: PERSON, status: 'active' });
  });

  it('refuses setting an unbound membership active (CHECK)', async () => {
    const state = await sqlState(() =>
      inTenant((tx) =>
        tx.update(membership).set({ status: 'active' }).where(eq(membership.id, PENDING)),
      ),
    );
    expect(state).toBe('23514');
    expect(await statusOf(PENDING)).toEqual({ user_id: null, status: 'pending' });
  });

  it('refuses putting a bound membership back to pending', async () => {
    const state = await sqlState(() =>
      inTenant((tx) =>
        tx.update(membership).set({ status: 'pending' }).where(eq(membership.id, BOUND)),
      ),
    );
    expect(state).toBe('42501');
    expect(await statusOf(BOUND)).toEqual({ user_id: PERSON, status: 'active' });
  });

  it('still deactivates and reactivates members (team, A-01-04)', async () => {
    await inTenant(async (tx) => {
      await tx.update(membership).set({ status: 'deactivated' }).where(eq(membership.id, BOUND));
      await tx.update(membership).set({ status: 'active' }).where(eq(membership.id, BOUND));
      // A pending invitation can be deactivated and goes back to pending on reactivation.
      await tx.update(membership).set({ status: 'deactivated' }).where(eq(membership.id, PENDING));
      await tx.update(membership).set({ status: 'pending' }).where(eq(membership.id, PENDING));
    });
    expect(await statusOf(BOUND)).toEqual({ user_id: PERSON, status: 'active' });
    expect(await statusOf(PENDING)).toEqual({ user_id: null, status: 'pending' });
  });
});

describe('INSERT by shifa_platform (clinic creation)', () => {
  it('cannot insert a bound owner, even inside clinic.created', async () => {
    const tenantId = randomUUID();
    const state = await sqlState(() =>
      testPlatformDb().withPlatformAdmin(
        { actorId: ADMIN, event: 'clinic.created' },
        async (tx) => {
          await insertTenantRow(tx, { id: tenantId });
          await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
          await tx.insert(membership).values({
            tenantId,
            userId: PERSON,
            phoneE164: PHONE,
            displayName: 'مالك مربوط',
            status: 'active',
          });
        },
      ),
    );
    expect(state).toBe('42501');
  });

  it('still creates a clinic with its pending owner', async () => {
    const { tenantId } = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'clinic.created' },
      (tx) =>
        createClinic(tx, {
          name: 'عيادة الربط',
          type: 'multi_doctor',
          owner: {
            displayName: 'مالك تجريبي',
            phoneE164: THIRD_PHONE,
            link: {
              purpose: 'owner_setup',
              tokenHash: 'e5'.repeat(32),
              expiresAt: new Date(Date.now() + 3_600_000),
            },
          },
        }),
    );
    const owners = await su()
      .select({ userId: membership.userId, status: membership.status })
      .from(membership)
      .innerJoin(roleAssignment, eq(roleAssignment.membershipId, membership.id))
      .where(eq(membership.tenantId, tenantId));
    expect(owners).toEqual([{ userId: null, status: 'pending' }]);
  });
});
