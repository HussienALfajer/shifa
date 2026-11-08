// The application role can never bypass RLS, own objects or change the schema.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { applyRolesSql, ownerDb, rawAppDb } from '../test-harness/index.ts';

interface RoleRow extends Record<string, unknown> {
  rolname: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  rolcanlogin: boolean;
}

describe('roles', () => {
  it('shifa_app is a plain login role without superuser or BYPASSRLS', async () => {
    const { rows } = await ownerDb().execute<RoleRow>(
      sql`select rolname, rolsuper, rolbypassrls, rolcanlogin from pg_roles
          where rolname in ('shifa_app', 'shifa_owner') order by rolname`,
    );
    expect(rows).toEqual([
      { rolname: 'shifa_app', rolsuper: false, rolbypassrls: false, rolcanlogin: true },
      expect.objectContaining({ rolname: 'shifa_owner', rolsuper: false, rolbypassrls: false }),
    ]);
  });

  it('shifa_app owns no table, schema or database', async () => {
    const { rows } = await ownerDb().execute<{ n: number }>(sql`
      select (select count(*) from pg_class where relowner = 'shifa_app'::regrole)
           + (select count(*) from pg_namespace where nspowner = 'shifa_app'::regrole)
           + (select count(*) from pg_database where datdba = 'shifa_app'::regrole) as n`);
    expect(Number(rows[0]?.n)).toBe(0);
  });

  it('shifa_app cannot create tables in public', async () => {
    await expect(rawAppDb().execute(sql`create table app_made (id int)`)).rejects.toThrow(
      /permission denied/,
    );
  });

  it('roles.sql is idempotent', async () => {
    await applyRolesSql();
    await applyRolesSql();
  });
});
