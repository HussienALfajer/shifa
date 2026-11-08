// Connection info shared by globalSetup (main process) and the workers (via Vitest provide).
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { ROLES_SQL } from '../src/migrate.ts';
import { assertTestTarget, type ContainerAddress } from './guard.ts';

export interface HarnessInfo extends ContainerAddress {
  superuserPassword: string;
  ownerPassword: string;
  appPassword: string;
}

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

/** Builds a guarded URL; throws UnsafeDatabaseError for anything outside the container. */
export function urlFor(info: HarnessInfo, role: HarnessRole, database: string): string {
  const password = {
    superuser: info.superuserPassword,
    owner: info.ownerPassword,
    app: info.appPassword,
  }[role];
  const url = `postgres://${USERS[role]}:${encodeURIComponent(password)}@${info.host}:${String(info.port)}/${encodeURIComponent(database)}`;
  assertTestTarget(url, info);
  return url;
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
