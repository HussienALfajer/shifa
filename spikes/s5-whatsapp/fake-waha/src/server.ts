// The WAHA endpoints the spike uses, at the pinned OpenAPI document's methods and paths, behind
// the X-Api-Key check; plus the fault-injection API under /__fake/ (only in the fake).
import { randomBytes, timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import { banError, messageKey } from './events.ts';
import { toOpenApiPath } from './openapi.ts';
import type { FakeCall, FakeSession, FakeState } from './state.ts';

export interface ServerOptions {
  apiKey: string;
  state: FakeState;
  /** Fault API: runs a named control action with JSON arguments. */
  control: (action: string, args: unknown[]) => Promise<unknown>;
}

const keyMatches = (given: unknown, expected: string) => {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

interface ChatBody {
  session?: string;
  chatId?: string;
  text?: string;
  reply_to?: string;
}

export function buildServer({ apiKey, state, control }: ServerOptions) {
  const app: FastifyInstance = Fastify({ logger: false });
  const routes: { method: string; path: string }[] = [];
  app.addHook('onRoute', (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      if (method !== 'HEAD') routes.push({ method, path: toOpenApiPath(route.url) });
    }
  });
  app.addHook('onRequest', async (request, reply) => {
    if (state.down) {
      // Gateway down: the connection is cut before any answer.
      reply.hijack();
      request.raw.socket.destroy();
      return reply;
    }
    if (!keyMatches(request.headers['x-api-key'], apiKey)) {
      return reply.code(401).send({ message: 'Unauthorized', statusCode: 401 });
    }
    return undefined;
  });

  const record = (method: string, path: string, body: ChatBody = {}): FakeCall => {
    const call: FakeCall = { at: Date.now(), endedAt: 0, clock: state.now(), method, path };
    if (body.session) call.session = body.session;
    if (body.chatId) call.chatId = body.chatId;
    if (body.text !== undefined) call.text = body.text;
    if (body.reply_to !== undefined) call.replyTo = body.reply_to;
    state.calls.push(call);
    return call;
  };
  const done = (call: FakeCall) => {
    call.endedAt = Date.now();
  };
  const sessionOr404 = (name: string, reply: FastifyReply): FakeSession | undefined => {
    const s = state.session(name);
    if (!s) void reply.code(404).send({ message: 'Session not found', statusCode: 404 });
    return s;
  };
  const info = (s: FakeSession) => ({
    name: s.name,
    status: s.status,
    config: {},
    me: s.status === 'WORKING' ? s.me : null,
    engine: { engine: 'GOWS' },
  });

  app.post<{ Body: { name: string; start?: boolean } }>('/api/sessions', async (req, reply) => {
    const call = record('POST', '/api/sessions');
    const s = state.create(req.body.name, false);
    if (req.body.start !== false) state.start(s);
    done(call);
    return reply.code(201).send(info(s));
  });
  app.get<{ Params: { session: string } }>('/api/sessions/:session', async (req, reply) => {
    const call = record('GET', `/api/sessions/${req.params.session}`, {
      session: req.params.session,
    });
    const s = sessionOr404(req.params.session, reply);
    done(call);
    return s ? info(s) : reply;
  });
  for (const action of ['start', 'stop'] as const) {
    app.post<{ Params: { session: string } }>(
      `/api/sessions/:session/${action}`,
      async (req, reply) => {
        const call = record('POST', `/api/sessions/${req.params.session}/${action}`);
        const s = sessionOr404(req.params.session, reply);
        // As the real WAHA (manual day): a start on a FAILED session answers but changes nothing.
        if (s && action === 'start' && s.status !== 'FAILED') state.start(s);
        if (s && action === 'stop') state.setStatus(s, 'STOPPED');
        done(call);
        return s ? reply.code(201).send(info(s)) : reply;
      },
    );
  }
  app.get<{ Params: { session: string } }>('/api/:session/auth/qr', async (req, reply) => {
    const call = record('GET', `/api/${req.params.session}/auth/qr`);
    const s = sessionOr404(req.params.session, reply);
    done(call);
    if (!s) return reply;
    if (s.status !== 'SCAN_QR_CODE')
      return reply.code(422).send({ message: 'Not in SCAN_QR_CODE' });
    return { value: `fake-qr-${randomBytes(8).toString('hex')}` };
  });
  app.get<{ Params: { session: string; lid: string } }>(
    '/api/:session/lids/:lid',
    async (req, reply) => {
      const call = record('GET', `/api/${req.params.session}/lids/${req.params.lid}`);
      const s = sessionOr404(req.params.session, reply);
      done(call);
      if (!s) return reply;
      const lid = req.params.lid.includes('@') ? req.params.lid : `${req.params.lid}@lid`;
      return { lid, pn: s.lids.get(lid) ?? null };
    },
  );

  for (const path of ['/api/sendSeen', '/api/startTyping', '/api/stopTyping'] as const) {
    app.post<{ Body: ChatBody }>(path, async (req, reply) => {
      const call = record('POST', path, req.body);
      const s = sessionOr404(req.body.session ?? '', reply);
      done(call);
      if (!s) return reply;
      return reply.code(201).send({});
    });
  }

  app.post<{ Body: ChatBody }>('/api/sendText', async (req, reply) => {
    const call = record('POST', '/api/sendText', req.body);
    const s = sessionOr404(req.body.session ?? '', reply);
    if (!s) return reply;
    const ok = () => {
      const id = `true_${req.body.chatId ?? ''}_${messageKey()}`;
      call.messageId = id;
      done(call);
      return reply.code(201).send({
        id,
        timestamp: Math.floor(state.now() / 1000),
        from: s.me.id,
        fromMe: true,
        source: 'api',
        to: req.body.chatId,
        body: req.body.text,
        hasMedia: false,
        ack: 1,
        ackName: 'SERVER',
      });
    };
    switch (s.sendMode) {
      case 'ok':
        return ok();
      case 'error463':
      case 'error475':
        done(call);
        return reply.code(500).send(banError(s.sendMode === 'error463' ? 463 : 475));
      case 'timeout':
      case 'hang':
        // No answer until releaseHung() (or close).
        return new Promise((resolve) => {
          state.hung.push(() => {
            resolve(ok());
          });
        });
    }
  });

  app.post<{ Params: { action: string }; Body: { args?: unknown[] } }>(
    '/__fake/:action',
    async (req) => ({ result: (await control(req.params.action, req.body.args ?? [])) ?? null }),
  );

  return { app, routes };
}
