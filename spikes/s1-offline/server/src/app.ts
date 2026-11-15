// Spike server: plain Fastify on @shifa/db. Routes: spike login, JWKS, POST /commands (the shared
// handler), the outbox pull, health. The prototype is served from `staticDir` when given.
import fastifyStatic from '@fastify/static';
import type { ShifaDb } from '@shifa/db';
import { sql } from 'drizzle-orm';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createAuth, type Principal, type SigningKeys } from './auth.ts';
import { CommandBatch } from './commands.ts';
import { handleBatch } from './handler/index.ts';
import { findTenant, type Identities } from './identities.ts';
import { type Logger, redacting } from './log.ts';
import { registerPowerSyncUpload } from './powersync-upload.ts';
import { registerReportRoute } from './report.ts';
import { registerSyncRoutes } from './sync.ts';

export interface ServerOptions {
  db: ShifaDb;
  identities: Identities;
  tokenTtlSeconds: number;
  log: Logger;
  /** Built prototype to serve at `/` (optional). */
  staticDir?: string;
  /** Signing keys shared with another server instance (default: a fresh pair). */
  keys?: SigningKeys;
}

async function seedPractitioners(db: ShifaDb, ids: Identities): Promise<void> {
  for (const t of [ids.A, ids.B]) {
    await db.withTenant(
      { tenantId: t.tenantId, branchId: t.branchId, userId: t.receptionist.userId },
      async (tx) => {
        for (const p of t.practitioners) {
          await tx.execute(
            sql`insert into s1.practitioner (id, branch_id, label) values (${p.id}, ${t.branchId}, ${p.label})
              on conflict (tenant_id, id) do nothing`,
          );
        }
      },
    );
  }
}

const DeviceId = z
  .string()
  .regex(/^[A-Za-z0-9-]{1,40}$/)
  .optional();
const Login = z.object({ username: z.string().max(40), deviceId: DeviceId });
const PatientLogin = z.object({ patientId: z.uuid(), deviceId: DeviceId });

export async function buildServer(options: ServerOptions): Promise<FastifyInstance> {
  const log = redacting(options.log);
  const auth = await createAuth(options.tokenTtlSeconds, options.keys);
  await seedPractitioners(options.db, options.identities);
  const app = Fastify({ logger: false, bodyLimit: 1_048_576 });

  app.addHook('onResponse', async (req, reply) => {
    log({
      event: 'request',
      method: req.method,
      route: req.routeOptions.url ?? 'unknown',
      status: reply.statusCode,
    });
  });
  app.setErrorHandler(async (err, _req, reply) => {
    const code = (err as { code?: unknown }).code;
    log({ event: 'error', code: typeof code === 'string' ? code : 'unknown' });
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.code(status >= 400 && status < 500 ? status : 500).send({ error: 'error' });
  });

  const principalOf = (req: FastifyRequest): Promise<Principal | undefined> =>
    auth.verify(req.headers.authorization);

  app.get('/health', () => ({ ok: true }));
  app.get('/.well-known/jwks.json', () => auth.jwks());

  app.post('/auth/login', async (req, reply) => {
    const body = Login.safeParse(req.body);
    const tenant = [options.identities.A, options.identities.B].find(
      (t) => body.success && t.receptionist.username === body.data.username,
    );
    if (!tenant) return reply.code(401).send({ error: 'unknown_user' });
    const token = await auth.sign({
      sub: tenant.receptionist.userId,
      tenantId: tenant.tenantId,
      branchId: tenant.branchId,
      role: 'reception',
      ...(body.success && body.data.deviceId ? { deviceId: body.data.deviceId } : {}),
    });
    return {
      token,
      tenantId: tenant.tenantId,
      branchId: tenant.branchId,
      practitioners: tenant.practitioners,
    };
  });

  app.post('/auth/patient-login', async (req, reply) => {
    const body = PatientLogin.safeParse(req.body);
    const tenant = [options.identities.A, options.identities.B].find(
      (t) => body.success && t.patients.some((p) => p.id === body.data.patientId),
    );
    if (!tenant || !body.success) return reply.code(401).send({ error: 'unknown_user' });
    const token = await auth.sign({
      sub: body.data.patientId,
      tenantId: tenant.tenantId,
      branchId: tenant.branchId,
      role: 'patient',
      ...(body.data.deviceId ? { deviceId: body.data.deviceId } : {}),
    });
    return { token, tenantId: tenant.tenantId, branchId: tenant.branchId };
  });

  app.post('/commands', async (req, reply) => {
    const principal = await principalOf(req);
    if (!principal || !findTenant(options.identities, principal.tenantId)) {
      return reply.code(401).send({ error: 'unauthenticated' });
    }
    const batch = CommandBatch.safeParse(req.body);
    if (!batch.success) return reply.code(400).send({ error: 'invalid_batch' });
    const results = await handleBatch({ db: options.db, log }, principal, batch.data.commands);
    log({ event: 'batch', tenantId: principal.tenantId, count: results.length });
    return { results };
  });

  registerSyncRoutes(app, { db: options.db, log, principalOf });
  registerReportRoute(app, { db: options.db, log, principalOf });
  registerPowerSyncUpload(app, { db: options.db, log, principalOf });

  if (options.staticDir) {
    await app.register(fastifyStatic, { root: options.staticDir, prefix: '/' });
  }
  return app;
}
