import { Pool } from 'pg';
import { runAsPlatformAdmin } from './admin.ts';
import { runWithTenant, type TenantContext } from './tenant.ts';
import type { Tx } from './transaction.ts';

export interface ShifaDb {
  /** Tenant-scoped work: one transaction with `app.tenant_id` etc. set (ADR-0005). */
  withTenant<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Cross-tenant platform work; requires a reason (audited once the audit slice lands). */
  withPlatformAdmin<T>(reason: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** Ends the pool at shutdown; later calls return the same promise. */
  close(): Promise<void>;
}

export interface CreateDbOptions {
  /** Pool size (default 10). One connection per transaction, PgBouncer-transaction-mode safe. */
  max?: number;
  /** Called when an idle pooled connection fails (e.g. the server restarted). */
  onIdleError?: (err: Error) => void;
  /** Give up opening a connection after this long (default 5000 ms) instead of the OS TCP timeout. */
  connectTimeoutMs?: number;
}

/**
 * Opens a pool as the application role (each new connection is checked: not superuser, no
 * BYPASSRLS, owns no table). The pool stays private: every query goes through withTenant() or
 * withPlatformAdmin(), and each `tx` handle stops working when its callback ends.
 */
export function createDb(url: string, options: CreateDbOptions = {}): ShifaDb {
  const pool = new Pool({
    connectionString: url,
    max: options.max ?? 10,
    // A black-holed database must fail requests and probes quickly, not pile them up.
    connectionTimeoutMillis: options.connectTimeoutMs ?? 5000,
  });
  // Without a listener an idle-connection error would crash the process; the next query on
  // a fresh connection reports any lasting problem.
  pool.on('error', options.onIdleError ?? (() => undefined));
  // pg throws on a second end(); a shutdown signal can race a manual close, so close once.
  let closing: Promise<void> | undefined;
  return {
    withTenant: (ctx, fn) => runWithTenant(pool, ctx, fn),
    withPlatformAdmin: (reason, fn) => runAsPlatformAdmin(pool, reason, fn),
    close: () => (closing ??= pool.end()),
  };
}
