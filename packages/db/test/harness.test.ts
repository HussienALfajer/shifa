// One cloned database per Vitest worker, reset between files, guarded against foreign targets.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  ensureWorkerDatabase,
  ownerDb,
  resetTestDb,
  UnsafeDatabaseError,
  workerDatabaseName,
} from '../test-harness/index.ts';

describe('test harness', () => {
  it("connects to this worker's own database", async () => {
    const { rows } = await ownerDb().execute<{ db: string }>(sql`select current_database() as db`);
    expect(rows[0]?.db).toBe(`shifa_test_${process.env['VITEST_POOL_ID'] ?? ''}`);
    expect(workerDatabaseName()).toBe(rows[0]?.db);
  });

  it('keeps data written here out of other workers', async () => {
    await ownerDb().execute(sql`
      create table if not exists harness_probe (id int primary key);
      insert into harness_probe values (1) on conflict do nothing;`);
    const other = await ensureWorkerDatabase('9999');
    const { rows } = await ownerDb(other).execute<{ t: string | null }>(
      sql`select to_regclass('harness_probe')::text as t`,
    );
    expect(rows[0]?.t).toBeNull();
  });

  it('resetTestDb empties tables but keeps the migration history', async () => {
    await ownerDb().execute(sql`
      create table if not exists harness_probe (id int primary key);
      insert into harness_probe values (2) on conflict do nothing;`);
    await resetTestDb();
    const { rows } = await ownerDb().execute<{ probe: number; migrations: number }>(sql`
      select (select count(*)::int from harness_probe) as probe,
             (select count(*)::int from drizzle.__drizzle_migrations) as migrations`);
    expect(rows[0]?.probe).toBe(0);
    expect(rows[0]?.migrations).toBeGreaterThan(0);
  });

  it('refuses databases it did not create', () => {
    expect(() => ownerDb('shifa')).toThrow(UnsafeDatabaseError);
  });
});
