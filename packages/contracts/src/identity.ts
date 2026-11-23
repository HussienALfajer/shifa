// Sign-in and sessions (A-01a criteria 6–10). The session travels in an HttpOnly cookie, never in
// a body: these schemas carry ids, times and the active clinic only, never a token or a phone.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';

/** Phone as typed (normalised by the server with normalisePhone()) and password. */
export const SignInRequest = z
  .object({
    phone: z.string().min(1).max(32),
    password: z.string().min(1).max(128),
  })
  .meta({ id: 'SignInRequest' });
export type SignInRequest = z.infer<typeof SignInRequest>;

export const SessionRole = z
  .enum(['owner', 'doctor', 'receptionist', 'assistant', 'accountant'])
  .meta({ id: 'SessionRole' });
export type SessionRole = z.infer<typeof SessionRole>;

/** A role the person holds in the active clinic: tenant-wide (branchId null) or in one branch. */
export const SessionRoleAssignment = z
  .object({
    role: SessionRole,
    tenantId: z.uuid(),
    branchId: z.uuid().nullable(),
  })
  .meta({ id: 'SessionRoleAssignment' });

/**
 * The session's second factor (A-01a criteria 11, 12): `none` (no TOTP enrolled), `pending`
 * (enrolled, challenge not yet passed in this session), `verified` (passed in this session).
 */
export const MfaState = z.enum(['none', 'pending', 'verified']).meta({ id: 'MfaState' });
export type MfaState = z.infer<typeof MfaState>;

/** The signed-in person's current session: who, where, and when it ends. */
export const SessionView = z
  .object({
    userId: z.uuid(),
    sessionId: z.uuid(),
    /** A super admin (admin web); never a clinic role. */
    platformAdmin: z.boolean(),
    mfa: MfaState,
    /**
     * True when this person must enrol TOTP before anything else (owners, super admins). With
     * `mfa: 'pending'`, anyone must pass the challenge first.
     */
    mfaRequired: z.boolean(),
    /** Active clinic; null when the person has none or must choose (A-01-05). */
    tenantId: z.uuid().nullable(),
    branchId: z.uuid().nullable(),
    roles: z.array(SessionRoleAssignment),
    /** The idle limit that applies: the clinic's setting, or 15 without a clinic. */
    idleMinutes: z.int().min(1),
    /** When the session ends unless another request comes first (warning one minute before). */
    idleExpiresAt: z.iso.datetime(),
    /** When the session ends however active (12 h after sign-in). */
    absoluteExpiresAt: z.iso.datetime(),
  })
  .meta({ id: 'SessionView' });
export type SessionView = z.infer<typeof SessionView>;

/** One of the person's sessions, for «جلساتي» (criterion 10). */
export const SessionSummary = z
  .object({
    id: z.uuid(),
    /** Android, iPhone, iPad, Windows, macOS, Linux; null when unknown. */
    device: z.string().nullable(),
    /** Chrome, Edge, Firefox, Safari, Samsung Internet, Opera; null when unknown. */
    browser: z.string().nullable(),
    createdAt: z.iso.datetime(),
    lastActiveAt: z.iso.datetime(),
    /** The session this request came with. */
    current: z.boolean(),
  })
  .meta({ id: 'SessionSummary' });
export type SessionSummary = z.infer<typeof SessionSummary>;

export const SessionList = z
  .object({ sessions: z.array(SessionSummary) })
  .meta({ id: 'SessionList' });
export type SessionList = z.infer<typeof SessionList>;

export const EndedSessions = z.object({ ended: z.int().min(0) }).meta({ id: 'EndedSessions' });
export type EndedSessions = z.infer<typeof EndedSessions>;

export const SessionIdParams = z.object({ id: z.uuid() }).meta({ id: 'SessionIdParams' });

/** Public. 401 `invalid_credentials` (one answer for a wrong phone or password); 429 locks. */
export const authSignIn = defineContract({
  operationId: 'authSignIn',
  method: 'POST',
  path: '/auth/sign-in',
  summary: 'Sign in with phone and password; sets the session cookie',
  request: { body: SignInRequest },
  responses: { 200: SessionView, 401: ErrorEnvelope, 429: ErrorEnvelope },
});

export const authSignOut = defineContract({
  operationId: 'authSignOut',
  method: 'POST',
  path: '/auth/sign-out',
  summary: 'End this session and clear the cookie',
  responses: { 204: null },
});

export const authSession = defineContract({
  operationId: 'authSession',
  method: 'GET',
  path: '/auth/session',
  summary: 'The current session',
  responses: { 200: SessionView },
});

export const authSessions = defineContract({
  operationId: 'authSessions',
  method: 'GET',
  path: '/auth/sessions',
  summary: 'The signed-in person’s sessions',
  responses: { 200: SessionList },
});

export const authEndSession = defineContract({
  operationId: 'authEndSession',
  method: 'DELETE',
  path: '/auth/sessions/:id',
  summary: 'End one of the signed-in person’s sessions',
  request: { params: SessionIdParams },
  responses: { 204: null, 404: ErrorEnvelope },
});

export const authEndOtherSessions = defineContract({
  operationId: 'authEndOtherSessions',
  method: 'POST',
  path: '/auth/sessions/end-others',
  summary: 'End every session of the signed-in person but this one',
  responses: { 200: EndedSessions },
});
