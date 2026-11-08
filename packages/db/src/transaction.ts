// One transaction on one checked-out connection, reachable only while the callback runs.
import { DrizzleQueryError, type SQL, type SQLWrapper } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool, PoolClient, QueryConfig, QueryResult, QueryResultRow } from 'pg';

type DrizzleTx = Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0];

/**
 * Raw SQL runs one statement per call and only as a `sql` template (never a string, so values
 * are always parameters). Drizzle's untyped `execute` returns a union with an array instead.
 */
export interface SingleStatementExecute {
  execute<TRow extends QueryResultRow = Record<string, unknown>>(
    query: SQLWrapper,
  ): Promise<QueryResult<TRow>>;
}

/** A Drizzle transaction handle; the only way application code reaches the database. */
export type Tx = Omit<DrizzleTx, 'execute'> & SingleStatementExecute;

/**
 * Drizzle can put query parameters (patient data) into DrizzleQueryError's message; we turn
 * that off and also rethrow the driver's error (SQLSTATE `code`, constraint) in its place.
 * PostgreSQL's own message can still echo a value: log `code`, never `message` or `detail`.
 */
export async function withoutQueryParams<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof DrizzleQueryError && err.cause instanceof Error) throw err.cause;
    throw err;
  }
}

/**
 * What Drizzle sees as its client. Once the callback settles it refuses every query, so a `tx`
 * kept in a closure or request state cannot run inside the next tenant's transaction on the
 * same pooled connection. (Its class name must not contain "Pool": Drizzle checks for that.)
 */
class ScopedConnection {
  #client: PoolClient | undefined;
  constructor(client: PoolClient) {
    this.#client = client;
  }
  /** Drizzle calls `query(config, values)` and awaits the promise form only. */
  query(config: QueryConfig, values?: unknown[]): Promise<QueryResult> {
    if (!this.#client) {
      throw new Error('This tx handle was used after its withTenant()/withPlatformAdmin() ended');
    }
    return this.#client.query(config, values);
  }
  close(): void {
    this.#client = undefined;
  }
}

const verified = new WeakSet<PoolClient>();

/**
 * FORCE RLS does not bind superusers, BYPASSRLS roles or table owners: refuse them, and any
 * role that is a member of another role (SET ROLE could reach the owner or a superuser).
 */
async function assertApplicationRole(client: PoolClient): Promise<void> {
  if (verified.has(client)) return;
  const { rows } = await client.query<{ unsafe: boolean }>(
    `SELECT r.rolsuper OR r.rolbypassrls
            OR EXISTS (SELECT 1 FROM pg_class c WHERE c.relowner = r.oid)
            OR EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid) AS unsafe
       FROM pg_roles r WHERE r.rolname = current_user`,
  );
  if (rows[0]?.unsafe !== false) {
    throw new Error(
      'createDb() must connect as the application role (shifa_app): this role is superuser, ' +
        'bypasses RLS, owns tables or is a member of another role',
    );
  }
  verified.add(client);
}

/** Runs `setup` then `fn` in one transaction; the handle dies when it ends. */
export async function runScoped<T>(pool: Pool, setup: SQL, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let broken: unknown;
  const onError = (err: Error) => {
    broken ??= err;
  };
  client.on('error', onError);
  const scoped = new ScopedConnection(client);
  try {
    await assertApplicationRole(client);
    const db = drizzle({ client: scoped as unknown as PoolClient, paramsInErrors: false });
    return await withoutQueryParams(() =>
      db.transaction(async (tx) => {
        await tx.execute(setup);
        return fn(tx as unknown as Tx);
      }),
    );
  } catch (err) {
    // Drizzle already rolled back; if the connection cannot even do that, destroy it.
    await client.query('ROLLBACK').catch((e: unknown) => {
      broken ??= e;
    });
    throw err;
  } finally {
    scoped.close();
    client.off('error', onError);
    client.release(broken instanceof Error ? broken : undefined);
  }
}
