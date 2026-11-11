// Spec 0.3-S2 criterion 5: a raw shifa_app client sets tenant A at session level through
// PgBouncer and disconnects. On that server connection withTenant(B) still sees only B and
// withPlatformAdmin no tenant rows, because the wrapper overrides all three settings locally in
// every transaction. A second PgBouncer with `server_reset_query_always = 1` shows the setting
// that would also clear the session value, and what it costs per transaction.
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type ShifaDb, type Tx } from '../../src/index.ts';
import {
  holdPoolingDatabase,
  POOLING_DATABASE,
  type PoolerName,
  pooledHarnessUrl,
  rawPooledSession,
  showPooler,
  workerDatabaseName,
} from '../../test-harness/index.ts';
import {
  BRANCH_A,
  CLEAN_VIEW,
  clearProbe,
  contextOf,
  ensureProbe,
  nextTransactionView,
  probeTenants,
  recordFinding,
  seedProbe,
  serverPid,
  TENANT_A,
  TENANT_B,
  USER_A,
  USER_B,
} from './probe.ts';

const findings: Record<string, unknown> = {};
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
  db = createDb(pooledHarnessUrl('app', POOLING_DATABASE), { max: 2 });
  await seedProbe(app(), TENANT_A, ['a1']);
  await seedProbe(app(), TENANT_B, ['b1', 'b2']);
});

afterAll(async () => {
  try {
    // Leave no session value behind for the next file on this server connection.
    const raw = await rawPooledSession(POOLING_DATABASE);
    await raw.query('RESET ALL');
    await raw.end();
    await db?.close();
    await clearProbe(POOLING_DATABASE);
    recordFinding('session-leftovers', findings);
  } finally {
    await release?.();
  }
});

/** A raw client sets tenant A, branch A and user A for its whole session, then disconnects. */
async function leaveSessionContext(pooler: PoolerName): Promise<number> {
  const raw = await rawPooledSession(POOLING_DATABASE, { pooler });
  try {
    // A constant test UUID, not input: SET takes no parameters.
    await raw.query(`SET app.tenant_id TO '${TENANT_A}'`);
    const rows = await raw.query<{ pid: number }>(
      `select set_config('app.branch_id', $1, false), set_config('app.user_id', $2, false),
              pg_backend_pid() as pid`,
      [BRANCH_A, USER_A],
    );
    return Number(rows[0]?.pid);
  } finally {
    await raw.end();
  }
}

async function look(tx: Tx) {
  return { pid: await serverPid(tx), ctx: await contextOf(tx), tenants: await probeTenants(tx) };
}

describe('shared PgBouncer (server_reset_query_always = 0)', () => {
  it('withTenant(B) and withPlatformAdmin override a raw session-level tenant A', async () => {
    const pid = await leaveSessionContext('shared');
    // Precondition: the session value really survives the client (no reset in transaction mode).
    const leftover = await nextTransactionView(POOLING_DATABASE);
    expect(leftover.pid).toBe(pid);
    expect({ tenant: leftover.tenant, rows: leftover.rows }).toEqual({ tenant: TENANT_A, rows: 1 });

    const inB = await app().withTenant({ tenantId: TENANT_B, userId: USER_B }, look);
    expect(inB.pid).toBe(pid);
    // No branch given: the wrapper must still blank the session's branch A.
    expect(inB.ctx).toEqual({ tenant: TENANT_B, branch: '', user: USER_B });
    expect(inB.tenants).toEqual([TENANT_B, TENANT_B]);

    const admin = await app().withPlatformAdmin('pooling leak test', look);
    expect(admin.pid).toBe(pid);
    expect(admin.ctx).toEqual({ tenant: '', branch: '', user: '' });
    expect(admin.tenants).toEqual([]);

    // The override is transaction-local: a client without the wrapper still sees tenant A.
    // This is why a session-level SET is forbidden outside the wrapper.
    const after = await nextTransactionView(POOLING_DATABASE);
    expect({ pid: after.pid, tenant: after.tenant }).toEqual({ pid, tenant: TENANT_A });
    findings['shared'] = { pid, leftoverVisibleWithoutWrapper: true };
  });
});

describe('PgBouncer with server_reset_query_always = 1', () => {
  it('runs with the reset after every transaction', async () => {
    const config = new Map(
      (await showPooler('CONFIG', 'reset')).map((row) => [
        String(row['key']),
        String(row['value']),
      ]),
    );
    expect(config.get('server_reset_query_always')).toBe('1');
    expect(config.get('server_reset_query')).toBe('DISCARD ALL');
    expect(config.get('pool_mode')).toBe('transaction');
  });

  it('clears a raw session-level tenant before the next client', async () => {
    const pid = await leaveSessionContext('reset');
    const next = await nextTransactionView(POOLING_DATABASE, 'reset');
    expect(next.pid, 'the next transaction did not reuse the server connection').toBe(pid);
    expect({ tenant: next.tenant, branch: next.branch, user: next.user, rows: next.rows }).toEqual(
      CLEAN_VIEW,
    );
    findings['resetAlways'] = { pid };
  });

  it('records the per-transaction cost of the reset (report only)', async () => {
    const shared = createDb(pooledHarnessUrl('app', workerDatabaseName()), { max: 1 });
    const reset = createDb(pooledHarnessUrl('app', workerDatabaseName(), 'reset'), { max: 1 });
    const ctx = { tenantId: TENANT_A, userId: USER_A };
    const timed = async (handle: ShifaDb): Promise<number> => {
      const start = process.hrtime.bigint();
      await handle.withTenant(ctx, (tx) => tx.execute(sql`select 1`));
      return Number(process.hrtime.bigint() - start) / 1e6;
    };
    try {
      const samples = { shared: [] as number[], reset: [] as number[] };
      for (let i = 0; i < 220; i += 1) {
        // Interleaved so both see the same machine noise; the first 20 warm up.
        const a = await timed(shared);
        const b = await timed(reset);
        if (i >= 20) {
          samples.shared.push(a);
          samples.reset.push(b);
        }
      }
      const p50 = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)] ?? NaN;
      const cost = {
        transactions: samples.shared.length,
        p50SharedMs: p50(samples.shared),
        p50ResetAlwaysMs: p50(samples.reset),
        p50OverheadMs: p50(samples.reset) - p50(samples.shared),
      };
      expect(Number.isFinite(cost.p50SharedMs) && Number.isFinite(cost.p50ResetAlwaysMs)).toBe(
        true,
      );
      findings['resetCost'] = cost;
    } finally {
      await shared.close();
      await reset.close();
    }
  }, 60_000);
});
