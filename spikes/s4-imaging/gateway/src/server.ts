// Imaging gateway (criterion 6, IMG-03, IMG-25). Refuses by default: only allowlisted DICOMweb
// routes pass, each with a valid short-lived token whose role allows it; the tenant comes from
// the token and picks the upstream Orthanc. Upstream error bodies are replaced by a fixed one,
// so another tenant's study and an unknown study answer alike. Responses stream through.
import type { Readable } from 'node:stream';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import { request } from 'undici';
import { type AuditLog, stowStudyUid } from './audit.ts';
import { authenticate } from './auth.ts';
import { matchRoute } from './routes.ts';

export interface Upstream {
  url: string;
  /** `Basic …` for the Orthanc `gateway` user; never leaves the gateway. */
  authorization: string;
}

export interface GatewayConfig {
  tokenKey: Uint8Array;
  upstreams: Readonly<Record<string, Upstream>>;
  audit: AuditLog;
  /** Largest STOW-RS request body accepted. */
  maxStowBytes: number;
  /** One line per request: route class, status, tenant, timing; never URLs, tags or tokens. */
  log?: (line: string) => void;
}

export interface Metrics {
  upstream: number;
  refused: number;
  audited: number;
}

const ERROR_BODY: Record<number, string> = {
  400: 'bad request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not found',
  413: 'too large',
  415: 'unsupported media type',
  502: 'upstream unavailable',
  503: 'unavailable',
};
const PASS_HEADERS = ['content-type', 'content-length'] as const;

export function buildServer(config: GatewayConfig): { app: FastifyInstance; metrics: Metrics } {
  const metrics: Metrics = { upstream: 0, refused: 0, audited: 0 };
  const tenants = new Set(Object.keys(config.upstreams));
  const log = config.log ?? ((line: string) => process.stdout.write(`${line}\n`));
  const app = Fastify({ logger: false, return503OnClosing: true, requestTimeout: 0 });
  app.removeAllContentTypeParsers();
  // Request bodies stay streams: STOW-RS is forwarded without buffering.
  app.addContentTypeParser('*', (_request, payload, done) => {
    done(null, payload);
  });

  const finish = (
    reply: FastifyReply,
    status: number,
    routeClass: string,
    tenant: string | null,
    start: number,
  ) => {
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
  const refuse = (
    reply: FastifyReply,
    status: number,
    start: number,
    tenant: string | null = null,
  ) => {
    metrics.refused += 1;
    finish(reply, status, 'refused', tenant, start);
    return reply
      .code(status)
      .type('application/json')
      .send({ error: ERROR_BODY[status] ?? 'refused' });
  };

  app.get('/healthz', (_request, reply) => reply.send('ok'));
  app.setNotFoundHandler((_request, reply) => refuse(reply, 404, performance.now()));
  app.setErrorHandler((_error, _request, reply) => refuse(reply, 400, performance.now()));

  app.route({
    method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    url: '/*',
    handler: async (req, reply) => {
      const start = performance.now();
      const match = matchRoute(req.method, req.raw.url ?? '');
      if (!match) return refuse(reply, 404, start);
      const auth = await authenticate(req.headers.authorization, config.tokenKey, tenants);
      if (!auth.ok) return refuse(reply, auth.status, start);
      const { principal } = auth;
      if (!match.route.roles.includes(principal.role))
        return refuse(reply, 403, start, principal.tenant);
      const upstream = config.upstreams[principal.tenant];
      if (!upstream) return refuse(reply, 403, start, principal.tenant);

      const headers: Record<string, string> = {
        authorization: upstream.authorization,
        accept: req.headers.accept ?? 'application/dicom+json',
      };
      let body: Readable | undefined;
      if (match.route.method === 'POST') {
        const length = Number(req.headers['content-length']);
        const type = req.headers['content-type'] ?? '';
        if (!Number.isSafeInteger(length) || length <= 0 || length > config.maxStowBytes) {
          return refuse(reply, 413, start, principal.tenant);
        }
        if (!/^multipart\/related\s*;/i.test(type))
          return refuse(reply, 415, start, principal.tenant);
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
      if (upstreamRes && match.route.routeClass === 'stow' && status < 400) {
        buffered = await upstreamRes.body.text();
        studyUid = stowStudyUid(buffered);
      }
      // An empty search answers 204 No Content (PS3.18 allows it): another tenant's study and an
      // unknown study then look the same on every QIDO route, list or not.
      const length = Number(upstreamRes?.headers['content-length'] ?? Number.NaN);
      if (upstreamRes && match.route.action === 'search' && status === 200 && length <= 16) {
        buffered = await upstreamRes.body.text();
        if (buffered.trim() === '[]') status = 204;
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
        return finish(reply, 503, match.route.routeClass, principal.tenant, start)
          .code(503)
          .send({ error: ERROR_BODY[503] });
      }

      finish(reply, status, match.route.routeClass, principal.tenant, start);
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
    },
  });
  return { app, metrics };
}
