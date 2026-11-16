// Imaging gateway (criterion 6, IMG-03, IMG-25). Refuses by default: only allowlisted DICOMweb
// routes pass, each with a valid short-lived token whose role allows it; the tenant comes from
// the token and picks the upstream Orthanc. Upstream error bodies are replaced by a fixed one,
// so another tenant's study and an unknown study answer alike. Responses stream through.
// 0.3-S4b adds the chunked upload (uploads.ts), the edge push routes (transfers.ts) and the
// viewer session and OHIF proxy (viewer.ts); GET DICOMweb routes also take the viewer cookie.
import type { Readable } from 'node:stream';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { request } from 'undici';
import { stowStudyUid } from './audit.ts';
import { type AuthResult, authenticate, authenticateCookie } from './auth.ts';
import {
  type Context,
  createContext,
  ERROR_BODY,
  type GatewayConfig,
  type Metrics,
} from './context.ts';
import { matchRoute } from './routes.ts';
import { registerTransfers } from './transfers.ts';
import { registerUploads } from './uploads.ts';
import { registerViewer } from './viewer.ts';

export type { GatewayConfig, Metrics, Upstream } from './context.ts';

const PASS_HEADERS = ['content-type', 'content-length'] as const;

export function buildServer(config: GatewayConfig): { app: FastifyInstance; metrics: Metrics } {
  const ctx = createContext(config);
  const app = Fastify({
    logger: false,
    return503OnClosing: true,
    // No total limit (a 300 MB STOW on a 1 Mbps uplink takes about 40 minutes), but a socket
    // idle for two minutes is closed: longer than a P1 cut plus TCP backoff, short enough that
    // idle clients cannot hold every connection.
    requestTimeout: 0,
    connectionTimeout: 120_000,
  });
  app.removeAllContentTypeParsers();
  // Request bodies stay streams: STOW-RS and Transfers buckets are forwarded without buffering.
  app.addContentTypeParser('*', (_request, payload, done) => {
    done(null, payload);
  });

  app.get('/healthz', (_request, reply) => reply.send('ok'));
  app.setNotFoundHandler((_request, reply) => ctx.refuse(reply, 404, performance.now()));
  app.setErrorHandler((_error, _request, reply) => ctx.refuse(reply, 400, performance.now()));
  registerUploads(app, ctx);
  registerTransfers(app, ctx);
  registerViewer(app, ctx);
  app.route({
    method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    url: '/*',
    handler: (req, reply) => dicomweb(ctx, req, reply),
  });
  return { app, metrics: ctx.metrics };
}

async function dicomweb(ctx: Context, req: FastifyRequest, reply: FastifyReply) {
  const { config, metrics, tenants } = ctx;
  const start = performance.now();
  const match = matchRoute(req.method, req.raw.url ?? '');
  if (!match) return ctx.refuse(reply, 404, start);
  // The bearer header wins; the viewer cookie counts on GET routes only.
  let auth: AuthResult;
  if (req.headers.authorization !== undefined || match.route.method !== 'GET') {
    auth = await authenticate(req.headers.authorization, config.tokenKey, tenants);
  } else {
    auth = await authenticateCookie(req.headers.cookie, config.tokenKey, tenants);
  }
  if (!auth.ok) return ctx.refuse(reply, auth.status, start);
  const { principal } = auth;
  if (!match.route.roles.includes(principal.role))
    return ctx.refuse(reply, 403, start, principal.tenant);
  const upstream = config.upstreams[principal.tenant];
  if (!upstream) return ctx.refuse(reply, 403, start, principal.tenant);

  const headers: Record<string, string> = {
    authorization: upstream.authorization,
    accept: req.headers.accept ?? 'application/dicom+json',
  };
  let body: Readable | undefined;
  if (match.route.method === 'POST') {
    const length = Number(req.headers['content-length']);
    const type = req.headers['content-type'] ?? '';
    if (!Number.isSafeInteger(length) || length <= 0 || length > config.maxStowBytes) {
      return ctx.refuse(reply, 413, start, principal.tenant);
    }
    if (!/^multipart\/related\s*;/i.test(type))
      return ctx.refuse(reply, 415, start, principal.tenant);
    headers['content-type'] = type;
    headers['content-length'] = String(length);
    body = req.body as Readable;
  }

  metrics.upstream += 1;
  const target = `${upstream.url}/dicom-web${match.upstreamPath}${match.query ? `?${match.query}` : ''}`;
  let status: number;
  let upstreamRes: Awaited<ReturnType<typeof request>> | undefined;
  try {
    upstreamRes = await request(target, {
      method: match.route.method,
      headers,
      ...(body ? { body } : {}),
      headersTimeout: 300_000,
      bodyTimeout: 0,
    });
    status = upstreamRes.statusCode;
  } catch {
    status = 502;
  }

  let studyUid = match.studyUid;
  let buffered: string | undefined;
  // An empty search answers 204 No Content (PS3.18 allows it): another tenant's study and an
  // unknown study then look the same on every QIDO route, list or not.
  const length = Number(upstreamRes?.headers['content-length'] ?? Number.NaN);
  const smallSearch = match.route.action === 'search' && status === 200 && length <= 16;
  const stowOk = match.route.routeClass === 'stow' && status < 400;
  if (upstreamRes && (stowOk || smallSearch)) {
    try {
      buffered = await upstreamRes.body.text();
      if (stowOk) studyUid = stowStudyUid(buffered);
      else if (buffered.trim() === '[]') status = 204;
    } catch {
      // Orthanc dropped the connection after its headers: an upstream failure, still
      // audited below (the STOW was already forwarded); the failed stream is not drained.
      status = 502;
      buffered = undefined;
      upstreamRes = undefined;
    }
  }
  try {
    await config.audit.write({
      actor: principal.actor,
      tenant: principal.tenant,
      studyUid,
      action: match.route.action,
      routeClass: match.route.routeClass,
      status,
    });
    metrics.audited += 1;
  } catch {
    await upstreamRes?.body.dump();
    return ctx
      .finish(reply, 503, match.route.routeClass, principal.tenant, start)
      .code(503)
      .send({ error: ERROR_BODY[503] });
  }

  ctx.finish(reply, status, match.route.routeClass, principal.tenant, start);
  // Patient data must not stay in a shared clinic PC's browser cache (security review M3).
  reply.header('cache-control', 'no-store').header('x-content-type-options', 'nosniff');
  if (status === 204) return reply.code(204).send();
  if (!upstreamRes || status >= 400) {
    await upstreamRes?.body.dump();
    const code = status >= 500 ? 502 : status;
    return reply
      .code(code)
      .type('application/json')
      .send({ error: ERROR_BODY[code] ?? 'error' });
  }
  reply.code(status);
  for (const name of PASS_HEADERS) {
    const value = upstreamRes.headers[name];
    if (typeof value === 'string' && !(buffered !== undefined && name === 'content-length')) {
      reply.header(name, value);
    }
  }
  return reply.send(buffered ?? upstreamRes.body);
}
