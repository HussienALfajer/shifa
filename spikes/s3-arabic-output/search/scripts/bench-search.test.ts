// Search bench (criterion 11, report only, no threshold): p50/p95 of the search query at the
// `load` volume (and for one 50,000-patient tenant) on both key strategies, inside withTenant()
// as shifa_app, plus the EXPLAIN plan (literals scrubbed).
// Run by `pnpm --filter @shifa-spike/s3-search bench:search` (a Vitest run, so it gets the
// @shifa/db harness). Writes `.verify/s3/search-bench.json`: versions, machine, timings; no names
// or search terms.
import { cpus, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { ownerDb, testDb } from '@shifa/db/testing';
import { createRandom, DEFAULT_LOAD_PARAMS, type LoadParams } from '@shifa/testing';
import { sql } from 'drizzle-orm';
import { expect, it } from 'vitest';
import { normaliseName } from '../src/normalise.ts';
import { writeReport } from '../src/report.ts';
import { SEARCH_TABLES, SIMILARITY_THRESHOLD, searchPatients, searchSql } from '../src/search.ts';
import { RULE_VARIANTS } from '../src/variants.ts';
import { resetS3, seedLoad } from '../test/db.ts';

const WARMUP = Number(process.env['BENCH_SEARCH_WARMUP'] ?? 100);
const ITERATIONS = Number(process.env['BENCH_SEARCH_ITERATIONS'] ?? 1000);
const USER_ID = '00000000-0000-4000-8000-000000000001';

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;

/** Plan lines without costs and without literals (the search key is a synthetic name). */
const scrubPlan = (plan: string[]) =>
  plan.map((line) =>
    line
      .trim()
      .replace(/\(cost=.*$/, '')
      .replace(/'[^']*'/g, "'…'")
      .trim(),
  );

/** p50/p95 per key strategy for one seeded volume; records which index the planner picks. */
async function measure(load: LoadParams): Promise<Record<string, unknown>> {
  await resetS3();
  const patients = await seedLoad(load);
  const random = createRandom(4_004);
  const queries = Array.from({ length: WARMUP + ITERATIONS }, (_, index) => {
    const r = random.fork(String(index));
    const patient = r.pick(patients);
    const typed = r.pick(RULE_VARIANTS).apply(patient.displayName, r) ?? patient.displayName;
    return { tenantId: patient.tenantId, key: normaliseName(typed) };
  });
  const results: Record<string, unknown> = {
    patients: patients.length,
    tenants: new Set(patients.map((p) => p.tenantId)).size,
  };
  for (const table of SEARCH_TABLES) {
    const times: number[] = [];
    for (const [index, q] of queries.entries()) {
      const start = performance.now();
      await testDb().withTenant({ tenantId: q.tenantId, userId: USER_ID }, (tx) =>
        searchPatients(tx, table, q.key),
      );
      if (index >= WARMUP) times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const sample = queries[0];
    if (!sample) throw new Error('no queries');
    const plan = await testDb().withTenant(
      { tenantId: sample.tenantId, userId: USER_ID },
      async (tx) => {
        const { rows } = await tx.execute<{ 'QUERY PLAN': string }>(
          sql`explain ${searchSql(table, sample.key)}`,
        );
        return rows.map((row) => row['QUERY PLAN']);
      },
    );
    results[table] = {
      p50_ms: Number(percentile(times, 50).toFixed(3)),
      p95_ms: Number(percentile(times, 95).toFixed(3)),
      max_ms: Number((times.at(-1) ?? 0).toFixed(3)),
      uses_gin_index: plan.some((line) => line.includes(`${table}_name_key`)),
      plan_nodes: scrubPlan(plan),
    };
  }
  return results;
}

it('measures search latency at the load volume and for one large tenant', async () => {
  const scenarios = {
    load: await measure(DEFAULT_LOAD_PARAMS),
    one_large_tenant: await measure({ tenants: 1, patientsPerTenant: 50_000 }),
  };
  // Recorded, not asserted: under RLS the planner did not use the trigram GIN index even for
  // one 50,000-patient tenant. pg_trgm's `%` is not LEAKPROOF, so it may not run in an index
  // scan ahead of the policy qual (report §5, ADR-0034).
  // Check before writing: the workflow uploads .verify/s3 even when this test fails.
  expect(JSON.stringify(scenarios)).not.toMatch(/[؀-ۿ]/u);
  const { rows } = await ownerDb().execute<{ server_version: string; trgm: string }>(
    sql`select current_setting('server_version') as server_version,
               (select extversion from pg_extension where extname = 'pg_trgm') as trgm`,
  );
  const path = await writeReport('search-bench.json', {
    warmup: WARMUP,
    iterations: ITERATIONS,
    similarity_threshold: SIMILARITY_THRESHOLD,
    postgres: rows[0]?.server_version,
    pg_trgm: rows[0]?.trgm,
    machine: {
      cpus: cpus().length,
      cpu: cpus()[0]?.model,
      ram_gb: Math.round(totalmem() / 2 ** 30),
    },
    scenarios,
  });
  process.stdout.write(`bench:search: ${JSON.stringify(scenarios, null, 2)}
wrote ${path}
`);
}, 1_800_000);
