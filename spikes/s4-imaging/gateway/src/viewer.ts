// Viewer session, OHIF proxy and the upload page (0.3-S4b, criteria 8 and 10; throwaway).
// - GET /viewer/session?code=… exchanges a one-time code for the session cookie (HttpOnly,
//   Secure, SameSite=Strict, Path=/); each code's jti is recorded, so a code works once.
// - The unmodified OHIF release is built for the origin root (its webpack public path is "/"),
//   so the gateway proxies only OHIF's own /viewer route and a strict pattern of its static
//   files at the root (bundles, styles, wasm, fonts, images), each with the session cookie.
//   Every other path is still refused by the default route.
// - /upload/ serves the built upload page; it holds no credential (the application hands it
//   short-lived uploader tokens).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { request } from 'undici';
import { authenticateCookie, SESSION_COOKIE, signSession, verifyCode } from './auth.ts';
import { type Context, unsafePath } from './context.ts';

const SEGMENT = '[A-Za-z0-9_-][A-Za-z0-9_.-]{0,120}';
/** OHIF's files at the origin root: top-level assets or under its three asset directories. */
const OHIF_ASSET = new RegExp(
  `^/(?:(?:assets|customizations|ort)/(?:${SEGMENT}/){0,4})?${SEGMENT}\\.(?:js|mjs|css|wasm|woff2|svg|png|ico|json|txt)$`,
);
const UPLOAD_ASSET = new RegExp(`^/upload/assets/${SEGMENT}\\.(?:js|css)$`);
const PASS_HEADERS = [
  'content-type',
  'content-length',
  'content-encoding',
  'cache-control',
  'etag',
];
const SESSION_PAGE = '<!doctype html><meta charset="utf-8"><title>session</title><p>ok</p>\n';

export function registerViewer(app: FastifyInstance, ctx: Context): void {
  const { config } = ctx;

  app.get(
    '/viewer/session',
    // No automatic HEAD route: a HEAD would spend the code too (security review L3).
    { exposeHeadRoute: false },
    async (req: FastifyRequest<{ Querystring: { code?: string } }>, reply) => {
      const start = performance.now();
      const code = typeof req.query.code === 'string' ? req.query.code : undefined;
      const result = await verifyCode(code, config.tokenKey, ctx.tenants);
      if (!result.ok) return ctx.refuse(reply, result.status, start);
      try {
        await config.pool.query('insert into s4.viewer_code (jti) values ($1)', [result.jti]);
      } catch (error) {
        if ((error as { code?: string }).code === '23505') return ctx.refuse(reply, 401, start);
        throw error;
      }
      const session = await signSession(result.principal, config.tokenKey);
      ctx.finish(reply, 200, 'viewer-session', result.principal.tenant, start);
      return reply
        .header(
          'set-cookie',
          `${SESSION_COOKIE}=${session}; HttpOnly; Secure; SameSite=Strict; Path=/`,
        )
        .header('cache-control', 'no-store')
        .type('text/html; charset=utf-8')
        .send(SESSION_PAGE);
    },
  );

  const ohif = async (req: FastifyRequest, reply: FastifyReply, path: string) => {
    const start = performance.now();
    if (!config.ohifUrl) return ctx.refuse(reply, 404, start);
    const auth = await authenticateCookie(req.headers.cookie, config.tokenKey, ctx.tenants);
    if (!auth.ok) return ctx.refuse(reply, auth.status, start);
    ctx.metrics.upstream += 1;
    try {
      const res = await request(`${config.ohifUrl}${path}`, {
        method: 'GET',
        headers: { 'accept-encoding': req.headers['accept-encoding'] ?? '' },
        headersTimeout: 60_000,
      });
      ctx.finish(reply, res.statusCode, 'viewer-static', auth.principal.tenant, start);
      if (res.statusCode >= 400) {
        await res.body.dump();
        return await ctx.refuse(reply, 404, start, auth.principal.tenant);
      }
      reply.code(res.statusCode);
      for (const name of PASS_HEADERS) {
        const value = res.headers[name];
        if (typeof value === 'string') reply.header(name, value);
      }
      return await reply.send(res.body);
    } catch {
      return ctx.refuse(reply, 502, start, auth.principal.tenant);
    }
  };

  // OHIF's viewer route: its index page (the query string stays in the browser).
  app.get('/viewer', (req, reply) => {
    if (unsafePath(req.raw.url ?? '')) return ctx.refuse(reply, 404, performance.now());
    return ohif(req, reply, '/index.html');
  });

  app.get('/upload/', async (_req, reply) => {
    const start = performance.now();
    if (!config.uploadPageDir) return ctx.refuse(reply, 404, start);
    ctx.finish(reply, 200, 'upload-page', null, start);
    return reply
      .type('text/html; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(await readFile(join(config.uploadPageDir, 'index.html')));
  });

  // Static files at the root: OHIF's (cookie) and the upload page's (public); else refused.
  app.addHook('onRequest', async (req, reply) => {
    if (req.method !== 'GET') return;
    const target = req.raw.url ?? '';
    const path = target.split('?')[0] ?? '';
    if (unsafePath(target)) return;
    if (UPLOAD_ASSET.test(path) && config.uploadPageDir) {
      const start = performance.now();
      const file = path.slice('/upload/'.length);
      ctx.finish(reply, 200, 'upload-page', null, start);
      return reply
        .type(path.endsWith('.css') ? 'text/css' : 'text/javascript')
        .send(await readFile(join(config.uploadPageDir, file)));
    }
    if (OHIF_ASSET.test(path) && config.ohifUrl) return ohif(req, reply, path);
    return;
  });
}
