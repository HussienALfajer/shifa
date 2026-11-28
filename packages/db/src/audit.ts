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
  // A-01-11: a pending owner's phone corrected (OD-99)
  'owner.phone_changed',
  'platform.admin_created',
  // A-02-02: entitlements, overrides and the type change (criterion 18)
  'entitlement.viewed',
  'entitlement.history_viewed',
  'entitlement.override_set',
  'entitlement.override_removed',
  'clinic.type_previewed',
  'clinic.type_changed',
  // A-02-03: feature flags (criterion 18)
  'flag.listed',
  'flag.changed',
  // A-02-04: a clinic's settings, locked and unlocked by the super admin (criteria 9, 18)
  'setting.viewed',
  'setting.locked',
  'setting.unlocked',
  // A-02-05: support access (criteria 11–14; ADR-0050). The reason stays on the grant row.
  'support.listed',
  'support.opened',
  'support.handoff_issued',
  'support.ended',
  // A-02-06: cities and areas (criteria 15, 18); names stay on the rows, never in audit data
  'city.listed',
  'city.created',
  'city.renamed',
  'city.archived',
  'city.restored',
  'area.created',
  'area.renamed',
  'area.archived',
  'area.restored',
  // A-02-07: announcements (criteria 16, 18; the body stays on the row) and a clinic's usage
  'announcement.listed',
  'announcement.created',
  'announcement.edited',
  'announcement.ended',
  'clinic.usage_viewed',
] as const;

/**
 * Support access events besides the platform actions (A-02-05): written in the clinic by shifa_app
 * (`support.request`, one per request of a support session; `support.ended` by an owner) or with a
 * null tenant (`support.expired`, `support.session_started`, by whichever path first sees it).
 */
export const SUPPORT_EVENTS = [
  'support.request',
  'support.ended',
  'support.expired',
  'support.session_started',
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
  // A-01-11: TOTP moved to a new phone (OD-98)
  'auth.mfa_reenrolled',
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
  // A-01-12: name and pending phone corrected (OD-103), branch restored (OD-105)
  'member.renamed',
  'member.phone_changed',
  'branch.restored',
  // A-02-06: a branch's city or area set, changed or cleared (ids only)
  'branch.place_changed',
  // A-03-02: charts (spec A-03 criterion 20); the chart id only, an edit's changed field keys
  'patient.created',
  'patient.edited',
  'patient.archived',
  'patient.restored',
  // A-03-04: registered anyway (the candidate chart ids), treating doctors changed (member ids)
  'patient.duplicate_registered',
  'patient.doctors_changed',
] as const;

export type AuditEventName =
  | PlatformEvent
  | (typeof AUTH_EVENTS)[number]
  | (typeof TENANT_EVENTS)[number]
  | (typeof SUPPORT_EVENTS)[number];

/** A request id as the API issues it; anything else is refused before it reaches a row. */
export const REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;
