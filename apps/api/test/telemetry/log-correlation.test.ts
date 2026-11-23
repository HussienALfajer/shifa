// Criterion 4: every pino line of a request carries trace_id and span_id of its server span and
// the existing request id; without telemetry the lines carry no ids and nothing fails.
import { SpanKind } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, type LogRecord, offlineDb, type TestApp } from '../support.ts';
import { listen, serverSpans, startTestTelemetry, type TestTelemetry } from './support.ts';

let current: TestApp | undefined;

afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

const REQUEST_ID = 'req-corr-0001-abcdef';
const isServer = (span: ReadableSpan) => span.kind === SpanKind.SERVER;
// The client's id is logged as client_request_id; the request's own id (reqId) is generated.
const reqIdOf = (records: LogRecord[]) =>
  records.find((r) => r['client_request_id'] === REQUEST_ID)?.['reqId'];
const ofRequest = (records: LogRecord[]) => {
  const reqId = reqIdOf(records);
  return records.filter((r) => reqId !== undefined && r['reqId'] === reqId);
};

// Runs first: the SDK is not started yet in this process.
describe('without telemetry', () => {
  it('writes the request lines with the request id and no trace ids', async () => {
    current = await buildTestApp({ db: offlineDb() });
    const base = await listen(current.app);
    const res = await fetch(`${base}/health/live`, { headers: { 'x-request-id': REQUEST_ID } });
    expect(res.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const lines = ofRequest(current.logs.records());
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) {
      expect(line).not.toHaveProperty('trace_id');
      expect(line).not.toHaveProperty('span_id');
    }
  });
});

describe('with telemetry', () => {
  let test: TestTelemetry;
  /** The generated id of the request the first case sends (its app is closed afterwards). */
  let correlatedReqId: unknown;

  it('puts the server span ids and the request id on every line of the request', async () => {
    test = startTestTelemetry();
    current = await buildTestApp({ db: offlineDb(), forwardLogs: true });
    const base = await listen(current.app);
    // /health/ready on an offline database logs a warning inside the handler as well.
    await fetch(`${base}/health/ready`, { headers: { 'x-request-id': REQUEST_ID } });
    const [server] = await serverSpans(test, 1, isServer);
    const traceId = server?.spanContext().traceId;
    const spanId = server?.spanContext().spanId;
    const lines = ofRequest(current.logs.records());
    correlatedReqId = reqIdOf(current.logs.records());
    // incoming request, the handler's own line, request completed
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) {
      expect(line['trace_id']).toBe(traceId);
      expect(line['span_id']).toBe(spanId);
    }
  });

  it('forwards the same lines to the log exporter, correlated with the span', async () => {
    const [server] = await serverSpans(test, 1, isServer);
    const records = test.logExporter
      .getFinishedLogRecords()
      .filter((r) => r.attributes['reqId'] === correlatedReqId);
    expect(records.length).toBeGreaterThanOrEqual(2);
    for (const record of records) {
      expect(record.spanContext?.traceId).toBe(server?.spanContext().traceId);
      expect(typeof record.body).toBe('string');
    }
    await test.telemetry.shutdown();
  });
});
