// The one error envelope and the central error-code catalogue (ADR-0013), shared by the API,
// the web apps and the patient app. Codes are stable: clients translate them, never `message`.
import { z } from 'zod';

/** Every error code the API answers with. Add codes; never rename or reuse one. */
export const ErrorCode = z
  .enum([
    'bad_request',
    'validation_failed',
    'unauthorized',
    'forbidden',
    'not_found',
    'method_not_allowed',
    'not_acceptable',
    'request_timeout',
    'conflict',
    'payload_too_large',
    'uri_too_long',
    'unsupported_media_type',
    'unprocessable_entity',
    'too_many_requests',
    'internal_error',
    'service_unavailable',
    // identity (A-01-02)
    'invalid_credentials',
    'phone_locked',
    'ip_blocked',
    'session_expired',
    // setup links and MFA (A-01-03)
    'link_invalid',
    'password_too_short',
    'password_common',
    'password_contains_phone',
    'mfa_enrolment_required',
    'mfa_challenge_required',
    'mfa_locked',
    'invalid_code',
    'clock_skew',
    'owner_setup_pending',
    // team and invitations (A-01-04)
    'last_owner',
    'phone_in_team',
    'account_shared',
    'permission_not_sensitive',
  ])
  .meta({ id: 'ErrorCode', description: 'Stable machine-readable error code.' });
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Zod 4 issue codes, as reported in `details[].code` of a `validation_failed` error. */
export const ValidationIssueCode = z
  .enum([
    'invalid_type',
    'too_big',
    'too_small',
    'invalid_format',
    'not_multiple_of',
    'unrecognized_keys',
    'invalid_union',
    'invalid_key',
    'invalid_element',
    'invalid_value',
    'custom',
  ])
  .meta({ id: 'ValidationIssueCode' });
export type ValidationIssueCode = z.infer<typeof ValidationIssueCode>;

/** One invalid field: where it is and what is wrong. Never carries the submitted value. */
export const ValidationIssue = z
  .object({
    /** `params.id`, `query.limit`, `body.items.0.name`; `body` for the body as a whole. */
    path: z.string(),
    code: ValidationIssueCode,
  })
  .meta({ id: 'ValidationIssue' });
export type ValidationIssue = z.infer<typeof ValidationIssue>;

export const ErrorBody = z
  .object({
    code: ErrorCode,
    /** Fixed English text per code, for logs and developers; never shown to users. */
    message: z.string(),
    /** Present only when `code` is `validation_failed`. */
    details: z.array(ValidationIssue).optional(),
    /** End of a lock (ISO 8601, UTC): only with `phone_locked`, `ip_blocked`, `mfa_locked`. */
    until: z.iso.datetime().optional(),
  })
  .meta({ id: 'ErrorBody' });
export type ErrorBody = z.infer<typeof ErrorBody>;

/** The response body of every error. */
export const ErrorEnvelope = z.object({ error: ErrorBody }).meta({ id: 'ErrorEnvelope' });
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

/** Code and fixed message per HTTP status. Unlisted 4xx → 400's entry, unlisted 5xx → 500's. */
export const STATUS_ERRORS: Readonly<Record<number, { code: ErrorCode; message: string }>> = {
  400: { code: 'bad_request', message: 'Bad request' },
  401: { code: 'unauthorized', message: 'Unauthorized' },
  403: { code: 'forbidden', message: 'Forbidden' },
  404: { code: 'not_found', message: 'Not found' },
  405: { code: 'method_not_allowed', message: 'Method not allowed' },
  406: { code: 'not_acceptable', message: 'Not acceptable' },
  408: { code: 'request_timeout', message: 'Request timeout' },
  409: { code: 'conflict', message: 'Conflict' },
  413: { code: 'payload_too_large', message: 'Payload too large' },
  414: { code: 'uri_too_long', message: 'URI too long' },
  415: { code: 'unsupported_media_type', message: 'Unsupported media type' },
  422: { code: 'unprocessable_entity', message: 'Unprocessable entity' },
  429: { code: 'too_many_requests', message: 'Too many requests' },
  500: { code: 'internal_error', message: 'Internal server error' },
  503: { code: 'service_unavailable', message: 'Service unavailable' },
};

/** Fixed messages of the codes that are not a plain status (clients translate the code). */
export const CODE_MESSAGES: Readonly<Partial<Record<ErrorCode, string>>> = {
  invalid_credentials: 'Invalid phone or password',
  phone_locked: 'Too many failed sign-ins for this phone',
  ip_blocked: 'Too many failed sign-ins from this address',
  session_expired: 'Session expired',
  link_invalid: 'This link is no longer valid',
  password_too_short: 'Password too short',
  password_common: 'Password too common',
  password_contains_phone: 'Password contains the phone number',
  mfa_enrolment_required: 'Two-factor enrolment required',
  mfa_challenge_required: 'Two-factor code required',
  mfa_locked: 'Too many wrong codes',
  invalid_code: 'Invalid code',
  clock_skew: 'Code from a device whose clock is off',
  owner_setup_pending: 'This phone is the owner of a clinic that is not set up yet',
  last_owner: 'The clinic must keep at least one active owner',
  phone_in_team: 'This phone is already a member of this clinic',
  account_shared: 'This account works in another clinic; recovery goes through the platform',
  permission_not_sensitive: 'Only sensitive permissions can be switched per member',
};

/** Message of a `validation_failed` error (same text as a plain 400). */
export const VALIDATION_FAILED_MESSAGE = 'Bad request';

/** The envelope for `status`, falling back to 400's or 500's entry. */
export function envelopeFor(status: number): ErrorEnvelope {
  const fallback = status < 500 ? 400 : 500;
  const entry = STATUS_ERRORS[status] ?? STATUS_ERRORS[fallback] ?? STATUS_ERRORS[500];
  return {
    error: { code: entry?.code ?? 'internal_error', message: entry?.message ?? 'Internal error' },
  };
}
