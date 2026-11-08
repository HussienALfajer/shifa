import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { runAsPlatformAdmin } from './admin.ts';
import { runWithTenant, type TenantContext, type Tx } from './tenant.ts';

export interface ShifaDb {
  /** Tenant-scoped work: one transaction with `app.tenant_id` etc. set (ADR-0005). */
  withTenant<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Cross-tenant platform work; requires a reason (audited once the audit slice lands). */
  withPlatformAdmin<T>(reason: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Ends the pool; call once at shutdown. */
  close(): Promise<void>;
}

export interface CreateDbOptions {
  /** Pool size (default 10). One connection per transaction, PgBouncer-transaction-mode safe. */
  max?: number;
  /** Called when an idle pooled connection fails (e.g. the server restarted). */
  onIdleError?: (err: Error) => void;
}

/**
 * Opens a pool as the application role. The pool and the raw Drizzle instance stay private:
 * every query goes through withTenant() or withPlatformAdmin().
 */
export function createDb(url: string, options: CreateDbOptions = {}): ShifaDb {
  const pool = new Pool({ connectionString: url, max: options.max ?? 10 });
  // Without a listener an idle-connection error would crash the process; the next query on
  // a fresh connection reports any lasting problem.
  pool.on('error', options.onIdleError ?? (() => undefined));
  const db = drizzle({ client: pool });
  return {
    withTenant: (ctx, fn) => runWithTenant(db, ctx, fn),
    withPlatformAdmin: (reason, fn) => runAsPlatformAdmin(db, reason, fn),
    close: () => pool.end(),
  };
}
