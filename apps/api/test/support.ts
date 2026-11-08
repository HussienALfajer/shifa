// Shared helpers for API tests: an app built exactly like production (same adapter, filter and
// logger), with optional test-only controllers and every log line captured in memory.
import { Writable } from 'node:stream';
import type { Type } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { ShifaDb } from '@shifa/db';
import { ROLE_GRANTS } from '../src/access/access.module.ts';
import { AUTH_PORT, type AuthPort } from '../src/access/auth.port.ts';
import { PRODUCTION_GRANTS, ROLES, type RoleGrants } from '../src/access/roles.ts';
import { AppModule } from '../src/app.module.ts';
import { configureApp, createAdapter } from '../src/app.ts';
import { createLogger } from '../src/platform/logging.ts';

/** One parsed pino line. */
export interface LogRecord {
  msg?: unknown;
  [field: string]: unknown;
}

export interface CapturedLogs {
  stream: Writable;
  /** Every log line written so far, as raw JSON text. */
  text(): string;
  /** Parsed log records. */
  records(): LogRecord[];
}

export function captureLogs(): CapturedLogs {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _enc, done) {
      chunks.push(chunk.toString());
      done();
    },
  });
  const text = () => chunks.join('');
  return {
    stream,
    text,
    records: () =>
      text()
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line) as LogRecord),
  };
}

/** A database that must never be reached: every call is counted and rejected. */
export function offlineDb(): ShifaDb & { calls: number } {
  const db = {
    calls: 0,
    withTenant: () => {
      db.calls += 1;
      return Promise.reject(new Error('offline test database'));
    },
    withPlatformAdmin: () => {
      db.calls += 1;
      return Promise.reject(new Error('offline test database'));
    },
    close: () => Promise.resolve(),
  };
  return db;
}

export interface TestApp {
  app: NestFastifyApplication;
  logs: CapturedLogs;
  /** Every route Fastify registered, as `METHOD /url` (automatic HEAD twins of GET left out). */
  routes: string[];
}

export async function buildTestApp({
  db,
  controllers = [],
  auth,
  grants,
}: {
  db: ShifaDb;
  controllers?: Type[];
  /** Replaces the production NoAuthAdapter. */
  auth?: AuthPort;
  /** Added to the production role grants (never replaces them), so the matrix sees both. */
  grants?: RoleGrants;
}): Promise<TestApp> {
  const logs = captureLogs();
  const logger = createLogger({ level: 'info', destination: logs.stream });
  let builder = Test.createTestingModule({
    imports: [AppModule.register({ db })],
    controllers,
  });
  if (auth) builder = builder.overrideProvider(AUTH_PORT).useValue(auth);
  if (grants) {
    builder = builder
      .overrideProvider(ROLE_GRANTS)
      .useValue(mergeGrants(PRODUCTION_GRANTS, grants));
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createAdapter(logger));
  const registered: { method: string; url: string }[] = [];
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRoute', (route) => {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      for (const method of methods) registered.push({ method, url: route.url });
    });
  await configureApp(app, logger);
  return { app, logs, routes: routeList(registered) };
}

/** Production grants plus `extra`, per role. */
export function mergeGrants(production: RoleGrants, extra: RoleGrants): RoleGrants {
  return Object.fromEntries(
    ROLES.map((role) => [role, [...new Set([...production[role], ...extra[role]])]]),
  ) as unknown as RoleGrants;
}

/** `METHOD /url` per route, leaving out only the HEAD twins Fastify adds to GET routes. */
export function routeList(registered: readonly { method: string; url: string }[]): string[] {
  const gets = new Set(registered.filter((r) => r.method === 'GET').map((r) => r.url));
  return registered
    .filter((r) => !(r.method === 'HEAD' && gets.has(r.url)))
    .map((r) => `${r.method} ${r.url}`);
}
