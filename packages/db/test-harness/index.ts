// @shifa/db/testing: per-worker database handles for tests. Each Vitest worker gets its own
// clone of the migrated template (`shifa_test_<VITEST_POOL_ID>`), emptied before every file.
import type { SQLWrapper } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inject } from 'vitest';
import { type AuthDb, createAuthDb } from '../src/auth.ts';
import {
  type CreateDbOptions,
  createDb,
  runWithoutTenantForTests,
  type ShifaDb,
  sharePool,
} from '../src/client.ts';
import { createPlatformDb, type PlatformDb } from '../src/platform.ts';
import { TABLE_CLASSIFICATION } from '../src/schema/classification.ts';
import { type SingleStatementExecute, type Tx, withoutQueryParams } from '../src/transaction.ts';
import {
  applyRoles,
  cloneTemplate,
  type HarnessRole,
  poolerStatsUrl,
  urlFor,
  type Via,
  withPool,
} from './context.ts';
import { fixtureId, insertTenantRow } from './fixtures.ts';
import { POOLING_DATABASE } from './pgbouncer.ts';
import { openRawSession, type RawSession } from './sessions.ts';

export * from './fixtures.ts';
export { UnsafeDatabaseError } from './guard.ts';
export { freshMigratedDatabase, migrateDatabase } from './migrations.ts';
export { POOLING_DATABASE } from './pgbouncer.ts';
export type { RawSession } from './sessions.ts';

/** Which PgBouncer: the shared one, or the `server_reset_query_always = 1` variant (0.3-S2b). */
export type PoolerName = 'shared' | 'reset';
const VIA = { shared: 'pooler', reset: 'reset-pooler' } as const satisfies Record<PoolerName, Via>;

const closers: (() => Promise<void>)[] = [];
/** Raw Drizzle handle with single-statement `execute` typing, like Tx. */
export type RawDb = Omit<NodePgDatabase, 'execute'> & SingleStatementExecute;

const raw = new Map<string, RawDb>();
const shared = new Map<Via, ShifaDb>();
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
    // Several files may share a fixed clone (e.g. the pristine one for catalog checks) and
    // run in different workers: serialize check-and-create per database name. The pool has
    // one connection, so lock and unlock run in the same session.
    await pool.query('SELECT pg_advisory_lock(hashtext($1))', [name]);
    try {
      const { rowCount } = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
      if (!rowCount) {
        await cloneTemplate(pool, name);
      }
    } finally {
      await pool.query('SELECT pg_advisory_unlock(hashtext($1))', [name]);
    }
  });
  created.add(name);
  return name;
}

function rawDb(role: HarnessRole, database: string, via: Via = 'direct'): RawDb {
  const url = urlFor(info(), role, database, { via }); // guard runs before any connection
  const key = `${role}@${database}/${via}`;
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

/** Raw `shifa_app` connection through PgBouncer, outside withTenant(): negative tests only. */
export function rawPooledAppDb(database = workerDatabaseName()): RawDb {
  return rawDb('app', database, 'pooler');
}

/**
 * Container superuser, on the maintenance database by default: cluster-level tests (roles)
 * only, or reading rows no application role may read (e.g. platform audit rows) in a test.
 */
export function superuserDb(database = 'postgres'): RawDb {
  return rawDb('superuser', database);
}

/** Guarded URL of a harness role on this worker's database, e.g. to test createDb() refusals. */
export function harnessUrl(role: HarnessRole, database = workerDatabaseName()): string {
  return urlFor(info(), role, database);
}

/** Like harnessUrl(), but through PgBouncer (the shared one unless `pooler` says otherwise). */
export function pooledHarnessUrl(
  role: HarnessRole,
  database = workerDatabaseName(),
  pooler: PoolerName = 'shared',
): string {
  return urlFor(info(), role, database, { via: VIA[pooler] });
}

/**
 * One raw session through PgBouncer (as `shifa_app` unless `role` says otherwise) that a test
 * can leave mid-transaction or kill (0.3-S2b). Negative tests only. Closed after the file if the
 * test does not close it.
 */
export async function rawPooledSession(
  database = workerDatabaseName(),
  {
    pooler = 'shared',
    role = 'app',
  }: { pooler?: PoolerName; role?: 'app' | 'auth' | 'platform' } = {},
): Promise<RawSession> {
  const session = await openRawSession(urlFor(info(), role, database, { via: VIA[pooler] }));
  closers.push(() => session.end().catch(() => undefined));
  return session;
}

/**
 * Serialises the files that rely on POOLING_DATABASE's single server connection, across
 * workers: a session advisory lock on a direct superuser connection (never through PgBouncer),
 * held until the returned release. Then clears any session-level setting an earlier, crashed
 * file left on the shared pooler's server connection.
 */
export async function holdPoolingDatabase(): Promise<() => Promise<void>> {
  const lock = await openRawSession(urlFor(info(), 'superuser', 'postgres'));
  try {
    await lock.query('SELECT pg_advisory_lock(hashtext($1))', ['shifa.pooling-database']);
    const pooled = await openRawSession(urlFor(info(), 'app', POOLING_DATABASE, { via: 'pooler' }));
    try {
      await pooled.query('RESET ALL');
    } finally {
      await pooled.end();
    }
  } catch (err) {
    await lock.end();
    throw err;
  }
  // Ending the session releases the lock; also done after the file if the test forgets.
  closers.push(() => lock.end());
  return () => lock.end();
}

function appDb(via: Via, options?: CreateDbOptions): ShifaDb {
  const existing = shared.get(via);
  if (!options && existing) return existing;
  const db = createDb(urlFor(info(), 'app', workerDatabaseName(), { via }), options);
  closers.push(() => db.close());
  if (options) return db;
  const handle: ShifaDb = {
    withTenant: (ctx, fn) => db.withTenant(ctx, fn),
    ping: () => db.ping(),
    close: () => {
      if (shared.get(via) === handle) shared.delete(via);
      return db.close();
    },
  };
  inner.set(handle, db);
  sharePool(handle, db);
  shared.set(via, handle);
  return handle;
}

/** Shared handles of testDb() and pooledTestDb() → the ShifaDb behind them. */
const inner = new WeakMap<ShifaDb, ShifaDb>();

/**
 * Runs `fn` as shifa_app on `db`'s pool with every `app.*` setting cleared: the way to prove
 * that without a tenant context FORCE RLS shows no tenant rows (the application itself has no
 * such path since A-01-01; platform work runs as shifa_platform).
 */
export function withoutTenant<T>(db: ShifaDb, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return runWithoutTenantForTests(inner.get(db) ?? db, fn);
}

let authHandle: AuthDb | undefined;
let platformHandle: PlatformDb | undefined;

/**
 * `createAuthDb()` as shifa_auth on this worker's database, shared within a file until someone
 * closes it (an app under test owns and closes its handle at shutdown, A-01-02); the next call
 * then opens a new one, as testDb() does.
 */
export function testAuthDb(): AuthDb {
  if (!authHandle) {
    const db = createAuthDb(urlFor(info(), 'auth', workerDatabaseName()));
    closers.push(() => db.close());
    const handle: AuthDb = {
      withAuth: (fn) => db.withAuth(fn),
      withUser: (userId, fn) => db.withUser(userId, fn),
      withSetupLink: (hash, fn) => db.withSetupLink(hash, fn),
      withUserLink: (userId, hash, fn) => db.withUserLink(userId, hash, fn),
      withHandoff: (hash, fn, userId) => db.withHandoff(hash, fn, userId),
      close: () => {
        if (authHandle === handle) authHandle = undefined;
        return db.close();
      },
    };
    authHandle = handle;
  }
  return authHandle;
}

/**
 * `createPlatformDb()` as shifa_platform on this worker's database, shared within a file until
 * someone closes it (an app under test owns and closes its handle at shutdown, A-01-03); the
 * next call then opens a new one.
 */
export function testPlatformDb(): PlatformDb {
  if (!platformHandle) {
    const db = createPlatformDb(urlFor(info(), 'platform', workerDatabaseName()));
    closers.push(() => db.close());
    const handle: PlatformDb = {
      withPlatformAdmin: (action, fn) => db.withPlatformAdmin(action, fn),
      close: () => {
        if (platformHandle === handle) platformHandle = undefined;
        return db.close();
      },
    };
    platformHandle = handle;
  }
  return platformHandle;
}

/**
 * The application view: `createDb()` as `shifa_app` on this worker's database. Without options
 * the handle is shared within a file until someone closes it (an app under test owns and
 * closes its handle at shutdown); the next call then opens a new one.
 */
export function testDb(options?: CreateDbOptions): ShifaDb {
  return appDb('direct', options);
}

/** The same application view as testDb(), connected through PgBouncer in transaction mode. */
export function pooledTestDb(options?: CreateDbOptions): ShifaDb {
  return appDb('pooler', options);
}

/**
 * Sends `text` to PgBouncer's console as the stats user and returns the error message, if any.
 * Negative tests only (proving the shared console refuses changes).
 */
export async function rawPoolerConsole(text: string): Promise<string | undefined> {
  return withPool(poolerStatsUrl(info()), async (pool) => {
    try {
      await pool.query(text);
      return undefined;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  });
}

const SHOW_COMMANDS = new Set(['CONFIG', 'DATABASES', 'POOLS', 'SERVERS', 'CLIENTS'] as const);
type ShowCommand = typeof SHOW_COMMANDS extends Set<infer T> ? T : never;

/**
 * Rows of a PgBouncer console `SHOW` command, as the read-only `stats_users` login: the shared
 * PgBouncer cannot be reconfigured from a test (a `SET` would change it for every worker).
 */
export async function showPooler(
  what: ShowCommand,
  pooler: PoolerName = 'shared',
): Promise<Record<string, unknown>[]> {
  // The admin console speaks the simple query protocol only: no parameters.
  if (!SHOW_COMMANDS.has(what)) throw new Error('showPooler() runs SHOW commands only');
  const { rows } = await withPool(poolerStatsUrl(info(), VIA[pooler]), (pool) =>
    pool.query<Record<string, unknown>>(`SHOW ${what}`),
  );
  return rows;
}

/**
 * Drops the test-only tables and views earlier files created in this worker's database (every
 * relation in `public` that is not in the classification), so each file starts from the
 * migrated schema: catalog-wide checks (privileges, presence) never see another file's probes.
 */
export async function dropTestOnlyRelations(): Promise<void> {
  const keep = Object.keys(TABLE_CLASSIFICATION);
  await withPool(urlFor(info(), 'owner', workerDatabaseName()), async (pool) => {
    const { rows } = await pool.query<{ stmt: string }>(
      `SELECT format(CASE c.relkind WHEN 'v' THEN 'DROP VIEW IF EXISTS %I CASCADE'
                                    WHEN 'm' THEN 'DROP MATERIALIZED VIEW IF EXISTS %I CASCADE'
                                    ELSE 'DROP TABLE IF EXISTS %I CASCADE' END, c.relname) AS stmt
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
          AND NOT (c.relname = ANY ($1::text[]))`,
      [keep],
    );
    for (const { stmt } of rows) await pool.query(stmt);
  });
}

/**
 * Platform tables whose rows a migration seeds (A-02-02: the plans and their values): kept by
 * resetTestDb(), as in every real database. No application role may write them.
 */
export const SEEDED_TABLES = ['plan', 'plan_feature'] as const;

/** Truncates every table outside the migration history (`drizzle` schema) and SEEDED_TABLES. */
export async function resetTestDb(): Promise<void> {
  const seeded = SEEDED_TABLES.map((t) => `'${t}'`).join(', ');
  await withPool(urlFor(info(), 'owner', workerDatabaseName()), (pool) =>
    pool.query(`DO $$
      DECLARE targets text;
      BEGIN
        SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') INTO targets
          FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'drizzle')
           AND NOT (schemaname = 'public' AND tablename IN (${seeded}));
        IF targets IS NOT NULL THEN
          EXECUTE 'TRUNCATE ' || targets || ' RESTART IDENTITY CASCADE';
        END IF;
      END $$`),
  );
}

/**
 * The start of a test that needs tenants: empties this worker's database (resetTestDb()), then
 * writes these tenant rows on the platform path (one withPlatformAdmin() call, so one platform
 * audit row). Tenant tables reference `tenant`, so their rows need these parents.
 */
export async function createTestTenants(...tenantIds: string[]): Promise<void> {
  await resetTestDb();
  await testPlatformDb().withPlatformAdmin(
    { actorId: fixtureId('test super admin'), event: 'clinic.created' },
    async (tx) => {
      for (const [index, id] of tenantIds.entries()) {
        await insertTenantRow(tx, { id, name: `عيادة تجريبية ${String(index + 1)}` });
      }
    },
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
  shared.clear();
  authHandle = undefined;
  platformHandle = undefined;
  await Promise.all(pending.map((close) => close()));
}
