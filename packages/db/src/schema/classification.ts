// Every table in the `public` schema, listed exactly once (0.2-06b, ADR-0004). The RLS
// presence test (test/architecture/rls-presence.test.ts) fails for a table missing here, for a
// tenant table without tenant_id / ENABLE + FORCE RLS / policies on current_tenant_id(), for a
// policy of shifa_auth or shifa_platform without a reason below, and the isolation suite
// (test/isolation/) fails for a tenant table without an isolation case.
//
// - tenant: holds one tenant's rows; RLS required (`/rls-policy`). `access` narrows what
//   shifa_app may do ('append-only': no UPDATE/DELETE for any application role; 'read-only':
//   SELECT only); `platformRows` allows a null tenant_id, with the reason.
// - global: no tenant data at all; give the reason.
// - system: infrastructure the application never queries for tenant data; give the reason.
// - roleAccess: the reason for each policy that applies to shifa_auth or shifa_platform only
//   (ADR-0043), by policy name. Policies for PUBLIC or shifa_app need none.
//
// Drizzle's migration history lives in the `drizzle` schema, outside this list. Test-only probe
// tables are never listed here: tests pass their own classification to the checks.

/** Policy name → why that role needs it. */
export type RoleAccess = Readonly<Record<string, string>>;

export type TableClass =
  | {
      readonly kind: 'tenant';
      readonly access?: 'append-only' | 'read-only';
      readonly platformRows?: string;
      readonly roleAccess?: RoleAccess;
    }
  | { readonly kind: 'global'; readonly reason: string; readonly roleAccess?: RoleAccess }
  | { readonly kind: 'system'; readonly reason: string; readonly roleAccess?: RoleAccess };

export type TableClassification = Readonly<Record<string, TableClass>>;

const IDENTITY =
  'a person is one account across clinics (ADR-0006); no clinic data. Personal data: shifa_app reads only the signed-in person (app.user_id)';
const PLATFORM_CREATE_ONLY =
  'restrictive: shifa_platform inserts here only inside a clinic.created transaction (createClinic())';
const OWNER_CREATE_ONLY =
  'restrictive: shifa_platform writes a clinic’s owner only inside its clinic.created transaction (createClinic(), A-01a 2, 3)';
const FIRST_OWNER_ONLY =
  'restrictive: app.admin_reason is set by the role itself, so the row must also be a clinic’s first and only owner (security review M1)';
const authAll = (table: string): RoleAccess => ({
  [`${table}_auth_all`]:
    'the Better Auth adapter reads and writes identity rows before any tenant or person is known (sign-in, sessions, MFA)',
});

export const TABLE_CLASSIFICATION: TableClassification = {
  tenant: {
    kind: 'global',
    reason:
      'the list of subscription accounts itself (PLT-01); tenant_id of every tenant table points here',
    roleAccess: {
      tenant_platform_all: 'the super admin creates clinics and sets status and end date (A-01a 3)',
      tenant_auth_member_read:
        'the clinic chooser shows the name, status and idle time of the clinics the signed-in person belongs to (A-01b 10, 11)',
      tenant_auth_link_read:
        'a setup page shows the name of the clinic its link belongs to, found by the token hash alone (A-01a 4)',
    },
  },
  platform_admin: {
    kind: 'global',
    reason: 'who is a super admin (A-01a 13); user ids only, no clinic data',
    roleAccess: {
      platform_admin_auth_read:
        'the auth path marks super admins in the principal (15-minute idle, MFA, platform routes)',
      platform_admin_platform_seed:
        'only the seed command creates super admins (platform.admin_created); no route does (A-01a 13)',
    },
  },
  user: { kind: 'global', reason: IDENTITY, roleAccess: authAll('user') },
  session: { kind: 'global', reason: IDENTITY, roleAccess: authAll('session') },
  account: { kind: 'global', reason: IDENTITY, roleAccess: authAll('account') },
  two_factor: { kind: 'global', reason: IDENTITY, roleAccess: authAll('two_factor') },
  verification: {
    kind: 'system',
    reason: 'Better Auth one-time values; no clinic data, never read by shifa_app',
    roleAccess: authAll('verification'),
  },
  auth_throttle: {
    kind: 'system',
    reason:
      'sign-in failure windows keyed by an HMAC of the phone or IP (A-01a 7); never read by shifa_app',
    roleAccess: authAll('auth_throttle'),
  },
  deployment_route: {
    kind: 'tenant',
    access: 'read-only',
    roleAccess: {
      deployment_route_platform_read:
        'the platform routes each tenant to its database (PLT-02, ADR-0004); the row holds no clinic data',
      deployment_route_platform_move: 'the platform moves a tenant to another database (ADR-0004)',
      deployment_route_platform_create_only: PLATFORM_CREATE_ONLY,
    },
  },
  organization: {
    kind: 'tenant',
    roleAccess: { organization_platform_create_only: PLATFORM_CREATE_ONLY },
  },
  branch: { kind: 'tenant', roleAccess: { branch_platform_create_only: PLATFORM_CREATE_ONLY } },
  membership: {
    kind: 'tenant',
    roleAccess: {
      membership_auth_own_read:
        "a person's own memberships across clinics, for sign-in and the clinic chooser (A-01b 10)",
      membership_auth_only_own:
        'restrictive: even with a tenant set, shifa_auth reaches only the signed-in person’s memberships, the membership of its setup link and pending ones for the person’s phone',
      membership_auth_invited_read:
        'the clinic chooser lists the person’s open invitations: pending, unbound, for their phone, with an open invitation link; read only, answered on the link (A-01b 10, OD-90, OD-91)',
      membership_auth_link_read:
        'a setup page shows the name and phone rules of the person its link is for (A-01a 4, 8)',
      membership_auth_link_accept:
        'using a setup link binds its pending membership to the new account, once (A-01a 5); accepting an invitation binds it to the signed-in person (A-01b 2)',
      membership_auth_accept_only:
        'restrictive: even with a tenant set, shifa_auth updates a membership only to bind it through its used link; an invitation only to the signed-in person with the invited phone',
      membership_platform_create_only: OWNER_CREATE_ONLY,
      membership_platform_first_owner_only: FIRST_OWNER_ONLY,
      membership_platform_owner_read:
        'the super admin sees each clinic’s owner card (name, status), never other members (A-01a 3, 13)',
      membership_platform_only_owner:
        'restrictive: even with a tenant set, shifa_platform reads owner memberships only',
      membership_platform_phone_change:
        'the super admin corrects the phone of a clinic’s owner who has no account yet, in an owner.phone_changed action (A-01a 13, OD-99)',
      membership_platform_phone_only:
        'restrictive: even with a tenant set, shifa_platform updates only a pending, unbound owner membership, only in owner.phone_changed; user_id and status stay as they were',
    },
  },
  role_assignment: {
    kind: 'tenant',
    roleAccess: {
      role_assignment_platform_create_only: OWNER_CREATE_ONLY,
      role_assignment_platform_first_owner_only: FIRST_OWNER_ONLY,
      role_assignment_platform_owner_read:
        'finding a clinic’s owner membership for the owner card and support actions (A-01a 13)',
      role_assignment_platform_only_owner:
        'restrictive: even with a tenant set, shifa_platform reads owner roles only',
      role_assignment_auth_own_read:
        'a person’s own roles across clinics: the MFA gate for an owner before a clinic is chosen (A-01a 11) and the clinic chooser (A-01b 10)',
      role_assignment_auth_only_own:
        'restrictive: even with a tenant set, shifa_auth reads only the signed-in person’s own roles',
    },
  },
  permission_override: { kind: 'tenant' },
  setup_link: {
    kind: 'tenant',
    roleAccess: {
      setup_link_auth_read: 'opening a setup link finds it by its token hash alone (A-01a 4)',
      setup_link_auth_use:
        'using an unused, unexpired link marks it used (A-01a 4); only used_at is granted',
      setup_link_auth_only_link:
        'restrictive: even with a tenant set, shifa_auth reaches only the link of its token hash, and reads invitation links for the signed-in person’s phone',
      setup_link_auth_invited_read:
        'the clinic chooser finds the open invitation links of the signed-in person’s phone; read only (OD-90, OD-91)',
      setup_link_platform_issue_only:
        'restrictive: shifa_platform issues owner links only at clinic creation, an owner.link_issued action or a pending owner’s phone corrected (A-01a 4, 13, OD-99)',
      setup_link_platform_owner_links_only:
        'restrictive: shifa_platform writes only owner or invitation links for a clinic’s owner, valid at most 72 h (review M1)',
      setup_link_platform_owner_only:
        'restrictive: shifa_platform sees owner links only (to replace them), never a token hash',
      setup_link_platform_replace_only:
        'restrictive: re-issuing (also after a pending owner’s phone is corrected) marks the owner’s unused links replaced, nothing else (A-01a 4, OD-99)',
    },
  },
  audit_event: {
    kind: 'tenant',
    access: 'append-only',
    platformRows:
      'platform and sign-in events belong to no tenant (A-01a 14); invisible to shifa_app',
    roleAccess: {
      audit_event_auth_insert:
        'sign-in, lockout and MFA events before any tenant is chosen (A-01a 14)',
      audit_event_platform_insert: 'one row per withPlatformAdmin() call (ADR-0005)',
      audit_event_side_null_tenant:
        'restrictive: shifa_auth and shifa_platform write platform rows only, even with a tenant set',
    },
  },
};
