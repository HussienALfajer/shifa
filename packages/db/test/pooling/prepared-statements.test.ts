// Spec 0.3-S2 criterion 7: a Drizzle named prepared statement, executed alternately for tenants
// A and B on PgBouncer's 2-connection pool, returns only the current tenant's rows every time,
// also after PostgreSQL may switch to a generic plan (more than 5 executions per server
// connection) and with `plan_cache_mode = force_generic_plan`. This exercises PgBouncer's
// `max_prepared_statements` tracking, also behind the `server_reset_query_always = 1` pooler.
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type ShifaDb } from '../../src/index.ts';
import {
  type PoolerName,
  pooledHarnessUrl,
  pooledTestDb,
  workerDatabaseName,
} from '../../test-harness/index.ts';
import {
  ensureProbe,
  poolProbe,
  recordFinding,
  seedProbe,
  serverPid,
  TENANT_A,
  TENANT_B,
  USER_A,
} from './probe.ts';

const ROUNDS = 12;
const handles: Partial<Record<PoolerName, ShifaDb>> = {};

const app = (pooler: PoolerName): ShifaDb => {
  const handle = handles[pooler];
  if (!handle) throw new Error('beforeAll did not open the pooled handles');
  return handle;
};

beforeAll(async () => {
  await ensureProbe(workerDatabaseName());
  handles.shared = pooledTestDb({ max: 4 });
  handles.reset = createDb(pooledHarnessUrl('app', workerDatabaseName(), 'reset'), { max: 4 });
  // Both tenants own a row labelled `shared`: a plan that ignored RLS would return two.
  await seedProbe(app('shared'), TENANT_A, ['shared', 'a-only']);
  await seedProbe(app('shared'), TENANT_B, ['shared', 'b-only']);
});

afterAll(async () => {
  await handles.reset?.close();
});

interface Variant {
  name: string;
  /** A constant in the statement text, so each variant's plans are counted on their own. */
  marker: string;
  forceGeneric: boolean;
  pooler: PoolerName;
}

interface Execution {
  pid: number;
  tenants: string[];
  genericPlans: number;
}

async function runPrepared(variant: Variant, tenantId: string) {
  return app(variant.pooler).withTenant(
    { tenantId, userId: USER_A },
    async (tx): Promise<Execution> => {
      if (variant.forceGeneric) {
        await tx.execute(sql`select set_config('plan_cache_mode', 'force_generic_plan', true)`);
      }
      const query = tx
        .select({
          tenantId: poolProbe.tenantId,
          marker: sql<string>`${sql.raw(`'${variant.marker}'`)}`,
        })
        .from(poolProbe)
        .where(eq(poolProbe.label, sql.placeholder('label')))
        .prepare(variant.name);
      const rows = await query.execute({ label: 'shared' });
      // Held briefly so that the A and B transactions of a round overlap on both connections.
      await tx.execute(sql`select pg_sleep(0.02)`);
      const plans = await tx.execute<{ generic: number }>(
        sql`select coalesce(sum(generic_plans), 0)::int as generic from pg_prepared_statements
             where statement like ${`%${variant.marker}%`}`,
      );
      return {
        pid: await serverPid(tx),
        tenants: rows.map((row) => row.tenantId),
        genericPlans: plans.rows[0]?.generic ?? 0,
      };
    },
  );
}

const VARIANTS: [string, Variant][] = [
  [
    'the default plan cache',
    { name: 'pool_ps', marker: 'ps_default', forceGeneric: false, pooler: 'shared' },
  ],
  [
    'plan_cache_mode = force_generic_plan',
    { name: 'pool_ps_generic', marker: 'ps_generic', forceGeneric: true, pooler: 'shared' },
  ],
  // DISCARD ALL after every transaction deallocates the server's statements: PgBouncer must
  // prepare them again on the next execution (input for the production setting, 0.3-S2c).
  [
    'server_reset_query_always = 1',
    { name: 'pool_ps_reset', marker: 'ps_reset', forceGeneric: false, pooler: 'reset' },
  ],
];

describe('named prepared statements through PgBouncer', () => {
  it.each(VARIANTS)('%s: every execution sees only its own tenant', async (_mode, variant) => {
    const perPid = new Map<number, number>();
    let wrong = 0;
    let genericPlans = 0;
    for (let round = 0; round < ROUNDS; round += 1) {
      const pair = await Promise.all([
        runPrepared(variant, TENANT_A),
        runPrepared(variant, TENANT_B),
      ]);
      for (const [index, run] of pair.entries()) {
        const expected = index === 0 ? TENANT_A : TENANT_B;
        if (run.tenants.length !== 1 || run.tenants[0] !== expected) wrong += 1;
        perPid.set(run.pid, (perPid.get(run.pid) ?? 0) + 1);
        genericPlans = Math.max(genericPlans, run.genericPlans);
      }
    }
    recordFinding(`prepared-statements-${variant.marker}`, {
      executionsPerServerPid: Object.fromEntries(perPid),
      wrong,
      maxGenericPlansSeen: genericPlans,
    });
    expect(wrong, 'executions that returned another tenant or no row').toBe(0);
    expect(perPid.size, 'both server connections were used').toBe(2);
    for (const count of perPid.values()) expect(count).toBeGreaterThan(5);
    if (variant.forceGeneric) {
      expect(genericPlans, 'this statement never ran with a generic plan').toBeGreaterThan(0);
    }
  });
});
