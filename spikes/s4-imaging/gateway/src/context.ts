// What every gateway route module shares: configuration, counters, the one-line request log
// and the uniform refusal (fixed error bodies; a refused client loses its connection).
import type { FastifyReply, FastifyRequest } from 'fastify';
import type pg from 'pg';
import type { AuditLog } from './audit.ts';
import { type AuthResult, authenticate } from './auth.ts';
import type { Role } from './routes.ts';

export interface Upstream {
  url: string;
  /** `Basic …` for the Orthanc `gateway` user; never leaves the gateway. */
  authorization: string;
}

export interface GatewayConfig {
  tokenKey: Uint8Array;
  upstreams: Readonly<Record<string, Upstream>>;
  audit: AuditLog;
  /** The gateway's spike database (upload sessions, used viewer codes). */
  pool: pg.Pool;
  /** Largest STOW-RS request body accepted. */
  maxStowBytes: number;
  /** Where chunked uploads are assembled (one directory per session, files by index). */
  uploadDir: string;
  /** OHIF container behind /viewer/ (unset: the viewer routes answer 404). */
  ohifUrl?: string;
  /** Built upload page served at /upload/ (unset: 404). */
  uploadPageDir?: string;
  /** One line per request: route class, status, tenant, timing; never URLs, tags or tokens. */
  log?: (line: string) => void;
}

export interface Metrics {
  upstream: number;
  refused: number;
  audited: number;
}

export const ERROR_BODY: Record<number, string> = {
  400: 'bad request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not found',
  409: 'conflict',
  413: 'too large',
  415: 'unsupported media type',
  422: 'checksum mismatch',
  502: 'upstream unavailable',
  503: 'unavailable',
};

export interface Context {
  config: GatewayConfig;
  metrics: Metrics;
  tenants: ReadonlySet<string>;
  /** Logs the request line and returns the reply. */
  finish(
    reply: FastifyReply,
    status: number,
    routeClass: string,
    tenant: string | null,
    start: number,
  ): FastifyReply;
  refuse(reply: FastifyReply, status: number, start: number, tenant?: string | null): FastifyReply;
  /** Bearer token with one of `roles`, or a refusal already sent. */
  bearer(
    req: FastifyRequest,
    reply: FastifyReply,
    roles: readonly Role[],
    start: number,
  ): Promise<AuthResult>;
}

export function createContext(config: GatewayConfig): Context {
  const metrics: Metrics = { upstream: 0, refused: 0, audited: 0 };
  const tenants = new Set(Object.keys(config.upstreams));
  const log = config.log ?? ((line: string) => process.stdout.write(`${line}\n`));
  const finish: Context['finish'] = (reply, status, routeClass, tenant, start) => {
    log(
      JSON.stringify({
        route: routeClass,
        status,
        tenant,
        ms: Math.round(performance.now() - start),
      }),
    );
    return reply;
  };
  const refuse: Context['refuse'] = (reply, status, start, tenant = null) => {
    metrics.refused += 1;
    finish(reply, status, 'refused', tenant, start);
    // A refused client does not keep its connection (nor trickle an unread body into it).
    return reply
      .header('connection', 'close')
      .code(status)
      .type('application/json')
      .send({ error: ERROR_BODY[status] ?? 'refused' });
  };
  const bearer: Context['bearer'] = async (req, reply, roles, start) => {
    const auth = await authenticate(req.headers.authorization, config.tokenKey, tenants);
    if (!auth.ok) {
      refuse(reply, auth.status, start);
      return auth;
    }
    if (!roles.includes(auth.principal.role)) {
      refuse(reply, 403, start, auth.principal.tenant);
      return { ok: false, status: 403 };
    }
    return auth;
  };
  return { config, metrics, tenants, finish, refuse, bearer };
}

/** A raw request target with dot segments, encoded characters, backslashes or `//`. */
export const unsafePath = (target: string): boolean => {
  const q = target.indexOf('?');
  const path = q === -1 ? target : target.slice(0, q);
  return /%|\\|\/\/|\/\.\.?(\/|$)/.test(path);
};

/** Reads a request body stream into memory, refusing more than `limit` bytes. */
export async function readBody(
  stream: AsyncIterable<Buffer> | undefined,
  limit: number,
): Promise<Buffer | null> {
  if (!stream) return Buffer.alloc(0);
  const parts: Buffer[] = [];
  let total = 0;
  for await (const part of stream) {
    total += part.length;
    if (total > limit) return null;
    parts.push(part);
  }
  return Buffer.concat(parts);
}
