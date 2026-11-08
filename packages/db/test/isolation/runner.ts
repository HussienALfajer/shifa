// Cross-tenant isolation runner (0.2-06b, ADR-0004). Seeds tenants A and B as shifa_app, then
// proves that inside A no read path returns B's rows and no write reaches B's rows. Returns one
// message per finding (empty = isolated); messages name the table and the path.
import { sql } from 'drizzle-orm';
import type { ShifaDb, Tx } from '../../src/index.ts';
import type { TableClassification } from '../../src/schema/classification.ts';
import { ownerDb } from '../../test-harness/index.ts';
import type { IsolationCase, TenantRow } from './define.ts';

export const TENANT_A = '1a1a1a1a-0000-4000-8000-00000000000a';
export const TENANT_B = '2b2b2b2b-0000-4000-8000-00000000000b';
const USER = '3c3c3c3c-0000-4000-8000-00000000000c';

/** Tenant tables without a case, and cases whose table is not a tenant table. */
export function coverageGaps(
  classification: TableClassification,
  cases: readonly IsolationCase[],
): string[] {
  const covered = new Set(cases.map((c) => c.table));
  const out: string[] = [];
  for (const [table, cls] of Object.entries(classification)) {
    if (cls.kind === 'tenant' && !covered.has(table)) {
      out.push(`${table}: tenant table has no isolation case; add one in test/isolation/cases/`);
    }
  }
  for (const table of covered) {
    if (classification[table]?.kind !== 'tenant') {
      out.push(`${table}: has an isolation case but is not classified as tenant`);
    }
  }
  return out;
}

function tenantOf(row: TenantRow): unknown {
  return row['tenant_id'] ?? row['tenantId'];
}

const sqlState = (err: unknown): string | undefined =>
  typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : undefined;

/** Runs `fn` inside tenant `tenantId`; returns the error it threw, or undefined. */
async function attempt(db: ShifaDb, tenantId: string, fn: (tx: Tx) => Promise<unknown>) {
  try {
    await db.withTenant({ tenantId, userId: USER }, fn);
    return undefined;
  } catch (err) {
    return err;
  }
}

/** B's rows as B sees them: physical row ids, which change on any UPDATE. */
async function rowsOfB(db: ShifaDb, t: ReturnType<typeof sql.identifier>): Promise<string[]> {
  const { rows } = await db.withTenant({ tenantId: TENANT_B, userId: USER }, (tx) =>
    tx.execute<{ id: string }>(
      sql`select ctid::text as id from ${t} where tenant_id = ${TENANT_B} order by 1`,
    ),
  );
  return rows.map((r) => r.id);
}

/** A forged write must be refused by RLS (SQLSTATE 42501), not succeed or fail otherwise. */
function refusedByRls(err: unknown, what: string, table: string): string[] {
  if (err === undefined) return [`${table}: ${what} inside tenant A was accepted`];
  const code = sqlState(err);
  if (code !== '42501') {
    return [`${table}: ${what} failed with SQLSTATE ${code ?? 'none'} instead of an RLS refusal`];
  }
  return [];
}

export async function runIsolationCase(db: ShifaDb, c: IsolationCase): Promise<string[]> {
  const t = sql.identifier(c.table);
  const out: string[] = [];
  // TRUNCATE ignores RLS; the owner only clears, it never writes tenant rows.
  await ownerDb().execute(sql`truncate ${t}`);
  for (const tenantId of [TENANT_A, TENANT_B]) {
    await db.withTenant({ tenantId, userId: USER }, (tx) => c.seed(tx, tenantId));
  }
  const seededB = await rowsOfB(db, t);
  if (seededB.length === 0) return [`${c.table}: seed wrote no rows for tenant B`];

  for (const [name, path] of Object.entries(c.paths)) {
    const rows = await db.withTenant({ tenantId: TENANT_A, userId: USER }, path);
    if (rows.some((r) => tenantOf(r) === undefined)) {
      out.push(`${c.table}: read path "${name}" returns rows without tenant_id; select it`);
      continue;
    }
    const foreign = rows.filter((r) => tenantOf(r) !== TENANT_A).length;
    if (foreign > 0) {
      out.push(`${c.table}: read path "${name}" returned ${String(foreign)} row(s) of tenant B`);
    }
  }

  out.push(
    ...refusedByRls(
      await attempt(db, TENANT_A, (tx) => c.seed(tx, TENANT_B)),
      "insert with tenant B's tenant_id",
      c.table,
    ),
  );
  const moved = await attempt(db, TENANT_A, (tx) =>
    tx.execute(sql`update ${t} set tenant_id = ${TENANT_B}`),
  );
  out.push(...refusedByRls(moved, 'update moving rows to tenant B', c.table));

  const beforeB = await rowsOfB(db, t);
  await db.withTenant({ tenantId: TENANT_A, userId: USER }, (tx) =>
    tx.execute(sql`update ${t} set tenant_id = tenant_id`),
  );
  const afterUpdate = await rowsOfB(db, t);
  if (afterUpdate.join() !== beforeB.join()) {
    out.push(`${c.table}: update without WHERE inside tenant A changed tenant B's rows`);
  }
  await db.withTenant({ tenantId: TENANT_A, userId: USER }, (tx) =>
    tx.execute(sql`delete from ${t}`),
  );
  if ((await rowsOfB(db, t)).length !== afterUpdate.length) {
    out.push(`${c.table}: delete without WHERE inside tenant A removed tenant B's rows`);
  }
  await ownerDb().execute(sql`truncate ${t}`);
  return out;
}
