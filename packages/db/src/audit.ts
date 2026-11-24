// Audit event names (PLT-47, A-01a criterion 14, A-01b criterion 12). The database only checks
// the dotted lower-case form; this list is what the application writes. Rows never carry
// phones, tokens, passwords, codes or cookies: actor, target and request id are ids only.

/** Super-admin actions, written by withPlatformAdmin() with a null tenant. */
export const PLATFORM_EVENTS = [
  'clinic.listed',
  'clinic.viewed',
  'clinic.created',
  'clinic.status_changed',
  'owner.link_issued',
  'owner.mfa_reset',
  'owner.sessions_ended',
  'platform.admin_created',
] as const;
export type PlatformEvent = (typeof PLATFORM_EVENTS)[number];

/** Identity events, written on the auth path (null tenant) or in a tenant. */
export const AUTH_EVENTS = [
  'auth.sign_in',
  'auth.sign_in_failed',
  'auth.locked',
  'auth.mfa_enrolled',
  'auth.mfa_passed',
  'auth.mfa_reset',
  'auth.password_reset',
  'auth.mfa_locked',
  'auth.recovery_code_used',
  'auth.link_used',
  'auth.session_ended',
  // A-01-09: change of password, its failures, renewal of recovery codes
  'auth.password_changed',
  'auth.password_change_failed',
  'auth.recovery_codes_renewed',
] as const;

/** Team, branch and switcher events, written inside a tenant. */
export const TENANT_EVENTS = [
  'member.added',
  'member.invitation_accepted',
  'member.invitation_declined',
  'member.roles_changed',
  'member.permissions_changed',
  'member.deactivated',
  'member.reactivated',
  'member.link_issued',
  'member.mfa_reset',
  'branch.created',
  'branch.renamed',
  'branch.archived',
  'clinic.switched',
  'clinic.settings_changed',
] as const;

export type AuditEventName =
  | PlatformEvent
  | (typeof AUTH_EVENTS)[number]
  | (typeof TENANT_EVENTS)[number];

/** A request id as the API issues it; anything else is refused before it reaches a row. */
export const REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;
