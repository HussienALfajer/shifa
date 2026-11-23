// A-01a criterion 16: a client's x-request-id is never exported. Spans and exported log records
// carry only the id the API generated; the client's value stays in local logs under its own key.
import { SpanKind } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import { afterAll, describe, expect, it } from 'vitest';
import { buildTestApp, offlineDb, type TestApp } from '../support.ts';
import { listen, serverSpans, startTestTelemetry } from './support.ts';

const CLIENT_ID = 'client-chosen-id-0963944';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const isServer = (span: ReadableSpan) => span.kind === SpanKind.SERVER;

let current: TestApp | undefined;
const test = startTestTelemetry();

afterAll(async () => {
  await current?.app.close();
  await test.telemetry.shutdown();
});

describe('client request ids', () => {
  it('are logged locally as client_request_id and exported nowhere', async () => {
    current = await buildTestApp({ db: offlineDb(), forwardLogs: true });
    const base = await listen(current.app);
    const res = await fetch(`${base}/health/live`, { headers: { 'x-request-id': CLIENT_ID } });
    const generated = res.headers.get('x-request-id') ?? '';
    expect(generated).toMatch(UUID);
    const [server] = await serverSpans(test, 1, isServer);
    expect(server?.attributes['shifa.request_id']).toBe(generated);
    expect(
      JSON.stringify(await test.spans(), (_k, v: unknown) =>
        typeof v === 'bigint' ? String(v) : v,
      ),
    ).not.toContain(CLIENT_ID);
    await test.telemetry.forceFlush();
    const exported = test.logExporter.getFinishedLogRecords();
    expect(exported.length).toBeGreaterThan(0);
    for (const record of exported) {
      expect(JSON.stringify(record.attributes)).not.toContain(CLIENT_ID);
      expect(String(record.body)).not.toContain(CLIENT_ID);
    }
    expect(current.logs.text()).toContain(`"client_request_id":"${CLIENT_ID}"`);
  });
});
