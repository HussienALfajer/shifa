// Builds the Nest application on Fastify. Tests use createAdapter() + configureApp() with a
// Nest testing module, so they run exactly the production adapter, filter and logger.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { ShifaDb } from '@shifa/db';
import { AppModule } from './app.module.ts';
import { GlobalExceptionFilter } from './platform/errors.ts';
import {
  type Logger,
  NestPinoLogger,
  REQUEST_ID_HEADER,
  requestIdFor,
} from './platform/logging.ts';

/** 1 MB: no endpoint in Release 1 takes more in JSON (uploads go to object storage). */
export const BODY_LIMIT_BYTES = 1024 * 1024;

export function createAdapter(logger: Logger): FastifyAdapter {
  return new FastifyAdapter({
    loggerInstance: logger,
    bodyLimit: BODY_LIMIT_BYTES,
    // Off until deployment fixes the proxy chain; otherwise X-Forwarded-For is client-controlled.
    trustProxy: false,
    requestIdHeader: false,
    genReqId: requestIdFor,
  });
}

/** Logger, global filter and response hooks; ends with the app initialised and Fastify ready. */
export async function configureApp(app: NestFastifyApplication, logger: Logger): Promise<void> {
  app.useLogger(new NestPinoLogger(logger));
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onSend', async (request, reply, payload) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
    return payload;
  });
  await app.init();
  await fastify.ready();
}

export async function createApp({
  db,
  logger,
}: {
  db: ShifaDb;
  logger: Logger;
}): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register({ db }),
    createAdapter(logger),
    { bufferLogs: true },
  );
  await configureApp(app, logger);
  return app;
}
