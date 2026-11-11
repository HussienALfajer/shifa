// Safety net: the harness only ever talks to the container it started, and only to databases
// it created there. It never reads DATABASE_URL or any other URL from the environment.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { acquireLock, LockBusyError } from '../../../scripts/lib/lock.mjs';

export class UnsafeDatabaseError extends Error {
  override name = 'UnsafeDatabaseError';
}

export interface ContainerAddress {
  host: string;
  port: number;
}

/**
 * The PostgreSQL container and, when started, the PgBouncer containers in front of it: the
 * shared one and the `server_reset_query_always = 1` variant (0.3-S2b).
 */
export interface HarnessAddress extends ContainerAddress {
  pooler?: ContainerAddress;
  resetPooler?: ContainerAddress;
}

/** Databases the harness creates: per-worker clones, the template, and the maintenance DB. */
const OWN_DATABASE = /^shifa_test_\d+$|^shifa_template$|^postgres$/;
/** Databases reachable through PgBouncer: the clones only. */
const POOLED_DATABASE = /^shifa_test_\d+$/;
/** PgBouncer's console: a virtual database, accepted only on the pooler address. */
const POOLER_ADMIN_DATABASE = 'pgbouncer';

const sameAddress = (a: ContainerAddress, host: string, port: number) =>
  a.host === host && a.port === port;

/**
 * Throws unless `url` points at the harness PostgreSQL or PgBouncer address (the exact host and
 * port pair) and one of the harness's own databases.
 */
export function assertTestTarget(url: string, container: HarnessAddress): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeDatabaseError('refusing a database URL that does not parse');
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new UnsafeDatabaseError(`refusing protocol ${parsed.protocol}`);
  }
  // Query parameters such as ?host= would let a URL connect somewhere else.
  if (parsed.search !== '') {
    throw new UnsafeDatabaseError('refusing a database URL with query parameters');
  }
  const port = parsed.port === '' ? 5432 : Number(parsed.port);
  const poolers = [container.pooler, container.resetPooler].filter(
    (a): a is ContainerAddress => a !== undefined,
  );
  const viaPooler = poolers.some((a) => sameAddress(a, parsed.hostname, port));
  if (!viaPooler && !sameAddress(container, parsed.hostname, port)) {
    const others = poolers.map((a) => ` or ${a.host}:${String(a.port)}`).join('');
    throw new UnsafeDatabaseError(
      `refusing ${parsed.hostname}:${String(port)}: not the test container (${container.host}:${String(container.port)}${others})`,
    );
  }
  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (viaPooler && database === POOLER_ADMIN_DATABASE) return;
  // PgBouncer keeps idle server connections; one on the template would block every later clone.
  if (viaPooler && !POOLED_DATABASE.test(database)) {
    throw new UnsafeDatabaseError(
      `refusing database "${database}" through PgBouncer: only shifa_test_<n> and its console`,
    );
  }
  if (!OWN_DATABASE.test(database)) {
    throw new UnsafeDatabaseError(
      `refusing database "${database}": the harness only uses shifa_test_<n>, shifa_template and postgres`,
    );
  }
}

const HELD = Symbol.for('shifa.db.testLock');
const DEFAULT_LOCK = join(import.meta.dirname, '..', '..', '..', '.verify', 'db-test.lock');

/**
 * One DB test run per worktree at a time. Waits up to `waitMs` (default 5 min) for another run,
 * then fails with a clear message. Locks of dead processes are reclaimed.
 */
export async function acquireDbTestLock({
  file = DEFAULT_LOCK,
  waitMs = 5 * 60_000,
  pollMs = 1000,
}: {
  file?: string;
  waitMs?: number;
  pollMs?: number;
} = {}): Promise<() => void> {
  // Several DB projects in one Vitest process each run globalSetup: share this process's hold
  // instead of waiting for ourselves. Kept on globalThis because each project may load its own
  // copy of this module.
  const registry = ((globalThis as Record<symbol, unknown>)[HELD] ??= new Map()) as Map<
    string,
    { count: number; release: () => void }
  >;
  const releaseShared = (held: { count: number; release: () => void }) => {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      held.count -= 1;
      if (held.count === 0) {
        registry.delete(file);
        held.release();
      }
    };
  };
  const existing = registry.get(file);
  if (existing) {
    existing.count += 1;
    return releaseShared(existing);
  }
  mkdirSync(dirname(file), { recursive: true });
  try {
    const held = { count: 1, release: await acquireLock(file, { waitMs, pollMs }) };
    registry.set(file, held);
    return releaseShared(held);
  } catch (err) {
    if (!(err instanceof LockBusyError)) throw err;
    const holder = err.pid === null ? 'a starting process' : `pid ${String(err.pid)}`;
    throw new Error(
      `Another database test run (${holder}) holds ${file}; waited ${String(Math.round(waitMs / 1000))} s. ` +
        'Let it finish, or delete the lock file if that process is gone.',
      { cause: err },
    );
  }
}
