// Local admin page for the manual run (criterion 11, preparation). It lives outside src/ on
// purpose: the service never starts, re-pairs or fetches a QR on its own (breaker.test.ts scans
// src/); only the owner does, from this page. It is served on 127.0.0.1 only,
// behind a per-run token (sent in a header; the page keeps it in the URL fragment, which never
// reaches a server or a log) and a Host check against DNS rebinding. It shows session state,
// proxies the QR from WAHA on request (never written to disk or logs: the QR equals account
// takeover), starts and stops sessions and resumes a session after a breaker pause (OD-46).
import { randomBytes, timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyReply } from 'fastify';
import type { Messaging } from '../src/service.ts';
import { wahaCall } from '../src/waha.ts';
import { ADMIN_HTML } from './admin-html.ts';

export interface AdminPage {
  url: string;
  token: string;
  close(): Promise<void>;
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function startAdminPage(
  messaging: Messaging,
  options: { port?: number } = {},
): Promise<AdminPage> {
  const { config } = messaging.ctx;
  const token = randomBytes(24).toString('base64url');
  const app = Fastify({ logger: false });
  let host = '';
  app.addHook('onRequest', async (req, reply) => {
    if (req.headers.host !== host) return reply.code(421).send({ error: 'host' });
    reply.header('cache-control', 'no-store');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'no-referrer');
    if (req.url === '/' || req.url.startsWith('/?')) return undefined;
    const given = req.headers['x-admin-token'];
    if (typeof given !== 'string' || !same(given, token)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    return undefined;
  });

  const session = (name: string, reply: FastifyReply) => {
    const s = config.sessions.find((x) => x.name === name);
    const conf = s ? config.containers[s.container] : undefined;
    if (!s || !conf) void reply.code(404).send({ error: 'unknown session' });
    return s && conf ? { s, conf } : undefined;
  };

  app.get('/', async (_req, reply) =>
    reply
      .type('text/html; charset=utf-8')
      .header(
        'content-security-policy',
        "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob:",
      )
      .send(ADMIN_HTML),
  );
  app.get('/api/sessions', async () => ({
    sessions: await messaging.query(
      `select name, role, container, clinic_id, waha_status, health, needs_admin_resume, paused_until,
              last_ok_at from s5.session order by name`,
    ),
    verifyOutcomes: await messaging.query(
      'select outcome, count(*)::int as n from s5.verify_attempt group by outcome order by outcome',
    ),
    attempts: await messaging.query(
      'select status, count(*)::int as n from s5.delivery_attempt group by status order by status',
    ),
    optins: await messaging.query(
      `select clinic_id, (last_inbound_at is not null) as wrote, opted_out from s5.optin
       order by clinic_id`,
    ),
    alerts: await messaging.query(
      'select session, kind, count(*)::int as n from s5.admin_alert group by session, kind order by session, kind',
    ),
  }));
  app.get<{ Params: { session: string } }>('/api/sessions/:session/qr', async (req, reply) => {
    const found = session(req.params.session, reply);
    if (!found) return reply;
    const path = `/api/${encodeURIComponent(found.s.name)}/auth/qr?format=raw`;
    const res = await wahaCall(found.conf, 'GET', path, undefined, config.sendTimeoutMs);
    if (res.kind !== 'ok' || typeof res.json['value'] !== 'string') {
      return reply.code(502).send({ error: res.kind === 'http' ? res.status : res.kind });
    }
    return reply.send({ value: res.json['value'] });
  });
  app.get<{ Params: { session: string } }>('/api/sessions/:session/qr.png', async (req, reply) => {
    const found = session(req.params.session, reply);
    if (!found) return reply;
    const res = await fetch(
      `${found.conf.wahaUrl}/api/${encodeURIComponent(found.s.name)}/auth/qr?format=image`,
      {
        headers: { 'x-api-key': found.conf.apiKey, accept: 'image/png' },
        signal: AbortSignal.timeout(config.sendTimeoutMs),
      },
    ).catch(() => null);
    if (!res?.ok) return reply.code(502).send({ error: res?.status ?? 'unreachable' });
    return reply.type('image/png').send(Buffer.from(await res.arrayBuffer()));
  });
  for (const action of ['start', 'stop'] as const) {
    app.post<{ Params: { session: string } }>(
      `/api/sessions/:session/${action}`,
      async (req, reply) => {
        const found = session(req.params.session, reply);
        if (!found) return reply;
        const base = `/api/sessions/${encodeURIComponent(found.s.name)}`;
        // Manual day (2026-11-19): after an unlink on the phone the session is FAILED, and a
        // start returns 200 but leaves it FAILED; a stop first makes the start ask for a new QR.
        if (action === 'start') {
          const now = await wahaCall(found.conf, 'GET', base, undefined, config.sendTimeoutMs);
          if (now.kind === 'ok' && now.json['status'] === 'FAILED') {
            await wahaCall(found.conf, 'POST', `${base}/stop`, {}, config.sendTimeoutMs);
          }
        }
        let res = await wahaCall(found.conf, 'POST', `${base}/${action}`, {}, config.sendTimeoutMs);
        // WAHA starts only a session that exists; the first start of the day creates it (the
        // container's global webhook settings apply to it).
        if (action === 'start' && res.kind === 'http' && res.status === 404) {
          const body = { name: found.s.name, start: true };
          res = await wahaCall(found.conf, 'POST', '/api/sessions', body, config.sendTimeoutMs);
        }
        return reply.code(res.kind === 'ok' ? 200 : 502).send({ result: res.kind });
      },
    );
  }
  app.post<{ Params: { session: string } }>('/api/sessions/:session/resume', async (req, reply) => {
    if (!session(req.params.session, reply)) return reply;
    const result = await messaging.resume(req.params.session);
    return reply.code(result === 'resumed' ? 200 : 409).send({ result });
  });

  const url = await app.listen({ host: '127.0.0.1', port: options.port ?? 0 });
  host = new URL(url).host;
  return { url, token, close: () => app.close() };
}
