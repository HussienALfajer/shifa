// A-02-06: the place migrations run as in production, by shifa_owner (NOBYPASSRLS), over a database
// with a clinic and its branch from before. The first list lands (Aleppo with its neighbourhoods,
// Azaz) under FORCE RLS; existing branches have no place; the contract step of A-02-04 drops
// tenant.idle_minutes, its check, the clinic's UPDATE on `tenant` and the policy tenant_app_settings,
// while the clinic's idle value stays in the settings cascade (A-02 criterion 10).
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  fixtureId,
  freshMigratedDatabase,
  migrateDatabase,
  ownerDb,
  superuserDb,
} from '../test-harness/index.ts';

// Pool id reserved for this file (9992: support migration; 9993: settings backfill; 9995, 9996:
// backup drill; 9997: rls-presence; 9998: hardening; 9999: harness).
const POOL_ID = '9991';
const BEFORE = '20261127073301_a02_support_policies';
const CLINIC = fixtureId('places migration clinic');

let database: string;

beforeAll(async () => {
  database = await freshMigratedDatabase(POOL_ID, BEFORE);
  const su = superuserDb(database);
  await su.execute(sql`insert into tenant (id, name, type, idle_minutes)
    values (${CLINIC}, 'عيادة قبل المدن', 'multi_branch', 15)`);
  await su.execute(sql`insert into branch (tenant_id, name) values (${CLINIC}, 'الفرع الرئيسي')`);
  await su.execute(sql`insert into setting_value (tenant_id, scope, scope_id, key, value)
    values (${CLINIC}, 'organization', null, 'session.idle_minutes', '15'::jsonb)`);
  await migrateDatabase(database);
}, 120_000);

describe('the place migrations over existing data', () => {
  it('seed Aleppo with its neighbourhoods and Azaz, none archived', async () => {
    const { rows } = await ownerDb(database).execute<{
      name: string;
      areas: number;
      archived: number;
    }>(sql`select c.name, count(a.id)::int as areas,
                  (count(*) filter (where c.archived_at is not null
                                       or a.archived_at is not null))::int as archived
             from city c left join area a on a.city_id = c.id
            group by c.name order by c.name`);
    expect(rows).toEqual([
      { name: 'أعزاز', areas: 0, archived: 0 },
      { name: 'حلب', areas: 44, archived: 0 },
    ]);
    const { rows: some } = await ownerDb(database).execute<{ name: string }>(
      sql`select name from area where name in ('الشهباء', 'الجميلية', 'حلب الجديدة') order by 1`,
    );
    expect(some.map((r) => r.name)).toEqual(['الجميلية', 'الشهباء', 'حلب الجديدة']);
  });

  it('leave both tables under FORCE RLS, with no policy for the owner', async () => {
    const { rows } = await ownerDb(database).execute<{ t: string; rls: boolean; force: boolean }>(
      sql`select relname as t, relrowsecurity as rls, relforcerowsecurity as force from pg_class
           where relname in ('city', 'area') order by 1`,
    );
    expect(rows).toEqual([
      { t: 'area', rls: true, force: true },
      { t: 'city', rls: true, force: true },
    ]);
    const policies = await ownerDb(database).execute<{ roles: string }>(
      sql`select roles::text as roles from pg_policies where tablename in ('city', 'area')`,
    );
    expect(policies.rows.map((r) => r.roles).join()).not.toContain('shifa_owner');
  });

  it('keep existing branches without a place', async () => {
    const { rows } = await superuserDb(database).execute<{ city: string | null }>(
      sql`select city_id as city from branch where tenant_id = ${CLINIC}`,
    );
    expect(rows).toEqual([{ city: null }]);
  });

  it('drop the idle column, its check, its grant and policy; the cascade keeps the value', async () => {
    const su = superuserDb(database);
    const column = await su.execute(sql`select 1 from information_schema.columns
      where table_name = 'tenant' and column_name = 'idle_minutes'`);
    expect(column.rows).toEqual([]);
    const check = await su.execute(
      sql`select 1 from pg_constraint where conname = 'tenant_idle_minutes_check'`,
    );
    expect(check.rows).toEqual([]);
    const policy = await su.execute(
      sql`select 1 from pg_policies where tablename = 'tenant' and policyname = 'tenant_app_settings'`,
    );
    expect(policy.rows).toEqual([]);
    const { rows: update } = await su.execute<{ ok: boolean }>(
      sql`select has_any_column_privilege('shifa_app', 'public.tenant', 'UPDATE') as ok`,
    );
    expect(update[0]?.ok).toBe(false);
    const { rows: value } = await su.execute<{ value: number }>(
      sql`select value from setting_value where tenant_id = ${CLINIC}
            and key = 'session.idle_minutes'`,
    );
    expect(value).toEqual([{ value: 15 }]);
  });
});
