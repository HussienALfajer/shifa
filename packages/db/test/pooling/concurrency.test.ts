// Spec 0.3-S2 criterion 8: 20 rounds of 50 concurrent withTenant() calls over 3 synthetic
// tenants (the `load` preset of @shifa/testing, small params) on PgBouncer's 2 server
// connections. Every call checks its own `app.tenant_id` and the tenant of every row it reads.
import { generateDataset } from '@shifa/testing';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ShifaDb } from '../../src/index.ts';
import { pooledTestDb, workerDatabaseName } from '../../test-harness/index.ts';
import { ensureProbe, recordFinding, seedProbe, USER_A } from './probe.ts';

const ROUNDS = 20;
const CONCURRENT = 50;
const dataset = generateDataset({
  seed: 2026_11_12,
  preset: 'load',
  load: { tenants: 3, patientsPerTenant: 4 },
});
const tenants = dataset.tenants.map((tenant) => tenant.id);
const expectedRows = new Map<string, number>();
let db: ShifaDb | undefined;

const app = (): ShifaDb => {
  if (!db) throw new Error('beforeAll did not open the pooled handle');
  return db;
};

beforeAll(async () => {
  await ensureProbe(workerDatabaseName());
  // 50 client connections compete for 2 server connections.
  db = pooledTestDb({ max: CONCURRENT });
  for (const tenantId of tenants) {
    // Chart ids as labels: synthetic, and different for every tenant.
    const labels = dataset.charts.filter((c) => c.tenantId === tenantId).map((c) => c.id);
    await seedProbe(app(), tenantId, labels);
    expectedRows.set(tenantId, labels.length);
  }
});

async function checkedCall(tenantId: string) {
  return app().withTenant({ tenantId, userId: USER_A }, async (tx) => {
    const setting = await tx.execute<{ t: string; pid: number }>(
      sql`select current_setting('app.tenant_id') as t, pg_backend_pid() as pid`,
    );
    const rows = await tx.execute<{ tenant_id: string }>(sql`select tenant_id from pool_probe`);
    const ok =
      setting.rows[0]?.t === tenantId &&
      rows.rows.length === expectedRows.get(tenantId) &&
      rows.rows.every((row) => row.tenant_id === tenantId);
    return { ok, pid: Number(setting.rows[0]?.pid) };
  });
}

describe('concurrent withTenant() through PgBouncer', () => {
  it('never shows a call another tenant’s context or rows', async () => {
    expect(tenants.length).toBeGreaterThanOrEqual(3);
    const pids = new Set<number>();
    let calls = 0;
    let mismatches = 0;
    const start = Date.now();
    for (let round = 0; round < ROUNDS; round += 1) {
      const results = await Promise.all(
        Array.from({ length: CONCURRENT }, (_, i) =>
          checkedCall(tenants[(round * CONCURRENT + i) % tenants.length] ?? ''),
        ),
      );
      for (const result of results) {
        calls += 1;
        if (!result.ok) mismatches += 1;
        pids.add(result.pid);
      }
    }
    recordFinding('concurrency', {
      tenants: tenants.length,
      calls,
      mismatches,
      serverPids: [...pids],
      elapsedMs: Date.now() - start,
    });
    expect(mismatches, 'calls that saw another tenant').toBe(0);
    expect(calls).toBe(ROUNDS * CONCURRENT);
    expect(pids.size, 'calls were spread over the 2 server connections').toBe(2);
  }, 120_000);
});
