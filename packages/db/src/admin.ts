import { sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { runScoped, type Tx } from './transaction.ts';

/**
 * The only path besides withTenant(): platform-level work with no tenant context, so FORCE RLS
 * shows no tenant rows. Placeholder until the audit slice gives it its own role and an audit
 * record; for now it insists on a reason and exposes it to SQL as `app.admin_reason`.
 * The tenant settings are cleared for this transaction, so even a value someone set at session
 * level on this connection cannot apply here.
 */
export async function runAsPlatformAdmin<T>(
  pool: Pool,
  reason: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (reason.trim() === '') {
    throw new Error('withPlatformAdmin needs a non-empty reason (it will be audited)');
  }
  const setup = sql`select set_config('app.tenant_id', '', true),
                           set_config('app.branch_id', '', true),
                           set_config('app.user_id', '', true),
                           set_config('app.admin_reason', ${reason}, true)`;
  return runScoped(pool, setup, fn);
}
