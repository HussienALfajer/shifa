// Table privileges of the three application roles (A-01-01, ADR-0043). Policies decide which
// rows a role sees; privileges decide which tables and commands it reaches at all. shifa_auth
// and shifa_platform fall under the tenant tables' PUBLIC policies too, so this exact matrix is
// what keeps them off clinic data: any drift (a new default privilege, a stray GRANT) fails here.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { ownerDb } from '../test-harness/index.ts';

type Priv = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE' | 'REFERENCES' | 'TRIGGER';
const ALL: readonly Priv[] = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE',
  'REFERENCES',
  'TRIGGER',
];
const DML: readonly Priv[] = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

/** Table-level privileges each role holds; every table not listed: none. */
const EXPECTED: Readonly<Record<string, Readonly<Record<string, readonly Priv[]>>>> = {
  shifa_app: {
    tenant: ['SELECT'],
    organization: DML,
    deployment_route: ['SELECT'],
    branch: DML,
    // A-01-04: UPDATE by column only (user_id is bound on the auth path, never here)
    membership: ['SELECT', 'INSERT', 'DELETE'],
    role_assignment: DML,
    permission_override: DML,
    // A-01-04: links are only marked replaced (column UPDATE below)
    setup_link: ['SELECT', 'INSERT', 'DELETE'],
    audit_event: ['SELECT', 'INSERT'],
    user: ['SELECT'],
    // session, account and two_factor: column privileges only (below)
  },
  shifa_auth: {
    user: DML,
    session: DML,
    account: DML,
    two_factor: DML,
    verification: DML,
    auth_throttle: DML,
    tenant: ['SELECT'],
    membership: ['SELECT'],
    setup_link: ['SELECT'],
    audit_event: ['INSERT'],
    platform_admin: ['SELECT'],
  },
  shifa_platform: {
    tenant: ['SELECT', 'INSERT', 'UPDATE'],
    deployment_route: ['SELECT', 'INSERT', 'UPDATE'],
    organization: ['INSERT'],
    branch: ['INSERT'],
    audit_event: ['INSERT'],
    // A-01-03: the owner at clinic creation (create-only policies), super admins (seed only)
    membership: ['INSERT'],
    role_assignment: ['INSERT'],
    setup_link: ['INSERT'],
    platform_admin: ['INSERT'],
  },
};

/** Column-level grants on top of the table privileges above (secrets left out on purpose). */
const COLUMNS: readonly [role: string, table: string, priv: Priv, columns: readonly string[]][] = [
  [
    'shifa_app',
    'session',
    'SELECT',
    [
      'id',
      'user_id',
      'expires_at',
      'created_at',
      'updated_at',
      'ip_address',
      'user_agent',
      'active_tenant_id',
      'active_branch_id',
      'last_active_at',
    ],
  ],
  ['shifa_app', 'account', 'SELECT', ['id', 'user_id', 'account_id', 'provider_id', 'created_at']],
  ['shifa_app', 'two_factor', 'SELECT', ['id', 'user_id', 'verified']],
  ['shifa_app', 'membership', 'UPDATE', ['display_name', 'status', 'last_active_at', 'updated_at']],
  ['shifa_app', 'setup_link', 'UPDATE', ['replaced_at']],
  ['shifa_app', 'tenant', 'UPDATE', ['idle_minutes', 'updated_at']],
  [
    'shifa_auth',
    'role_assignment',
    'SELECT',
    ['id', 'tenant_id', 'membership_id', 'role', 'branch_id'],
  ],
  ['shifa_auth', 'setup_link', 'UPDATE', ['used_at']],
  ['shifa_auth', 'membership', 'UPDATE', ['user_id', 'status', 'updated_at']],
  [
    'shifa_platform',
    'membership',
    'SELECT',
    ['id', 'tenant_id', 'user_id', 'phone_e164', 'display_name', 'status'],
  ],
  ['shifa_platform', 'role_assignment', 'SELECT', ['id', 'tenant_id', 'membership_id', 'role']],
  [
    'shifa_platform',
    'setup_link',
    'SELECT',
    [
      'id',
      'tenant_id',
      'membership_id',
      'purpose',
      'expires_at',
      'used_at',
      'replaced_at',
      'created_at',
    ],
  ],
  ['shifa_platform', 'setup_link', 'UPDATE', ['replaced_at']],
];

/** Secret columns no role but shifa_auth may read. */
const SECRETS: readonly [table: string, column: string][] = [
  ['session', 'token'],
  ['account', 'password'],
  ['account', 'access_token'],
  ['account', 'refresh_token'],
  ['account', 'id_token'],
  ['two_factor', 'secret'],
  ['two_factor', 'backup_codes'],
];

async function publicTables(): Promise<string[]> {
  const { rows } = await ownerDb().execute<{ t: string }>(
    sql`select tablename as t from pg_tables where schemaname = 'public' order by 1`,
  );
  return rows.map((r) => r.t);
}

async function tablePrivileges(role: string, table: string): Promise<Priv[]> {
  const held: Priv[] = [];
  for (const priv of ALL) {
    const { rows } = await ownerDb().execute<{ ok: boolean }>(
      sql`select has_table_privilege(${role}, ${`public.${table}`}::regclass, ${priv}) as ok`,
    );
    if (rows[0]?.ok) held.push(priv);
  }
  return held;
}

async function columnPrivilege(role: string, table: string, column: string, priv: Priv) {
  const { rows } = await ownerDb().execute<{ ok: boolean }>(
    sql`select has_column_privilege(${role}, ${`public.${table}`}::regclass, ${column}, ${priv}) as ok`,
  );
  return rows[0]?.ok === true;
}

describe('application role privileges', () => {
  it('every table in the expected matrix exists', async () => {
    const tables = new Set(await publicTables());
    const named = Object.values(EXPECTED).flatMap((m) => Object.keys(m));
    expect(named.filter((t) => !tables.has(t))).toEqual([]);
  });

  for (const role of Object.keys(EXPECTED)) {
    it(`${role} holds exactly the listed table privileges`, async () => {
      const expected = EXPECTED[role] ?? {};
      const actual: Record<string, Priv[]> = {};
      for (const table of await publicTables()) {
        const held = await tablePrivileges(role, table);
        if (held.length > 0) actual[table] = held;
      }
      const want = Object.fromEntries(
        Object.entries(expected).map(([t, privs]) => [t, ALL.filter((p) => privs.includes(p))]),
      );
      expect(actual).toEqual(want);
    });
  }

  it('column grants cover exactly the listed columns', async () => {
    for (const [role, table, priv, columns] of COLUMNS) {
      const { rows } = await ownerDb().execute<{ c: string }>(sql`
        select a.attname as c from pg_attribute a
         where a.attrelid = ${`public.${table}`}::regclass and a.attnum > 0 and not a.attisdropped
         order by a.attnum`);
      for (const { c } of rows) {
        expect(await columnPrivilege(role, table, c, priv), `${role} ${priv} ${table}.${c}`).toBe(
          columns.includes(c),
        );
      }
    }
  });

  it('only shifa_auth can read secret columns', async () => {
    for (const [table, column] of SECRETS) {
      for (const role of ['shifa_app', 'shifa_platform']) {
        expect(
          await columnPrivilege(role, table, column, 'SELECT'),
          `${role} ${table}.${column}`,
        ).toBe(false);
      }
      expect(await columnPrivilege('shifa_auth', table, column, 'SELECT')).toBe(true);
    }
  });

  it('nothing in public is granted to PUBLIC', async () => {
    const { rows } = await ownerDb().execute<{ t: string }>(sql`
      select c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p', 'v')
         and exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
                      where x.grantee = 0)`);
    expect(rows).toEqual([]);
  });

  it('the policy helpers are executable by the three application roles only', async () => {
    for (const fn of ['current_tenant_id()', 'current_user_id()', 'current_link_token_hash()']) {
      const { rows } = await ownerDb().execute<{ role: string; ok: boolean }>(sql`
        select r.rolname as role, has_function_privilege(r.oid, ${`public.${fn}`}::regprocedure,
               'EXECUTE') as ok
          from pg_roles r where r.rolname in ('shifa_app', 'shifa_auth', 'shifa_platform')
         order by 1`);
      expect(
        rows.every((r) => r.ok),
        fn,
      ).toBe(true);
      const { rows: pub } = await ownerDb().execute<{ ok: boolean }>(sql`
        select exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl,
                         acldefault('f', p.proowner))) x
                        where p.oid = ${`public.${fn}`}::regprocedure and x.grantee = 0) as ok`);
      expect(pub[0]?.ok, `${fn} granted to PUBLIC`).toBe(false);
    }
  });
});
