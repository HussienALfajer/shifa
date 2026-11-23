// The application roles can never bypass RLS, own objects or change the schema. Three login
// roles since A-01-01 (ADR-0043): shifa_app (tenant work), shifa_auth (identity and link
// lookups), shifa_platform (super-admin work).
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { ROLES_SQL } from '../src/index.ts';
import { applyRolesSql, ownerDb, rawAppDb, superuserDb } from '../test-harness/index.ts';

interface RoleRow extends Record<string, unknown> {
  rolname: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  rolcanlogin: boolean;
  rolinherit: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  rolreplication: boolean;
}

const APPLICATION_ROLES = ['shifa_app', 'shifa_auth', 'shifa_platform'] as const;

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

  it('shifa_auth and shifa_platform are plain login roles like shifa_app (ADR-0043)', async () => {
    const { rows } = await ownerDb().execute<RoleRow>(
      sql`select rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit, rolcreatedb,
                 rolcreaterole, rolreplication
            from pg_roles where rolname in ('shifa_auth', 'shifa_platform') order by rolname`,
    );
    const plain = {
      rolsuper: false,
      rolbypassrls: false,
      rolcanlogin: true,
      rolinherit: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
    };
    expect(rows).toEqual([
      { rolname: 'shifa_auth', ...plain },
      { rolname: 'shifa_platform', ...plain },
    ]);
  });

  it('no application role is a member of another role', async () => {
    const { rows } = await ownerDb().execute<{ n: number }>(sql`
      select count(*)::int as n from pg_auth_members m join pg_roles r on r.oid = m.member
       where r.rolname in ('shifa_app', 'shifa_auth', 'shifa_platform')`);
    expect(rows[0]?.n).toBe(0);
  });

  it('no application role owns a table, schema, function or database', async () => {
    for (const role of APPLICATION_ROLES) {
      const { rows } = await ownerDb().execute<{ n: number }>(sql`
        select (select count(*) from pg_class where relowner = ${role}::regrole)
             + (select count(*) from pg_namespace where nspowner = ${role}::regrole)
             + (select count(*) from pg_proc where proowner = ${role}::regrole)
             + (select count(*) from pg_database where datdba = ${role}::regrole) as n`);
      expect(Number(rows[0]?.n), role).toBe(0);
    }
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

  it.each(['shifa_auth', 'shifa_platform'])(
    'roles.sql refuses a %s that gained a role membership',
    async (role) => {
      // Inside one transaction that is rolled back, so other workers never see the membership.
      const mid = `roles_mid_${role}`;
      await expect(
        superuserDb().transaction(async (tx) => {
          await tx.execute(sql.raw(`create role ${mid} nologin`));
          await tx.execute(sql.raw(`grant ${mid} to ${role}`));
          await tx.execute(sql.raw(readFileSync(ROLES_SQL, 'utf8')));
        }),
      ).rejects.toThrow(/member of another role/);
    },
  );

  it.each(['shifa_auth', 'shifa_platform'])(
    'roles.sql re-asserts the safety attributes of %s',
    async (role) => {
      // A hand-made BYPASSRLS is reverted by the next roles.sql run (rolled back afterwards).
      let after: boolean | undefined;
      await expect(
        superuserDb().transaction(async (tx) => {
          await tx.execute(sql.raw(`alter role ${role} bypassrls`));
          await tx.execute(sql.raw(readFileSync(ROLES_SQL, 'utf8')));
          const { rows } = await tx.execute<{ b: boolean }>(
            sql`select rolbypassrls as b from pg_roles where rolname = ${role}`,
          );
          after = rows[0]?.b;
          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');
      expect(after).toBe(false);
    },
  );
});
