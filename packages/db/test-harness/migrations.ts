// Migration tests (A-02-04 security review B1): a fresh, empty database migrated as shifa_owner
// step by step, so a data migration runs exactly as in production (no superuser, FORCE RLS on),
// over rows a test writes between the steps.
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { inject } from 'vitest';
import { MIGRATIONS_DIR } from '../src/migrate.ts';
import { urlFor, withPool } from './context.ts';

/**
 * Drops and recreates `shifa_test_<poolId>` empty (owned by shifa_owner), then applies the
 * migrations up to and including the folder `through` (all of them when absent). Returns its name.
 */
export async function freshMigratedDatabase(poolId: string, through?: string): Promise<string> {
  if (!/^\d+$/.test(poolId)) throw new Error(`pool id must be numeric, got "${poolId}"`);
  const name = `shifa_test_${poolId}`;
  await withPool(urlFor(inject('shifaDb'), 'superuser', 'postgres'), async (pool) => {
    await pool.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await pool.query(`CREATE DATABASE ${name} OWNER shifa_owner`);
    await pool.query(`REVOKE TEMPORARY ON DATABASE ${name} FROM PUBLIC`);
  });
  await migrateDatabase(name, through);
  return name;
}

/** Applies the pending migrations of `database` as shifa_owner, up to `through` when given. */
export async function migrateDatabase(database: string, through?: string): Promise<void> {
  const folders = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  if (through !== undefined && !folders.includes(through)) {
    throw new Error(`no migration folder ${through}`);
  }
  const chosen = through === undefined ? folders : folders.filter((f) => f <= through);
  const dir = mkdtempSync(join(tmpdir(), 'shifa-migrations-'));
  try {
    for (const folder of chosen)
      cpSync(join(MIGRATIONS_DIR, folder), join(dir, folder), { recursive: true });
    const pool = new Pool({
      connectionString: urlFor(inject('shifaDb'), 'owner', database),
      max: 1,
    });
    try {
      await drizzleMigrate(drizzle({ client: pool }), { migrationsFolder: dir });
    } finally {
      await pool.end();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
