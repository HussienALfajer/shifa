// Writes the OpenAPI 3.1 document of the production app (registered as the `openapi` drift check
// in scripts/drift.config.mjs; never run by hand, use `node scripts/check-drift.mjs --fix`).
// The app is built with a database stub that is never connected, initialised (so the start-up
// checks run) and closed again. Bundled by tsdown.openapi.config.ts: decorators need metadata,
// which Node type stripping cannot run.
// Usage: node <bundle> <output file>
import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { anonymousSchemas } from '@shifa/contracts';
import type { ShifaDb } from '@shifa/db';
import { AppModule } from '../src/app.module.ts';
import { configureApp, createAdapter } from '../src/app.ts';
import { buildOpenApiDocument, serializeDocument } from '../src/platform/contract/openapi.ts';
import { createLogger } from '../src/platform/logging.ts';

const out = process.argv[2];
if (!out) throw new Error('usage: generate-openapi <output file>');

const refuse = () => Promise.reject(new Error('the OpenAPI generator has no database'));
const db: ShifaDb = {
  withTenant: refuse,
  withPlatformAdmin: refuse,
  close: () => Promise.resolve(),
};

const logger = createLogger({ level: 'silent' });
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule.register({ db }),
  createAdapter(logger),
  { logger: false },
);
try {
  await configureApp(app, logger);
  const document = buildOpenApiDocument(app);
  const anonymous = anonymousSchemas(document);
  if (anonymous.length > 0) {
    throw new Error(`name these schemas (.meta({ id })):\n  ${anonymous.join('\n  ')}`);
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, serializeDocument(document));
} finally {
  await app.close();
}
