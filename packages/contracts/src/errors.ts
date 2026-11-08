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
