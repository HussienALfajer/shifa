// One exception filter for the whole API: a minimal error envelope for clients and sanitised
// error records for the log. PostgreSQL messages and `detail` can echo values (patient data),
// so a database error is logged as SQLSTATE, constraint, table and column only.
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import { type ErrorEnvelope, envelopeFor, VALIDATION_FAILED_MESSAGE } from '@shifa/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { RequestValidationError } from './contract/validation.ts';
import type { Logger } from './logging.ts';

// The envelope, the code catalogue and the fixed messages live in @shifa/contracts.
export { type ErrorEnvelope, envelopeFor };

/** The answer for `exception`: its status's envelope, with field details for validation. */
function bodyFor(exception: unknown, status: number): ErrorEnvelope {
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
    if (!(exception instanceof HttpException)) {
      if (status >= 500) log.error({ err: describeError(exception) }, 'request failed');
    } else if (status >= 500 && exception.cause !== undefined) {
      // e.g. readiness 503: the cause is for operators, never for the client.
      log.warn({ err: describeError(exception.cause) }, 'request failed');
    }
    if (reply.sent) return;
    void reply.status(status).send(bodyFor(exception, status));
  }
}
