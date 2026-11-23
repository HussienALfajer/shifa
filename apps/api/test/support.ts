// Shared helpers for API tests: an app built exactly like production (same adapter, filter and
// logger), with optional test-only controllers and every log line captured in memory.
import { Writable } from 'node:stream';
import type { Type } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { type Contract, defineContract, type HttpMethod } from '@shifa/contracts';
import type { AuthDb, PlatformDb, ShifaDb } from '@shifa/db';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ROLE_GRANTS } from '../src/access/access.module.ts';
import { AUTH_PORT, type AuthPort } from '../src/access/auth.port.ts';
import { type PermissionDefinition, PRODUCTION_PERMISSIONS } from '../src/access/permissions.ts';
import { PRODUCTION_GRANTS, ROLES, type RoleGrants } from '../src/access/roles.ts';
import { AppModule } from '../src/app.module.ts';
import { configureApp, createAdapter } from '../src/app.ts';
import type { Clock } from '../src/platform/clock.ts';
import { createLogger } from '../src/platform/logging.ts';
import { otlpLogForwarder } from '../src/telemetry/logs.ts';

/** Response schema of test-only routes that are not about contracts. */
export const TestAnything = z.unknown().meta({ id: 'TestAnything' });

const capitalise = (word: string) =>
  `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;

/**
 * A minimal contract for a test-only route: any 200 body, and string path parameters for each
 * `:name` in `path` (OpenAPI needs them declared).
 */
export function testContract(method: HttpMethod, path: string): Contract {
  const words = [method, ...path.split(/[^a-zA-Z0-9]+/)].filter(Boolean).map(capitalise);
  const operationId = `test${words.join('')}`;
  const names = [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1] ?? '');
  const params =
    names.length > 0
      ? z
          .object(Object.fromEntries(names.map((name) => [name, z.string()])))
          .meta({ id: `${operationId.charAt(0).toUpperCase()}${operationId.slice(1)}Params` })
      : undefined;
  // Methods that carry a body accept any body, so handlers may read @Body().
  const body =
    method === 'POST' || method === 'PUT' || method === 'PATCH' ? TestAnything : undefined;
  const request = { ...(params ? { params } : {}), ...(body ? { body } : {}) };
  return defineContract({
    operationId,
    method,
    path,
    ...(params || body ? { request } : {}),
    // Nest's default success status: 201 for POST, 200 otherwise.
    responses: { [method === 'POST' ? 201 : 200]: TestAnything },
  });
}

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
    ping: () => {
      db.calls += 1;
      return Promise.reject(new Error('offline test database'));
    },
    close: () => Promise.resolve(),
  };
  return db;
}

/** An identity database that must never be reached (apps that never sign anyone in). */
export function offlineAuthDb(): AuthDb {
  const refuse = () => Promise.reject(new Error('offline test identity database'));
  return {
    withAuth: refuse,
    withUser: refuse,
    withSetupLink: refuse,
    withUserLink: refuse,
    close: () => Promise.resolve(),
  };
}

/** A platform database that must never be reached (apps without super-admin calls). */
export function offlinePlatformDb(): PlatformDb {
  return {
    withPlatformAdmin: () => Promise.reject(new Error('offline test platform database')),
    close: () => Promise.resolve(),
  };
}

/** Test-only secrets: never used outside tests. */
export const TEST_SECRETS = {
  betterAuthSecret: 'test-better-auth-secret-0123456789abcdef',
  hmacKey: 'test-auth-hmac-key-0123456789abcdef01234',
} as const;

export interface TestApp {
  app: NestFastifyApplication;
  logs: CapturedLogs;
  /** Every route Fastify registered, as `METHOD /url` (automatic HEAD twins of GET left out). */
  routes: string[];
}

export async function buildTestApp({
  db,
  authDb = offlineAuthDb(),
  platformDb = offlinePlatformDb(),
  clock,
  clinicWebUrl,
  beforeInit,
  controllers = [],
  auth,
  grants,
  permissions,
  forwardLogs = false,
  testRoutes = false,
}: {
  db: ShifaDb;
  /** shifa_auth handle for the identity module; offline by default. */
  authDb?: AuthDb;
  /** shifa_platform handle for the super-admin API; offline by default. */
  platformDb?: PlatformDb;
  /** Origin of the clinic web app in setup links. */
  clinicWebUrl?: string;
  /** Clock of the identity module (session limits, locks); the system clock by default. */
  clock?: Clock;
  /** Runs on the Fastify instance before the app initialises (raw-route tests). */
  beforeInit?: (fastify: FastifyInstance) => void;
  /** Register the test-only routes of src/platform/test-support.ts (as NODE_ENV=test does). */
  testRoutes?: boolean;
  /** Also send every log line to the OpenTelemetry log pipeline (telemetry tests). */
  forwardLogs?: boolean;
  controllers?: Type[];
  /** Replaces the production BetterAuthAdapter. */
  auth?: AuthPort;
  /** Added to the production role grants (never replaces them), so the matrix sees both. */
  grants?: RoleGrants;
  /** Added to the production permission catalogue (test keys; probe.ts TEST_PERMISSIONS). */
  permissions?: readonly PermissionDefinition[];
}): Promise<TestApp> {
  const logs = captureLogs();
  const logger = createLogger({
    level: 'info',
    destination: logs.stream,
    ...(forwardLogs ? { forward: otlpLogForwarder() } : {}),
  });
  let builder = Test.createTestingModule({
    imports: [
      AppModule.register({
        db,
        authDb,
        platformDb,
        secrets: TEST_SECRETS,
        clinicWebUrl,
        ...(clock ? { clock } : {}),
        ...(permissions ? { permissions: [...PRODUCTION_PERMISSIONS, ...permissions] } : {}),
        testRoutes,
      }),
    ],
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
  beforeInit?.(app.getHttpAdapter().getInstance());
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
