// Shared helpers for the pooling leak tests (0.3-S2b, spec 0.3-S2 criteria 4–9).
// `pool_probe` is a test-only tenant table (FORCE RLS on current_tenant_id(), index led by
// tenant_id), created by the owner with `create table if not exists`: never in migrations.
// Failure output names tenant ids and row counts only.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import type { ShifaDb, Tx } from '../../src/index.ts';
import {
  ownerDb,
  type PoolerName,
  rawPooledSession,
  superuserDb,
} from '../../test-harness/index.ts';

export const TENANT_A = 'a0a0a0a0-0000-4000-8000-0000000000a1';
export const TENANT_B = 'b0b0b0b0-0000-4000-8000-0000000000b2';
export const BRANCH_A = 'a1a1a1a1-0000-4000-8000-0000000000a3';
export const USER_A = 'a2a2a2a2-0000-4000-8000-0000000000a4';
export const USER_B = 'b2b2b2b2-0000-4000-8000-0000000000b5';

/** What a transaction must see when nobody set a context: no settings, no probe rows. */
export const CLEAN_VIEW = { tenant: '', branch: '', user: '', rows: 0 } as const;

export const poolProbe = pgTable('pool_probe', {
  tenantId: uuid('tenant_id').notNull(),
  label: text('label').notNull(),
});

/** Creates `pool_probe` (owner, idempotent) in `database`. */
export async function ensureProbe(database: string): Promise<void> {
  await ownerDb(database).execute(sql`
    create table if not exists pool_probe (tenant_id uuid not null, label text not null);
    create index if not exists pool_probe_tenant_label on pool_probe (tenant_id, label);
    alter table pool_probe enable row level security;
    alter table pool_probe force row level security;
    drop policy if exists tenant_isolation on pool_probe;
    create policy tenant_isolation on pool_probe
      using (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id());
  `);
}

/** Empties `pool_probe` (owner); POOLING_DATABASE is never truncated by the harness. */
export async function clearProbe(database: string): Promise<void> {
  await ownerDb(database).execute(sql`truncate pool_probe`);
}

/** Inserts one row per label for `tenantId`, through withTenant() like the application. */
export async function seedProbe(db: ShifaDb, tenantId: string, labels: string[]): Promise<void> {
  if (labels.length === 0) return;
  await db.withTenant({ tenantId, userId: USER_A }, (tx) =>
    tx.insert(poolProbe).values(labels.map((label) => ({ tenantId, label }))),
  );
}

/** The PostgreSQL backend this transaction runs on. */
export async function serverPid(tx: Tx): Promise<number> {
  const { rows } = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
  return Number(rows[0]?.pid);
}

const CONTEXT_COLUMNS = `coalesce(current_setting('app.tenant_id', true), '') as tenant,
  coalesce(current_setting('app.branch_id', true), '') as branch,
  coalesce(current_setting('app.user_id', true), '') as "user"`;

export interface Context {
  tenant: string;
  branch: string;
  user: string;
}

/** The three context settings as this transaction sees them ('' when unset). */
export async function contextOf(tx: Tx): Promise<Context> {
  const { rows } = await tx.execute<Context>(sql.raw(`select ${CONTEXT_COLUMNS}`));
  const row = rows[0];
  if (!row) throw new Error('no context row');
  return { tenant: row.tenant, branch: row.branch, user: row.user };
}

/** `app.admin_reason` as this transaction sees it ('' when unset). */
export async function adminReasonOf(tx: Tx): Promise<string> {
  const { rows } = await tx.execute<{ reason: string }>(
    sql`select coalesce(current_setting('app.admin_reason', true), '') as reason`,
  );
  return rows[0]?.reason ?? '';
}

/** Tenant ids of the probe rows this transaction can see, ordered by label. */
export async function probeTenants(tx: Tx): Promise<string[]> {
  const { rows } = await tx.execute<{ tenant_id: string }>(
    sql`select tenant_id from pool_probe order by label`,
  );
  return rows.map((row) => row.tenant_id);
}

export interface View extends Context {
  pid: number;
  rows: number;
}

/**
 * The next transaction a client without the wrapper gets: one statement on a fresh raw session
 * through PgBouncer, so it runs on whichever server connection the pool hands out.
 */
export async function nextTransactionView(
  database: string,
  pooler: PoolerName = 'shared',
): Promise<View> {
  const session = await rawPooledSession(database, { pooler });
  try {
    const rows = await session.query<View>(
      `select pg_backend_pid() as pid, ${CONTEXT_COLUMNS},
              (select count(*)::int from pool_probe) as rows`,
    );
    const row = rows[0];
    if (!row) throw new Error('no view row');
    // pg_backend_pid() and count()::int are int4: pg returns them as numbers.
    return row;
  } finally {
    await session.end();
  }
}

async function shifaAppBackends(database: string, onlyInTransaction: boolean): Promise<number[]> {
  const { rows } = await superuserDb().execute<{ pid: number }>(
    sql`select pid from pg_stat_activity
         where datname = ${database} and usename = 'shifa_app'
           and (not ${onlyInTransaction} or state like 'idle in transaction%')
         order by pid`,
  );
  return rows.map((row) => row.pid);
}

/** Every shifa_app backend on `database`. */
export const backendPids = (database: string) => shifaAppBackends(database, false);

/** shifa_app backends on `database` that sit inside an open transaction. */
export const openTransactionPids = (database: string) => shifaAppBackends(database, true);

/** Polls `check` until it holds; fails after `timeoutMs`. */
export async function waitFor(check: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`condition not met within ${String(timeoutMs)} ms`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

const FINDINGS_DIR = join(import.meta.dirname, '..', '..', '..', '..', '.verify', 's2-pooling');

/** Writes what a test observed (pids, counts, timings) for the 0.3-S2c report. */
export function recordFinding(name: string, data: unknown): void {
  mkdirSync(FINDINGS_DIR, { recursive: true });
  writeFileSync(join(FINDINGS_DIR, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
}
