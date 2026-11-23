// A-01a criterion 16: sign-in is the first public route, so a client's `traceparent` no longer
// decides sampling. With a ratio of 0, a sampled parent from outside starts no exported trace,
// and an unsampled parent cannot hide a request either way (the ratio decides).
import { SpanKind } from '@opentelemetry/api';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, offlineDb, type TestApp } from '../support.ts';
import { listen, startTestTelemetry, type TestTelemetry } from './support.ts';

let test: TestTelemetry;
let current: TestApp | undefined;

beforeAll(() => {
  test = startTestTelemetry({ samplerRatio: 0 });
});

afterAll(async () => {
  await test.telemetry.shutdown();
});

afterEach(async () => {
  await current?.app.close();
  current = undefined;
  test.reset();
});

const TRACE = '4bf92f3577b34da6a3ce929d0e0e4736';
const PARENT = '00f067aa0ba902b7';

describe('sampling of incoming traceparent', () => {
  it('a sampled remote parent does not force a trace when the ratio is 0', async () => {
    current = await buildTestApp({ db: offlineDb() });
    const base = await listen(current.app);
    const res = await fetch(`${base}/health/live`, {
      headers: { traceparent: `00-${TRACE}-${PARENT}-01` },
    });
    expect(res.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const spans = (await test.spans()).filter((s) => s.kind === SpanKind.SERVER);
    expect(spans).toEqual([]);
  });
});
