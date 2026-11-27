import { sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { contextSetup } from './context.ts';
import { type CreateDbOptions, openPool } from './pool.ts';
import { runWithTenant, type TenantContext } from './tenant.ts';
import { runScoped, type Tx } from './transaction.ts';

export type { CreateDbOptions } from './pool.ts';

export interface ShifaDb {
  /** Tenant-scoped work: one transaction with `app.tenant_id` etc. set (ADR-0005). */
  withTenant<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T>;
  /**
   * Health probe: checks the role and runs `select 1` with every context setting cleared (no
   * tenant, no platform path). Throws when the database is unreachable or the role is unsafe.
   */
  ping(): Promise<void>;
  /** Ends the pool at shutdown; later calls return the same promise. */
  close(): Promise<void>;
}

// The pool behind each ShifaDb, for the test harness's no-tenant path only (not exported from
// the package entry point).
const pools = new WeakMap<ShifaDb, Pool>();

/** Runs `fn` as shifa_app with every `app.*` setting cleared. */
function runWithoutContext<T>(pool: Pool, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return runScoped(pool, 'shifa_app', contextSetup({}), fn);
}

/**
 * Opens a pool as the application role shifa_app (each new connection is checked: exactly that
 * role, not superuser, no BYPASSRLS, owns no table, member of no role). The pool stays private:
 * every query goes through withTenant(), and each `tx` handle stops working when its callback
 * ends. Identity and platform work have their own roles and pools (createAuthDb(),
 * createPlatformDb(); ADR-0043).
 */
export function createDb(url: string, options: CreateDbOptions = {}): ShifaDb {
  const { pool, close } = openPool(url, options);
  const db: ShifaDb = {
    withTenant: (ctx, fn) => runWithTenant(pool, ctx, fn),
    ping: async () => {
      await runWithoutContext(pool, (tx) => tx.execute(sql`select 1`));
    },
    close,
  };
  pools.set(db, pool);
  return db;
}

/**
 * Package-internal (test harness): `handle` wraps `db` and uses its pool (the shared test
 * handles of testDb()), so the helpers below find it.
 */
export function sharePool(handle: ShifaDb, db: ShifaDb): void {
  const pool = pools.get(db);
  if (pool) pools.set(handle, pool);
}

/**
 * Package-internal: `fn` on this db's pool with no context set (global tables only show rows;
 * FORCE RLS hides every tenant row). Not exported from the package entry point.
 */
export function withoutContext<T>(db: ShifaDb, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const pool = pools.get(db);
  if (!pool) return Promise.reject(new Error('not a ShifaDb created by createDb()'));
  return runWithoutContext(pool, fn);
}

/**
 * Tests only (`@shifa/db/testing` re-exports it): runs `fn` on this db's pool with no tenant
 * context, to prove that FORCE RLS then shows no tenant rows.
 */
export function runWithoutTenantForTests<T>(db: ShifaDb, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withoutContext(db, fn);
}
