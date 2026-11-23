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
  /**
   * Puts the calling person's TOTP in `state` ('none': removed; 'unconfirmed' or 'enrolled'
   * with a known key) and returns the current code. Anonymous callers: no-op.
   */
  totp(state: 'none' | 'unconfirmed' | 'enrolled'): Promise<string>;
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
  'POST /platform/clinics/:id/owner/reset-mfa': (ctx) => ({
    url: `/platform/clinics/${ctx.clinicId}/owner/reset-mfa`,
  }),
  'POST /platform/clinics/:id/owner/end-sessions': (ctx) => ({
    url: `/platform/clinics/${ctx.clinicId}/owner/end-sessions`,
  }),
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
  // test-only (TEST_ONLY_ROUTES)
  'GET /_test/fail': failsForEveryone,
};
