// Spec 0.3-S2 criterion 10: under RLS, a typical tenant query (the tenant's latest 20 rows, with
// no tenant filter of its own: only the policy picks the tenant) uses the tenant_id-leading index
// of a table the size of the `load` preset, as shifa_app inside withTenant() through PgBouncer,
// and the index condition comes from the policy (current_tenant_id()). The last case is the
// negative evidence: without the index the same walker reports the sequential scan.
// Owner-approved change (2026-11-15, 0.3-S2c review B1): the query no longer names the tenant,
// so a policy predicate that cannot use the index would fail this file.
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
  policyLatestQuery,
} from '../../scripts/plan-probe.ts';
import { ownerDb, pooledTestDb, workerDatabaseName } from '../../test-harness/index.ts';
import { USER_A } from './probe.ts';

const tenants = planProbeTenants();

/** EXPLAIN (FORMAT JSON) of the typical query for `tenantId`, as the application runs it. */
async function explainAs(tenantId: string): Promise<unknown> {
  return pooledTestDb().withTenant({ tenantId, userId: USER_A }, async (tx) => {
    const { rows } = await tx.execute<{ 'QUERY PLAN': unknown }>(
      sql`explain (format json) ${policyLatestQuery()}`,
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

  it(`uses ${PLAN_PROBE_INDEX} for the policy predicate and never a sequential scan`, async () => {
    const scans = planScans(await explainAs(tenants[7] ?? ''), PLAN_PROBE_TABLE);
    expect(scans.map((scan) => scan.description)).not.toContain(`Seq Scan on ${PLAN_PROBE_TABLE}`);
    const onIndex = scans.filter((scan) => scan.index === PLAN_PROBE_INDEX);
    expect(onIndex.length).toBeGreaterThan(0);
    // The query names no tenant: the index condition can only come from the policy.
    for (const scan of onIndex) {
      expect(scan.indexCond ?? '').toMatch(/current_setting|current_tenant_id/);
    }
  });

  it('returns only the current tenant rows, 20 of them, from RLS alone', async () => {
    const tenantId = tenants[3] ?? '';
    const seen = await pooledTestDb().withTenant({ tenantId, userId: USER_A }, async (tx) => {
      const { rows } = await tx.execute<{ tenant_id: string }>(policyLatestQuery());
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
