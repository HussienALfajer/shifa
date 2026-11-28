// The one error envelope and the central error-code catalogue (ADR-0013), shared by the API,
// the web apps and the patient app. Codes are stable: clients translate them, never `message`.
import { z } from 'zod';
import { DuplicateCandidate } from './patient-card.ts';

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
    // branches (A-01-05)
    'last_branch',
    'branch_archived',
    // clinic switcher (A-01-05)
    'clinic_suspended',
    'no_clinic',
    'branch_not_held',
    // account API gaps (A-01-09)
    'password_unchanged',
    'branch_required',
    'owner_mfa_platform',
    'mfa_already_enrolled',
    'mfa_not_started',
    'mfa_not_owed',
    'mfa_not_enrolled',
    'owner_role_protected',
    // account and platform API gaps (A-01-11)
    'owner_account_exists',
    // team and branch API gaps (A-01-12)
    'member_deactivated',
    'member_not_deactivated',
    'member_account_exists',
    'self_action',
    'invitation_other_phone',
    'branch_not_archived',
    // limits, gates (A-02-03)
    'limit_reached',
    'feature_unavailable',
    // settings cascade (A-02-04)
    'setting_locked',
    'setting_not_lockable',
    // support access (A-02-05)
    'support_active',
    'support_ended',
    'support_read_only',
    // cities and areas (A-02-06)
    'place_name_taken',
    'place_archived',
    'place_not_archived',
    // announcements (A-02-07)
    'announcement_link',
    'announcement_ended',
    // patients (A-03-02)
    'previous_file_number_taken',
    'patient_id_taken',
    'patient_archived',
    'patient_not_archived',
    'patient_merged',
    'stale',
    // patient search (A-03-03)
    'rate_limited',
    // duplicates, treating doctors (A-03-04)
    'possible_duplicate',
    'doctor_not_member',
  ])
  .meta({ id: 'ErrorCode', description: 'Stable machine-readable error code.' });
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Zod 4 issue codes, and the API's own field codes after them, as reported in `details[].code` of a `validation_failed` error. */
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
    // A-02-06: a branch's area is not in its city (or has no city)
    'area_not_in_city',
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

/**
 * `idle` and `absolute`: a limit ran out. `ended`: the cookie is genuine but its session is gone
 * (ended on another device, by the owner, by the super admin or by a change of password); a
 * session deleted after its limit by an earlier request reads `ended` too. `support_ended`: the
 * support grant behind a support session ended (A-02-05; `supportEnded` says how).
 */
export const SessionEndReason = z
  .enum(['idle', 'absolute', 'ended', 'support_ended'])
  .meta({ id: 'SessionEndReason' });
export type SessionEndReason = z.infer<typeof SessionEndReason>;

/** Who ended a support grant: the super admin, an owner of the clinic, or its expiry. */
export const SupportEndedBy = z.enum(['admin', 'owner', 'expiry']).meta({ id: 'SupportEndedBy' });
export type SupportEndedBy = z.infer<typeof SupportEndedBy>;

/** How a support session's grant ended (A-02 criterion 12): the full page «انتهى دخول الدعم». */
export const SupportEnded = z
  .object({
    endedBy: SupportEndedBy,
    endedAt: z.iso.datetime(),
    /** The owner who ended it («أنهاه المالك: …»); null unless `endedBy` is `owner`. */
    ownerName: z.string().nullable(),
  })
  .meta({ id: 'SupportEnded' });
export type SupportEnded = z.infer<typeof SupportEnded>;

/** Which limit refused an add, its value and the use it was compared with (A-02 criterion 4). */
export const LimitReached = z
  .object({
    /** The limit's catalogue key, e.g. `limits.practitioners`. */
    key: z.string(),
    limit: z.number().int(),
    used: z.number().int(),
  })
  .meta({ id: 'LimitReached' });
export type LimitReached = z.infer<typeof LimitReached>;

/** Which place of a branch save was archived (with 409 `place_archived`; A-02-06). */
export const PlaceKind = z.enum(['city', 'area']).meta({ id: 'PlaceKind' });
export type PlaceKind = z.infer<typeof PlaceKind>;

/** Who saved a record last and when: with 409 `stale` (A-03 criterion 28). */
export const StaleChange = z
  .object({
    updatedAt: z.iso.datetime(),
    /** The member's name as the clinic typed it; null when not a member (support, removed). */
    updatedByName: z.string().nullable(),
  })
  .meta({ id: 'StaleChange' });
export type StaleChange = z.infer<typeof StaleChange>;

export const ErrorBody = z
  .object({
    code: ErrorCode,
    /** Fixed English text per code, for logs and developers; never shown to users. */
    message: z.string(),
    /** Present only when `code` is `validation_failed`. */
    details: z.array(ValidationIssue).optional(),
    /** End of a lock (ISO 8601, UTC): only with `phone_locked`, `ip_blocked`, `mfa_locked`. */
    until: z.iso.datetime().optional(),
    /** Why the session ended: only with `session_expired` (A-01a criterion 9). */
    reason: SessionEndReason.optional(),
    /** The limit that refused the add: only with `limit_reached` (A-02 criterion 4). */
    limitReached: LimitReached.optional(),
    /** How the support grant ended: only with `session_expired`, reason `support_ended`. */
    supportEnded: SupportEnded.optional(),
    /** Which place of a branch was archived: only with `place_archived` on a branch save. */
    place: PlaceKind.optional(),
    /** Who saved since the form was filled, and when: only with `stale` (A-03-02). */
    stale: StaleChange.optional(),
    /** The charts not acknowledged: only with `possible_duplicate` (A-03-04). */
    candidates: z.array(DuplicateCandidate).optional(),
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
  owner_setup_pending: 'The clinic’s owner has not set up their account yet',
  last_owner: 'The clinic must keep at least one active owner',
  phone_in_team: 'This phone is already a member of this clinic',
  account_shared: 'This account works in another clinic; recovery goes through the platform',
  permission_not_sensitive: 'Only sensitive permissions can be switched per member',
  last_branch: 'The clinic must keep at least one active branch',
  branch_archived: 'This branch is archived',
  clinic_suspended: 'This clinic account is suspended',
  no_clinic: 'No clinic is available for this account',
  branch_not_held: 'No role in this branch',
  password_unchanged: 'The new password is the current one',
  branch_required: 'Choose a branch',
  owner_mfa_platform: 'An owner’s two-factor is reset through the platform',
  mfa_already_enrolled: 'Two-factor is already enrolled',
  mfa_not_started: 'Two-factor enrolment was not started',
  mfa_not_owed: 'No two-factor code is due for this session',
  mfa_not_enrolled: 'Two-factor is not enrolled',
  owner_role_protected: 'Only the owner themselves or the platform removes an owner’s role',
  owner_account_exists: 'The clinic’s owner already has an account',
  member_deactivated: 'This member is deactivated',
  member_not_deactivated: 'This member is not deactivated',
  member_account_exists: 'This member has already accepted; their phone cannot change',
  self_action: 'Not allowed on your own membership',
  invitation_other_phone: 'This invitation was sent to another phone number',
  branch_not_archived: 'This branch is not archived',
  limit_reached: 'The clinic has reached a limit of its plan',
  feature_unavailable: 'This feature is not available to this clinic',
  setting_locked: 'This setting is locked by the platform',
  setting_not_lockable: 'This setting cannot be locked for a clinic',
  support_active: 'You already have open support access to this clinic',
  support_ended: 'This support access has ended',
  support_read_only: 'Support access is read-only',
  place_name_taken: 'A place with this name already exists here',
  place_archived: 'This place is archived',
  place_not_archived: 'This place is not archived',
  announcement_link: 'An announcement is plain text, without a link',
  announcement_ended: 'This announcement has ended',
  previous_file_number_taken: 'Another chart of this clinic has this previous file number',
  patient_id_taken: 'This chart id holds another chart',
  patient_archived: 'This chart is archived',
  patient_not_archived: 'This chart is not archived',
  patient_merged: 'This chart was merged into another',
  stale: 'Someone else saved this record since you opened it',
  rate_limited: 'Too many searches in a short time',
  possible_duplicate: 'Charts like this one exist; acknowledge them to register anyway',
  doctor_not_member: 'A treating doctor must be a doctor member of this clinic',
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
