// What a handler may know about the request beyond its validated params, query and body: the
// generated request id, the socket address (trustProxy is off), the user agent and cookies, and a
// way to set a cookie on the reply. One parameter decorator, so handlers never take `@Req()`; the
// contract check knows it (routes.ts) and refuses every other own decorator.
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

export interface RequestMeta {
  /** The id the API generated for this request (never the client's). */
  requestId: string;
  /** Socket address; X-Forwarded-For is ignored until the reverse proxy exists. */
  ip: string;
  userAgent: string | undefined;
  /** Value of one cookie, or undefined. */
  cookie(name: string): string | undefined;
  /** Adds one Set-Cookie line to the reply. */
  setCookie(line: string): void;
  /** An info line on the request's logger (ids and enum words only; never values from input). */
  logInfo(fields: Record<string, string | number | boolean | null>, message: string): void;
}

/** Cookies of a Cookie header (first value wins; malformed encodings are kept as sent). */
export function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at <= 0) continue;
    const name = part.slice(0, at).trim();
    if (cookies.has(name)) continue;
    const raw = part.slice(at + 1).trim();
    try {
      cookies.set(name, decodeURIComponent(raw));
    } catch {
      cookies.set(name, raw);
    }
  }
  return cookies;
}

/** Factory of @ClientRequest(); exported so the contract check can recognise it. */
export function requestMetaFactory(_data: unknown, context: ExecutionContext): RequestMeta {
  const http = context.switchToHttp();
  const request = http.getRequest<FastifyRequest>();
  const reply = http.getResponse<FastifyReply>();
  const cookieHeader = request.headers.cookie;
  const userAgent = request.headers['user-agent'];
  return {
    requestId: request.id,
    ip: request.ip,
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
    cookie: (name) => parseCookies(cookieHeader).get(name),
    setCookie: (line) => {
      void reply.header('set-cookie', line);
    },
    logInfo: (fields, message) => {
      request.log.info(fields, message);
    },
  };
}

/** Handler parameter: request id, address, user agent, cookies and setCookie(). */
export const ClientRequest = createParamDecorator(requestMetaFactory);
