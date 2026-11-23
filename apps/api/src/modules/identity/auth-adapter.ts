// Better Auth's Drizzle adapter on the shifa_auth pool (ADR-0043). @shifa/db never hands out a
// pool or a raw Drizzle handle, only `withAuth((tx) => …)`, whose `tx` dies when the callback
// ends. So the adapter is built once over a facade that forwards to the transaction of the
// current call (AsyncLocalStorage), and every adapter method opens its own withAuth()
// transaction unless it already runs inside one (a Better Auth transaction, or `run()`).
import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import type { AuthDb, Tx } from '@shifa/db';
import type { BetterAuthOptions } from 'better-auth';

/** What Better Auth's `database` option expects a factory to return. */
type AdapterOf = ReturnType<ReturnType<typeof drizzleAdapter>>;

/** One scoped adapter per process: the transaction the current call runs in, if any. */
export interface ScopedAuthAdapter {
  (options: BetterAuthOptions): AdapterOf;
  /** Runs `fn` in one withAuth() transaction; Better Auth calls inside it share that `tx`. */
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

export function scopedAuthAdapter(
  authDb: AuthDb,
  schema: Record<string, unknown>,
): ScopedAuthAdapter {
  const current = new AsyncLocalStorage<Tx>();
  const activeTx = (): Tx => {
    const tx = current.getStore();
    if (!tx) throw new Error('Better Auth adapter used outside a withAuth() transaction');
    return tx;
  };
  // Every property read goes to the transaction of the current call.
  const facade = new Proxy({} as Tx, {
    get: (_target, prop) => {
      const tx = activeTx() as unknown as Record<PropertyKey, unknown>;
      const value = tx[prop];
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(tx) : value;
    },
  });
  const run = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => {
    const tx = current.getStore();
    if (tx) return fn(tx);
    return authDb.withAuth((scoped) => current.run(scoped, () => fn(scoped)));
  };
  const factory = drizzleAdapter(facade, { provider: 'pg', schema, transaction: false });

  const scoped = ((options: BetterAuthOptions) => {
    const adapter = factory(options) as unknown as Record<string, unknown>;
    const wrapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(adapter)) {
      wrapped[key] =
        typeof value === 'function'
          ? (...args: unknown[]) =>
              run(() => Promise.resolve((value as (...a: unknown[]) => unknown)(...args)))
          : value;
    }
    // Better Auth runs multi-step writes through adapter.transaction(cb): one withAuth() for all.
    wrapped['transaction'] = <T>(cb: (trx: unknown) => Promise<T>) => run(() => cb(wrapped));
    return wrapped as unknown as AdapterOf;
  }) as ScopedAuthAdapter;
  scoped.run = run;
  return scoped;
}
