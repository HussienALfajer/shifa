// Review follow-ups of 0.2-09b1, end to end: a client tracestate carrying synthetic patient data
// never reaches an exported span, pg span names hold no SQL text, and the metric View strips a
// label that is not on the allowlist.
import { metrics, SpanKind } from '@opentelemetry/api';
import { JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import { testDb } from '@shifa/db/testing';
import { createRandom, generatePhone } from '@shifa/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../support.ts';
import { listen, serverSpans, startTestTelemetry, type TestTelemetry } from './support.ts';

const PHONE = generatePhone(createRandom(20261112), 'SY');
const TOKEN = 'synthetic-token-552901';

let test: TestTelemetry;
let current: TestApp;

beforeAll(async () => {
  test = startTestTelemetry();
  current = await buildTestApp({ db: testDb() });
  const base = await listen(current.app);
  const res = await fetch(`${base}/health/ready`, {
    headers: {
      traceparent: `00-${'4'.repeat(32)}-${'5'.repeat(16)}-01`,
      tracestate: `p=${PHONE},t=${TOKEN}`,
    },
  });
  expect(res.status).toBe(200);
});

afterAll(async () => {
  await current.app.close();
  await test.telemetry.shutdown();
});

const isServer = (span: ReadableSpan) => span.kind === SpanKind.SERVER;

describe('tracestate', () => {
  it('is continued as a trace but never exported', async () => {
    const [server] = await serverSpans(test, 1, isServer);
    expect(server?.spanContext().traceId).toBe('4'.repeat(32));
    const payload = new TextDecoder().decode(
      JsonTraceSerializer.serializeRequest(await test.spans()),
    );
    expect(payload).not.toContain(PHONE);
    expect(payload).not.toContain(TOKEN);
  });
});

describe('pg span names', () => {
  it('carry the operation keyword only', async () => {
    const names = (await test.spans())
      .filter((span) => span.attributes['db.system'] === 'postgresql')
      .map((span) => span.name);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).toMatch(/^pg\.query(:[A-Z]+)?$/);
  });
});

describe('metric View', () => {
  it('strips labels that are not on the allowlist', async () => {
    metrics
      .getMeter('review-probe')
      .createCounter('review.probe')
      .add(1, { 'http.route': '/x', 'patient.name': 'synthetic-name-8812' });
    const resourceMetrics = await test.metrics();
    const probe = resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .find((metric) => metric.descriptor.name === 'review.probe');
    expect(probe?.dataPoints.map((point) => point.attributes)).toEqual([{ 'http.route': '/x' }]);
  });
});
