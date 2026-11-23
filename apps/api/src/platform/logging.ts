// One pino logger per process, shared by Fastify (request logs) and Nest (framework logs).
// Logs never carry request bodies, query strings, credentials or database values.
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { LoggerService } from '@nestjs/common';
import { isSpanContextValid, trace } from '@opentelemetry/api';
import { type DestinationStream, type Logger, pino } from 'pino';
import type { LogLevel } from '../config/env.ts';
import { describeError } from './errors.ts';

export type { Logger } from 'pino';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Only plain ids from clients are logged; anything else (newlines, JSON, long) is dropped. */
const CLIENT_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Log key of a client's own x-request-id: local logs only, never exported (logs.ts drops it). */
export const CLIENT_REQUEST_ID_KEY = 'client_request_id';

/**
 * Fastify `genReqId`: always a fresh UUID. A client could put a phone number in its own id, and
 * the request id reaches spans, error events and audit rows (A-01a criterion 16).
 */
export function requestIdFor(): string {
  return randomUUID();
}

/** The client's x-request-id when well-formed (for correlating with its own logs), else undefined. */
export function clientRequestId(req: Pick<IncomingMessage, 'headers'>): string | undefined {
  const header = req.headers[REQUEST_ID_HEADER];
  return typeof header === 'string' && CLIENT_REQUEST_ID.test(header) ? header : undefined;
}

const SECRET_HEADERS = ['authorization', 'cookie', 'set-cookie', 'proxy-authorization'];

/** Defence in depth: paths redacted even if code logs headers or a body by hand. */
const REDACT_PATHS = [
  ...SECRET_HEADERS.flatMap((h) => [`headers["${h}"]`, `*.headers["${h}"]`]),
  'authorization',
  'cookie',
  'body',
  '*.body',
];

interface RequestLike {
  method?: string;
  routeOptions?: { url?: string | undefined };
}

/**
 * The route template (`/patients/:id`), never the concrete URL: path parameters and query
 * strings can carry patient data. Unmatched and malformed URLs are not logged at all.
 */
export function routeTemplate(req: RequestLike): string {
  return req.routeOptions?.url ?? '[unmatched]';
}

/**
 * `trace_id` and `span_id` of the active span, so a line can be found from its trace and back.
 * Without the telemetry SDK nothing is ever active and lines carry no ids.
 */
function traceIds(): Record<string, string> {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ids = span.spanContext();
  return isSpanContextValid(ids) ? { trace_id: ids.traceId, span_id: ids.spanId } : {};
}

/** A second destination that receives every line already serialised and redacted. */
export interface LogForwarder {
  write(line: string): void;
}

type LogArgs = [unknown, ...unknown[]];

/**
 * pino turns `log.error(err)` into `msg: err.message`, past every serializer. Rewrite it as
 * `log.error({ err }, msg)` so the error goes through the `err` serializer like any other.
 */
function errorFirst(
  this: Logger,
  args: LogArgs,
  method: (this: Logger, ...args: LogArgs) => void,
): void {
  const [first, ...rest] = args;
  if (first instanceof Error) {
    const message = typeof rest[0] === 'string' ? rest[0] : 'error';
    method.apply(this, [{ err: first }, message]);
    return;
  }
  method.apply(this, args);
}

export function createLogger({
  level,
  destination,
  forward,
}: {
  level: LogLevel;
  destination?: DestinationStream;
  /** Telemetry on: the same lines also go here (telemetry/logs.ts → OTLP). */
  forward?: LogForwarder;
}): Logger {
  const options = {
    level,
    base: null, // no pid or hostname in every line
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    hooks: { logMethod: errorFirst },
    mixin: traceIds,
    serializers: {
      // Fastify's request log: method and route only (no headers, values, body or address).
      req: (req: RequestLike) => ({ method: req.method, route: routeTemplate(req) }),
      res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
      // Callers pass describeError() output; a raw error logged by mistake (or by a library)
      // is sanitised here, so a pg error's `detail` never reaches the log either way.
      err: (err: unknown) => (err instanceof Error ? describeError(err) : err),
    },
  };
  if (forward) {
    const primary = destination ?? pino.destination(1);
    return pino(
      options,
      pino.multistream([
        { level: 'trace', stream: primary },
        { level: 'trace', stream: forward },
      ]),
    );
  }
  return destination ? pino(options, destination) : pino(options);
}

/**
 * Routes Nest's own log calls into the shared pino logger. Nest appends the context as the
 * last argument; anything between (an error's stack) is dropped, since a stack's first line
 * repeats the error message, which may hold a value.
 */
const CONTEXT = /^[A-Za-z0-9_.-]{1,64}$/;

export class NestPinoLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  #write(level: 'info' | 'error' | 'warn' | 'debug' | 'trace' | 'fatal', args: unknown[]) {
    const [message, ...rest] = args;
    const last = rest.at(-1);
    // A context is a short class name; a lone stack trace passed as last argument is not.
    const context = typeof last === 'string' && CONTEXT.test(last) ? last : undefined;
    this.logger[level](
      context === undefined ? {} : { context },
      typeof message === 'string' ? message : 'non-text log message',
    );
  }
  log(...args: unknown[]): void {
    this.#write('info', args);
  }
  error(...args: unknown[]): void {
    this.#write('error', args);
  }
  warn(...args: unknown[]): void {
    this.#write('warn', args);
  }
  debug(...args: unknown[]): void {
    this.#write('debug', args);
  }
  verbose(...args: unknown[]): void {
    this.#write('trace', args);
  }
  fatal(...args: unknown[]): void {
    this.#write('fatal', args);
  }
}
