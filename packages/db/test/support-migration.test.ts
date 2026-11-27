// A-02-05: the support migrations run as in production, by shifa_owner (NOBYPASSRLS), over a
// database with sessions and clinics from before (expand only: a new table, a nullable column on
// `session`, policies and grants; no data is read or written). Existing sessions are kept, no
// session is a support session, and the new table is FORCE RLS with no owner policy left.
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  fixtureId,
  freshMigratedDatabase,
  migrateDatabase,
  ownerDb,
  superuserDb,
} from '../test-harness/index.ts';

// Pool id reserved for this file (9993: settings backfill; 9995, 9996: backup drill; 9997:
// rls-presence; 9998: hardening; 9999: harness).
const POOL_ID = '9992';
const BEFORE = '20261127044029_a02_setting_policies';
const USER = fixtureId('migration person');
const CLINIC = fixtureId('migration clinic');

let database: string;

beforeAll(async () => {
  database = await freshMigratedDatabase(POOL_ID, BEFORE);
  const su = superuserDb(database);
  await su.execute(sql`insert into tenant (id, name, type) values (${CLINIC}, 'عيادة', 'solo')`);
  await su.execute(sql`insert into "user" (id, name, email)
    values (${USER}, 'شخص', ${`${USER}@users.shifa.invalid`})`);
  await su.execute(sql`insert into session (id, token, user_id, expires_at, active_tenant_id)
    values (${fixtureId('migration session')}, 'migration-token', ${USER},
            now() + interval '1 hour', ${CLINIC})`);
  await migrateDatabase(database);
}, 120_000);

describe('the support migrations over existing data', () => {
  it('keep every session, none of them a support session', async () => {
    const { rows } = await superuserDb(database).execute<{ n: number; support: number }>(
      sql`select count(*)::int as n, count(support_grant_id)::int as support from session`,
    );
    expect(rows[0]).toEqual({ n: 1, support: 0 });
  });

  it('leave support_access_grant under FORCE RLS, with no policy for the owner', async () => {
    const { rows } = await ownerDb(database).execute<{ rls: boolean; force: boolean }>(
      sql`select relrowsecurity as rls, relforcerowsecurity as force from pg_class
           where relname = 'support_access_grant'`,
    );
    expect(rows[0]).toEqual({ rls: true, force: true });
    const policies = await ownerDb(database).execute<{ roles: string }>(
      sql`select roles::text as roles from pg_policies where tablename = 'support_access_grant'`,
    );
    expect(policies.rows.map((r) => r.roles).join()).not.toContain('shifa_owner');
    // The owner, bound by FORCE RLS, sees no grant without a tenant.
    const seen = await ownerDb(database).execute(sql`select id from support_access_grant`);
    expect(seen.rows).toEqual([]);
  });
});
