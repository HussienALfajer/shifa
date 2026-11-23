// The side roles stay on their own rows even when a tenant is set on their path (A-01-01
// security review M1, L1, L2, L3). The tenant isolation policies are for PUBLIC and any role can
// set `app.tenant_id`, so restrictive policies must hold shifa_auth to its own memberships and
// one link, both side roles to null-tenant audit rows, and shifa_platform's tenant-table writes
// to clinic creation.
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createClinic, type Tx } from '../src/index.ts';
import {
  createTestTenants,
  fixtureId,
  insertMembership,
  insertSetupLink,
  insertUser,
  superuserDb,
  syntheticPhones,
  testAuthDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const T1 = fixtureId('side context tenant 1');
const T2 = fixtureId('side context tenant 2');
const U1 = fixtureId('side context user');
const ADMIN = fixtureId('side context admin');
const HASH = 'ab'.repeat(32);
const [PHONE_1 = '', PHONE_2 = ''] = syntheticPhones(7501, 2);

const inTenant = (tenantId: string) => (tx: Tx) =>
  tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);

beforeEach(async () => {
  await createTestTenants(T1, T2);
  await testAuthDb().withAuth((tx) => insertUser(tx, { id: U1, phone: PHONE_1 }));
  // U1 belongs to T1; T2 has another member with a link whose hash is not HASH.
  for (const [tenantId, userId, phone, hash] of [
    [T1, U1, PHONE_1, HASH],
    [T2, null, PHONE_2, createHash('sha256').update('other').digest('hex')],
  ] as const) {
    await testDb().withTenant({ tenantId, userId: U1 }, async (tx) => {
      const id = fixtureId(`side context member ${tenantId}`);
      await insertMembership(tx, { id, tenantId, userId, phone });
      await insertSetupLink(tx, {
        id: fixtureId(`side context link ${tenantId}`),
        tenantId,
        membershipId: id,
        tokenHashHex: hash,
      });
    });
  }
});

describe('shifa_auth with a tenant set on its path', () => {
  it("withUser still reads only the person's own memberships", async () => {
    const { rows } = await testAuthDb().withUser(U1, async (tx) => {
      await inTenant(T2)(tx);
      return tx.execute<{ tenant_id: string }>(sql`select tenant_id from membership`);
    });
    expect(rows).toEqual([{ tenant_id: T1 }]);
  });

  it('withSetupLink still reads and marks only the link of its hash', async () => {
    const { rows, rowCount } = await testAuthDb().withSetupLink(HASH, async (tx) => {
      await inTenant(T2)(tx);
      await tx.execute(sql`update setup_link set used_at = now()`);
      return tx.execute<{ tenant_id: string }>(sql`select tenant_id from setup_link`);
    });
    expect({ rows, rowCount }).toEqual({ rows: [{ tenant_id: T1 }], rowCount: 1 });
    const { rows: used } = await superuserDb(workerDatabaseName()).execute<{ t: string }>(
      sql`select tenant_id::text as t from setup_link where used_at is not null`,
    );
    expect(used).toEqual([{ t: T1 }]);
  });

  it('cannot write an audit row into a tenant', async () => {
    await expect(
      testAuthDb().withAuth(async (tx) => {
        await inTenant(T1)(tx);
        await tx.execute(
          sql`insert into audit_event (tenant_id, event) values (${T1}, 'auth.sign_in')`,
        );
      }),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('shifa_platform with a tenant set on its path', () => {
  it('cannot insert into an existing clinic outside clinic creation', async () => {
    await expect(
      testPlatformDb().withPlatformAdmin(
        { actorId: ADMIN, event: 'clinic.status_changed' },
        async (tx) => {
          await inTenant(T1)(tx);
          await tx.execute(sql`insert into branch (tenant_id, name) values (${T1}, 'فرع دخيل')`);
        },
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('cannot write an audit row into a tenant', async () => {
    await expect(
      testPlatformDb().withPlatformAdmin(
        { actorId: ADMIN, event: 'clinic.created' },
        async (tx) => {
          await inTenant(T1)(tx);
          await tx.execute(
            sql`insert into audit_event (tenant_id, event) values (${T1}, 'clinic.created')`,
          );
        },
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("names the created clinic as the audit row's target without being told", async () => {
    const tenantId = fixtureId('side context new clinic');
    await testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'clinic.created' }, (tx) =>
      createClinic(tx, { tenantId, name: 'عيادة جديدة', type: 'solo' }),
    );
    const { rows } = await superuserDb(workerDatabaseName()).execute<{ t: string | null }>(
      sql`select target_id::text as t from audit_event
           where event = 'clinic.created' and target_id = ${tenantId}`,
    );
    expect(rows).toEqual([{ t: tenantId }]);
  });
});

describe('setup link use rules', () => {
  it.each([
    ['an expired link', sql`update setup_link set expires_at = now() - interval '1 minute'`],
    ['a replaced link', sql`update setup_link set replaced_at = now()`],
  ])('cannot mark %s used', async (_what, change) => {
    // Set up as the superuser: shifa_app may only mark links replaced since A-01-04.
    await superuserDb(workerDatabaseName()).execute(change);
    const { rowCount } = await testAuthDb().withSetupLink(HASH, (tx) =>
      tx.execute(sql`update setup_link set used_at = now()`),
    );
    expect(rowCount).toBe(0);
  });
});
