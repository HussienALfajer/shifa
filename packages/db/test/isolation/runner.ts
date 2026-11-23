// Cross-tenant isolation runner (0.2-06b, ADR-0004). Seeds tenants A and B as shifa_app, then
// proves that inside A no read path returns B's rows and no write reaches B's rows. Returns one
// message per finding (empty = isolated); messages name the table and the path.
// A-01-01: each case starts from an empty database with the `tenant` rows of A and B, and its
// prepare() writes parent rows; tables classified 'append-only' or 'read-only' must refuse
// shifa_app's writes by privileges ("permission denied"), not by a policy (backlog B7).
import { sql } from 'drizzle-orm';
import type { ShifaDb, Tx } from '../../src/index.ts';
import { TABLE_CLASSIFICATION, type TableClassification } from '../../src/schema/classification.ts';
import { createTestTenants, ownerDb, withoutTenant } from '../../test-harness/index.ts';
import type { IsolationCase, TenantRow } from './define.ts';

export const TENANT_A = '1a1a1a1a-0000-4000-8000-00000000000a';
export const TENANT_B = '2b2b2b2b-0000-4000-8000-00000000000b';
const USER = '3c3c3c3c-0000-4000-8000-00000000000c';

type Access = 'read-write' | 'append-only' | 'read-only';

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

function accessOf(classification: TableClassification, table: string): Access {
  const cls = Object.hasOwn(classification, table) ? classification[table] : undefined;
  return cls?.kind === 'tenant' ? (cls.access ?? 'read-write') : 'read-write';
}

function tenantOf(row: TenantRow): unknown {
  return row['tenant_id'] ?? row['tenantId'];
}

const sqlState = (err: unknown): string | undefined =>
  typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : undefined;
const messageOf = (err: unknown): string => (err instanceof Error ? err.message : '');

/** Where a check runs: inside tenant A, or with no tenant context. */
interface Scope {
  readonly where: string;
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

function scopes(db: ShifaDb): { tenantA: Scope; noTenant: Scope } {
  return {
    tenantA: {
      where: 'inside tenant A',
      run: (fn) => db.withTenant({ tenantId: TENANT_A, userId: USER }, fn),
    },
    noTenant: { where: 'without a tenant context', run: (fn) => withoutTenant(db, fn) },
  };
}

/** Runs `fn` in `scope`; returns the error it threw, or undefined. */
async function attempt(scope: Scope, fn: (tx: Tx) => Promise<unknown>): Promise<unknown> {
  try {
    await scope.run(fn);
    return undefined;
  } catch (err) {
    return err;
  }
}

const describeError = (err: unknown): string => `SQLSTATE ${sqlState(err) ?? 'none'}`;

/** B's rows as B sees them: physical row ids, which change on any UPDATE. */
async function rowsOfB(db: ShifaDb, t: ReturnType<typeof sql.identifier>): Promise<string[]> {
  const { rows } = await db.withTenant({ tenantId: TENANT_B, userId: USER }, (tx) =>
    tx.execute<{ id: string }>(
      sql`select ctid::text as id from ${t} where tenant_id = ${TENANT_B} order by 1`,
    ),
  );
  return rows.map((r) => r.id);
}

/**
 * A forged write must be refused by this table's RLS policy (SQLSTATE 42501, the message naming
 * the table): a refusal from another table, or another error, proves nothing about this one.
 */
function refusedByRls(err: unknown, what: string, table: string, scope: Scope): string[] {
  if (err === undefined) return [`${table}: ${what} ${scope.where} was accepted`];
  if (sqlState(err) !== '42501') {
    return [
      `${table}: ${what} ${scope.where} failed with ${describeError(err)}, not an RLS refusal`,
    ];
  }
  const refusedBy = /for table "([^"]+)"/.exec(messageOf(err))?.[1];
  if (refusedBy !== table) {
    return [
      `${table}: ${what} ${scope.where} was refused for table "${refusedBy ?? 'unknown'}"; seed must write only to ${table}`,
    ];
  }
  return [];
}

/** For append-only and read-only tables: shifa_app holds no privilege for this write at all. */
function refusedByPrivilege(err: unknown, what: string, table: string, scope: Scope): string[] {
  const denied = new RegExp(`^permission denied for table ${table}$`);
  if (sqlState(err) === '42501' && denied.test(messageOf(err))) return [];
  const seen = err === undefined ? 'it was accepted' : describeError(err);
  return [`${table}: ${what} ${scope.where} was not refused by privileges (${seen})`];
}

type Path = IsolationCase['paths'][string];

/** Inside A every path returns some of A's rows and none of B's. */
async function readsInTenantA(scope: Scope, table: string, paths: [string, Path][]) {
  const out: string[] = [];
  for (const [name, path] of paths) {
    const rows = await scope.run(path);
    if (rows.some((r) => tenantOf(r) === undefined)) {
      out.push(`${table}: read path "${name}" returns rows without tenant_id; select it`);
      continue;
    }
    if (rows.length === 0) {
      out.push(`${table}: read path "${name}" returned no rows of tenant A; it proves nothing`);
      continue;
    }
    const foreign = rows.filter((r) => tenantOf(r) !== TENANT_A).length;
    if (foreign > 0) {
      out.push(`${table}: read path "${name}" returned ${String(foreign)} row(s) of tenant B`);
    }
  }
  return out;
}

/** With no tenant context, FORCE RLS shows no tenant rows at all. */
async function readsWithoutTenant(scope: Scope, table: string, paths: [string, Path][]) {
  const out: string[] = [];
  for (const [name, path] of paths) {
    const rows = await scope.run(path);
    if (rows.length > 0) {
      out.push(
        `${table}: ${scope.where}, read path "${name}" returned ${String(rows.length)} row(s)`,
      );
    }
  }
  return out;
}

/** Seeds `tenantId` as shifa_app, or for a read-only table as the owner in that tenant. */
function seeder(db: ShifaDb, c: IsolationCase, access: Access) {
  return async (tenantId: string): Promise<void> => {
    if (access !== 'read-only') {
      await db.withTenant({ tenantId, userId: USER }, (tx) => c.seed(tx, tenantId));
      return;
    }
    // The owner is bound by FORCE RLS too: it writes under the tenant's own context.
    await ownerDb().transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
      await c.seed(tx as unknown as Tx, tenantId);
    });
  };
}

export async function runIsolationCase(
  db: ShifaDb,
  c: IsolationCase,
  classification: TableClassification = TABLE_CLASSIFICATION,
): Promise<string[]> {
  const t = sql.identifier(c.table);
  const access = accessOf(classification, c.table);
  const out: string[] = [];
  await createTestTenants(TENANT_A, TENANT_B);
  await c.prepare?.({
    tenants: [TENANT_A, TENANT_B],
    inTenant: (tenantId, fn) => db.withTenant({ tenantId, userId: USER }, fn),
  });
  const seed = seeder(db, c, access);
  // TRUNCATE ignores RLS; the owner only clears (and seeds read-only tables in-tenant).
  const reseed = async () => {
    await ownerDb().execute(sql`truncate ${t} cascade`);
    for (const tenantId of [TENANT_A, TENANT_B]) await seed(tenantId);
  };
  await reseed();
  const seededB = await rowsOfB(db, t);
  if (seededB.length === 0) return [`${c.table}: seed wrote no rows for tenant B`];

  const { tenantA, noTenant } = scopes(db);
  // The runner's own unfiltered read: a case's paths may filter by tenant and hide a leak.
  const paths: [string, Path][] = [
    ['unfiltered select', async (tx) => (await tx.execute(sql`select tenant_id from ${t}`)).rows],
    ...Object.entries(c.paths),
  ];
  out.push(...(await readsInTenantA(tenantA, c.table, paths)));
  out.push(...(await readsWithoutTenant(noTenant, c.table, paths)));

  const insertRefused = access === 'read-only' ? refusedByPrivilege : refusedByRls;
  const changeRefused = access === 'read-write' ? refusedByRls : refusedByPrivilege;
  const forged = "insert with tenant B's tenant_id";
  for (const scope of [tenantA, noTenant]) {
    const err = await attempt(scope, (tx) => c.seed(tx, TENANT_B));
    out.push(...insertRefused(err, forged, c.table, scope));
  }
  const moved = await attempt(tenantA, (tx) =>
    tx.execute(sql`update ${t} set tenant_id = ${TENANT_B}`),
  );
  out.push(...changeRefused(moved, 'update moving rows to tenant B', c.table, tenantA));

  // A constant SET reads no column, so only the UPDATE policy decides which rows it reaches.
  const beforeB = await rowsOfB(db, t);
  const updated = await attempt(tenantA, (tx) =>
    tx.execute(sql`update ${t} set tenant_id = ${TENANT_A}`),
  );
  if (access !== 'read-write') {
    out.push(...refusedByPrivilege(updated, 'update without WHERE', c.table, tenantA));
  } else if (updated !== undefined) {
    out.push(
      `${c.table}: update without WHERE inside tenant A failed with ${describeError(updated)}`,
    );
  }
  if ((await rowsOfB(db, t)).join() !== beforeB.join()) {
    out.push(`${c.table}: update without WHERE inside tenant A changed tenant B's rows`);
  }
  // A leaky UPDATE may have moved B's rows away; start the DELETE check from fresh data.
  await reseed();
  const beforeDelete = await rowsOfB(db, t);
  const deleted = await attempt(tenantA, (tx) => tx.execute(sql`delete from ${t}`));
  if (access !== 'read-write') {
    out.push(...refusedByPrivilege(deleted, 'delete without WHERE', c.table, tenantA));
  } else if (deleted !== undefined) {
    out.push(
      `${c.table}: delete without WHERE inside tenant A failed with ${describeError(deleted)}`,
    );
  }
  if ((await rowsOfB(db, t)).join() !== beforeDelete.join()) {
    out.push(`${c.table}: delete without WHERE inside tenant A removed tenant B's rows`);
  }
  await ownerDb().execute(sql`truncate ${t} cascade`);
  return out;
}
