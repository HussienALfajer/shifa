// Spec 0.3-S2 criterion 6: a client that dies mid-transaction (socket destroyed after
// set_config, before COMMIT) leaves no context and no open transaction for the next client on
// the pool-of-1 database; the same holds when idle_in_transaction_session_timeout ends it.
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../../src/index.ts';
import {
  holdPoolingDatabase,
  ownerDb,
  POOLING_DATABASE,
  pooledHarnessUrl,
  type RawSession,
  rawPooledSession,
} from '../../test-harness/index.ts';
import {
  BRANCH_A,
  backendPids,
  CLEAN_VIEW,
  clearProbe,
  ensureProbe,
  nextTransactionView,
  openTransactionPids,
  recordFinding,
  seedProbe,
  TENANT_A,
  USER_A,
  waitFor,
} from './probe.ts';

const findings: Record<string, unknown> = {};
let release: (() => Promise<void>) | undefined;

/** A 1 s idle-in-transaction timeout on the pooling database (new backends only), or none. */
const setIdleTimeout = (on: boolean) =>
  ownerDb(POOLING_DATABASE).execute(
    on
      ? sql`alter database ${sql.identifier(POOLING_DATABASE)} set idle_in_transaction_session_timeout = '1s'`
      : sql`alter database ${sql.identifier(POOLING_DATABASE)} reset idle_in_transaction_session_timeout`,
  );

interface Abandoned {
  raw: RawSession;
  pid: number;
  timeout: string;
}

/** Opens a transaction through PgBouncer with tenant A's context set, and leaves it open. */
async function openWithContext(): Promise<Abandoned> {
  const raw = await rawPooledSession(POOLING_DATABASE);
  await raw.query('BEGIN');
  const rows = await raw.query<{ pid: number; timeout: string }>(
    `select set_config('app.tenant_id', $1, true), set_config('app.branch_id', $2, true),
            set_config('app.user_id', $3, true), pg_backend_pid() as pid,
            current_setting('idle_in_transaction_session_timeout') as timeout`,
    [TENANT_A, BRANCH_A, USER_A],
  );
  return { raw, pid: Number(rows[0]?.pid), timeout: String(rows[0]?.timeout) };
}

/** Kills the client socket mid-transaction and waits until PostgreSQL no longer has `pid`. */
async function killAndWait(open: Abandoned): Promise<void> {
  open.raw.kill();
  await waitFor(async () => !(await backendPids(POOLING_DATABASE)).includes(open.pid));
}

async function expectCleanNextClient(deadPid: number): Promise<number> {
  const next = await nextTransactionView(POOLING_DATABASE);
  expect(next.pid, 'the next client got the dead backend').not.toBe(deadPid);
  expect({ tenant: next.tenant, branch: next.branch, user: next.user, rows: next.rows }).toEqual(
    CLEAN_VIEW,
  );
  expect(await openTransactionPids(POOLING_DATABASE)).toEqual([]);
  return next.pid;
}

beforeAll(async () => {
  release = await holdPoolingDatabase();
  await ensureProbe(POOLING_DATABASE);
  await clearProbe(POOLING_DATABASE);
  const db = createDb(pooledHarnessUrl('app', POOLING_DATABASE), { max: 1 });
  try {
    await seedProbe(db, TENANT_A, ['a1']);
  } finally {
    await db.close();
  }
});

afterAll(async () => {
  try {
    await setIdleTimeout(false);
    // The pooled backend still carries the 1 s timeout: replace it with a fresh one.
    await killAndWait(await openWithContext());
    await clearProbe(POOLING_DATABASE);
    recordFinding('broken-clients', findings);
  } finally {
    await release?.();
  }
});

describe('a client that dies mid-transaction', () => {
  it('leaves no context and no open transaction for the next client', async () => {
    const open = await openWithContext();
    // Precondition: the transaction is really open on the server when the client dies.
    expect(await openTransactionPids(POOLING_DATABASE)).toContain(open.pid);
    await killAndWait(open);
    const nextPid = await expectCleanNextClient(open.pid);
    findings['socketDestroyed'] = { killedPid: open.pid, nextPid };
  });

  it('is cleaned up the same way when idle_in_transaction_session_timeout fires', async () => {
    await setIdleTimeout(true);
    // ALTER DATABASE reaches new backends only: retire the pooled one first.
    await killAndWait(await openWithContext());
    const open = await openWithContext();
    expect(open.timeout, 'the backend predates the timeout setting').toBe('1s');
    // Nobody kills the client this time: the server must end the idle transaction itself.
    await waitFor(async () => !(await backendPids(POOLING_DATABASE)).includes(open.pid), 10_000);
    await expect(open.raw.query('select 1')).rejects.toThrow();
    open.raw.kill();
    const nextPid = await expectCleanNextClient(open.pid);
    findings['idleTimeout'] = { endedPid: open.pid, nextPid, timeout: open.timeout };
  }, 30_000);
});
