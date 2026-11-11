// Spec 0.2-09c criterion 6: the restore drill's comparisons report equal for identical data and
// unequal for one changed row, a missing migration journal entry and NO FORCE ROW LEVEL SECURITY.
// Two pristine clones of the migrated template stand in for source and restore; every change
// to the "restore" happens inside an owner transaction that is rolled back.
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  checkAbsent,
  checkAppRole,
  checkRls,
  compareJournal,
  compareRows,
  shortReason,
} from '../scripts/backup-drill-checks.ts';
import { TABLE_CLASSIFICATION, type TableClassification } from '../src/schema/classification.ts';
import { ensureWorkerDatabase, ownerDb, type RawDb, superuserDb } from '../test-harness/index.ts';
import type { Catalog } from './architecture/rls-presence.ts';

let source: RawDb;
let restore: RawDb;

/** The drill table with three fixed rows (one statement per execute). */
function drillTable() {
  return [
    sql`create schema if not exists drill`,
    sql`create table if not exists drill.rows (
      id uuid primary key, batch text not null, payload jsonb not null, created_at timestamptz not null)`,
    sql`truncate drill.rows`,
    sql`insert into drill.rows values
      ('00000000-0000-4000-8000-000000000001', 'baseline', '{"n": 1}', '2026-11-11T10:00:00Z'),
      ('00000000-0000-4000-8000-000000000002', 'a', '{"n": 2}', '2026-11-11T10:00:01Z'),
      ('00000000-0000-4000-8000-000000000003', 'b', '{"n": 3}', '2026-11-11T10:00:02Z')`,
  ];
}

beforeAll(async () => {
  // Numeric pool ids reserved for this file (9997: rls-presence, 9998: hardening).
  source = ownerDb(await ensureWorkerDatabase('9995'));
  restore = ownerDb(await ensureWorkerDatabase('9996'));
  for (const db of [source, restore]) {
    for (const statement of drillTable()) await db.execute(statement);
  }
});

class RolledBack extends Error {}

/** Runs `change` then `check` on the restore inside a transaction that is rolled back. */
async function withChange<T>(
  change: ReturnType<typeof sql>[],
  check: (db: Catalog) => Promise<T>,
): Promise<T> {
  let result: T | undefined;
  try {
    await restore.transaction(async (tx) => {
      for (const statement of change) await tx.execute(statement);
      result = await check(tx as unknown as Catalog);
      throw new RolledBack();
    });
  } catch (err) {
    if (!(err instanceof RolledBack)) throw err;
  }
  return result as T;
}

describe('restore drill comparisons', () => {
  it('reports equal rows, journal, RLS and role on identical databases', async () => {
    expect((await compareRows(source, restore, ['baseline', 'a'])).passed).toBe(true);
    expect(await compareJournal(source, restore)).toMatchObject({ passed: true });
    expect(await checkRls(restore, TABLE_CLASSIFICATION)).toMatchObject({ passed: true });
    expect(await checkAppRole(restore)).toMatchObject({ passed: true });
  });

  it('reports unequal rows when one row changed, without showing values', async () => {
    const result = await withChange(
      [sql`update drill.rows set payload = '{"n": 99}' where batch = 'a'`],
      (db) => compareRows(source, db, ['baseline', 'a']),
    );
    expect(result).toEqual({
      name: 'rows.baseline_and_a',
      passed: false,
      reason: 'source 2 rows, restore 2 rows, checksums differ',
    });
  });

  it('reports batch B present after the target time', async () => {
    expect(await checkAbsent(restore, 'b')).toMatchObject({
      passed: false,
      reason: '1 b rows present',
    });
    const absent = await withChange([sql`delete from drill.rows where batch = 'b'`], (db) =>
      checkAbsent(db, 'b'),
    );
    expect(absent.passed).toBe(true);
  });

  it('reports a missing migration journal entry', async () => {
    const result = await withChange(
      [
        sql`delete from drizzle.__drizzle_migrations where id = (select max(id) from drizzle.__drizzle_migrations)`,
      ],
      (db) => compareJournal(source, db),
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/^source \d+ migrations, restore \d+, different hashes$/);
  });

  it('reports NO FORCE ROW LEVEL SECURITY on a tenant table', async () => {
    const probe = [
      sql`create table presence_probe (id uuid primary key, tenant_id uuid not null)`,
      sql`alter table presence_probe enable row level security`,
      sql`alter table presence_probe force row level security`,
      sql`create policy tenant_isolation on presence_probe
            using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id())`,
    ];
    const asTenant: TableClassification = {
      ...TABLE_CLASSIFICATION,
      presence_probe: { kind: 'tenant' },
    };
    expect(await withChange(probe, (db) => checkRls(db, asTenant))).toMatchObject({ passed: true });
    const weakened = await withChange(
      [...probe, sql`alter table presence_probe no force row level security`],
      (db) => checkRls(db, asTenant),
    );
    expect(weakened.passed).toBe(false);
    expect(weakened.reason).toContain('presence_probe: FORCE ROW LEVEL SECURITY is off');
  });

  it('reports shifa_app as a member of another role (SET ROLE would bypass RLS)', async () => {
    let result: Awaited<ReturnType<typeof checkAppRole>> | undefined;
    try {
      // Roles are cluster-wide: grant as superuser inside a transaction that is rolled back.
      await superuserDb().transaction(async (tx) => {
        await tx.execute(sql`grant shifa_owner to shifa_app`);
        result = await checkAppRole(tx as unknown as Catalog);
        throw new RolledBack();
      });
    } catch (err) {
      if (!(err instanceof RolledBack)) throw err;
    }
    expect(result).toMatchObject({ passed: false, reason: 'member of another role' });
    expect((await checkAppRole(restore)).passed).toBe(true);
  });

  it('cuts a long list of violations to fit the report', () => {
    const reason = shortReason(
      Array.from(
        { length: 20 },
        (_, i) => `a_long_tenant_table_${String(i)}: ENABLE ROW LEVEL SECURITY is off`,
      ),
    );
    expect(reason.length).toBeLessThanOrEqual(400);
    expect(reason.startsWith('20 violations: ')).toBe(true);
  });
});
