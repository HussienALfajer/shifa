// PgBouncer in the test harness (0.3-S2a, spec 0.3-S2 criteria 1 and 2): pinned image,
// transaction mode with a tiny server pool, the application view through the pooler, and the
// role check still refusing an unsafe role behind it.
import { globSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb } from '../src/client.ts';
import { PGBOUNCER_IMAGE } from '../test-harness/image.ts';
import {
  POOLING_DATABASE,
  pooledHarnessUrl,
  pooledTestDb,
  rawPooledAppDb,
  showPooler,
  workerDatabaseName,
} from '../test-harness/index.ts';

const TENANT = '3c3c3c3c-0000-4000-8000-00000000000c';
const USER = '4d4d4d4d-0000-4000-8000-00000000000d';
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

describe('PgBouncer in the harness', () => {
  it('pins the image by version and digest', () => {
    expect(PGBOUNCER_IMAGE).toMatch(/^[a-z0-9./-]+:v?\d+\.\d+\.\d+[\w.-]*@sha256:[0-9a-f]{64}$/);
  });

  it('runs in transaction mode with a server pool of 2 and prepared statements on', async () => {
    const config = new Map(
      (await showPooler('CONFIG')).map((row) => [String(row['key']), String(row['value'])]),
    );
    expect(config.get('pool_mode')).toBe('transaction');
    expect(config.get('default_pool_size')).toBe('2');
    expect(Number(config.get('max_prepared_statements'))).toBeGreaterThan(0);
    expect(config.get('auth_type')).toBe('scram-sha-256');
    // S2b decides whether production needs it; the harness starts without it.
    expect(config.get('server_reset_query_always')).toBe('0');
  });

  it('gives the pooling database a server pool of exactly 1', async () => {
    const databases = await showPooler('DATABASES');
    const pooling = databases.find((row) => row['name'] === POOLING_DATABASE);
    expect(pooling).toBeDefined();
    expect(Number(pooling?.['pool_size'])).toBe(1);
    expect(pooling?.['database']).toBe(POOLING_DATABASE);
  });

  it('writes no userlist or PgBouncer config into the repository', () => {
    const found = globSync('**/{userlist*,pgbouncer*.ini}', {
      cwd: REPO_ROOT,
      exclude: (path) => /(^|[\\/])(node_modules|\.git)$/.test(path),
    });
    expect(found).toEqual([]);
  });
});

describe('pooledTestDb()', () => {
  it('runs withTenant() as shifa_app on a server connection PgBouncer holds', async () => {
    const seen = await pooledTestDb().withTenant({ tenantId: TENANT, userId: USER }, async (tx) => {
      const { rows } = await tx.execute<{ role: string; db: string; pid: number }>(
        sql`select current_user as role, current_database() as db, pg_backend_pid() as pid`,
      );
      // Asked while the transaction is open, so the server connection is linked to us.
      return { row: rows[0], servers: await showPooler('SERVERS') };
    });
    expect(seen.row?.role).toBe('shifa_app');
    expect(seen.row?.db).toBe(workerDatabaseName());
    const server = seen.servers.find((s) => Number(s['remote_pid']) === Number(seen.row?.pid));
    expect(server, 'the backend is not one of PgBouncer server connections').toBeDefined();
    expect(server?.['user']).toBe('shifa_app');
    expect(server?.['database']).toBe(workerDatabaseName());
  });

  it('keeps the tenant context inside the transaction', async () => {
    const tenant = await pooledTestDb().withTenant(
      { tenantId: TENANT, userId: USER },
      async (tx) => {
        const { rows } = await tx.execute<{ t: string }>(
          sql`select current_setting('app.tenant_id') as t`,
        );
        return rows[0]?.t;
      },
    );
    expect(tenant).toBe(TENANT);
  });

  it('rawPooledAppDb() connects as shifa_app through the pooler', async () => {
    const { rows } = await rawPooledAppDb().execute<{ role: string }>(
      sql`select current_user as role`,
    );
    expect(rows[0]?.role).toBe('shifa_app');
  });

  it('createDb() behind PgBouncer still refuses the owner role', async () => {
    const asOwner = createDb(pooledHarnessUrl('owner'), { max: 1 });
    try {
      await expect(
        asOwner.withTenant({ tenantId: TENANT, userId: USER }, (tx) => tx.execute(sql`select 1`)),
      ).rejects.toThrow(/application role/);
    } finally {
      await asOwner.close();
    }
  });
});
