// One pino logger per process, shared by Fastify (request logs) and Nest (framework logs).
// Logs never carry request bodies, query strings, credentials or database values.
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { LoggerService } from '@nestjs/common';
import { type DestinationStream, type Logger, pino } from 'pino';
import type { LogLevel } from '../config/env.ts';

export type { Logger } from 'pino';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Only plain ids are taken from clients; anything else (newlines, JSON, long) is replaced. */
const CLIENT_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Fastify `genReqId`: the client's x-request-id when well-formed, otherwise a fresh UUID. */
export function requestIdFor(req: IncomingMessage): string {
  const header = req.headers[REQUEST_ID_HEADER];
  return typeof header === 'string' && CLIENT_REQUEST_ID.test(header) ? header : randomUUID();
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
  url?: string;
  routeOptions?: { url?: string };
}

/** Path without the query string: query parameters can carry patient data. */
function pathOf(url: string | undefined): string | undefined {
  return url?.split('?', 1)[0];
}

export function createLogger({
  level,
  destination,
}: {
  level: LogLevel;
  destination?: DestinationStream;
}): Logger {
  const options = {
    level,
    base: null, // no pid or hostname in every line
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    serializers: {
      // Fastify's request log: method and path only (no headers, query, body or address).
      req: (req: RequestLike) => ({ method: req.method, path: pathOf(req.url) }),
      res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
      // `err` is already sanitised by describeError(); pino's default would re-add fields.
      err: (err: unknown) => err,
    },
  };
  return destination ? pino(options, destination) : pino(options);
}

/**
 * Routes Nest's own log calls into the shared pino logger. Nest appends the context as the
 * last argument; anything between (an error's stack) is dropped, since a stack's first line
 * repeats the error message, which may hold a value.
 */
export class NestPinoLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  #write(level: 'info' | 'error' | 'warn' | 'debug' | 'trace' | 'fatal', args: unknown[]) {
    const [message, ...rest] = args;
    const context = rest.at(-1);
    this.logger[level](
      typeof context === 'string' ? { context } : {},
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
