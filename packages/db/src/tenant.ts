import { sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { runScoped, type Tx } from './transaction.ts';

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
  pool: Pool,
  ctx: TenantContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  assertUuid('tenantId', ctx.tenantId);
  if (ctx.branchId !== undefined) assertUuid('branchId', ctx.branchId);
  assertUuid('userId', ctx.userId);
  const setup = sql`select set_config('app.tenant_id', ${ctx.tenantId}, true),
                           set_config('app.branch_id', ${ctx.branchId ?? ''}, true),
                           set_config('app.user_id', ${ctx.userId}, true)`;
  return runScoped(pool, setup, fn);
}
