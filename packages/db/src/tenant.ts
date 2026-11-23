import type { Pool } from 'pg';
import { assertUuid, contextSetup } from './context.ts';
import { runScoped, type Tx } from './transaction.ts';

export { TenantContextError } from './context.ts';

export interface TenantContext {
  tenantId: string;
  branchId?: string;
  userId: string;
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
  const setup = contextSetup({
    tenantId: ctx.tenantId,
    branchId: ctx.branchId,
    userId: ctx.userId,
  });
  return runScoped(pool, 'shifa_app', setup, fn);
}
