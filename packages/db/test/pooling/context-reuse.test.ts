// Spec 0.3-S2 criterion 4: a committed, a rolled-back and a failed withTenant() leave nothing on
// the server connection. The next transaction on the same backend (forced by the pool-of-1
// database) sees no tenant, branch or user setting and no probe rows.
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type ShifaDb } from '../../src/index.ts';
import {
  holdPoolingDatabase,
  POOLING_DATABASE,
  pooledHarnessUrl,
} from '../../test-harness/index.ts';
import {
  BRANCH_A,
  CLEAN_VIEW,
  clearProbe,
  contextOf,
  ensureProbe,
  nextTransactionView,
  recordFinding,
  seedProbe,
  serverPid,
  TENANT_A,
  TENANT_B,
  USER_A,
} from './probe.ts';

const CTX_A = { tenantId: TENANT_A, branchId: BRANCH_A, userId: USER_A };
const observed: Record<string, { inside: number; next: number }> = {};
let release: (() => Promise<void>) | undefined;
let db: ShifaDb | undefined;

const app = (): ShifaDb => {
  if (!db) throw new Error('beforeAll did not open the pooled handle');
  return db;
};

beforeAll(async () => {
  release = await holdPoolingDatabase();
  await ensureProbe(POOLING_DATABASE);
  await clearProbe(POOLING_DATABASE);
  // Several client connections, one server connection: every transaction lands on one backend.
  db = createDb(pooledHarnessUrl('app', POOLING_DATABASE), { max: 3 });
  await seedProbe(app(), TENANT_A, ['a1', 'a2']);
  await seedProbe(app(), TENANT_B, ['b1']);
});

afterAll(async () => {
  try {
    await db?.close();
    await clearProbe(POOLING_DATABASE);
    recordFinding('context-reuse', observed);
  } finally {
    await release?.();
  }
});

/** The next transaction must run on `pid` and see no context and no rows. */
async function expectCleanAfter(pid: number, label: string): Promise<void> {
  expect(pid, 'no server pid was captured inside the transaction').toBeGreaterThan(0);
  const next = await nextTransactionView(POOLING_DATABASE);
  observed[label] = { inside: pid, next: next.pid };
  // A test that never reused the connection would prove nothing.
  expect(next.pid, 'the next transaction did not reuse the server connection').toBe(pid);
  expect({ tenant: next.tenant, branch: next.branch, user: next.user, rows: next.rows }).toEqual(
    CLEAN_VIEW,
  );
}

describe('context on a reused server connection (pool of 1)', () => {
  it('is gone after a committed withTenant()', async () => {
    const pid = await app().withTenant(CTX_A, async (tx) => {
      expect(await contextOf(tx)).toEqual({ tenant: TENANT_A, branch: BRANCH_A, user: USER_A });
      const { rows } = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from pool_probe`,
      );
      expect(rows[0]?.n).toBe(2);
      return serverPid(tx);
    });
    await expectCleanAfter(pid, 'committed');
  });

  it('is gone after a withTenant() that rolls back', async () => {
    let pid = 0;
    await expect(
      app().withTenant(CTX_A, async (tx) => {
        pid = await serverPid(tx);
        throw new Error('roll back on purpose');
      }),
    ).rejects.toThrow('roll back on purpose');
    await expectCleanAfter(pid, 'rolled back');
  });

  it('is gone after a withTenant() whose statement fails', async () => {
    let pid = 0;
    await expect(
      app().withTenant(CTX_A, async (tx) => {
        pid = await serverPid(tx);
        await tx.execute(sql`select 1 / 0`);
      }),
    ).rejects.toThrow(/division by zero/);
    await expectCleanAfter(pid, 'failed statement');
  });
});
