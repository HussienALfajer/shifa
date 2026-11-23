import { Pool } from 'pg';

export interface CreateDbOptions {
  /** Pool size (default 10). One connection per transaction, PgBouncer-transaction-mode safe. */
  max?: number;
  /** Called when an idle pooled connection fails (e.g. the server restarted). */
  onIdleError?: (err: Error) => void;
  /** Give up opening a connection after this long (default 5000 ms) instead of the OS TCP timeout. */
  connectTimeoutMs?: number;
}

/** A private pool plus a close() that is safe to call twice (pg throws on a second end()). */
export function openPool(
  url: string,
  options: CreateDbOptions,
): { pool: Pool; close: () => Promise<void> } {
  const pool = new Pool({
    connectionString: url,
    max: options.max ?? 10,
    // A black-holed database must fail requests and probes quickly, not pile them up.
    connectionTimeoutMillis: options.connectTimeoutMs ?? 5000,
  });
  // Without a listener an idle-connection error would crash the process; the next query on
  // a fresh connection reports any lasting problem.
  pool.on('error', options.onIdleError ?? (() => undefined));
  // A shutdown signal can race a manual close, so close once.
  let closing: Promise<void> | undefined;
  return { pool, close: () => (closing ??= pool.end()) };
}
