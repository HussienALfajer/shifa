// Column-level grants of the three application roles (A-01-01 review): privileges.test.ts reads
// table privileges, which do not show a column grant such as `GRANT SELECT (phone_e164) ON
// membership TO shifa_platform`. This file lists every column ACL entry an application role
// holds and compares it with the reviewed list, so such a grant fails here.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { TABLE_CLASSIFICATION } from '../src/schema/classification.ts';
import { ensureWorkerDatabase, ownerDb } from '../test-harness/index.ts';
import { type Catalog, checkRlsPresence } from './architecture/rls-presence.ts';

/** `role table.column PRIV`, sorted: every column-level grant to an application role. */
const EXPECTED_COLUMN_GRANTS = [
  'shifa_app account.account_id SELECT',
  'shifa_app account.created_at SELECT',
  'shifa_app account.id SELECT',
  'shifa_app account.provider_id SELECT',
  'shifa_app account.user_id SELECT',
  'shifa_app session.active_branch_id SELECT',
  'shifa_app session.active_tenant_id SELECT',
  'shifa_app session.created_at SELECT',
  'shifa_app session.expires_at SELECT',
  'shifa_app session.id SELECT',
  'shifa_app session.ip_address SELECT',
  'shifa_app session.last_active_at SELECT',
  'shifa_app session.updated_at SELECT',
  'shifa_app session.user_agent SELECT',
  'shifa_app session.user_id SELECT',
  'shifa_app two_factor.id SELECT',
  'shifa_app two_factor.user_id SELECT',
  'shifa_app two_factor.verified SELECT',
  'shifa_auth membership.status UPDATE',
  'shifa_auth membership.updated_at UPDATE',
  'shifa_auth membership.user_id UPDATE',
  'shifa_auth setup_link.used_at UPDATE',
  'shifa_platform membership.display_name SELECT',
  'shifa_platform membership.id SELECT',
  'shifa_platform membership.phone_e164 SELECT',
  'shifa_platform membership.status SELECT',
  'shifa_platform membership.tenant_id SELECT',
  'shifa_platform membership.user_id SELECT',
  'shifa_platform role_assignment.id SELECT',
  'shifa_platform role_assignment.membership_id SELECT',
  'shifa_platform role_assignment.role SELECT',
  'shifa_platform role_assignment.tenant_id SELECT',
  'shifa_platform setup_link.created_at SELECT',
  'shifa_platform setup_link.expires_at SELECT',
  'shifa_platform setup_link.id SELECT',
  'shifa_platform setup_link.membership_id SELECT',
  'shifa_platform setup_link.purpose SELECT',
  'shifa_platform setup_link.replaced_at SELECT',
  'shifa_platform setup_link.replaced_at UPDATE',
  'shifa_platform setup_link.tenant_id SELECT',
  'shifa_platform setup_link.used_at SELECT',
];

/** Column ACL entries (not table grants) of the application roles in `public`. */
const columnGrants = sql`
  select format('%s %s.%s %s', r.rolname, c.relname, a.attname, x.privilege_type) as g
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(a.attacl) x
    join pg_roles r on r.oid = x.grantee
   where n.nspname = 'public' and a.attacl is not null and not a.attisdropped
     and r.rolname in ('shifa_app', 'shifa_auth', 'shifa_platform')
   order by 1`;

describe('column-level grants', () => {
  it('match the reviewed list exactly', async () => {
    const db = ownerDb(await ensureWorkerDatabase('9997'));
    const { rows } = await db.execute<{ g: string }>(columnGrants);
    expect(rows.map((r) => r.g)).toEqual(EXPECTED_COLUMN_GRANTS);
  });

  it('a stray column grant fails the comparison (red case)', async () => {
    class RolledBack extends Error {}
    let found: string[] = [];
    await expect(
      ownerDb(await ensureWorkerDatabase('9997')).transaction(async (tx) => {
        await tx.execute(sql`grant select (token_hash) on setup_link to shifa_platform`);
        const { rows } = await tx.execute<{ g: string }>(columnGrants);
        found = rows.map((r) => r.g);
        throw new RolledBack();
      }),
    ).rejects.toThrow(RolledBack);
    expect(found).toContain('shifa_platform setup_link.token_hash SELECT');
    expect(found).not.toEqual(EXPECTED_COLUMN_GRANTS);
  });

  it('the presence check sees a column UPDATE grant on an append-only table', async () => {
    class RolledBack extends Error {}
    let found: string[] = [];
    await expect(
      ownerDb(await ensureWorkerDatabase('9997')).transaction(async (tx) => {
        await tx.execute(sql`grant update (event) on audit_event to shifa_app`);
        found = await checkRlsPresence(tx as unknown as Catalog, TABLE_CLASSIFICATION);
        throw new RolledBack();
      }),
    ).rejects.toThrow(RolledBack);
    expect(found).toEqual([expect.stringMatching(/audit_event.*append-only.*shifa_app.*UPDATE/)]);
  });
});
