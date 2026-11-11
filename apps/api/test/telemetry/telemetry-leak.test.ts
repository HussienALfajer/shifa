// Criterion 6 (PLT-52), the leak test: synthetic patient data sent in the path, query, body,
// headers and cookie of a request whose handler fails in PostgreSQL with an error that quotes
// the value never appears in any exported span, metric or log record (serialised as OTLP JSON,
// exactly what goes over the wire), in any error event (the Sentry envelope as sent) or in the
// stdout log.
import { Body, Controller, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { SpanStatusCode } from '@opentelemetry/api';
import {
  JsonLogsSerializer,
  JsonMetricsSerializer,
  JsonTraceSerializer,
} from '@opentelemetry/otlp-transformer';
import {
  defineContract,
  type RequestBody,
  type RequestParams,
  type RequestQuery,
} from '@shifa/contracts';
import type { ShifaDb } from '@shifa/db';
import { testDb } from '@shifa/db/testing';
import { createRandom, fullName, generatePersonName, generatePhone } from '@shifa/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Public } from '../../src/access/index.ts';
import { Contract } from '../../src/platform/contract/index.ts';
import { SHIFA_DB } from '../../src/platform/database.module.ts';
import {
  flushErrors,
  startErrorReporting,
  stopErrorReporting,
} from '../../src/telemetry/errors.ts';
import { buildTestApp, TestAnything, type TestApp } from '../support.ts';
import { type ErrorSink, errorSink, TEST_DSN } from './error-sink.ts';
import { listen, startTestTelemetry, type TestTelemetry } from './support.ts';

const random = createRandom(20261111);
const NAME = fullName(generatePersonName(random, { sex: 'female', adult: true, region: 'azaz' }));
const PHONE = generatePhone(random, 'SY');
const NOTE = `ملاحظة سريرية اصطناعية ${String(random.int(100000, 999999))}`;
const TOKEN = `synthetic-token-${String(random.int(100000, 999999))}`;
const SECRETS = { NAME, PHONE, NOTE, TOKEN };

const leakProbe = defineContract({
  operationId: 'testTelemetryLeak',
  method: 'POST',
  path: '/test-telemetry/:name',
  request: {
    params: z.object({ name: z.string() }).meta({ id: 'TestTelemetryLeakParams' }),
    query: z.object({ phone: z.string() }).meta({ id: 'TestTelemetryLeakQuery' }),
    body: z.object({ note: z.string() }).meta({ id: 'TestTelemetryLeakBody' }),
  },
  responses: { 200: TestAnything },
});

/** Sends each value to PostgreSQL as a uuid: the error message quotes the value back. */
@Controller('test-telemetry')
class LeakController {
  constructor(@Inject(SHIFA_DB) private readonly db: ShifaDb) {}

  @Public()
  @Contract(leakProbe)
  @HttpCode(200)
  @Post(':name')
  async fail(
    @Param() params: RequestParams<typeof leakProbe>,
    @Query() query: RequestQuery<typeof leakProbe>,
    @Body() body: RequestBody<typeof leakProbe>,
  ): Promise<unknown> {
    for (const value of [params.name, query.phone]) {
      await this.db
        .withPlatformAdmin('leak-test', (tx) => tx.execute(sql`select ${value}::uuid`))
        .catch(() => undefined);
    }
    return this.db.withPlatformAdmin('leak-test', (tx) =>
      tx.execute(sql`select ${body.note}::uuid`),
    );
  }
}

let test: TestTelemetry;
let errors: ErrorSink;
let current: TestApp;

beforeAll(async () => {
  test = startTestTelemetry();
  errors = errorSink();
  startErrorReporting({
    dsn: TEST_DSN,
    release: 'shifa-api@0.0.0-test',
    environment: 'test',
    transport: errors.transport,
  });
  current = await buildTestApp({ db: testDb(), controllers: [LeakController], forwardLogs: true });
  const base = await listen(current.app);
  const res = await fetch(
    `${base}/test-telemetry/${encodeURIComponent(NAME)}?phone=${encodeURIComponent(PHONE)}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${TOKEN}`,
        cookie: `sid=${TOKEN}; name=${encodeURIComponent(NAME)}`,
        'x-patient-phone': PHONE,
        'x-forwarded-for': PHONE,
        referer: `http://clinic.test/patients?name=${encodeURIComponent(NAME)}`,
      },
      body: JSON.stringify({ note: NOTE }),
    },
  );
  expect(res.status).toBe(500);
  await new Promise((resolve) => setTimeout(resolve, 100));
});

afterAll(async () => {
  await current.app.close();
  await stopErrorReporting();
  await test.telemetry.shutdown();
});

const decode = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes);

/** Each value as sent and as a URL or JSON encoder would write it. */
function forms(value: string): string[] {
  return [...new Set([value, encodeURIComponent(value), JSON.stringify(value).slice(1, -1)])];
}

function expectClean(what: string, text: string): void {
  expect(text.length, `${what} is empty`).toBeGreaterThan(0);
  for (const [label, value] of Object.entries(SECRETS)) {
    for (const form of forms(value)) {
      expect(text.includes(form), `${label} found in ${what}`).toBe(false);
    }
  }
}

describe('telemetry leak test (PLT-52)', () => {
  it('ran the failing database path it claims to cover', async () => {
    const spans = await test.spans();
    const failed = spans.filter(
      (span) =>
        span.attributes['db.system'] === 'postgresql' && span.status.code === SpanStatusCode.ERROR,
    );
    expect(failed.length).toBeGreaterThanOrEqual(3);
    expect(failed.some((span) => span.events.some((e) => e.name === 'exception'))).toBe(true);
  });

  it('exports no synthetic value in any span', async () => {
    const spans = await test.spans();
    expectClean('spans', decode(JsonTraceSerializer.serializeRequest(spans)));
  });

  it('exports no synthetic value in any metric', async () => {
    const metrics = await test.metrics();
    expectClean('metrics', decode(JsonMetricsSerializer.serializeRequest(metrics)));
  });

  it('exports no synthetic value in any log record', async () => {
    await test.telemetry.forceFlush();
    const records = test.logExporter.getFinishedLogRecords();
    expectClean('log records', decode(JsonLogsSerializer.serializeRequest(records)));
  });

  it('sent the error event it claims to cover', async () => {
    await flushErrors(2000);
    expect(errors.events()).toHaveLength(1);
  });

  it('exports no synthetic value in any error event', async () => {
    await flushErrors(2000);
    expectClean('error events', errors.text());
  });

  it('writes no synthetic value to the stdout log', () => {
    expectClean('stdout log', current.logs.text());
  });
});
