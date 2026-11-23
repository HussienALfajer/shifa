// Setup links and TOTP (A-01a criteria 4, 5, 11, 12). A link's token travels in a request body,
// never in a URL the API sees (the web page keeps it in the fragment). Codes, keys and recovery
// codes appear only in these bodies: never in logs, errors or audit rows.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';
import { SessionView } from './identity.ts';

/** 32 random bytes, base64url (43 characters). */
export const SetupLinkToken = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/)
  .meta({ id: 'SetupLinkToken' });

export const SetupLinkRequest = z
  .object({ token: SetupLinkToken })
  .meta({ id: 'SetupLinkRequest' });
export type SetupLinkRequest = z.infer<typeof SetupLinkRequest>;

export const SetupLinkPurpose = z
  .enum(['owner_setup', 'member_setup', 'invitation', 'admin_setup'])
  .meta({ id: 'SetupLinkPurpose' });
export type SetupLinkPurpose = z.infer<typeof SetupLinkPurpose>;

export const SetupLinkRole = z
  .enum(['owner', 'doctor', 'receptionist', 'assistant', 'accountant', 'platform_admin'])
  .meta({ id: 'SetupLinkRole' });
export type SetupLinkRole = z.infer<typeof SetupLinkRole>;

/** What the setup page shows before the password is set. */
export const SetupLinkView = z
  .object({
    /** Null for a super admin's link (no clinic). */
    clinicName: z.string().nullable(),
    personName: z.string(),
    role: SetupLinkRole,
    purpose: SetupLinkPurpose,
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: 'SetupLinkView' });
export type SetupLinkView = z.infer<typeof SetupLinkView>;

export const SetPasswordRequest = z
  .object({ token: SetupLinkToken, password: z.string().min(1).max(128) })
  .meta({ id: 'SetPasswordRequest' });
export type SetPasswordRequest = z.infer<typeof SetPasswordRequest>;

/** Enrolment: the otpauth URI for the QR code and the same key for typing in. */
export const TotpEnrolStart = z
  .object({ otpauthUri: z.string(), manualKey: z.string() })
  .meta({ id: 'TotpEnrolStart' });
export type TotpEnrolStart = z.infer<typeof TotpEnrolStart>;

export const TotpCode = z
  .string()
  .regex(/^[0-9]{6}$/)
  .meta({ id: 'TotpCode' });

export const TotpEnrolConfirm = z.object({ code: TotpCode }).meta({ id: 'TotpEnrolConfirm' });
export type TotpEnrolConfirm = z.infer<typeof TotpEnrolConfirm>;

/** Ten single-use recovery codes, shown once, and the rotated session. */
export const MfaEnrolled = z
  .object({ recoveryCodes: z.array(z.string()), session: SessionView })
  .meta({ id: 'MfaEnrolled' });
export type MfaEnrolled = z.infer<typeof MfaEnrolled>;

export const TotpChallengeMethod = z.enum(['totp', 'recovery']).meta({ id: 'TotpChallengeMethod' });

/** A six-digit code, or one recovery code (case and dashes ignored). */
export const TotpChallenge = z
  .object({ method: TotpChallengeMethod, code: z.string().min(1).max(32) })
  .meta({ id: 'TotpChallenge' });
export type TotpChallenge = z.infer<typeof TotpChallenge>;

/** Public. 404 `link_invalid`: one answer for used, expired, replaced or unknown links. */
export const authSetupLinkView = defineContract({
  operationId: 'authSetupLinkView',
  method: 'POST',
  path: '/auth/setup-link/view',
  summary: 'What a setup link is for, before the password is set',
  request: { body: SetupLinkRequest },
  responses: { 200: SetupLinkView, 404: ErrorEnvelope },
});

/** Public. Sets the password, uses the link and signs in (cookie); 400 names the password rule. */
export const authSetupLinkConsume = defineContract({
  operationId: 'authSetupLinkConsume',
  method: 'POST',
  path: '/auth/setup-link/consume',
  summary: 'Set the password through a setup link and sign in',
  request: { body: SetPasswordRequest },
  responses: { 200: SessionView, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const authMfaEnrolStart = defineContract({
  operationId: 'authMfaEnrolStart',
  method: 'POST',
  path: '/auth/mfa/enrol/start',
  summary: 'Start TOTP enrolment: a new key (replaces an unconfirmed one)',
  responses: { 200: TotpEnrolStart, 409: ErrorEnvelope, 429: ErrorEnvelope },
});

/** 400 `invalid_code` or `clock_skew`; 429 `mfa_locked`. Rotates the session cookie. */
export const authMfaEnrolConfirm = defineContract({
  operationId: 'authMfaEnrolConfirm',
  method: 'POST',
  path: '/auth/mfa/enrol/confirm',
  summary: 'Confirm TOTP enrolment with one code; returns the recovery codes once',
  request: { body: TotpEnrolConfirm },
  responses: { 200: MfaEnrolled, 409: ErrorEnvelope, 429: ErrorEnvelope },
});

/** 400 `invalid_code`; 429 `mfa_locked`; 409 when the session needs no challenge. */
export const authMfaChallenge = defineContract({
  operationId: 'authMfaChallenge',
  method: 'POST',
  path: '/auth/mfa/challenge',
  summary: 'Pass the second factor for this session; rotates the session cookie',
  request: { body: TotpChallenge },
  responses: { 200: SessionView, 409: ErrorEnvelope, 429: ErrorEnvelope },
});
