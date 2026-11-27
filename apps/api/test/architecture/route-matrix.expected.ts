// The route permission matrix: every API route × caller, with the expected status class.
// This file is the review surface for access changes: a new route needs a row here, or CI fails.
// 200 = any 2xx; 401 = not authenticated; 403 = authenticated without the permission.
// Rows under "probe" come from the test-only ProbeModule (test/access/probe.ts); rows under
// "test-only" from src/platform/test-support.ts, registered only when NODE_ENV=test.
// 500 = the route fails on purpose (test-only routes only).
import type { Role } from '../../src/access/roles.ts';

export type Caller = 'anonymous' | Role;
export type Expected = 200 | 401 | 403 | 500;
export type MatrixRow = Readonly<Record<Caller, Expected>>;
export type Matrix = Readonly<Record<string, MatrixRow>>;

const everyone: MatrixRow = {
  anonymous: 200,
  owner: 200,
  doctor: 200,
  receptionist: 200,
  assistant: 200,
  accountant: 200,
  platform_admin: 200,
};

const failsForEveryone: MatrixRow = {
  anonymous: 500,
  owner: 500,
  doctor: 500,
  receptionist: 500,
  assistant: 500,
  accountant: 500,
  platform_admin: 500,
};

/** @SignedIn(): any signed-in person, whatever their roles (own session and account routes). */
const signedIn: MatrixRow = {
  anonymous: 401,
  owner: 200,
  doctor: 200,
  receptionist: 200,
  assistant: 200,
  accountant: 200,
  platform_admin: 200,
};

/** @PlatformAdmin(): super admins only (A-01-03); every clinic role is refused. */
const platformAdmin: MatrixRow = {
  anonymous: 401,
  owner: 403,
  doctor: 403,
  receptionist: 403,
  assistant: 403,
  accountant: 403,
  platform_admin: 200,
};

/** What the matrix sends besides the caller's credentials, per route (A-01b criterion 13). */
export interface SampleContext {
  /** A synthetic person's phone and password that sign in successfully. */
  signIn: { phone: string; password: string };
  /** Another session of the calling person, safe to end. */
  otherSessionId: string;
  /** A clinic with a pending owner (super-admin routes). */
  clinicId: string;
  /** A synthetic phone no one has used yet. */
  nextPhone(): string;
  /** A fresh owner setup link's token (a new clinic each call). */
  newLinkToken(): Promise<string>;
  /** A clinic whose owner has an account (A-01-11: actions on a pending owner answer 409). */
  ownedClinicId(): Promise<string>;
  /**
   * Puts the calling person's TOTP in `state` ('none': removed; 'unconfirmed', 'enrolled' or
   * 'reenrolling' (enrolled, with a pending re-enrolment, OD-98) with a known key) and returns
   * the current code. Anonymous callers: no-op.
   */
  totp(state: 'none' | 'unconfirmed' | 'enrolled' | 'reenrolling'): Promise<string>;
  /** A fresh member of the callers' clinic (TENANT_A), pending or deactivated (A-01-04). */
  memberId(status?: 'pending' | 'deactivated'): Promise<string>;
  /**
   * A fresh branch of the callers' clinic (TENANT_A), never its last active one (A-01-05);
   * archived for the restore route (A-01-12).
   */
  branchId(state?: 'active' | 'archived'): Promise<string>;
  /** A fresh open invitation for the calling person's phone; its membership id (OD-90). */
  invitationId(): Promise<string>;
  /** A new clinic where the calling person is an active doctor (A-01-05 switch). */
  callerClinicId(): Promise<string>;
  /** A fresh invitation to TENANT_B for the calling person's phone; its token. */
  invitationToken(): Promise<string>;
  /** Sets the calling person's password back to the known one and returns it (A-01-09). */
  password(): Promise<string>;
  /** A fresh active doctor of TENANT_A with an account and TOTP enrolled (A-01-09 reset). */
  enrolledMemberId(): Promise<string>;
  /** A new clinic with an override of `limits.branches` (A-02-02 removal). */
  overriddenClinicId(): Promise<string>;
}

export interface SampleRequest {
  url?: string;
  body?: unknown;
  /** The caller's MFA state for this call (test auth only), e.g. `pending` for the challenge. */
  mfa?: 'none' | 'pending' | 'verified';
}

type Sample = (ctx: SampleContext) => SampleRequest | Promise<SampleRequest>;

/** Routes taking a body or a path parameter get a valid sample, so the status shows access only. */
export const SAMPLE_REQUESTS: Readonly<Record<string, Sample>> = {
  'POST /auth/sign-in': (ctx) => ({ body: ctx.signIn }),
  'DELETE /auth/sessions/:id': (ctx) => ({ url: `/auth/sessions/${ctx.otherSessionId}` }),
  'POST /auth/setup-link/view': async (ctx) => ({ body: { token: await ctx.newLinkToken() } }),
  'POST /auth/setup-link/consume': async (ctx) => ({
    body: { token: await ctx.newLinkToken(), password: ctx.signIn.password },
  }),
  'POST /auth/mfa/enrol/start': async (ctx) => {
    await ctx.totp('none');
    return {};
  },
  'POST /auth/mfa/enrol/confirm': async (ctx) => ({
    body: { code: await ctx.totp('unconfirmed') },
  }),
  'POST /auth/mfa/challenge': async (ctx) => ({
    body: { method: 'totp', code: await ctx.totp('enrolled') },
    mfa: 'pending',
  }),
  'POST /platform/clinics': (ctx) => ({
    body: {
      name: 'عيادة المصفوفة',
      type: 'solo',
      status: 'trial',
      ownerName: 'مالك المصفوفة',
      ownerPhone: ctx.nextPhone(),
    },
  }),
  'GET /platform/clinics/:id': (ctx) => ({ url: `/platform/clinics/${ctx.clinicId}` }),
  'PATCH /platform/clinics/:id': (ctx) => ({
    url: `/platform/clinics/${ctx.clinicId}`,
    body: { status: 'active' },
  }),
  'POST /platform/clinics/:id/owner/setup-link': (ctx) => ({
    url: `/platform/clinics/${ctx.clinicId}/owner/setup-link`,
  }),
  'POST /platform/clinics/:id/owner/reset-mfa': async (ctx) => ({
    url: `/platform/clinics/${await ctx.ownedClinicId()}/owner/reset-mfa`,
  }),
  'POST /platform/clinics/:id/owner/end-sessions': async (ctx) => ({
    url: `/platform/clinics/${await ctx.ownedClinicId()}/owner/end-sessions`,
  }),
  'PATCH /platform/clinics/:id/owner': (ctx) => ({
    url: `/platform/clinics/${ctx.clinicId}/owner`,
    body: { phone: ctx.nextPhone() },
  }),
  'GET /platform/clinics/:id/entitlements': (ctx) => ({
    url: `/platform/clinics/${ctx.clinicId}/entitlements`,
  }),
  'PUT /platform/clinics/:id/overrides/:key': (ctx) => ({
    url: `/platform/clinics/${ctx.clinicId}/overrides/limits.branches`,
    body: { value: 2, reason: 'سبب تجريبي للمصفوفة' },
  }),
  'DELETE /platform/clinics/:id/overrides/:key': async (ctx) => ({
    url: `/platform/clinics/${await ctx.overriddenClinicId()}/overrides/limits.branches`,
  }),
  'GET /platform/clinics/:id/overrides/:key/history': (ctx) => ({
    url: `/platform/clinics/${ctx.clinicId}/overrides/limits.branches/history`,
  }),
  'GET /platform/clinics/:id/type-preview': (ctx) => ({
    url: `/platform/clinics/${ctx.clinicId}/type-preview?type=multi_branch`,
  }),
  'GET /team/members/:id': async (ctx) => ({ url: `/team/members/${await ctx.memberId()}` }),
  'POST /team/members': (ctx) => ({
    body: {
      name: 'موظف المصفوفة',
      phone: ctx.nextPhone(),
      roles: [{ role: 'receptionist', branchId: null }],
    },
  }),
  'PATCH /team/members/:id': async (ctx) => ({
    url: `/team/members/${await ctx.memberId()}`,
    body: { roles: [{ role: 'doctor', branchId: null }] },
  }),
  'POST /team/members/:id/deactivate': async (ctx) => ({
    url: `/team/members/${await ctx.memberId()}/deactivate`,
  }),
  'POST /team/members/:id/reactivate': async (ctx) => ({
    url: `/team/members/${await ctx.memberId('deactivated')}/reactivate`,
  }),
  'POST /team/members/:id/setup-link': async (ctx) => ({
    url: `/team/members/${await ctx.memberId()}/setup-link`,
  }),
  'POST /team/members/:id/reset-mfa': async (ctx) => ({
    url: `/team/members/${await ctx.enrolledMemberId()}/reset-mfa`,
  }),
  // A-01-12: the sensitive keys with each role's default (OD-102), a pending member's phone
  // (OD-103), an archived branch restored (OD-105).
  'GET /team/permissions': () => ({}),
  'PATCH /team/members/:id/phone': async (ctx) => ({
    url: `/team/members/${await ctx.memberId()}/phone`,
    body: { phone: ctx.nextPhone() },
  }),
  'POST /branches/:id/restore': async (ctx) => ({
    url: `/branches/${await ctx.branchId('archived')}/restore`,
  }),
  // A-01-09: the caller's own password and recovery codes.
  'POST /auth/password': async (ctx) => ({
    body: { currentPassword: await ctx.password(), newPassword: 'matrix lantern harbour 31' },
  }),
  'POST /auth/mfa/recovery-codes': async (ctx) => ({
    body: { code: await ctx.totp('enrolled') },
  }),
  'POST /auth/mfa/re-enrol/start': async (ctx) => ({
    body: { code: await ctx.totp('enrolled') },
  }),
  'POST /auth/mfa/re-enrol/confirm': async (ctx) => ({
    body: { code: await ctx.totp('reenrolling') },
  }),
  'PATCH /clinic/settings': () => ({ body: { idleMinutes: 30 } }),
  'POST /branches': () => ({ body: { name: 'فرع المصفوفة' } }),
  // A-01-05: the chooser needs a clinic or an invitation of the caller; the switch a clinic where
  // the caller is an active member.
  'GET /me/clinics': async (ctx) => {
    await ctx.invitationId();
    return {};
  },
  'POST /me/switch': async (ctx) => ({ body: { tenantId: await ctx.callerClinicId() } }),
  'PATCH /branches/:id': async (ctx) => ({
    url: `/branches/${await ctx.branchId()}`,
    body: { name: 'فرع معدّل' },
  }),
  'GET /branches/:id/archive-preview': async (ctx) => ({
    url: `/branches/${await ctx.branchId()}/archive-preview`,
  }),
  'POST /branches/:id/archive': async (ctx) => ({
    url: `/branches/${await ctx.branchId()}/archive`,
  }),
  'POST /invitations/view': async (ctx) => ({ body: { token: await ctx.invitationToken() } }),
  'POST /invitations/accept': async (ctx) => ({ body: { token: await ctx.invitationToken() } }),
  'POST /invitations/decline': async (ctx) => ({ body: { token: await ctx.invitationToken() } }),
};

/** @RequirePermission of an owner key (members.*, clinic.settings.manage; A-01-04). */
const ownerOnly: MatrixRow = {
  anonymous: 401,
  owner: 200,
  doctor: 403,
  receptionist: 403,
  assistant: 403,
  accountant: 403,
  platform_admin: 403,
};

/** Routes that exist only when NODE_ENV=test; never in production or the OpenAPI document. */
export const TEST_ONLY_ROUTES: ReadonlySet<string> = new Set(['GET /_test/fail']);

export const EXPECTED_MATRIX: Matrix = {
  // production
  'GET /health/live': everyone,
  'GET /health/ready': everyone,
  // identity (A-01-02): sign-in is public; the rest need a session and no permission
  'POST /auth/sign-in': everyone,
  'POST /auth/sign-out': signedIn,
  'GET /auth/session': signedIn,
  'GET /auth/sessions': signedIn,
  'DELETE /auth/sessions/:id': signedIn,
  'POST /auth/sessions/end-others': signedIn,
  // the person's own account (A-01-09): profile (before MFA too), password, MFA status, codes
  'GET /me': signedIn,
  'POST /auth/password': signedIn,
  'GET /auth/mfa': signedIn,
  'POST /auth/mfa/recovery-codes': signedIn,
  // A-01-11: TOTP moved to a new phone (OD-98), after MFA
  'POST /auth/mfa/re-enrol/start': signedIn,
  'POST /auth/mfa/re-enrol/confirm': signedIn,
  // setup links and MFA (A-01-03): a link's token is the credential; enrolment and the
  // challenge need a session (and are reachable before MFA)
  'POST /auth/setup-link/view': everyone,
  'POST /auth/setup-link/consume': everyone,
  'POST /auth/mfa/enrol/start': signedIn,
  'POST /auth/mfa/enrol/confirm': signedIn,
  'POST /auth/mfa/challenge': signedIn,
  // super admin (A-01-03): @PlatformAdmin, never a clinic role
  'GET /platform/clinics': platformAdmin,
  'POST /platform/clinics': platformAdmin,
  'GET /platform/clinics/:id': platformAdmin,
  'PATCH /platform/clinics/:id': platformAdmin,
  'POST /platform/clinics/:id/owner/setup-link': platformAdmin,
  'POST /platform/clinics/:id/owner/reset-mfa': platformAdmin,
  'POST /platform/clinics/:id/owner/end-sessions': platformAdmin,
  // A-01-11: a pending owner's phone corrected (OD-99)
  'PATCH /platform/clinics/:id/owner': platformAdmin,
  // A-02-02: a clinic's entitlements, overrides, their history and the type preview
  'GET /platform/clinics/:id/entitlements': platformAdmin,
  'PUT /platform/clinics/:id/overrides/:key': platformAdmin,
  'DELETE /platform/clinics/:id/overrides/:key': platformAdmin,
  'GET /platform/clinics/:id/overrides/:key/history': platformAdmin,
  'GET /platform/clinics/:id/type-preview': platformAdmin,
  // team (A-01-04): members.view / members.manage, owner only
  'GET /team/members': ownerOnly,
  'GET /team/members/:id': ownerOnly,
  'POST /team/members': ownerOnly,
  'PATCH /team/members/:id': ownerOnly,
  'POST /team/members/:id/deactivate': ownerOnly,
  'POST /team/members/:id/reactivate': ownerOnly,
  'POST /team/members/:id/setup-link': ownerOnly,
  'POST /team/members/:id/reset-mfa': ownerOnly,
  // A-01-12: members.view (catalogue) and members.manage (phone), owner only
  'GET /team/permissions': ownerOnly,
  'PATCH /team/members/:id/phone': ownerOnly,
  // clinic settings (A-01a criterion 9): clinic.settings.manage
  'GET /clinic/settings': ownerOnly,
  'PATCH /clinic/settings': ownerOnly,
  // branches (A-01-05): branches.manage
  'GET /branches': ownerOnly,
  'POST /branches': ownerOnly,
  'PATCH /branches/:id': ownerOnly,
  'GET /branches/:id/archive-preview': ownerOnly,
  'POST /branches/:id/archive': ownerOnly,
  // A-01-12: branches.manage (OD-105)
  'POST /branches/:id/restore': ownerOnly,
  // invitations (A-01-04): the token is the credential to view; answering needs a session
  'POST /invitations/view': everyone,
  'POST /invitations/accept': signedIn,
  'POST /invitations/decline': signedIn,
  // the clinic chooser and switcher (A-01-05): the person's own clinics, any role
  'GET /me/clinics': signedIn,
  'POST /me/switch': signedIn,
  // probe
  'GET /__probe/public': everyone,
  'GET /__probe/read': {
    anonymous: 401,
    owner: 200,
    doctor: 200,
    receptionist: 200,
    assistant: 403,
    accountant: 403,
    platform_admin: 403,
  },
  'GET /__probe/sensitive': {
    anonymous: 401,
    owner: 200,
    doctor: 403,
    receptionist: 403,
    assistant: 403,
    accountant: 403,
    platform_admin: 403,
  },
  // the sensitive key clinical.notes.view by role default (toggles: test/access/catalogue.test.ts)
  'GET /__probe/notes': {
    anonymous: 401,
    owner: 403,
    doctor: 200,
    receptionist: 403,
    assistant: 200,
    accountant: 403,
    platform_admin: 403,
  },
  // test-only (TEST_ONLY_ROUTES)
  'GET /_test/fail': failsForEveryone,
};
