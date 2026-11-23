// Builds the Nest application on Fastify. Tests use createAdapter() + configureApp() with a
// Nest testing module, so they run exactly the production adapter, filter and logger.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AuthDb, PlatformDb, ShifaDb } from '@shifa/db';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppModule } from './app.module.ts';
import type { IdentitySecrets } from './modules/identity/index.ts';
import { envelopeFor, GlobalExceptionFilter } from './platform/errors.ts';
import {
  CLIENT_REQUEST_ID_KEY,
  clientRequestId,
  type Logger,
  NestPinoLogger,
  REQUEST_ID_HEADER,
  requestIdFor,
} from './platform/logging.ts';
import { registerRequestGuard } from './platform/request-guard.ts';
import { registerTelemetryHooks } from './telemetry/http.ts';

/** 1 MB: no endpoint in Release 1 takes more in JSON (uploads go to object storage). */
export const BODY_LIMIT_BYTES = 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 30_000;

export function createAdapter(logger: Logger): FastifyAdapter {
  return new FastifyAdapter({
    loggerInstance: logger,
    bodyLimit: BODY_LIMIT_BYTES,
    // Off until deployment fixes the proxy chain; otherwise X-Forwarded-For is client-controlled.
    trustProxy: false,
    requestIdHeader: false,
    genReqId: requestIdFor,
    // Fastify's default 0 means no limit: a client trickling a body could hold a socket forever.
    requestTimeout: REQUEST_TIMEOUT_MS,
    // Routing errors (bad URL encoding, overlong parameters) happen before Nest's filter runs;
    // Fastify's default would echo and log the whole URL, query string included.
    frameworkErrors: (error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
      const status = error.statusCode === 414 ? 414 : 400;
      void reply.code(status).send(envelopeFor(status));
    },
  });
}

/** Logger, global filter and response hooks; ends with the app initialised and Fastify ready. */
export async function configureApp(app: NestFastifyApplication, logger: Logger): Promise<void> {
  app.useLogger(new NestPinoLogger(logger));
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  const fastify = app.getHttpAdapter().getInstance();
  registerTelemetryHooks(fastify);
  registerRequestGuard(fastify);
  // A client's own request id goes on its lines under a separate key (logs only, never exported).
  fastify.addHook('onRequest', (request, reply, done) => {
    const clientId = clientRequestId(request.raw);
    if (clientId !== undefined) {
      // Both: Fastify writes "request completed" through reply.log.
      request.log = request.log.child({ [CLIENT_REQUEST_ID_KEY]: clientId });
      reply.log = request.log;
    }
    done();
  });
  fastify.addHook('onSend', async (request, reply, payload) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
    return payload;
  });
  await app.init();
  await fastify.ready();
}

export async function createApp({
  db,
  authDb,
  platformDb,
  secrets,
  clinicWebUrl,
  logger,
  testRoutes = false,
}: {
  db: ShifaDb;
  authDb: AuthDb;
  platformDb: PlatformDb;
  secrets: IdentitySecrets;
  clinicWebUrl?: string | undefined;
  logger: Logger;
  /** NODE_ENV=test only (config.testRoutes): registers platform/test-support.ts. */
  testRoutes?: boolean;
}): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register({ db, authDb, platformDb, secrets, clinicWebUrl, testRoutes }),
    createAdapter(logger),
    // From the first line on, so errors while Nest builds providers also go through pino.
    { logger: new NestPinoLogger(logger) },
  );
  await configureApp(app, logger);
  return app;
}
