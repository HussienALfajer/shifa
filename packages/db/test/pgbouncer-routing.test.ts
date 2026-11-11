// Follow-up proofs from the 0.3-S2a reviews: every pooled handle really goes through PgBouncer,
// the direct ones do not, the shared console is read-only, the pool-of-1 database is ready,
// and no PgBouncer file lands anywhere in the repository (dot-directories included).
import { type Dirent, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb } from '../src/client.ts';
import {
  holdPoolingDatabase,
  POOLING_DATABASE,
  pooledHarnessUrl,
  rawAppDb,
  rawPooledAppDb,
  rawPoolerConsole,
  showPooler,
} from '../test-harness/index.ts';
import { DB_MODES } from './isolation/modes.ts';

const TENANT = '5e5e5e5e-0000-4000-8000-00000000000e';
const USER = '6f6f6f6f-0000-4000-8000-00000000000f';
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

async function heldByPooler(pid: number): Promise<boolean> {
  return (await showPooler('SERVERS')).some((s) => Number(s['remote_pid']) === pid);
}

const pidOf = (rows: { pid: number }[]) => Number(rows[0]?.pid);

describe('routing per mode', () => {
  it.each(DB_MODES)(
    '%s mode: the backend is held by PgBouncer only when pooled',
    async (mode, db) => {
      // Asked inside the transaction, so a pooled server connection is linked and listed.
      const held = await db().withTenant({ tenantId: TENANT, userId: USER }, async (tx) => {
        const { rows } = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        return heldByPooler(pidOf(rows));
      });
      expect(held).toBe(mode === 'pgbouncer');
    },
  );

  it('rawPooledAppDb() goes through PgBouncer and rawAppDb() does not', async () => {
    const pooled = await rawPooledAppDb().execute<{ pid: number }>(
      sql`select pg_backend_pid() as pid`,
    );
    const direct = await rawAppDb().execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    // Idle server connections stay listed in SHOW SERVERS.
    expect(await heldByPooler(pidOf(pooled.rows))).toBe(true);
    expect(await heldByPooler(pidOf(direct.rows))).toBe(false);
  });
});

describe('the shared PgBouncer', () => {
  it('refuses configuration changes from the harness console login', async () => {
    expect(await rawPoolerConsole('SET default_pool_size = 7')).toMatch(/admin access needed/);
    const config = await showPooler('CONFIG');
    expect(config.find((row) => row['key'] === 'default_pool_size')?.['value']).toBe('2');
  });

  it('has the pool-of-1 database ready behind it', async () => {
    // Its single server connection is shared with the leak tests in test/pooling/.
    const release = await holdPoolingDatabase();
    const db = createDb(pooledHarnessUrl('app', POOLING_DATABASE), { max: 1 });
    try {
      const name = await db.withTenant({ tenantId: TENANT, userId: USER }, async (tx) => {
        const { rows } = await tx.execute<{ db: string }>(sql`select current_database() as db`);
        return rows[0]?.db;
      });
      expect(name).toBe(POOLING_DATABASE);
    } finally {
      await db.close();
      await release();
    }
  }, 60_000);
});

/** Every file under `dir`, dot-directories included; skips node_modules and .git. */
function walk(dir: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return []; // removed while walking (another worker's temp files)
  }
  return entries.flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.git') return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe('PgBouncer files', () => {
  it('none is written anywhere in the repository, dot-directories included', () => {
    const found = walk(REPO_ROOT).filter((path) =>
      /(^|[\\/])(userlist[^\\/]*|pgbouncer[^\\/]*\.ini)$/.test(path),
    );
    expect(found).toEqual([]);
  });
});
