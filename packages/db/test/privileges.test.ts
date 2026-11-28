// Table privileges of the three application roles (A-01-01, ADR-0043). Policies decide which
// rows a role sees; privileges decide which tables and commands it reaches at all. shifa_auth
// and shifa_platform fall under the tenant tables' PUBLIC policies too, so this exact matrix is
// what keeps them off clinic data: any drift (a new default privilege, a stray GRANT) fails here.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { COUNT_FUNCTIONS } from '../src/schema/classification.ts';
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
    // A-02-02: plans and add-ons, and the clinic's own add-ons, overrides and their history
    plan: ['SELECT'],
    plan_feature: ['SELECT'],
    addon: ['SELECT'],
    tenant_addon: ['SELECT'],
    tenant_override: ['SELECT'],
    tenant_override_event: ['SELECT'],
    // A-02-03: flags (global) and the clinic's own selections
    feature_flag: ['SELECT'],
    feature_flag_tenant: ['SELECT'],
    // A-02-04: settings; the clinic's own values, UPDATE by column only (never `locked`, below)
    platform_setting_value: ['SELECT'],
    setting_value: ['SELECT', 'INSERT', 'DELETE'],
    // A-02-05: the clinic's support grants; an owner ends one by column UPDATE (below)
    support_access_grant: ['SELECT'],
    // A-02-06: cities and areas (platform lists); a branch holds one of each
    city: ['SELECT'],
    area: ['SELECT'],
    // A-02-07: announcements aimed at the clinic (seven columns, below), its targets, the
    // person's own dismissals (UPDATE by column, below; never DELETE), the clinic's counters
    announcement_target: ['SELECT'],
    announcement_dismissal: ['SELECT', 'INSERT'],
    usage_daily: DML,
    // A-03-02: charts and the file-number counter, never deleted
    patient: ['SELECT', 'INSERT', 'UPDATE'],
    patient_file_counter: ['SELECT', 'INSERT', 'UPDATE'],
    // A-03-03: name tokens, rewritten (deleted and written again) on every name change
    patient_name_token: ['SELECT', 'INSERT', 'DELETE'],
    patient_treating_doctor: ['SELECT', 'INSERT', 'DELETE'],
    // A-03-05: field definitions and choices, never deleted (tombstones, archived choices)
    patient_field: ['SELECT', 'INSERT', 'UPDATE'],
    patient_field_option: ['SELECT', 'INSERT', 'UPDATE'],
    patient_field_value: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
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
    // A-02-04: platform values, and each clinic's idle sign-out (column SELECT below)
    platform_setting_value: ['SELECT'],
    // A-02-05: the grant of a hand-off or of the signed-in super admin (policies); UPDATE by
    // column only (below)
    support_access_grant: ['SELECT'],
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
    // A-02-02: overrides and their history, inside a clinic in entitlement actions (policies)
    plan: ['SELECT'],
    plan_feature: ['SELECT'],
    addon: ['SELECT'],
    tenant_addon: ['SELECT'],
    tenant_override: DML,
    tenant_override_event: ['SELECT', 'INSERT'],
    // A-02-03: the super admin sets flags and their selected clinics (flag actions, policies)
    feature_flag: ['SELECT', 'INSERT', 'UPDATE'],
    feature_flag_tenant: ['SELECT', 'INSERT', 'DELETE'],
    // A-02-04: a clinic's values, locked or unlocked, in setting actions (policies); UPDATE by
    // column only (below), never a value's clinic, scope or key
    platform_setting_value: ['SELECT'],
    setting_value: ['SELECT', 'INSERT', 'DELETE'],
    // A-02-05: opens grants in support actions (policies); SELECT and UPDATE by column (below)
    support_access_grant: ['INSERT'],
    // A-02-06: adds cities and areas (place actions, policies); UPDATE by column only (below);
    // never DELETE
    city: ['SELECT', 'INSERT'],
    area: ['SELECT', 'INSERT'],
    // A-02-07: announcements and their clinics (announcement actions, policies; UPDATE by column,
    // below; never an announcement deleted), and every clinic's counters (read only)
    announcement: ['SELECT', 'INSERT'],
    announcement_target: ['SELECT', 'INSERT', 'DELETE'],
    usage_daily: ['SELECT'],
  },
};

/** support_access_grant without the hand-off hash (A-02-05): what the super admin reads. */
const GRANT_COLUMNS = [
  'id',
  'tenant_id',
  'admin_user_id',
  'admin_name',
  'reason',
  'opened_at',
  'expires_at',
  'ended_at',
  'ended_by',
  'ended_by_name',
  'end_reason',
] as const;

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
  // A-01-12: phone_e164 for a pending member's phone (OD-103; a trigger refuses any other row)
  [
    'shifa_app',
    'membership',
    'UPDATE',
    // A-02-07: last_sign_in_on, the day of the member's last sign-in (members signed in per day)
    ['display_name', 'status', 'last_active_at', 'updated_at', 'phone_e164', 'last_sign_in_on'],
  ],
  ['shifa_app', 'setup_link', 'UPDATE', ['replaced_at']],
  // A-02-06: the idle column and its grant are gone; the clinic writes nothing on its tenant row
  ['shifa_app', 'tenant', 'UPDATE', []],
  // A-02-04: a clinic changes its own unlocked value, never the lock (owner-approved column grant)
  ['shifa_app', 'setting_value', 'UPDATE', ['value', 'set_by', 'set_at']],
  [
    'shifa_auth',
    'setting_value',
    'SELECT',
    ['tenant_id', 'scope', 'scope_id', 'key', 'value', 'locked'],
  ],
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
  // A-01-11: a pending owner's phone corrected (OD-99; policies keep it to that row)
  ['shifa_platform', 'membership', 'UPDATE', ['phone_e164', 'updated_at']],
  // A-02-04: the super admin's lock with a value (security review N2)
  ['shifa_platform', 'setting_value', 'UPDATE', ['value', 'locked', 'set_by', 'set_at']],
  // A-02-05: the clinic reads its grants without the hand-off hash and an owner ends one; the
  // super admin opens, hands off and ends (policies keep each to its action)
  [
    'shifa_app',
    'support_access_grant',
    'UPDATE',
    ['ended_at', 'ended_by', 'ended_by_name', 'end_reason'],
  ],
  ['shifa_platform', 'support_access_grant', 'SELECT', [...GRANT_COLUMNS, 'handoff_expires_at']],
  [
    'shifa_platform',
    'support_access_grant',
    'UPDATE',
    [
      'ended_at',
      'ended_by',
      'ended_by_name',
      'end_reason',
      'handoff_token_hash',
      'handoff_expires_at',
    ],
  ],
  [
    'shifa_auth',
    'support_access_grant',
    'UPDATE',
    ['ended_at', 'end_reason', 'handoff_token_hash', 'handoff_expires_at'],
  ],
  // A-02-06: a rename, an archive or a restore (policies and the guard trigger keep each to its
  // column); no place is ever deleted
  ['shifa_platform', 'city', 'UPDATE', ['name', 'name_key', 'archived_at', 'updated_at']],
  ['shifa_platform', 'area', 'UPDATE', ['name', 'name_key', 'archived_at', 'updated_at']],
  ['shifa_app', 'city', 'UPDATE', []],
  ['shifa_app', 'area', 'UPDATE', []],
  // A-02-07: the clinic reads seven columns of an announcement (never who wrote or ended it); the
  // person changes only the version and time of their own dismissal; the super admin edits and
  // ends by column (never the author or creation time)
  [
    'shifa_app',
    'announcement',
    'SELECT',
    ['id', 'version', 'level', 'body', 'starts_at', 'ends_at', 'target'],
  ],
  ['shifa_app', 'announcement', 'UPDATE', []],
  ['shifa_app', 'announcement_dismissal', 'UPDATE', ['version', 'dismissed_at', 'updated_at']],
  [
    'shifa_platform',
    'announcement',
    'UPDATE',
    [
      'version',
      'body',
      'level',
      'starts_at',
      'ends_at',
      'target',
      'ended_early',
      'ended_by',
      'ended_by_name',
      'updated_at',
    ],
  ],
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
  // A-01-11: a self re-enrolment's new secret (OD-98)
  ['two_factor', 'pending_secret'],
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

  // ADR-0051 (A-02-06; moved here from entitlements-platform.test.ts with the second function):
  // the only SECURITY DEFINER functions are the integers-only counts the classification lists.
  it('SECURITY DEFINER functions are the listed counts: integers only, shifa_platform alone', async () => {
    const { rows } = await ownerDb().execute<{
      fn: string;
      roles: string[];
      config: string[] | null;
      results: string[];
    }>(sql`
      select regexp_replace(p.oid::regprocedure::text, '^public[.]|[[:space:]]', '', 'g') as fn,
             array(select r.rolname::text from pg_roles r
                    where r.rolname in ('shifa_app', 'shifa_auth', 'shifa_platform')
                      and has_function_privilege(r.oid, p.oid, 'EXECUTE')
                    order by 1) as roles,
             p.proconfig as config,
             array(select format_type(t.oid, null)
                     from unnest(p.proallargtypes, p.proargmodes) as a(oid, mode)
                     join pg_type t on t.oid = a.oid
                    where a.mode in ('o', 't', 'b')) as results
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef
       order by 1`);
    expect(rows.map((r) => r.fn).sort()).toEqual(Object.keys(COUNT_FUNCTIONS).sort());
    for (const row of rows) {
      expect(row.roles, row.fn).toEqual(['shifa_platform']);
      expect(row.config, row.fn).toEqual(['search_path=pg_catalog, public']);
      expect(row.results.length, row.fn).toBeGreaterThan(0);
      expect(new Set(row.results), row.fn).toEqual(new Set(['integer']));
      const { rows: pub } = await ownerDb().execute<{ ok: boolean }>(sql`
        select exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl,
                         acldefault('f', p.proowner))) x
                        where p.oid = ${`public.${row.fn}`}::regprocedure and x.grantee = 0) as ok`);
      expect(pub[0]?.ok, `${row.fn} granted to PUBLIC`).toBe(false);
    }
  });
});
