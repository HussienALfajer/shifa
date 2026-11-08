// @shifa/db/testing: per-worker database handles for tests. Each Vitest worker gets its own
// clone of the migrated template (`shifa_test_<VITEST_POOL_ID>`), emptied before every file.
import type { SQLWrapper } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';
import { type CreateDbOptions, createDb, type ShifaDb } from '../src/client.ts';
import { type SingleStatementExecute, withoutQueryParams } from '../src/transaction.ts';
import { applyRoles, type HarnessRole, urlFor, withPool } from './context.ts';

export { UnsafeDatabaseError } from './guard.ts';

const closers: (() => Promise<void>)[] = [];
/** Raw Drizzle handle with single-statement `execute` typing, like Tx. */
export type RawDb = Omit<NodePgDatabase, 'execute'> & SingleStatementExecute;

const raw = new Map<string, RawDb>();
let defaultDb: ShifaDb | undefined;
const created = new Set<string>();

const info = () => inject('shifaDb');

/** `shifa_test_<VITEST_POOL_ID>` for this worker. */
export function workerDatabaseName(): string {
  return `shifa_test_${process.env['VITEST_POOL_ID'] ?? '0'}`;
}

/** Creates `shifa_test_<poolId>` from the template unless it exists; returns its name. */
export async function ensureWorkerDatabase(
  poolId = process.env['VITEST_POOL_ID'] ?? '0',
): Promise<string> {
  if (!/^\d+$/.test(poolId)) throw new Error(`pool id must be numeric, got "${poolId}"`);
  const name = `shifa_test_${poolId}`;
  if (created.has(name)) return name;
  await withPool(urlFor(info(), 'superuser', 'postgres'), async (pool) => {
    const { rowCount } = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!rowCount) {
      await pool.query(`CREATE DATABASE ${name} TEMPLATE shifa_template OWNER shifa_owner`);
      // A clone does not inherit the template's database ACL; repeat the baseline's revoke.
      await pool.query(`REVOKE TEMPORARY ON DATABASE ${name} FROM PUBLIC`);
    }
  });
  created.add(name);
  return name;
}

function rawDb(role: HarnessRole, database: string): RawDb {
  const url = urlFor(info(), role, database); // guard runs before any connection
  const key = `${role}@${database}`;
  let db = raw.get(key);
  if (!db) {
    const pool = new Pool({ connectionString: url, max: 2 });
    pool.on('error', () => undefined);
    closers.push(() => pool.end());
    const inner = drizzle({ client: pool });
    // Same error unwrapping as withTenant(), so tests see the driver's message.
    db = new Proxy(inner, {
      get: (target, prop, receiver): unknown =>
        prop === 'execute'
          ? (query: SQLWrapper) => withoutQueryParams(async () => target.execute(query))
          : Reflect.get(target, prop, receiver),
    }) as unknown as RawDb;
    raw.set(key, db);
  }
  return db;
}

/** Schema owner (`shifa_owner`): create test-only tables, inspect catalogs. */
export function ownerDb(database = workerDatabaseName()): RawDb {
  return rawDb('owner', database);
}

/** Raw `shifa_app` connection outside withTenant(), for negative tests only. */
export function rawAppDb(database = workerDatabaseName()): RawDb {
  return rawDb('app', database);
}

/** Container superuser on the maintenance database: cluster-level tests (roles) only. */
export function superuserDb(): RawDb {
  return rawDb('superuser', 'postgres');
}

/** Guarded URL of a harness role on this worker's database, e.g. to test createDb() refusals. */
export function harnessUrl(role: HarnessRole, database = workerDatabaseName()): string {
  return urlFor(info(), role, database);
}

/** The application view: `createDb()` as `shifa_app` on this worker's database. */
export function testDb(options?: CreateDbOptions): ShifaDb {
  if (!options && defaultDb) return defaultDb;
  const db = createDb(urlFor(info(), 'app', workerDatabaseName()), options);
  closers.push(() => db.close());
  if (!options) defaultDb = db;
  return db;
}

/** Truncates every table outside the migration history (`drizzle` schema). */
export async function resetTestDb(): Promise<void> {
  await withPool(urlFor(info(), 'owner', workerDatabaseName()), (pool) =>
    pool.query(`DO $$
      DECLARE targets text;
      BEGIN
        SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') INTO targets
          FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'drizzle');
        IF targets IS NOT NULL THEN
          EXECUTE 'TRUNCATE ' || targets || ' RESTART IDENTITY CASCADE';
        END IF;
      END $$`),
  );
}

/** Re-runs sql/roles.sql against the container (it must be idempotent). */
export async function applyRolesSql(): Promise<void> {
  await applyRoles(info());
}

/** Closes every pool this file opened (setup.ts calls it after each file). */
export async function closeTestConnections(): Promise<void> {
  const pending = closers.splice(0);
  raw.clear();
  defaultDb = undefined;
  await Promise.all(pending.map((close) => close()));
}
