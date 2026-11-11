// Spec 0.3-S2 criterion 9: what works in transaction mode and what must stay forbidden.
// The transaction-scoped advisory lock works across PgBouncer's server connections. Session
// state taken inside withTenant() (a session advisory lock, a WITH HOLD cursor) outlives the
// transaction on the shared pooler's backend, where the next tenant inherits it; the
// `server_reset_query_always = 1` pooler clears both. Temporary tables, even ON COMMIT DROP, stay
// refused to shifa_app (baseline migration: no TEMPORARY privilege; owner, 2026-11-12).
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type ShifaDb, type Tx } from '../../src/index.ts';
import {
  holdPoolingDatabase,
  POOLING_DATABASE,
  type PoolerName,
  pooledHarnessUrl,
  pooledTestDb,
  superuserDb,
} from '../../test-harness/index.ts';
import {
  clearProbe,
  ensureProbe,
  recordFinding,
  seedProbe,
  serverPid,
  TENANT_A,
  TENANT_B,
  USER_A,
  USER_B,
  waitFor,
} from './probe.ts';

const CTX_A = { tenantId: TENANT_A, userId: USER_A };
const CTX_B = { tenantId: TENANT_B, userId: USER_B };
const XACT_KEY = 940_001;
const SESSION_KEY = 940_002;
const findings: Record<string, unknown> = {};
let db: ShifaDb | undefined;

const app = (): ShifaDb => {
  if (!db) throw new Error('beforeAll did not open the pooled handle');
  return db;
};

beforeAll(() => {
  db = pooledTestDb({ max: 4 });
});

afterAll(() => {
  recordFinding('session-features', findings);
});

async function tryXactLock(tx: Tx, key: number): Promise<boolean> {
  const { rows } = await tx.execute<{ got: boolean }>(
    sql`select pg_try_advisory_xact_lock(${key}::bigint) as got`,
  );
  return rows[0]?.got === true;
}

/** Backends holding the advisory lock `key` (single bigint form), from pg_locks. */
async function advisoryHolders(key: number): Promise<number[]> {
  const { rows } = await superuserDb().execute<{ pid: number }>(
    sql`select pid from pg_locks
         where locktype = 'advisory' and granted and classid = 0
           and objid = ${String(key)}::oid and objsubid = 1`,
  );
  return rows.map((row) => row.pid);
}

describe('transaction-scoped features through PgBouncer', () => {
  it('pg_advisory_xact_lock blocks a second transaction and is released at COMMIT', async () => {
    let finish: () => void = () => undefined;
    const holding = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let signalLocked: () => void = () => undefined;
    const locked = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });
    const holder = app().withTenant(CTX_A, async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${XACT_KEY}::bigint)`);
      signalLocked();
      await holding;
      return serverPid(tx);
    });
    let blocked: { got: boolean; pid: number };
    try {
      await locked;
      expect(await advisoryHolders(XACT_KEY)).toHaveLength(1);
      blocked = await app().withTenant(CTX_B, async (tx) => ({
        got: await tryXactLock(tx, XACT_KEY),
        pid: await serverPid(tx),
      }));
    } finally {
      // Never leave the holder's transaction open, even when the check above fails.
      finish();
    }
    const holderPid = await holder;
    expect(blocked.pid, 'the second transaction ran on the other server connection').not.toBe(
      holderPid,
    );
    expect(blocked.got, 'the lock was free while its holder was open').toBe(false);
    // Checked in pg_locks: a try-lock on the holder's own backend would succeed even if the
    // lock had leaked (advisory locks are re-entrant within a session).
    expect(await advisoryHolders(XACT_KEY), 'the lock outlived COMMIT').toEqual([]);
  });

  it('refuses temporary tables to shifa_app, even ON COMMIT DROP', async () => {
    await expect(
      app().withTenant(CTX_A, (tx) =>
        tx.execute(sql`create temp table pool_scratch (x int) on commit drop`),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('session state taken inside withTenant() on the pool of 1', () => {
  let release: (() => Promise<void>) | undefined;
  const pooled: Partial<Record<PoolerName, ShifaDb>> = {};
  const on = (pooler: PoolerName): ShifaDb => {
    const handle = pooled[pooler];
    if (!handle) throw new Error('beforeAll did not open the pooled handles');
    return handle;
  };

  // In a hook (60 s timeout): the lock may wait for the other files on this database.
  beforeAll(async () => {
    release = await holdPoolingDatabase();
    await ensureProbe(POOLING_DATABASE);
    await clearProbe(POOLING_DATABASE);
    // Pool of 1 on each pooler: every transaction below reaches the same backend.
    for (const pooler of ['shared', 'reset'] as const) {
      pooled[pooler] = createDb(pooledHarnessUrl('app', POOLING_DATABASE, pooler), { max: 1 });
    }
    await seedProbe(on('shared'), TENANT_A, ['a1']);
    await seedProbe(on('shared'), TENANT_B, ['b1']);
  });

  afterAll(async () => {
    try {
      // The lock and the cursor live on the shared pooler's backend until removed there.
      await on('shared').withTenant(CTX_A, (tx) =>
        tx.execute(sql`select pg_advisory_unlock_all()`),
      );
      await on('shared').withTenant(CTX_A, (tx) => tx.execute(sql`close all`));
      await Promise.all(Object.values(pooled).map((handle) => handle.close()));
      await clearProbe(POOLING_DATABASE);
    } finally {
      await release?.();
    }
  });

  it('a session advisory lock outlives COMMIT on the shared pooler', async () => {
    const pid = await on('shared').withTenant(CTX_A, async (tx) => {
      await tx.execute(sql`select pg_advisory_lock(${SESSION_KEY}::bigint)`);
      return serverPid(tx);
    });
    // COMMIT is done; the next client of this server connection inherits the lock.
    expect(await advisoryHolders(SESSION_KEY)).toEqual([pid]);
    findings['sessionLockSurvivedOnPid'] = pid;
  });

  it('a WITH HOLD cursor opened for tenant A is readable inside tenant B (shared pooler)', async () => {
    const pid = await on('shared').withTenant(CTX_A, async (tx) => {
      await tx.execute(
        sql`declare pool_hold cursor with hold for select tenant_id from pool_probe`,
      );
      return serverPid(tx);
    });
    const inB = await on('shared').withTenant(CTX_B, async (tx) => {
      const { rows } = await tx.execute<{ tenant_id: string }>(sql`fetch all from pool_hold`);
      return { pid: await serverPid(tx), tenants: rows.map((row) => row.tenant_id) };
    });
    expect(inB.pid).toBe(pid);
    // The rows were materialised at A's COMMIT: RLS is not checked again for B.
    expect(inB.tenants).toEqual([TENANT_A]);
    findings['withHoldCursorLeakedToOtherTenantOnPid'] = pid;
  });

  it('server_reset_query_always = 1 clears both before the next client', async () => {
    const pid = await on('reset').withTenant(CTX_A, async (tx) => {
      await tx.execute(sql`select pg_advisory_lock(${SESSION_KEY + 1}::bigint)`);
      await tx.execute(sql`declare pool_hold_reset cursor with hold for select 1`);
      return serverPid(tx);
    });
    // DISCARD ALL runs after the server connection is released.
    await waitFor(async () => (await advisoryHolders(SESSION_KEY + 1)).length === 0);
    let nextPid = 0;
    await expect(
      on('reset').withTenant(CTX_B, async (tx) => {
        nextPid = await serverPid(tx);
        await tx.execute(sql`fetch all from pool_hold_reset`);
      }),
    ).rejects.toThrow(/does not exist/);
    expect(nextPid, 'the next transaction did not reuse the server connection').toBe(pid);
    findings['resetAlwaysClearedLockAndCursorOnPid'] = pid;
  });
});
