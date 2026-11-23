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

/** What the matrix sends besides the caller's credentials, per route (A-01b criterion 13). */
export interface SampleContext {
  /** A synthetic person's phone and password that sign in successfully. */
  signIn: { phone: string; password: string };
  /** Another session of the calling person, safe to end. */
  otherSessionId: string;
}

export interface SampleRequest {
  url?: string;
  body?: unknown;
}

/** Routes taking a body or a path parameter get a valid sample, so the status shows access only. */
export const SAMPLE_REQUESTS: Readonly<Record<string, (ctx: SampleContext) => SampleRequest>> = {
  'POST /auth/sign-in': (ctx) => ({ body: ctx.signIn }),
  'DELETE /auth/sessions/:id': (ctx) => ({ url: `/auth/sessions/${ctx.otherSessionId}` }),
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
