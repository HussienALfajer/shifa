// Spec 0.3-S2 criterion 9: what works in transaction mode and what must stay forbidden.
// The transaction-scoped advisory lock works across PgBouncer's server connections; a session
// advisory lock outlives the transaction on the pooled backend (why the session form is
// forbidden); temporary tables, even ON COMMIT DROP, stay refused to shifa_app (baseline
// migration: no TEMPORARY privilege, since temp tables have no RLS).
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDb, type ShifaDb, type Tx } from '../../src/index.ts';
import {
  holdPoolingDatabase,
  POOLING_DATABASE,
  pooledHarnessUrl,
  pooledTestDb,
  superuserDb,
} from '../../test-harness/index.ts';
import { recordFinding, serverPid, TENANT_A, TENANT_B, USER_A, USER_B } from './probe.ts';

const CTX_A = { tenantId: TENANT_A, userId: USER_A };
const CTX_B = { tenantId: TENANT_B, userId: USER_B };
const XACT_KEY = 940_001;
const SESSION_KEY = 940_002;
let db: ShifaDb | undefined;

const app = (): ShifaDb => {
  if (!db) throw new Error('beforeAll did not open the pooled handle');
  return db;
};

beforeAll(() => {
  db = pooledTestDb({ max: 4 });
});

async function tryXactLock(tx: Tx, key: number): Promise<boolean> {
  const { rows } = await tx.execute<{ got: boolean }>(
    sql`select pg_try_advisory_xact_lock(${key}::bigint) as got`,
  );
  return rows[0]?.got === true;
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
    await locked;
    const blocked = await app().withTenant(CTX_B, async (tx) => ({
      got: await tryXactLock(tx, XACT_KEY),
      pid: await serverPid(tx),
    }));
    finish();
    const holderPid = await holder;
    expect(blocked.pid, 'the second transaction ran on the other server connection').not.toBe(
      holderPid,
    );
    expect(blocked.got, 'the lock was free while its holder was open').toBe(false);
    expect(await app().withTenant(CTX_B, (tx) => tryXactLock(tx, XACT_KEY))).toBe(true);
  });

  it('refuses temporary tables to shifa_app, even ON COMMIT DROP', async () => {
    await expect(
      app().withTenant(CTX_A, (tx) =>
        tx.execute(sql`create temp table pool_scratch (x int) on commit drop`),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('session-scoped features through PgBouncer', () => {
  it('a session advisory lock outlives its transaction on the pooled backend', async () => {
    const release = await holdPoolingDatabase();
    // Pool of 1: the unlock below reaches the backend that holds the lock.
    const pooled = createDb(pooledHarnessUrl('app', POOLING_DATABASE), { max: 1 });
    try {
      const pid = await pooled.withTenant(CTX_A, async (tx) => {
        await tx.execute(sql`select pg_advisory_lock(${SESSION_KEY}::bigint)`);
        return serverPid(tx);
      });
      // COMMIT is done; the next client of this server connection inherits the lock.
      const { rows } = await superuserDb().execute<{ pid: number }>(
        sql`select pid from pg_locks
             where locktype = 'advisory' and granted and classid = 0
               and objid = ${String(SESSION_KEY)}::oid and objsubid = 1`,
      );
      expect(rows.map((row) => row.pid)).toEqual([pid]);
      recordFinding('session-features', { sessionAdvisoryLockSurvivedOnPid: pid });
    } finally {
      await pooled
        .withTenant(CTX_A, (tx) => tx.execute(sql`select pg_advisory_unlock_all()`))
        .finally(() => pooled.close());
      await release();
    }
  });
});
