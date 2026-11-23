// A setup link is one-time in the database too (A-01a criterion 4, A-01-01 review): shifa_auth
// may mark an unused link used, never clear or re-stamp `used_at`, and no other link moves.
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createTestTenants,
  fixtureId,
  insertMembership,
  insertSetupLink,
  superuserDb,
  syntheticPhones,
  testAuthDb,
  testDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const TENANT = fixtureId('link-use tenant');
const USER = fixtureId('link-use user');
const HASH = 'f6'.repeat(32);
const OTHER = '07'.repeat(32);
const [PHONE_A = '', PHONE_B = ''] = syntheticPhones(7401, 2);

async function usedAt(): Promise<Record<string, string | null>> {
  const { rows } = await superuserDb(workerDatabaseName()).execute<{
    h: string;
    u: string | null;
  }>(sql`select token_hash as h, used_at::text as u from setup_link order by 1`);
  return Object.fromEntries(rows.map((r) => [r.h, r.u]));
}

beforeEach(async () => {
  await createTestTenants(TENANT);
  await testDb().withTenant({ tenantId: TENANT, userId: USER }, async (tx) => {
    for (const [label, hash, phone] of [
      ['a', HASH, PHONE_A],
      ['b', OTHER, PHONE_B],
    ] as const) {
      const id = fixtureId(`link-use member ${label}`);
      await insertMembership(tx, { id, tenantId: TENANT, phone });
      await insertSetupLink(tx, {
        id: fixtureId(`link-use link ${label}`),
        tenantId: TENANT,
        membershipId: id,
        tokenHashHex: hash,
      });
    }
  });
});

describe('setup link use on the auth path', () => {
  it('marks an unused link used, and only that link', async () => {
    const { rowCount } = await testAuthDb().withSetupLink(HASH, (tx) =>
      tx.execute(sql`update setup_link set used_at = now()`),
    );
    expect(rowCount).toBe(1);
    const after = await usedAt();
    expect(after[HASH]).not.toBeNull();
    expect(after[OTHER]).toBeNull();
  });

  it('cannot make a used link usable again', async () => {
    const auth = testAuthDb();
    await auth.withSetupLink(HASH, (tx) => tx.execute(sql`update setup_link set used_at = now()`));
    const cleared = await auth.withSetupLink(HASH, (tx) =>
      tx.execute(sql`update setup_link set used_at = null`),
    );
    expect(cleared.rowCount).toBe(0);
    expect((await usedAt())[HASH]).not.toBeNull();
  });

  it('cannot re-stamp a used link', async () => {
    const auth = testAuthDb();
    await auth.withSetupLink(HASH, (tx) =>
      tx.execute(sql`update setup_link set used_at = '2026-01-01T00:00:00Z'`),
    );
    const before = (await usedAt())[HASH];
    const again = await auth.withSetupLink(HASH, (tx) =>
      tx.execute(sql`update setup_link set used_at = now()`),
    );
    expect(again.rowCount).toBe(0);
    expect((await usedAt())[HASH]).toBe(before);
  });

  it('refuses to mark an unused link as unused (WITH CHECK)', async () => {
    await expect(
      testAuthDb().withSetupLink(HASH, (tx) =>
        tx.execute(sql`update setup_link set used_at = null`),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
