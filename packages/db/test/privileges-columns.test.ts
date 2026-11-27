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
  // A-02-07: the clinic reads seven columns of the announcements aimed at it; a person changes
  // only the version and time of their own dismissal
  'shifa_app announcement.body SELECT',
  'shifa_app announcement.ends_at SELECT',
  'shifa_app announcement.id SELECT',
  'shifa_app announcement.level SELECT',
  'shifa_app announcement.starts_at SELECT',
  'shifa_app announcement.target SELECT',
  'shifa_app announcement.version SELECT',
  'shifa_app announcement_dismissal.dismissed_at UPDATE',
  'shifa_app announcement_dismissal.updated_at UPDATE',
  'shifa_app announcement_dismissal.version UPDATE',
  'shifa_app membership.display_name UPDATE',
  'shifa_app membership.last_active_at UPDATE',
  // A-02-07: the day of the member's last sign-in (members signed in per day)
  'shifa_app membership.last_sign_in_on UPDATE',
  // A-01-12: a pending member's phone corrected (OD-103; guarded by a trigger)
  'shifa_app membership.phone_e164 UPDATE',
  'shifa_app membership.status UPDATE',
  'shifa_app membership.updated_at UPDATE',
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
  // A-02-04: a clinic's own unlocked setting values, never `locked` (owner-approved)
  'shifa_app setting_value.set_at UPDATE',
  'shifa_app setting_value.set_by UPDATE',
  'shifa_app setting_value.value UPDATE',
  'shifa_app setup_link.replaced_at UPDATE',
  // A-02-05: an owner ends an open support grant (restrictive policy: as `owner`, by themselves)
  'shifa_app support_access_grant.end_reason UPDATE',
  'shifa_app support_access_grant.ended_at UPDATE',
  'shifa_app support_access_grant.ended_by UPDATE',
  'shifa_app support_access_grant.ended_by_name UPDATE',
  'shifa_app two_factor.id SELECT',
  'shifa_app two_factor.user_id SELECT',
  'shifa_app two_factor.verified SELECT',
  'shifa_auth membership.status UPDATE',
  'shifa_auth membership.updated_at UPDATE',
  'shifa_auth membership.user_id UPDATE',
  'shifa_auth role_assignment.branch_id SELECT',
  'shifa_auth role_assignment.id SELECT',
  'shifa_auth role_assignment.membership_id SELECT',
  'shifa_auth role_assignment.role SELECT',
  'shifa_auth role_assignment.tenant_id SELECT',
  // A-02-04: each session's idle limit (the idle key only, by policy)
  'shifa_auth setting_value.key SELECT',
  'shifa_auth setting_value.locked SELECT',
  'shifa_auth setting_value.scope SELECT',
  'shifa_auth setting_value.scope_id SELECT',
  'shifa_auth setting_value.tenant_id SELECT',
  'shifa_auth setting_value.value SELECT',
  'shifa_auth setup_link.used_at UPDATE',
  // A-02-05: a hand-off used once, an expired grant closed (policies)
  'shifa_auth support_access_grant.end_reason UPDATE',
  'shifa_auth support_access_grant.ended_at UPDATE',
  'shifa_auth support_access_grant.handoff_expires_at UPDATE',
  'shifa_auth support_access_grant.handoff_token_hash UPDATE',
  // A-02-06: renames, archives and restores of cities and areas (place actions, guard trigger)
  // A-02-07: an announcement edited or ended (policies keep each to its action)
  'shifa_platform announcement.body UPDATE',
  'shifa_platform announcement.ended_by UPDATE',
  'shifa_platform announcement.ended_by_name UPDATE',
  'shifa_platform announcement.ended_early UPDATE',
  'shifa_platform announcement.ends_at UPDATE',
  'shifa_platform announcement.level UPDATE',
  'shifa_platform announcement.starts_at UPDATE',
  'shifa_platform announcement.target UPDATE',
  'shifa_platform announcement.updated_at UPDATE',
  'shifa_platform announcement.version UPDATE',
  'shifa_platform area.archived_at UPDATE',
  'shifa_platform area.name UPDATE',
  'shifa_platform area.name_key UPDATE',
  'shifa_platform area.updated_at UPDATE',
  'shifa_platform city.archived_at UPDATE',
  'shifa_platform city.name UPDATE',
  'shifa_platform city.name_key UPDATE',
  'shifa_platform city.updated_at UPDATE',
  'shifa_platform membership.display_name SELECT',
  'shifa_platform membership.id SELECT',
  'shifa_platform membership.phone_e164 SELECT',
  // A-01-11: a pending owner's phone corrected (OD-99)
  'shifa_platform membership.phone_e164 UPDATE',
  'shifa_platform membership.status SELECT',
  'shifa_platform membership.tenant_id SELECT',
  'shifa_platform membership.updated_at UPDATE',
  'shifa_platform membership.user_id SELECT',
  'shifa_platform role_assignment.id SELECT',
  'shifa_platform role_assignment.membership_id SELECT',
  'shifa_platform role_assignment.role SELECT',
  'shifa_platform role_assignment.tenant_id SELECT',
  // A-02-04: the super admin's lock with a value, never a value's clinic, scope or key
  'shifa_platform setting_value.locked UPDATE',
  'shifa_platform setting_value.set_at UPDATE',
  'shifa_platform setting_value.set_by UPDATE',
  'shifa_platform setting_value.value UPDATE',
  'shifa_platform setup_link.created_at SELECT',
  'shifa_platform setup_link.expires_at SELECT',
  'shifa_platform setup_link.id SELECT',
  'shifa_platform setup_link.membership_id SELECT',
  'shifa_platform setup_link.purpose SELECT',
  'shifa_platform setup_link.replaced_at SELECT',
  'shifa_platform setup_link.replaced_at UPDATE',
  'shifa_platform setup_link.tenant_id SELECT',
  'shifa_platform setup_link.used_at SELECT',
  // A-02-05: support grants without the hand-off hash; open, hand off, end (support actions)
  'shifa_platform support_access_grant.admin_name SELECT',
  'shifa_platform support_access_grant.admin_user_id SELECT',
  'shifa_platform support_access_grant.end_reason SELECT',
  'shifa_platform support_access_grant.end_reason UPDATE',
  'shifa_platform support_access_grant.ended_at SELECT',
  'shifa_platform support_access_grant.ended_at UPDATE',
  'shifa_platform support_access_grant.ended_by SELECT',
  'shifa_platform support_access_grant.ended_by UPDATE',
  'shifa_platform support_access_grant.ended_by_name SELECT',
  'shifa_platform support_access_grant.ended_by_name UPDATE',
  'shifa_platform support_access_grant.expires_at SELECT',
  'shifa_platform support_access_grant.handoff_expires_at SELECT',
  'shifa_platform support_access_grant.handoff_expires_at UPDATE',
  'shifa_platform support_access_grant.handoff_token_hash UPDATE',
  'shifa_platform support_access_grant.id SELECT',
  'shifa_platform support_access_grant.opened_at SELECT',
  'shifa_platform support_access_grant.reason SELECT',
  'shifa_platform support_access_grant.tenant_id SELECT',
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
