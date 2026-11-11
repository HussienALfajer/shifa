// The restore drill's comparisons (spec 0.2-09c criterion 6): source and restored database
// must agree on the drill rows written before T and on the migration journal, and the restore
// must keep every tenant table's RLS and the application role's limits. Each check returns a
// pass/fail and a short reason built from counts and names only, never row values.
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { TableClassification } from '../src/schema/classification.ts';
import { type Catalog, checkRlsPresence } from '../test/architecture/rls-presence.ts';
import type { DRILL_CHECKS } from './backup-drill-report.ts';

export type DrillCheckName = (typeof DRILL_CHECKS)[number];
const n = (value: number) => String(value);

export interface CheckResult {
  name: DrillCheckName;
  passed: boolean;
  reason: string;
}

export const DRILL_SCHEMA = 'drill';
/** The drill's own table sits outside `public` on purpose; the presence check reports it. */
const DRILL_TABLE_NOTICE = `${DRILL_SCHEMA}.rows: relation in schema ${DRILL_SCHEMA}`;

/** A short-lived connection as a Drizzle handle (the presence check needs `execute`). */
export async function withCatalog<T>(url: string, fn: (db: Catalog) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: url, max: 1 });
  pool.on('error', () => undefined);
  try {
    // Same cast as the presence test uses for a transaction: only `execute` is needed.
    return await fn(drizzle({ client: pool }) as unknown as Catalog);
  } finally {
    await pool.end();
  }
}

interface Digest {
  count: number;
  digest: string | null;
}

/** Count and md5 of the canonical text of the drill rows in the given batches, ordered by id. */
export async function rowsDigest(db: Catalog, batches: readonly string[]): Promise<Digest> {
  const { rows } = await db.execute<{ count: string; digest: string | null }>(sql`
    select count(*)::text as count,
           md5(string_agg(format('%s|%s|%s|%s', id, batch, payload::text,
                                 extract(epoch from created_at)), E'\n' order by id)) as digest
      from drill.rows
     where batch in (${sql.join(
       batches.map((b) => sql`${b}`),
       sql`, `,
     )})`);
  const row = rows[0];
  return { count: Number(row?.count ?? 0), digest: row?.digest ?? null };
}

/** Count and md5 of Drizzle's migration journal (hash and created_at of every entry). */
export async function journalDigest(db: Catalog): Promise<Digest> {
  const { rows } = await db.execute<{ count: string; digest: string | null }>(sql`
    select count(*)::text as count,
           md5(string_agg(format('%s|%s', hash, created_at), E'\n' order by id)) as digest
      from drizzle.__drizzle_migrations`);
  const row = rows[0];
  return { count: Number(row?.count ?? 0), digest: row?.digest ?? null };
}

const same = (a: Digest, b: Digest) => a.count === b.count && a.digest === b.digest;

export async function compareRows(
  source: Catalog,
  restored: Catalog,
  batches: readonly string[],
): Promise<CheckResult> {
  const [a, b] = await Promise.all([rowsDigest(source, batches), rowsDigest(restored, batches)]);
  const name = 'rows.baseline_and_a';
  if (a.count === 0) return { name, passed: false, reason: 'no rows in the source' };
  return same(a, b)
    ? { name, passed: true, reason: `${n(a.count)} rows, checksums equal` }
    : {
        name,
        passed: false,
        reason: `source ${n(a.count)} rows, restore ${n(b.count)} rows, checksums ${a.digest === b.digest ? 'equal' : 'differ'}`,
      };
}

export async function checkAbsent(restored: Catalog, batch: string): Promise<CheckResult> {
  const { count } = await rowsDigest(restored, [batch]);
  return count === 0
    ? { name: 'rows.b_absent', passed: true, reason: `no ${batch} rows after the target time` }
    : { name: 'rows.b_absent', passed: false, reason: `${n(count)} ${batch} rows present` };
}

export async function compareJournal(source: Catalog, restored: Catalog): Promise<CheckResult> {
  const [a, b] = await Promise.all([journalDigest(source), journalDigest(restored)]);
  const name = 'migrations.journal';
  return same(a, b) && a.count > 0
    ? { name, passed: true, reason: `${n(a.count)} migrations, identical` }
    : {
        name,
        passed: false,
        reason: `source ${n(a.count)} migrations, restore ${n(b.count)}, ${a.digest === b.digest ? 'same' : 'different'} hashes`,
      };
}

/** The 0.2-06b presence check on the restore; the drill's own table is the one allowed notice. */
export async function checkRls(
  restored: Catalog,
  classification: TableClassification,
): Promise<CheckResult> {
  const violations = (await checkRlsPresence(restored, classification)).filter(
    (v) => !v.startsWith(DRILL_TABLE_NOTICE),
  );
  const tenantTables = Object.values(classification).filter((c) => c.kind === 'tenant').length;
  return violations.length === 0
    ? {
        name: 'rls.presence',
        passed: true,
        reason: `${n(tenantTables)} tenant tables, no violations`,
      }
    : { name: 'rls.presence', passed: false, reason: violations.slice(0, 5).join('; ') };
}

/** shifa_app: not superuser, not BYPASSRLS, owns no relation (ADR-0004). */
export async function checkAppRole(restored: Catalog): Promise<CheckResult> {
  const { rows } = await restored.execute<{
    superuser: boolean;
    bypass: boolean;
    owned: string;
  }>(sql`
    select r.rolsuper as superuser, r.rolbypassrls as bypass,
           (select count(*) from pg_class c where c.relowner = r.oid)::text as owned
      from pg_roles r where r.rolname = 'shifa_app'`);
  const role = rows[0];
  const name = 'roles.app_not_owner';
  if (!role) return { name, passed: false, reason: 'role shifa_app missing' };
  const problems = [
    role.superuser && 'superuser',
    role.bypass && 'BYPASSRLS',
    role.owned !== '0' && `owns ${role.owned} relations`,
  ].filter(Boolean);
  return problems.length === 0
    ? { name, passed: true, reason: 'not superuser, no BYPASSRLS, owns nothing' }
    : { name, passed: false, reason: problems.join(', ') };
}
