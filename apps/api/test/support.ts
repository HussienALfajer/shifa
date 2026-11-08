// Shared helpers for API tests: an app built exactly like production (same adapter, filter and
// logger), with optional test-only controllers and every log line captured in memory.
import { Writable } from 'node:stream';
import type { Type } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { ShifaDb } from '@shifa/db';
import { AppModule } from '../src/app.module.ts';
import { configureApp, createAdapter } from '../src/app.ts';
import { createLogger } from '../src/platform/logging.ts';

export interface CapturedLogs {
  stream: Writable;
  /** Every log line written so far, as raw JSON text. */
  text(): string;
  /** Parsed log records. */
  records(): Record<string, unknown>[];
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
        .map((line) => JSON.parse(line) as Record<string, unknown>),
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
}

export async function buildTestApp({
  db,
  controllers = [],
}: {
  db: ShifaDb;
  controllers?: Type[];
}): Promise<TestApp> {
  const logs = captureLogs();
  const logger = createLogger({ level: 'info', destination: logs.stream });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register({ db })],
    controllers,
  }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createAdapter(logger));
  await configureApp(app, logger);
  return { app, logs };
}
