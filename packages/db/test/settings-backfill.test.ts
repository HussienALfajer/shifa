// A-02 criterion 10, the backfill of 20261127044029_a02_setting_policies (security review B1): run
// as in production, by shifa_owner (NOBYPASSRLS, FORCE RLS on `tenant`), over clinics that existed
// before it. A fresh database is migrated to the migration before, clinics with 15, 30 and 60 are
// written, the rest of the migrations run, and every clinic has its organization value.
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  fixtureId,
  freshMigratedDatabase,
  migrateDatabase,
  ownerDb,
  superuserDb,
} from '../test-harness/index.ts';

// Pool id reserved for this file (9995, 9996: backup drill; 9997: rls-presence; 9998: hardening).
const POOL_ID = '9993';
const BEFORE = '20261127044024_a02_settings';
const CLINICS = [
  { id: fixtureId('backfill 15'), minutes: 15 },
  { id: fixtureId('backfill 30'), minutes: 30 },
  { id: fixtureId('backfill 60'), minutes: 60 },
] as const;

let database: string;

beforeAll(async () => {
  database = await freshMigratedDatabase(POOL_ID, BEFORE);
  // The rows a clinic held before A-02-04 (written as the superuser: nobody else may).
  for (const c of CLINICS) {
    await superuserDb(database).execute(sql`insert into tenant (id, name, type, idle_minutes)
      values (${c.id}, 'عيادة قبل الإعدادات', 'multi_doctor', ${c.minutes})`);
  }
  await migrateDatabase(database);
}, 120_000);

describe('backfill of session.idle_minutes', () => {
  it('gives every existing clinic its idle minutes at the organization', async () => {
    const { rows } = await superuserDb(database).execute<{
      tenant_id: string;
      value: number;
      locked: boolean;
      scope_id: string | null;
    }>(sql`select tenant_id, value, locked, scope_id from setting_value
            where key = 'session.idle_minutes' and scope = 'organization' order by value`);
    expect(rows).toEqual(
      CLINICS.map((c) => ({ tenant_id: c.id, value: c.minutes, locked: false, scope_id: null })),
    );
  });

  it('leaves no policy for the owner on tenant', async () => {
    const { rows } = await ownerDb(database).execute<{ policyname: string }>(
      sql`select policyname from pg_policies where tablename = 'tenant' order by 1`,
    );
    expect(rows.map((r) => r.policyname)).not.toContain('tenant_owner_backfill');
  });
});
