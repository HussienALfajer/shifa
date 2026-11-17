// The throwaway messaging service: database, sessions from config, webhook router, the clinic
// admin's resume endpoint, the queue (pg-boss) and the health job.
import { timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { resume } from './breaker.ts';
import { type Deps, defaultDeps, type MessagingConfig, makeLogger } from './config.ts';
import { type Ctx, ts } from './context.ts';
import { Db } from './db.ts';
import { runHealth } from './health.ts';
import { type Queue, startQueue } from './queue.ts';
import { type SendResult, sendWhatsApp } from './send.ts';
import { type TickResult, tick } from './tick.ts';
import { registerWebhooks } from './webhook.ts';

export interface Messaging {
  app: FastifyInstance;
  /** Listens on 127.0.0.1 and returns the base URL. */
  listen(port?: number): Promise<string>;
  sendWhatsApp(
    clinicId: string,
    patientId: string,
    templateKey: string,
    vars: Record<string, string>,
  ): Promise<SendResult>;
  registerPatient(clinicId: string, patientId: string, phone: string): Promise<void>;
  /** One queue step for a session (the pg-boss worker runs the same). */
  tick(session: string): Promise<TickResult>;
  /** The 5-minute health job's handler. */
  runHealth(): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

const tokenMatches = (header: unknown, token: string) => {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function createMessaging(
  config: MessagingConfig,
  deps: Partial<Deps> = {},
): Promise<Messaging> {
  const allDeps: Deps = { ...defaultDeps, ...deps };
  const db = new Db(config.databaseUrl);
  await db.migrate();
  let queue: Queue | undefined;
  const ctx: Ctx = {
    config,
    db,
    deps: allDeps,
    log: makeLogger(allDeps),
    kick: async (session, at) => {
      await queue?.kick(session, at);
    },
  };
  for (const s of config.sessions) {
    await db.query(
      `insert into s5.session (name, container, clinic_id, role, time_zone, created_at)
       values ($1, $2, $3, $4, $5, $6) on conflict (name) do nothing`,
      [s.name, s.container, s.clinicId, s.role, s.timeZone, ts(ctx)],
    );
  }
  const health = () => runHealth(ctx);
  if (config.queue !== 'off') queue = await startQueue(ctx, config.queue, health);

  const app = Fastify({ logger: false, bodyLimit: 1_048_576 });
  // The webhook HMAC covers the raw body, so JSON stays a Buffer until it is verified.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });
  registerWebhooks(app, ctx);
  app.post<{ Params: { session: string } }>(
    '/admin/sessions/:session/resume',
    async (req, reply) => {
      if (!tokenMatches(req.headers.authorization, config.adminToken)) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const result = await resume(ctx, req.params.session);
      const code = result === 'resumed' ? 200 : result === 'unknown_session' ? 404 : 409;
      return reply.code(code).send({ result });
    },
  );

  return {
    app,
    async listen(port = 0) {
      return app.listen({ host: '127.0.0.1', port });
    },
    sendWhatsApp: (clinicId, patientId, templateKey, vars) =>
      sendWhatsApp(ctx, clinicId, patientId, templateKey, vars),
    async registerPatient(clinicId, patientId, phone) {
      await db.query(
        `insert into s5.patient (clinic_id, patient_id, phone) values ($1, $2, $3)
         on conflict (clinic_id, patient_id) do update set phone = excluded.phone`,
        [clinicId, patientId, phone],
      );
    },
    tick: (session) => tick(ctx, session),
    runHealth: health,
    query: (sql, params) => db.query(sql, params),
    async close() {
      await app.close();
      await queue?.stop();
      await db.close();
    },
  };
}
