// Safety net: the harness only ever talks to the container it started, and only to databases
// it created there. It never reads DATABASE_URL or any other URL from the environment.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { acquireLock, acquireSlot, LockBusyError } from '../../../scripts/lib/lock.mjs';

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
 * DB test processes of one worktree that may run at once (OD-33). A slot is one process (a Vitest
 * run, the API boot check, a script); it starts one PostgreSQL + PgBouncer set per database
 * project (`@shifa/api` has two), each on a new network with random passwords and Docker-assigned
 * ports, and assertTestTarget admits only that run's own addresses, so runs never share a server
 * or a database; the limit only caps the Docker load. Inside `verify full` only the `@shifa/db`
 * and `@shifa/api` test processes overlap (boot waits for build, which waits for the tests).
 */
export const DB_TEST_SLOTS = 3;

/**
 * Takes one of `slots` DB test slots of this worktree (lock files `<file>.0` …). Waits up to
 * `waitMs` (default 5 min) while every slot is held, then fails with a clear message. Locks of
 * dead processes are reclaimed.
 */
export async function acquireDbTestLock({
  file = DEFAULT_LOCK,
  slots = DB_TEST_SLOTS,
  waitMs = 5 * 60_000,
  pollMs = 1000,
}: {
  file?: string;
  slots?: number;
  waitMs?: number;
  pollMs?: number;
} = {}): Promise<() => void> {
  // Several DB projects in one Vitest process each run globalSetup: share this process's slot
  // instead of taking more. Kept on globalThis because each project may load its own copy of
  // this module.
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
    const held = { count: 1, release: await acquireSlot(file, { slots, waitMs, pollMs }) };
    registry.set(file, held);
    return releaseShared(held);
  } catch (err) {
    if (!(err instanceof LockBusyError)) throw err;
    const holder = err.pid === null ? 'a starting process' : `pid ${String(err.pid)}`;
    throw new Error(
      `Another database test run (${holder}) holds a slot, and all ${String(slots)} slots ` +
        `(${file}.<n>) are taken; waited ${String(Math.round(waitMs / 1000))} s. ` +
        'Let a run finish, or delete the slot files of processes that are gone.',
      { cause: err },
    );
  }
}

/**
 * Takes every DB test slot of this worktree, in slot order (two such callers cannot deadlock),
 * for scripts that must run alone as they did under the single lock: the RLS bench (other runs
 * would skew its timings) and the observability smoke (its metric check cannot tell two runs
 * apart). Waits up to `waitMs` in total; on failure it releases what it took.
 */
export async function acquireAllDbTestSlots({
  file = DEFAULT_LOCK,
  slots = DB_TEST_SLOTS,
  waitMs = 5 * 60_000,
  pollMs = 1000,
}: {
  file?: string;
  slots?: number;
  waitMs?: number;
  pollMs?: number;
} = {}): Promise<() => void> {
  mkdirSync(dirname(file), { recursive: true });
  const deadline = Date.now() + waitMs;
  const releases: (() => void)[] = [];
  const releaseAll = () => {
    for (const release of releases.splice(0).reverse()) release();
  };
  try {
    for (let i = 0; i < slots; i += 1) {
      const left = Math.max(0, deadline - Date.now());
      releases.push(await acquireLock(`${file}.${String(i)}`, { waitMs: left, pollMs }));
    }
  } catch (err) {
    releaseAll();
    if (!(err instanceof LockBusyError)) throw err;
    throw new Error(
      `A database test run holds a slot of ${file}.<n>; this script runs alone and waited ` +
        `${String(Math.round(waitMs / 1000))} s. Let the other runs finish.`,
      { cause: err },
    );
  }
  return releaseAll;
}
