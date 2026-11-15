// The RLS plan probe (spec 0.3-S2 criteria 10 and 11): a test-only tenant table the size of the
// `load` preset, the typical tenant query, and a walker over `EXPLAIN (FORMAT JSON)` output.
// Shared by test/pooling/plan-check.test.ts and scripts/bench-rls.ts. Never in migrations or the
// classification. Synthetic data only: tenant ids from @shifa/testing, generated rows.
import { createRandom, DEFAULT_LOAD_PARAMS, IdRegistry } from '@shifa/testing';
import { type SQL, type SQLWrapper, sql } from 'drizzle-orm';

export const PLAN_PROBE_TABLE = 'plan_probe';
export const PLAN_PROBE_INDEX = 'plan_probe_tenant_created';
export const ROWS_PER_TENANT = DEFAULT_LOAD_PARAMS.patientsPerTenant;
const SEED = 20_261_115;

/** Anything with Drizzle's `execute` (a raw handle or a transaction). */
export interface Executor {
  execute(query: SQLWrapper): Promise<unknown>;
}

/** The `load` preset's tenant count of synthetic tenant ids, the same on every run. */
export function planProbeTenants(count: number = DEFAULT_LOAD_PARAMS.tenants): string[] {
  const random = createRandom(SEED);
  const ids = new IdRegistry();
  return Array.from({ length: count }, () => ids.next(random));
}

/**
 * Creates the probe as the schema owner (idempotent). RLS is ENABLEd, not FORCEd: FORCE only
 * subjects the owner, who fills and counts the table; shifa_app is planned and filtered the same
 * either way. The policy is the production one (`tenant_id = current_tenant_id()`).
 */
export function createPlanProbe(): SQL {
  return sql.raw(`
    create table if not exists ${PLAN_PROBE_TABLE} (
      tenant_id uuid not null,
      created_at timestamptz not null,
      label text not null
    );
    create index if not exists ${PLAN_PROBE_INDEX} on ${PLAN_PROBE_TABLE} (tenant_id, created_at desc);
    alter table ${PLAN_PROBE_TABLE} enable row level security;
    drop policy if exists tenant_isolation on ${PLAN_PROBE_TABLE};
    create policy tenant_isolation on ${PLAN_PROBE_TABLE}
      using (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id());
  `);
}

/** Drops the index and re-analyzes: the negative evidence for the plan check. */
export function dropPlanProbeIndex(): SQL {
  return sql.raw(`drop index if exists ${PLAN_PROBE_INDEX}; analyze ${PLAN_PROBE_TABLE};`);
}

/** Empties the probe, inserts ROWS_PER_TENANT generated rows per tenant, then ANALYZE. */
export async function fillPlanProbe(owner: Executor, tenants: readonly string[]): Promise<void> {
  const array = `{${tenants.join(',')}}`;
  await owner.execute(sql.raw(`truncate ${PLAN_PROBE_TABLE}`));
  await owner.execute(sql`
    insert into ${sql.identifier(PLAN_PROBE_TABLE)} (tenant_id, created_at, label)
    select t, timestamptz '2026-01-01 00:00:00+00' + g * interval '1 minute', 'row ' || g
      from unnest(${array}::uuid[]) as t
     cross join generate_series(1, ${ROWS_PER_TENANT}::int) as g`);
  await owner.execute(sql.raw(`analyze ${PLAN_PROBE_TABLE}`));
}

/** The typical tenant query's text: the tenant's latest 20 rows ($1 is the tenant id). */
export const TENANT_LATEST_TEXT = `select tenant_id, created_at, label from ${PLAN_PROBE_TABLE}
 where tenant_id = $1 order by created_at desc limit 20`;

/** The same query as a Drizzle `sql` template, for withTenant(). */
export function tenantLatestQuery(tenantId: string): SQL {
  return sql`select tenant_id, created_at, label from ${sql.identifier(PLAN_PROBE_TABLE)}
 where tenant_id = ${tenantId}::uuid order by created_at desc limit 20`;
}

export interface PlanScan {
  nodeType: string;
  index: string | undefined;
  /** `Seq Scan on plan_probe`, `Index Scan using plan_probe_tenant_created on plan_probe`. */
  description: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Every scan node of `table` in an `EXPLAIN (FORMAT JSON)` result (including the Bitmap Index
 * Scan under a Bitmap Heap Scan, which names only its index). Accepts the JSON value or its text.
 */
export function planScans(explained: unknown, table: string): PlanScan[] {
  const root: unknown = typeof explained === 'string' ? JSON.parse(explained) : explained;
  if (!Array.isArray(root) || root.length === 0) {
    throw new Error('not an EXPLAIN (FORMAT JSON) result');
  }
  const scans: PlanScan[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!isRecord(node)) return;
    if (isRecord(node['Plan'])) visit(node['Plan']);
    const nodeType = typeof node['Node Type'] === 'string' ? node['Node Type'] : undefined;
    const relation = node['Relation Name'];
    const index = typeof node['Index Name'] === 'string' ? node['Index Name'] : undefined;
    if (nodeType && (relation === table || (relation === undefined && index !== undefined))) {
      const using = index === undefined ? '' : ` using ${index}`;
      scans.push({ nodeType, index, description: `${nodeType}${using} on ${table}` });
    }
    if (Array.isArray(node['Plans'])) visit(node['Plans']);
  };
  visit(root);
  return scans;
}
