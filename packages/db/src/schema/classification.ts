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

const PLAN_TABLE =
  'what a plan or add-on gives (A-02 criterion 1, ADR-0007); keys and values only, no clinic data; written by migrations alone';
const ENTITLEMENT_READ =
  'restrictive: shifa_platform reads a clinic’s add-ons, overrides and their history only inside that clinic in an entitlement action (view, history, set, remove, type preview and change; A-02 criteria 1–3, 20)';

const PLACE_TABLE =
  'a platform list of cities and their areas with Arabic names (A-02 criterion 15, PLT-15); place names only, no clinic data; never deleted';
const placeAccess = (table: 'city' | 'area'): RoleAccess => ({
  [`${table}_platform_create`]: `shifa_platform adds a ${table}, created now and not archived, only in a ${table}.created action (A-02 criterion 15)`,
  [`${table}_platform_change`]: `shifa_platform renames, archives or restores a ${table} only in that action, times bounded by now(); a trigger keeps each action to its column (A-02 criterion 15)`,
});

/**
 * SECURITY DEFINER functions in `public` (ADR-0051, amending ADR-0043): each reads clinic rows as
 * the owner for shifa_platform and returns integers only, never a row, id or name. Pinned in
 * test/privileges.test.ts: exactly these, a fixed search_path, integer results, EXECUTE for
 * shifa_platform alone. Signature → why the platform needs the count.
 */
export const COUNT_FUNCTIONS: Readonly<Record<string, string>> = {
  'tenant_usage_counts(uuid)':
    'a clinic’s doctors and active branches beside its limits and in a type preview (A-02 criteria 2, 3; A-02-02)',
  'place_counts(text,uuid[],uuid[])':
    'branches, clinics and doctors on each city and area across clinics, by the place’s position in the array (A-02 criterion 24; A-02-06)',
  'announcement_counts(uuid[],integer[],boolean[],uuid[])':
    'targeted members and their dismissals of each announcement across its clinics, by the announcement’s position in the array (A-02 criterion 22; A-02-07)',
  'tenant_custom_field_count(uuid,bigint)':
    'a clinic’s custom fields (active, and archived after the cutoff) beside its limits and in a type preview (A-03 criterion 15; A-03-05)',
  'clinic_member_counts(uuid)':
    'a clinic’s members, active members and branches beside its usage (A-02 criterion 17; A-02-07)',
};

export const TABLE_CLASSIFICATION: TableClassification = {
  plan: { kind: 'global', reason: PLAN_TABLE },
  plan_feature: { kind: 'global', reason: PLAN_TABLE },
  addon: { kind: 'global', reason: PLAN_TABLE },
  tenant_addon: {
    kind: 'tenant',
    access: 'read-only',
    roleAccess: { tenant_addon_platform_read_only_in_actions: ENTITLEMENT_READ },
  },
  tenant_override: {
    kind: 'tenant',
    access: 'read-only',
    roleAccess: {
      tenant_override_platform_read_only_in_actions: ENTITLEMENT_READ,
      tenant_override_platform_set_only:
        'restrictive: shifa_platform inserts an override only in an entitlement.override_set action (A-02 criterion 3)',
      tenant_override_platform_change_only:
        'restrictive: shifa_platform changes an override only in an entitlement.override_set action (A-02 criterion 3)',
      tenant_override_platform_remove_only:
        'restrictive: shifa_platform removes an override only in an entitlement.override_removed action (A-02 criterion 3)',
    },
  },
  // shifa_app only reads it ('read-only'); no role may UPDATE or DELETE it (privileges pinned in
  // test/privileges.test.ts, and a trigger refuses even the owner).
  tenant_override_event: {
    kind: 'tenant',
    access: 'read-only',
    roleAccess: {
      tenant_override_event_platform_read_only_in_actions: ENTITLEMENT_READ,
      tenant_override_event_platform_append_only:
        'restrictive: shifa_platform appends a key’s history only in the actions that change it (override set or removed, type changed; A-02 criterion 20)',
    },
  },
  // A-02-04: the settings cascade (criteria 8–10). shifa_app writes its own unlocked values only
  // (restrictive policies for shifa_app need no reason here).
  platform_setting_value: {
    kind: 'global',
    reason:
      'a setting’s value for every clinic or for one plan (A-02 criterion 8, PLT-22); keys and values only, no clinic data. No role writes it, the owner included (FORCE RLS, a SELECT policy only): a seeding migration adds a temporary INSERT policy for shifa_owner and drops it in the same migration',
  },
  setting_value: {
    kind: 'tenant',
    roleAccess: {
      setting_value_platform_read_only_in_actions:
        'restrictive: shifa_platform reads a clinic’s setting values only inside that clinic in a setting action (list, lock, unlock; A-02 criterion 9)',
      setting_value_platform_lock_only:
        'restrictive: shifa_platform writes a clinic’s value only with its lock, at the organization, in a setting.locked action (A-02 criterion 9)',
      setting_value_platform_relock_only:
        'restrictive: shifa_platform changes a clinic’s organization value only into a locked one, in a setting.locked action (A-02 criterion 9)',
      setting_value_platform_unlock_only:
        'restrictive: shifa_platform removes only a locked organization value, in a setting.unlocked action (A-02 criterion 9)',
      setting_value_auth_idle_read:
        'the auth path reads the idle sign-out of the clinics the signed-in person belongs to, for each session’s idle limit (A-02 criterion 10, A-01a 9)',
      setting_value_auth_only_idle:
        'restrictive: the auth path reads the organization’s session.idle_minutes of the person’s own clinics and no other setting, even with a tenant set',
    },
  },
  // A-02-05: read-only support access (criteria 11–14, ADR-0050). shifa_app reads its own grants
  // and an owner ends an open one (restrictive policy, no reason needed).
  support_access_grant: {
    kind: 'tenant',
    roleAccess: {
      support_access_grant_platform_only_in_support:
        'restrictive: shifa_platform reads a clinic’s support grants only inside that clinic in a support action (list, open, hand-off, end; A-02 criteria 11, 12)',
      support_access_grant_platform_open_only:
        'restrictive: shifa_platform inserts only an open grant of the acting super admin, opened now and at most 4 hours long, in a support.opened action (A-02 criterion 11)',
      support_access_grant_platform_change_only:
        'restrictive: shifa_platform changes only an open grant: a hand-off of its own in support.handoff_issued, its own end in support.ended, or the close of an expired grant (A-02 criteria 11, 12)',
      support_access_grant_auth_handoff_read:
        'exchanging a hand-off finds the grant by the token hash alone, before anyone is signed in on clinic web (ADR-0050)',
      support_access_grant_auth_own_read:
        'each request of a support session reads its grant (ended, expired) as the signed-in super admin (A-02 criterion 12)',
      support_access_grant_auth_handoff_use:
        'a hand-off of an open grant is used once: its hash is cleared (ADR-0050)',
      support_access_grant_auth_expire:
        'a support session that finds its grant expired closes it as `expiry`, once (A-02 criteria 12, 14)',
      support_access_grant_auth_only_own:
        'restrictive: even with a tenant set, shifa_auth reads only the grant of its hand-off hash or the signed-in super admin’s own',
      support_access_grant_auth_only_use_or_expire:
        'restrictive: even with a tenant set, shifa_auth changes only an open grant: clears its hand-off or closes it as expired (never re-opens an ended one)',
    },
  },
  // A-02-06: cities and areas (criterion 15, OD-113); a branch holds one of each (optional)
  city: { kind: 'global', reason: PLACE_TABLE, roleAccess: placeAccess('city') },
  area: { kind: 'global', reason: PLACE_TABLE, roleAccess: placeAccess('area') },
  // A-02-07: announcements (criteria 16, 22) and daily usage (criteria 17, 19, 21)
  announcement: {
    kind: 'global',
    reason:
      'the super admin’s plain-text announcements with level, period, target and authors’ names (A-02 criterion 16, PLT-18); no clinic data. shifa_app reads seven columns of the ones aimed at its clinic',
    roleAccess: {
      announcement_platform_read:
        'the super admin lists, creates, edits and ends announcements (A-02 criterion 16)',
      announcement_platform_create:
        'shifa_platform adds an announcement only in announcement.created, as its own author, not ended, stamped now (A-02 criterion 16)',
      announcement_platform_change:
        'shifa_platform edits or ends an announcement only in announcement.edited or announcement.ended; an end names the acting super admin (A-02 criterion 16)',
    },
  },
  announcement_target: {
    kind: 'tenant',
    access: 'read-only',
    roleAccess: {
      announcement_target_platform_read:
        'the announcements list names the clinics each one is for, across clinics (tenant ids only), in announcement actions (A-02 criterion 16)',
      announcement_target_platform_select_clinics:
        'shifa_platform aims an announcement at a clinic only in announcement.created or announcement.edited',
      announcement_target_platform_unselect:
        'shifa_platform removes a clinic from an announcement only in announcement.edited',
      announcement_target_platform_only_in_actions:
        'restrictive: even with a tenant set, shifa_platform reaches targets only in an announcement action and writes them only in created or edited',
      announcement_target_platform_delete_only_in_edit:
        'restrictive: even with a tenant set, shifa_platform deletes a target only in announcement.edited (a DELETE has no WITH CHECK)',
    },
  },
  announcement_dismissal: {
    kind: 'global',
    reason:
      'a person’s own dismissal of an announcement across their clinics (A-02 criterion 16): user id, announcement id and version only, no clinic data. Every role reads only app.user_id’s rows; shifa_app writes only the signed-in person’s',
  },
  usage_daily: {
    kind: 'tenant',
    roleAccess: {
      usage_daily_platform_read:
        'the clinics list (last activity, sign-ins in 7 days) and a clinic’s usage view read every clinic’s daily counters, integers only (A-02 criteria 17, 19, 21)',
      usage_daily_platform_only_in_usage:
        'restrictive: even with a tenant set, shifa_platform reads counters only in clinic.listed and clinic.usage_viewed, and writes none',
    },
  },
  // A-03-02: a clinic's charts (spec A-03 criteria 1–3, 13) and its file-number counter. Personal
  // data on `patient`; shifa_app holds no DELETE on either (charts are never deleted).
  patient: { kind: 'tenant' },
  patient_file_counter: { kind: 'tenant' },
  // A-03-03: the name tokens of a clinic's charts (criterion 5, ADR-0052); parts of names.
  patient_name_token: { kind: 'tenant' },
  // A-03-04: a chart's treating doctors (criterion 10), membership ids; replaced by delete and add.
  patient_treating_doctor: { kind: 'tenant' },
  // A-03-05: custom field definitions and their choices (criteria 14–17); never deleted (a purged
  // field stays as a tombstone, a choice is archived), so shifa_app holds no DELETE on either.
  patient_field: { kind: 'tenant' },
  patient_field_option: { kind: 'tenant' },
  // A-03-06: a chart's custom field values and their search keys (criteria 4, 16, 17); personal
  // data. A cleared value and a purged field's values are deleted.
  patient_field_value: { kind: 'tenant' },
  // A-02-03: feature flags (criterion 7, OD-114)
  feature_flag: {
    kind: 'global',
    reason:
      'the super admin’s mode per engineering flag (off, on, selected) with reason and author; no clinic data',
    roleAccess: {
      feature_flag_platform_set:
        'shifa_platform records a flag’s first change only in a flag.changed action (A-02 criterion 7)',
      feature_flag_platform_change:
        'shifa_platform changes a flag’s mode and reason only in a flag.changed action (A-02 criterion 7)',
    },
  },
  feature_flag_tenant: {
    kind: 'tenant',
    access: 'read-only',
    roleAccess: {
      feature_flag_tenant_platform_read:
        'the flags list shows the clinics each flag is on for, across clinics (tenant ids only), in flag.listed and flag.changed (A-02 criterion 7)',
      feature_flag_tenant_platform_select_clinics:
        'shifa_platform adds a clinic to a flag’s selection only in a flag.changed action',
      feature_flag_tenant_platform_unselect:
        'shifa_platform removes a clinic from a flag’s selection only in a flag.changed action',
      feature_flag_tenant_platform_only_in_flag_actions:
        'restrictive: even with a tenant set, shifa_platform reaches selections only in a flag action and writes them only in flag.changed',
      feature_flag_tenant_platform_delete_only_in_change:
        'restrictive: even with a tenant set, shifa_platform deletes a selection only in flag.changed (a DELETE has no WITH CHECK)',
    },
  },
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
        'restrictive: even with a tenant set, shifa_platform updates only the pending, unbound membership of a clinic’s only owner (never a co-owner the owner invited), only in owner.phone_changed; user_id and status stay as they were',
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
