// Connection info shared by globalSetup (main process) and the workers (via Vitest provide).
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { ROLES_SQL } from '../src/migrate.ts';
import { assertTestTarget, type ContainerAddress, type HarnessAddress } from './guard.ts';

/** `pooler` (PgBouncer in front of PostgreSQL, 0.3-S2a) is set once PgBouncer has started. */
export interface HarnessInfo extends HarnessAddress {
  superuserPassword: string;
  ownerPassword: string;
  appPassword: string;
  /** PgBouncer-only login for its admin console (SHOW CONFIG etc.); not a PostgreSQL role. */
  poolerAdminPassword: string;
}

/** PgBouncer user allowed on the admin console; exists only in the generated userlist. */
export const POOLER_ADMIN_USER = 'shifa_pooler_admin';

/** How a URL reaches PostgreSQL: straight to the container, or through PgBouncer. */
export type Via = 'direct' | 'pooler';

declare module 'vitest' {
  export interface ProvidedContext {
    shifaDb: HarnessInfo;
  }
}

export type HarnessRole = 'superuser' | 'owner' | 'app';

const USERS: Record<HarnessRole, string> = {
  superuser: 'postgres',
  owner: 'shifa_owner',
  app: 'shifa_app',
};

function guardedUrl(
  info: HarnessInfo,
  address: ContainerAddress,
  user: string,
  password: string,
  database: string,
): string {
  const url = `postgres://${user}:${encodeURIComponent(password)}@${address.host}:${String(address.port)}/${encodeURIComponent(database)}`;
  assertTestTarget(url, info);
  return url;
}

/** Builds a guarded URL; throws UnsafeDatabaseError for anything outside the containers. */
export function urlFor(
  info: HarnessInfo,
  role: HarnessRole,
  database: string,
  { via = 'direct' }: { via?: Via } = {},
): string {
  const password = {
    superuser: info.superuserPassword,
    owner: info.ownerPassword,
    app: info.appPassword,
  }[role];
  return guardedUrl(info, via === 'pooler' ? pooler(info) : info, USERS[role], password, database);
}

/** Guarded URL of PgBouncer's admin console (simple-protocol SHOW commands only). */
export function poolerAdminUrl(info: HarnessInfo): string {
  return guardedUrl(info, pooler(info), POOLER_ADMIN_USER, info.poolerAdminPassword, 'pgbouncer');
}

function pooler(info: HarnessInfo): ContainerAddress {
  if (!info.pooler) throw new Error('PgBouncer has not been started by this harness');
  return info.pooler;
}

/** Runs `fn` with a short-lived single connection. */
export async function withPool<T>(url: string, fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

/** sql/roles.sql, then test-only logins (passwords are random hex, generated per run). */
export async function applyRoles(info: HarnessInfo): Promise<void> {
  for (const pw of [info.ownerPassword, info.appPassword]) {
    if (!/^[0-9a-f]{32}$/.test(pw)) throw new Error('harness passwords must be 32 hex chars');
  }
  await withPool(urlFor(info, 'superuser', 'postgres'), async (pool) => {
    await pool.query(readFileSync(ROLES_SQL, 'utf8'));
    await pool.query(`ALTER ROLE shifa_owner LOGIN PASSWORD '${info.ownerPassword}'`);
    await pool.query(`ALTER ROLE shifa_app PASSWORD '${info.appPassword}'`);
  });
}
