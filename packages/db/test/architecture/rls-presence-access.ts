// Role and privilege checks behind rls-presence.ts (A-01-01, ADR-0043, A-01b criterion 13,
// backlog B1 and B7). Policies for PUBLIC or shifa_app are the tenant coverage; a policy for
// shifa_auth or shifa_platform only needs a reason in the classification; any other role is
// refused. The access classes are checked against the application roles' privileges.
import { sql } from 'drizzle-orm';
import type { TableClass } from '../../src/schema/classification.ts';
import type { Catalog } from './rls-presence.ts';

export const APPLICATION_ROLES = ['shifa_app', 'shifa_auth', 'shifa_platform'] as const;
const SIDE_ROLES: ReadonlySet<string> = new Set(['shifa_auth', 'shifa_platform']);
const CLASSIFICATION_FILE = 'packages/db/src/schema/classification.ts';

export interface PolicyRoles {
  name: string;
  /** Role names; 'public' for PUBLIC. */
  roles: string[];
}

/** Policies that count as tenant coverage: those that apply to PUBLIC or shifa_app. */
export function isAppPolicy(p: PolicyRoles): boolean {
  return p.roles.includes('public') || p.roles.includes('shifa_app');
}

/** Policies for shifa_auth / shifa_platform (need a reason) and for any other role (refused). */
export function rolePolicyViolations(
  table: string,
  policies: readonly PolicyRoles[],
  cls: TableClass,
): string[] {
  const out: string[] = [];
  const reasons = cls.roleAccess ?? {};
  for (const p of policies) {
    if (isAppPolicy(p)) continue;
    const roles = p.roles.join(', ');
    if (!p.roles.every((r) => SIDE_ROLES.has(r))) {
      out.push(
        `${table}: policy "${p.name}" is for ${roles}; policies are for PUBLIC or an application role only`,
      );
    } else if (!reasons[p.name]?.trim()) {
      out.push(
        `${table}: policy "${p.name}" for ${roles} needs a reason in roleAccess of ${CLASSIFICATION_FILE}`,
      );
    }
  }
  const names = new Set(policies.map((p) => p.name));
  for (const name of Object.keys(reasons)) {
    if (!names.has(name)) {
      out.push(
        `${table}: roleAccess "${name}" in ${CLASSIFICATION_FILE}: the policy does not exist`,
      );
    }
  }
  return out;
}

/** Table privileges the three application roles hold, by table. */
export async function applicationPrivileges(
  db: Catalog,
): Promise<Map<string, Map<string, Set<string>>>> {
  const { rows } = await db.execute<{ t: string; role: string; priv: string }>(sql`
    select c.relname as t, r.rolname as role, p.priv
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join pg_roles r
      cross join unnest(array['INSERT', 'UPDATE', 'DELETE']) as p(priv)
     where n.nspname = 'public' and c.relkind in ('r', 'p')
       and r.rolname in ('shifa_app', 'shifa_auth', 'shifa_platform')
       -- A column grant (UPDATE (event)) counts too: DELETE has no column form.
       and case when p.priv = 'DELETE' then has_table_privilege(r.oid, c.oid, p.priv)
                else has_any_column_privilege(r.oid, c.oid, p.priv) end`);
  const out = new Map<string, Map<string, Set<string>>>();
  for (const { t, role, priv } of rows) {
    const byRole = out.get(t) ?? new Map<string, Set<string>>();
    const privs = byRole.get(role) ?? new Set<string>();
    privs.add(priv);
    byRole.set(role, privs);
    out.set(t, byRole);
  }
  return out;
}

/** 'append-only': no role may UPDATE or DELETE; 'read-only': shifa_app may not write at all. */
export function accessViolations(
  table: string,
  access: 'append-only' | 'read-only' | undefined,
  held: Map<string, Set<string>> | undefined,
): string[] {
  if (!access) return [];
  const out: string[] = [];
  const forbidden: [role: string, privs: string[]][] =
    access === 'append-only'
      ? APPLICATION_ROLES.map((r) => [r, ['UPDATE', 'DELETE']])
      : [['shifa_app', ['INSERT', 'UPDATE', 'DELETE']]];
  for (const [role, privs] of forbidden) {
    for (const priv of privs) {
      if (held?.get(role)?.has(priv)) {
        out.push(`${table}: classified ${access}, but ${role} holds ${priv}; revoke it`);
      }
    }
  }
  return out;
}
