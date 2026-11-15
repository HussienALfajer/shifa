// Spec 0.3-S2 criterion 10: under RLS, a typical tenant query (the tenant's latest 20 rows) uses
// the tenant_id-leading index of a table the size of the `load` preset, as shifa_app inside
// withTenant() through PgBouncer. The second case is the negative evidence: without the index
// the same walker reports the sequential scan.
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createPlanProbe,
  dropPlanProbeIndex,
  fillPlanProbe,
  PLAN_PROBE_INDEX,
  PLAN_PROBE_TABLE,
  planProbeTenants,
  planScans,
  tenantLatestQuery,
} from '../../scripts/plan-probe.ts';
import { ownerDb, pooledTestDb, workerDatabaseName } from '../../test-harness/index.ts';
import { USER_A } from './probe.ts';

const tenants = planProbeTenants();

/** EXPLAIN (FORMAT JSON) of the typical query for `tenantId`, as the application runs it. */
async function explainAs(tenantId: string): Promise<unknown> {
  return pooledTestDb().withTenant({ tenantId, userId: USER_A }, async (tx) => {
    const { rows } = await tx.execute<{ 'QUERY PLAN': unknown }>(
      sql`explain (format json) ${tenantLatestQuery(tenantId)}`,
    );
    return rows[0]?.['QUERY PLAN'];
  });
}

beforeAll(async () => {
  const owner = ownerDb(workerDatabaseName());
  await owner.execute(createPlanProbe());
  await fillPlanProbe(owner, tenants);
}, 120_000);

describe('RLS plan check (load preset volume)', () => {
  it('fills the probe with the load preset volume', async () => {
    const { rows } = await ownerDb().execute<{ n: number; t: number }>(
      sql`select count(*)::int as n, count(distinct tenant_id)::int as t from ${sql.identifier(PLAN_PROBE_TABLE)}`,
    );
    expect(rows[0]).toEqual({ n: tenants.length * 1000, t: tenants.length });
  });

  it(`uses ${PLAN_PROBE_INDEX} and never a sequential scan on ${PLAN_PROBE_TABLE}`, async () => {
    const scans = planScans(await explainAs(tenants[7] ?? ''), PLAN_PROBE_TABLE);
    expect(scans.map((scan) => scan.description)).not.toContain(`Seq Scan on ${PLAN_PROBE_TABLE}`);
    expect(scans.map((scan) => scan.index)).toContain(PLAN_PROBE_INDEX);
  });

  it('returns only the current tenant rows, 20 of them', async () => {
    const tenantId = tenants[3] ?? '';
    const seen = await pooledTestDb().withTenant({ tenantId, userId: USER_A }, async (tx) => {
      const { rows } = await tx.execute<{ tenant_id: string }>(tenantLatestQuery(tenantId));
      return rows.map((row) => row.tenant_id);
    });
    expect(seen).toHaveLength(20);
    expect(new Set(seen)).toEqual(new Set([tenantId]));
  });

  it('reports "Seq Scan on plan_probe" once the index is gone (negative evidence)', async () => {
    await ownerDb().execute(dropPlanProbeIndex());
    const scans = planScans(await explainAs(tenants[7] ?? ''), PLAN_PROBE_TABLE);
    expect(scans.map((scan) => scan.description)).toContain(`Seq Scan on ${PLAN_PROBE_TABLE}`);
    expect(scans.map((scan) => scan.index)).not.toContain(PLAN_PROBE_INDEX);
  });
});
