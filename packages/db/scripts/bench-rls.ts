// The RLS bench (spec 0.3-S2 criterion 11, report only, no threshold). Run by
// `pnpm --filter @shifa/db bench:rls`; needs Docker. Under the DB test lock it starts its own
// harness (PostgreSQL + PgBouncer), clones the template into BENCH_DATABASE, fills the plan probe
// with the `load` preset's volume, and times the same rows through PgBouncer:
//   (a) as shifa_app, under RLS, with the application query that names no tenant (the policy
//       picks it);
//   (b) as shifa_bench_bypass, a BYPASSRLS login created only inside this throw-away container
//       (never in roles.sql or migrations), with the tenant named explicitly.
// Both run BEGIN; set_config('app.tenant_id', $1, true); the query; COMMIT, interleaved, and
// return the same 20 rows. Writes `.verify/s2-bench/report.json`; prints no credentials or rows.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { drizzle } from 'drizzle-orm/node-postgres';
import { type ClientBase, Pool } from 'pg';
import {
  acquireDbTestLock,
  type HarnessContainer,
  startHarnessContainer,
} from '../test-harness/container.ts';
import { cloneTemplate, withPool } from '../test-harness/context.ts';
import { assertNoSecrets, type BenchReport, summarize, writeBenchReport } from './bench-report.ts';
import {
  createPlanProbe,
  fillPlanProbe,
  PLAN_PROBE_TABLE,
  POLICY_LATEST_TEXT,
  planProbeTenants,
  planScans,
  ROWS_PER_TENANT,
  TENANT_LATEST_TEXT,
} from './plan-probe.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const BENCH_DATABASE = 'shifa_test_9990';
const BYPASS_ROLE = 'shifa_bench_bypass';
const PAGE = 20;

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a whole number`);
  return value;
}

const WARMUP = positiveInt('BENCH_RLS_WARMUP', 200);
const ITERATIONS = Math.max(1, positiveInt('BENCH_RLS_ITERATIONS', 2000));

const say = (line: string) => process.stdout.write(`bench:rls: ${line}\n`);

type Side = 'rls' | 'bypass';

/**
 * Under RLS the application query names no tenant (the policy picks it); without RLS the same
 * rows need the tenant named explicitly.
 */
const queryFor = (side: Side, tenantId: string): [string, string[]] =>
  side === 'rls' ? [POLICY_LATEST_TEXT, []] : [TENANT_LATEST_TEXT, [tenantId]];

/** One measured transaction; checks it saw exactly one page of its own tenant's rows. */
async function timedTransaction(client: ClientBase, side: Side, tenantId: string): Promise<number> {
  const [text, values] = queryFor(side, tenantId);
  const start = performance.now();
  await client.query('BEGIN');
  try {
    await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
    const { rows } = await client.query<{ tenant_id: string }>(text, values);
    await client.query('COMMIT');
    const elapsed = performance.now() - start;
    if (rows.length !== PAGE || rows.some((row) => row.tenant_id !== tenantId)) {
      throw new Error(
        `expected ${String(PAGE)} rows of the current tenant, got ${String(rows.length)}`,
      );
    }
    return elapsed;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
}

/** The index the query's plan uses for this client (or `none`). */
async function planIndex(client: ClientBase, side: Side, tenantId: string): Promise<string> {
  const [text, values] = queryFor(side, tenantId);
  await client.query('BEGIN');
  try {
    await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
    const { rows } = await client.query<{ 'QUERY PLAN': unknown }>(
      `explain (format json) ${text}`,
      values,
    );
    const scans = planScans(rows[0]?.['QUERY PLAN'], PLAN_PROBE_TABLE);
    return scans.find((scan) => scan.index !== undefined)?.index ?? 'none';
  } finally {
    await client.query('ROLLBACK');
  }
}

function drizzleVersion(): string {
  const file = join(import.meta.dirname, '..', 'node_modules', 'drizzle-orm', 'package.json');
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown };
  return typeof parsed.version === 'string' ? parsed.version : 'unknown';
}

async function prepare(container: HarnessContainer, bypassPassword: string): Promise<void> {
  await withPool(container.url('superuser', 'postgres'), async (pool) => {
    await cloneTemplate(pool, BENCH_DATABASE);
    // Only in this run's container; the password is per-run hex, never printed.
    await pool.query(`CREATE ROLE ${BYPASS_ROLE} LOGIN BYPASSRLS PASSWORD '${bypassPassword}'`);
  });
  const ownerPool = new Pool({ connectionString: container.url('owner', BENCH_DATABASE), max: 1 });
  try {
    const owner = drizzle({ client: ownerPool });
    await owner.execute(createPlanProbe());
    await fillPlanProbe(owner, planProbeTenants());
    await ownerPool.query(`GRANT USAGE ON SCHEMA public TO ${BYPASS_ROLE}`);
    await ownerPool.query(`GRANT SELECT ON ${PLAN_PROBE_TABLE} TO ${BYPASS_ROLE}`);
    await ownerPool.query(`GRANT EXECUTE ON FUNCTION current_tenant_id() TO ${BYPASS_ROLE}`);
  } finally {
    await ownerPool.end();
  }
}

async function measure(container: HarnessContainer, bypassPassword: string): Promise<BenchReport> {
  const tenants = planProbeTenants();
  const appPool = new Pool({
    connectionString: container.url('app', BENCH_DATABASE, { via: 'pooler' }),
    max: 1,
  });
  const bypassPool = new Pool({
    connectionString: container.loginUrl(
      { user: BYPASS_ROLE, password: bypassPassword },
      BENCH_DATABASE,
      { via: 'pooler' },
    ),
    max: 1,
  });
  for (const pool of [appPool, bypassPool]) pool.on('error', () => undefined);
  const app = await appPool.connect();
  const bypass = await bypassPool.connect();
  try {
    const { rows: who } = await bypass.query<{ bypass: boolean }>(
      'select rolbypassrls as bypass from pg_roles where rolname = current_user',
    );
    if (who[0]?.bypass !== true) throw new Error('the bench role does not bypass RLS');
    const samples = { rls: [] as number[], bypass: [] as number[] };
    for (let i = 0; i < WARMUP + ITERATIONS; i += 1) {
      const tenantId = tenants[i % tenants.length] ?? '';
      // Alternate which goes first so neither always runs on a warmer cache.
      const order = i % 2 === 0 ? (['rls', 'bypass'] as const) : (['bypass', 'rls'] as const);
      for (const which of order) {
        const elapsed = await timedTransaction(which === 'rls' ? app : bypass, which, tenantId);
        if (i >= WARMUP) samples[which].push(elapsed);
      }
    }
    const probeTenant = tenants[0] ?? '';
    const { rows: version } = await app.query<{ v: string }>(
      "select current_setting('server_version') as v",
    );
    const pgbouncer = await withPool(container.poolerConsoleUrl(), async (pool) => {
      const { rows } = await pool.query<{ version: string }>('SHOW VERSION');
      return rows[0]?.version ?? 'unknown';
    });
    const rls = summarize(samples.rls);
    const off = summarize(samples.bypass);
    const ratio = (a: number, b: number) =>
      Math.max(0.01, b > 0 ? Math.round((a / b) * 100) / 100 : 1);
    const cpu = cpus();
    return {
      date: new Date().toISOString(),
      query: `latest ${String(PAGE)} rows of one tenant by created_at (${PLAN_PROBE_TABLE}); RLS side: policy only, bypass side: explicit tenant filter`,
      tenants: tenants.length,
      rowsPerTenant: ROWS_PER_TENANT,
      warmup: WARMUP,
      iterations: ITERATIONS,
      rls: { role: 'shifa_app', ...rls, planIndex: await planIndex(app, 'rls', probeTenant) },
      bypass: {
        role: BYPASS_ROLE,
        ...off,
        planIndex: await planIndex(bypass, 'bypass', probeTenant),
      },
      overhead: {
        p50Ratio: ratio(rls.p50Ms, off.p50Ms),
        p95Ratio: ratio(rls.p95Ms, off.p95Ms),
      },
      versions: {
        pgbouncer,
        postgres: version[0]?.v ?? 'unknown',
        drizzle: drizzleVersion(),
        node: process.version,
      },
      machine: {
        cpuModel: (cpu[0]?.model ?? 'unknown').replace(/\s+/g, ' ').trim() || 'unknown',
        cores: Math.max(1, cpu.length),
        ramGb: Math.round((totalmem() / 1024 ** 3) * 10) / 10,
        platform: `${process.platform} ${process.arch}`,
      },
    };
  } finally {
    app.release();
    bypass.release();
    await Promise.all([appPool.end(), bypassPool.end()]);
  }
}

async function main(): Promise<void> {
  const release = await acquireDbTestLock();
  let container: HarnessContainer | undefined;
  try {
    const bypassPassword = randomBytes(16).toString('hex');
    say('starting PostgreSQL and PgBouncer');
    container = await startHarnessContainer({ poolerUsers: [[BYPASS_ROLE, bypassPassword]] });
    say(
      `filling ${PLAN_PROBE_TABLE} (${String(planProbeTenants().length)} tenants x ${String(ROWS_PER_TENANT)} rows)`,
    );
    await prepare(container, bypassPassword);
    say(`measuring: ${String(WARMUP)} warm-up + ${String(ITERATIONS)} iterations each`);
    const report = await measure(container, bypassPassword);
    const { info } = container;
    assertNoSecrets(report, [
      bypassPassword,
      info.superuserPassword,
      info.ownerPassword,
      info.appPassword,
      info.poolerStatsPassword,
    ]);
    const dir = writeBenchReport(ROOT, report);
    say(
      `RLS (shifa_app) p50 ${String(report.rls.p50Ms)} ms, p95 ${String(report.rls.p95Ms)} ms; ` +
        `BYPASSRLS p50 ${String(report.bypass.p50Ms)} ms, p95 ${String(report.bypass.p95Ms)} ms; ` +
        `ratio p50 ${String(report.overhead.p50Ratio)}, p95 ${String(report.overhead.p95Ratio)}`,
    );
    say(`plan index: RLS ${report.rls.planIndex}, BYPASSRLS ${report.bypass.planIndex}`);
    say(`report: ${join(dir, 'report.json')}`);
  } finally {
    try {
      await container?.stop();
    } finally {
      release();
    }
  }
}

main().catch((err: unknown) => {
  // Only the message: never a connection string (pg errors carry none, but be strict).
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`bench:rls failed: ${message.replace(/postgres(ql)?:\/\/\S+/g, '<url>')}\n`);
  process.exit(1);
});
