import { DrizzleQueryError, type SQLWrapper, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { QueryResult, QueryResultRow } from 'pg';

type DrizzleTx = Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0];

/**
 * Raw SQL runs one statement per call, so the result is a single QueryResult. (Drizzle's own
 * untyped `execute` also allows multi-statement strings and returns a union with an array.)
 */
export interface SingleStatementExecute {
  execute<TRow extends QueryResultRow = Record<string, unknown>>(
    query: SQLWrapper | string,
  ): Promise<QueryResult<TRow>>;
}

/** A Drizzle transaction handle; the only way application code reaches the database. */
export type Tx = Omit<DrizzleTx, 'execute'> & SingleStatementExecute;

/** Same object; only the static type of `execute` is narrowed (see SingleStatementExecute). */
export const asTx = (tx: DrizzleTx): Tx => tx as unknown as Tx;

/**
 * Drizzle's DrizzleQueryError puts the query parameters (patient data) into its message, which
 * ends up in logs. Rethrow the driver's error instead: SQLSTATE code and message, no values.
 */
export async function withoutQueryParams<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof DrizzleQueryError && err.cause instanceof Error) throw err.cause;
    throw err;
  }
}

export interface TenantContext {
  tenantId: string;
  branchId?: string;
  userId: string;
}

/** Raised before any SQL is sent when a tenant context is malformed. */
export class TenantContextError extends Error {
  override name = 'TenantContextError';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(field: string, value: unknown): asserts value is string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    // The value itself is not echoed: it may be user input.
    throw new TenantContextError(`${field} must be a UUID`);
  }
}

/**
 * Runs `fn` in one transaction whose RLS context is this tenant (ADR-0004, ADR-0005).
 * The settings are transaction-local (`set_config(..., true)`), so they vanish at COMMIT or
 * ROLLBACK and never leak to the next user of the pooled connection. A throw rolls back.
 */
export async function runWithTenant<T>(
  db: NodePgDatabase,
  ctx: TenantContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  assertUuid('tenantId', ctx.tenantId);
  if (ctx.branchId !== undefined) assertUuid('branchId', ctx.branchId);
  assertUuid('userId', ctx.userId);
  const { tenantId, userId } = ctx;
  const branchId = ctx.branchId ?? '';
  return withoutQueryParams(() =>
    db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true),
                                  set_config('app.branch_id', ${branchId}, true),
                                  set_config('app.user_id', ${userId}, true)`);
      return fn(asTx(tx));
    }),
  );
}
