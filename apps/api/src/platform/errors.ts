// One exception filter for the whole API: a minimal error envelope for clients and sanitised
// error records for the log. PostgreSQL messages and `detail` can echo values (patient data),
// so a database error is logged as SQLSTATE, constraint, table and column only.
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import {
  CODE_MESSAGES,
  type ErrorCode,
  type ErrorEnvelope,
  envelopeFor,
  type LimitReached,
  type PlaceKind,
  type SessionEndReason,
  type StaleChange,
  type SupportEnded,
  VALIDATION_FAILED_MESSAGE,
} from '@shifa/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { reportError } from '../telemetry/errors.ts';
import { RequestValidationError } from './contract/validation.ts';
import { type Logger, routeTemplate } from './logging.ts';

// The envelope, the code catalogue and the fixed messages live in @shifa/contracts.
export { type ErrorEnvelope, envelopeFor };

/**
 * An answer with its own code from the catalogue (and, for locks, when it ends). The message is
 * the code's fixed text: nothing from the request ever reaches it.
 */
export class ApiError extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    readonly until?: Date,
    /** Why the session ended: only with `session_expired` (A-01a criterion 9). */
    readonly reason?: SessionEndReason,
    /** The limit that refused an add: only with `limit_reached` (A-02 criterion 4). */
    readonly limitReached?: LimitReached,
    /** How a support grant ended: only with `session_expired`, `support_ended` (A-02-05). */
    readonly supportEnded?: SupportEnded,
    /** A Set-Cookie line sent with the answer (A-02-05: the support cookie cleared). */
    readonly setCookie?: string,
    /** Which place was archived: only with `place_archived` on a branch save (A-02-06). */
    readonly place?: PlaceKind,
    /** Who saved since the form was filled, and when: only with `stale` (A-03-02). */
    readonly stale?: StaleChange,
  ) {
    super(CODE_MESSAGES[code] ?? code, status);
  }

  /** 409 `stale`: someone saved the record since `expectedUpdatedAt` (A-03 criterion 28). */
  static stale(change: StaleChange): ApiError {
    const none = undefined;
    return new ApiError(409, 'stale', none, none, none, none, none, none, change);
  }
}

/** The answer for `exception`: its status's envelope, with field details for validation. */
function bodyFor(exception: unknown, status: number): ErrorEnvelope {
  if (exception instanceof ApiError) {
    return {
      error: {
        code: exception.code,
        message: CODE_MESSAGES[exception.code] ?? envelopeFor(status).error.message,
        ...(exception.until ? { until: exception.until.toISOString() } : {}),
        ...(exception.reason ? { reason: exception.reason } : {}),
        ...(exception.limitReached ? { limitReached: { ...exception.limitReached } } : {}),
        ...(exception.supportEnded ? { supportEnded: { ...exception.supportEnded } } : {}),
        ...(exception.place ? { place: exception.place } : {}),
        ...(exception.stale ? { stale: { ...exception.stale } } : {}),
      },
    };
  }
  if (exception instanceof RequestValidationError) {
    return {
      error: {
        code: 'validation_failed',
        message: VALIDATION_FAILED_MESSAGE,
        details: [...exception.issues],
      },
    };
  }
  return envelopeFor(status);
}

const SQLSTATE = /^[0-9A-Z]{5}$/;

interface DatabaseErrorFields {
  code: string;
  constraint?: unknown;
  table?: unknown;
  column?: unknown;
}

/** pg's DatabaseError (possibly wrapped, e.g. as a DrizzleQueryError cause). */
function findDatabaseError(err: unknown, depth = 0): DatabaseErrorFields | undefined {
  if (depth > 5 || typeof err !== 'object' || err === null) return undefined;
  const candidate = err as Partial<DatabaseErrorFields> & { severity?: unknown; cause?: unknown };
  if (
    typeof candidate.code === 'string' &&
    SQLSTATE.test(candidate.code) &&
    candidate.severity !== undefined
  ) {
    return candidate as DatabaseErrorFields;
  }
  return findDatabaseError(candidate.cause, depth + 1);
}

const identifier = (value: unknown) => (typeof value === 'string' ? value : undefined);

/**
 * What may be logged about an error. Database errors keep identifiers only (never `message`,
 * `detail`, `where` or `hint`); other errors keep their type, message and stack.
 */
export function describeError(err: unknown): Record<string, unknown> {
  const db = findDatabaseError(err);
  if (db) {
    return Object.fromEntries(
      Object.entries({
        type: 'DatabaseError',
        sqlstate: db.code,
        constraint: identifier(db.constraint),
        table: identifier(db.table),
        column: identifier(db.column),
      }).filter(([, value]) => value !== undefined),
    );
  }
  if (err instanceof Error) return { type: err.name, message: err.message, stack: err.stack };
  return { type: typeof err };
}

/** The error class and SQLSTATE: all that the error tracker is told about an error. */
export function errorClass(err: unknown): { type: string; code?: string } {
  const { type, sqlstate } = describeError(err);
  const name = typeof type === 'string' ? type : 'Error';
  return typeof sqlstate === 'string' ? { type: name, code: sqlstate } : { type: name };
}

/** HTTP status of an exception: Nest's HttpException, a Fastify 4xx error, otherwise 500. */
function statusOf(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  const status = (exception as { statusCode?: unknown } | null)?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) return status;
  return 500;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    const request = http.getRequest<FastifyRequest | undefined>();
    const status = statusOf(exception);
    const log = request?.log ?? this.logger;
    // 5xx only: a 4xx is the client's mistake, never reported to the error tracker.
    const report = (err: unknown) => {
      reportError(err, {
        ...(request ? { route: routeTemplate(request), requestId: request.id } : {}),
        status,
        ...errorClass(err),
      });
    };
    if (!(exception instanceof HttpException)) {
      if (status >= 500) {
        log.error({ err: describeError(exception) }, 'request failed');
        report(exception);
      }
    } else if (status >= 500 && exception.cause !== undefined) {
      // e.g. readiness 503: the cause is for operators, never for the client.
      log.warn({ err: describeError(exception.cause) }, 'request failed');
      report(exception.cause);
    } else if (status >= 500) {
      report(exception);
    }
    if (reply.sent) return;
    if (exception instanceof ApiError && exception.setCookie) {
      void reply.header('set-cookie', exception.setCookie);
    }
    void reply.status(status).send(bodyFor(exception, status));
  }
}
