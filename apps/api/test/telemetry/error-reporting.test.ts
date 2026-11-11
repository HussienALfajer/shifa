// Criterion 5 and its edge case: 5xx responses and unhandled exceptions reach the error tracker
// (stub transport, envelopes as serialised for the wire) with the route template, status,
// request id, trace id and release, and nothing else; 4xx never do; the response body is unchanged.
import { Controller, Get, Query, ServiceUnavailableException } from '@nestjs/common';
import { SpanKind } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import { addBreadcrumb } from '@sentry/core';
import { defineContract, envelopeFor, type RequestQuery } from '@shifa/contracts';
import { createRandom, fullName, generatePersonName } from '@shifa/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Public } from '../../src/access/index.ts';
import { Contract } from '../../src/platform/contract/index.ts';
import { REQUEST_ID_HEADER } from '../../src/platform/logging.ts';
import {
  flushErrors,
  startErrorReporting,
  stopErrorReporting,
} from '../../src/telemetry/errors.ts';
import { buildTestApp, offlineDb, TestAnything, type TestApp, testContract } from '../support.ts';
import { type ErrorSink, errorSink, TEST_DSN } from './error-sink.ts';
import { listen, serverSpans, startTestTelemetry, type TestTelemetry } from './support.ts';

const random = createRandom(20261112);
const NAME = fullName(generatePersonName(random, { sex: 'male', adult: true, region: 'aleppo' }));
const RELEASE = 'shifa-api@0.0.0-test';

const boom = testContract('GET', '/test-errors/boom');
const database = testContract('GET', '/test-errors/database');
const unavailable = testContract('GET', '/test-errors/unavailable');
const validated = defineContract({
  operationId: 'testErrorsValidated',
  method: 'GET',
  path: '/test-errors/validated',
  request: {
    query: z.object({ count: z.string().regex(/^\d+$/) }).meta({ id: 'TestErrorsValidatedQuery' }),
  },
  responses: { 200: TestAnything },
});

/** A pg DatabaseError (SQLSTATE 22P02 quotes the value) wrapped like Drizzle wraps it. */
function databaseError(): Error {
  const pg = Object.assign(new Error(`invalid input syntax for type uuid: "${NAME}"`), {
    name: 'error',
    code: '22P02',
    severity: 'ERROR',
  });
  const wrapped = new Error(`Failed query: select $1::uuid\nparams: ${NAME}`, { cause: pg });
  wrapped.name = 'DrizzleQueryError';
  return wrapped;
}

@Controller('test-errors')
class ErrorsController {
  @Public()
  @Contract(boom)
  @Get('boom')
  boom(): never {
    throw new Error(`could not load the chart of ${NAME}`);
  }

  @Public()
  @Contract(database)
  @Get('database')
  database(): never {
    throw databaseError();
  }

  @Public()
  @Contract(unavailable)
  @Get('unavailable')
  unavailable(): never {
    throw new ServiceUnavailableException(undefined, {
      cause: new TypeError(`connection refused for ${NAME}`),
    });
  }

  @Public()
  @Contract(validated)
  @Get('validated')
  validated(@Query() query: RequestQuery<typeof validated>): unknown {
    return query;
  }
}

let test: TestTelemetry;
let sink: ErrorSink;
let current: TestApp;
let base: string;

beforeAll(async () => {
  test = startTestTelemetry();
  sink = errorSink();
  startErrorReporting({
    dsn: TEST_DSN,
    release: RELEASE,
    environment: 'test',
    transport: sink.transport,
  });
  current = await buildTestApp({ db: offlineDb(), controllers: [ErrorsController] });
  base = await listen(current.app);
});

afterAll(async () => {
  await current.app.close();
  await stopErrorReporting();
  await test.telemetry.shutdown();
});

beforeEach(() => {
  sink.reset();
  test.reset();
});

const isServer = (span: ReadableSpan) => span.kind === SpanKind.SERVER;

async function call(path: string) {
  const res = await fetch(`${base}${path}`);
  const body: unknown = await res.json();
  await flushErrors(2000);
  return { res, body, events: sink.events() };
}

interface Exception {
  type?: unknown;
  value?: unknown;
  stacktrace?: { frames?: Record<string, unknown>[] };
}
const exceptionsOf = (event: Record<string, unknown> | undefined): Exception[] =>
  (event?.['exception'] as { values?: Exception[] } | undefined)?.values ?? [];

/** Every key an event may carry; anything else (request, user, extra, …) must be gone. */
const EVENT_KEYS = new Set([
  'event_id',
  'timestamp',
  'platform',
  'level',
  'release',
  'environment',
  'tags',
  'exception',
  'contexts',
]);
const FRAME_KEYS = new Set(['filename', 'function', 'lineno', 'colno']);

describe('error reporting (criterion 5)', () => {
  it('a 500 sends exactly one event with route, status, ids and release', async () => {
    const { res, body, events } = await call('/test-errors/boom');
    expect(res.status).toBe(500);
    expect(body).toEqual(envelopeFor(500));
    expect(events).toHaveLength(1);
    const [event] = events;
    const [server] = await serverSpans(test, 1, isServer);
    const traceId = server?.spanContext().traceId;
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(event?.['tags']).toEqual({
      route: '/test-errors/boom',
      status: '500',
      request_id: res.headers.get(REQUEST_ID_HEADER),
      trace_id: traceId,
      release: RELEASE,
      environment: 'test',
    });
    expect(event?.['release']).toBe(RELEASE);
    expect(event?.['environment']).toBe('test');
    expect((event?.['contexts'] as { trace?: { trace_id?: unknown } }).trace?.trace_id).toBe(
      traceId,
    );
  });

  it('keeps only allowlisted event fields and frame fields', async () => {
    addBreadcrumb({ message: NAME, data: { name: NAME } });
    const { events } = await call('/test-errors/boom');
    const [event] = events;
    for (const key of Object.keys(event ?? {})) expect(EVENT_KEYS, key).toContain(key);
    expect(Object.keys((event?.['contexts'] as object | undefined) ?? {})).toEqual(['trace']);
    const [exception, ...more] = exceptionsOf(event);
    expect(more).toHaveLength(0);
    expect(exception?.type).toBe('Error');
    expect(exception?.value).toBe('Error');
    const frames = exception?.stacktrace?.frames ?? [];
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.some((frame) => typeof frame['lineno'] === 'number')).toBe(true);
    for (const frame of frames) {
      for (const key of Object.keys(frame)) expect(FRAME_KEYS, key).toContain(key);
    }
    expect(sink.text().includes(NAME)).toBe(false);
  });

  it('a 400 (validation) sends none', async () => {
    const { res, events } = await call('/test-errors/validated?count=many');
    expect(res.status).toBe(400);
    expect(events).toHaveLength(0);
  });

  it('a 404 sends none', async () => {
    const { res, body, events } = await call('/test-errors/missing');
    expect(res.status).toBe(404);
    expect(body).toEqual(envelopeFor(404));
    expect(events).toHaveLength(0);
  });
});

describe('error reporting edge cases', () => {
  it('a database error quoting a value is reported as its class and SQLSTATE only', async () => {
    const { res, events } = await call('/test-errors/database');
    expect(res.status).toBe(500);
    expect(events).toHaveLength(1);
    const [exception] = exceptionsOf(events[0]);
    expect(exception?.type).toBe('DatabaseError');
    expect(exception?.value).toBe('DatabaseError 22P02');
    expect(sink.text().includes(NAME)).toBe(false);
  });

  it('a 503 with a cause sends one event with the cause class, body unchanged', async () => {
    const { res, body, events } = await call('/test-errors/unavailable');
    expect(res.status).toBe(503);
    expect(body).toEqual(envelopeFor(503));
    expect(events).toHaveLength(1);
    const [exception] = exceptionsOf(events[0]);
    expect(exception?.type).toBe('TypeError');
    expect(exception?.value).toBe('TypeError');
    expect((events[0]?.['tags'] as Record<string, unknown>)['status']).toBe('503');
    expect(sink.text().includes(NAME)).toBe(false);
  });
});
