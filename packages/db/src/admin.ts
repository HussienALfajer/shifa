import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { asTx, type Tx, withoutQueryParams } from './tenant.ts';

/**
 * The only path besides withTenant(): platform-level work with no tenant context, so FORCE RLS
 * shows no tenant rows. Placeholder until the audit slice gives it its own role and an audit
 * record; for now it insists on a reason and exposes it to SQL as `app.admin_reason`.
 */
export async function runAsPlatformAdmin<T>(
  db: NodePgDatabase,
  reason: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (reason.trim() === '') {
    throw new Error('withPlatformAdmin needs a non-empty reason (it will be audited)');
  }
  return withoutQueryParams(() =>
    db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.admin_reason', ${reason}, true)`);
      return fn(asTx(tx));
    }),
  );
}
