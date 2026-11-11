// Criterion 2: one server span per request named by method and route template, PostgreSQL child
// spans without statements or values, the resource attributes, and incoming traceparent honoured.
import { SpanKind } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import { testDb } from '@shifa/db/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../support.ts';
import {
  listen,
  serverSpans,
  startTestTelemetry,
  TEST_SERVICE_VERSION,
  type TestTelemetry,
} from './support.ts';

let test: TestTelemetry;
let current: TestApp | undefined;
let base: string;

beforeAll(() => {
  test = startTestTelemetry();
});

afterAll(async () => {
  await test.telemetry.shutdown();
});

afterEach(async () => {
  await current?.app.close();
  current = undefined;
  test.reset();
});

async function start(): Promise<void> {
  current = await buildTestApp({ db: testDb() });
  base = await listen(current.app);
}

const isServer = (span: ReadableSpan) => span.kind === SpanKind.SERVER;

describe('server spans', () => {
  it('names the span by method and route template and sets http.route', async () => {
    await start();
    const res = await fetch(`${base}/health/ready`);
    expect(res.status).toBe(200);
    const [server, ...others] = await serverSpans(test, 1, isServer);
    expect(others).toHaveLength(0);
    expect(server?.name).toBe('GET /health/ready');
    expect(server?.attributes['http.route']).toBe('/health/ready');
  });

  it('carries the resource attributes', async () => {
    await start();
    await fetch(`${base}/health/live`);
    const [server] = await serverSpans(test, 1, isServer);
    expect(server?.resource.attributes).toMatchObject({
      'service.name': 'shifa-api',
      'service.version': TEST_SERVICE_VERSION,
      'deployment.environment': 'test',
    });
  });

  it('names an unmatched URL [unmatched], never the raw path', async () => {
    await start();
    const res = await fetch(`${base}/no-such-route/synthetic-path-6610?q=synthetic-query-6611`);
    expect(res.status).toBe(404);
    const [server] = await serverSpans(test, 1, isServer);
    expect(server?.name).toBe('GET [unmatched]');
    expect(server?.attributes['http.route']).toBe('[unmatched]');
    expect(JSON.stringify(server?.attributes)).not.toMatch(/synthetic-(path|query)/);
  });

  it('continues the trace of an incoming traceparent', async () => {
    await start();
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const parentId = '00f067aa0ba902b7';
    await fetch(`${base}/health/live`, {
      headers: { traceparent: `00-${traceId}-${parentId}-01` },
    });
    const [server] = await serverSpans(test, 1, isServer);
    expect(server?.spanContext().traceId).toBe(traceId);
    expect(server?.parentSpanContext?.spanId).toBe(parentId);
  });
});

describe('PostgreSQL spans', () => {
  it('are children of the server span and carry no statement or values', async () => {
    await start();
    await fetch(`${base}/health/ready`);
    const [server] = await serverSpans(test, 1, isServer);
    const spans = await test.spans();
    const db = spans.filter((span) => span.attributes['db.system'] === 'postgresql');
    expect(db.length).toBeGreaterThan(0);
    for (const span of db) {
      expect(span.spanContext().traceId).toBe(server?.spanContext().traceId);
      for (const key of Object.keys(span.attributes)) {
        expect(key).not.toMatch(/statement|query\.text|values|connection_string|user/);
      }
    }
    // The readiness query runs inside the request: at least one span names its operation.
    expect(db.some((span) => typeof span.attributes['db.operation.name'] === 'string')).toBe(true);
  });
});
