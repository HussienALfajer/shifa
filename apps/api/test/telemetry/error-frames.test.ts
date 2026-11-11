// Review 0.2-09b2 B1, N1, N2: what reportError() hands the SDK. A multi-line message whose later
// lines contain ` at ` (Drizzle's `params: …` line, an indented fake frame) must not turn into
// stack frames; contexts.trace carries the active OpenTelemetry span's ids, and no made-up trace
// id when there is no span (a crash).
import { trace } from '@opentelemetry/api';
import { createRandom, fullName, generatePersonName, generatePhone } from '@shifa/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  flushErrors,
  reportError,
  startErrorReporting,
  stopErrorReporting,
} from '../../src/telemetry/errors.ts';
import { type ErrorSink, errorSink, TEST_DSN } from './error-sink.ts';
import { startTestTelemetry, type TestTelemetry } from './support.ts';

const random = createRandom(20261113);
const PHONE = generatePhone(random, 'SY');
// A given name ending in "at " is what made Sentry's parser read a frame out of the message.
const NAME = `Medhat ${fullName(generatePersonName(random, { sex: 'male', adult: true, region: 'azaz' }))}`;
const NOTE = 'seen at clinic Azaz';

let telemetry: TestTelemetry;
let sink: ErrorSink;

beforeAll(() => {
  telemetry = startTestTelemetry();
  sink = errorSink();
  startErrorReporting({
    dsn: TEST_DSN,
    release: 'shifa-api@0.0.0-test',
    environment: 'test',
    transport: sink.transport,
  });
});

afterAll(async () => {
  await stopErrorReporting();
  await telemetry.telemetry.shutdown();
});

beforeEach(() => {
  sink.reset();
});

function drizzleLikeError(): Error {
  const err = new Error(
    `Failed query: select $1::uuid, $2, $3\nparams: ${NAME},${PHONE}\n    at ${NOTE} (${PHONE}:1:2)`,
  );
  err.name = 'DrizzleQueryError';
  return err;
}

interface Frame {
  filename?: string;
  function?: string;
}

function framesOf(event: Record<string, unknown> | undefined): Frame[] {
  const values = (event?.['exception'] as { values?: { stacktrace?: { frames?: Frame[] } }[] })
    .values;
  return values?.[0]?.stacktrace?.frames ?? [];
}

describe('reportError hands the SDK frames only', () => {
  it('a message line containing " at " never becomes a frame', async () => {
    reportError(drizzleLikeError(), { type: 'DrizzleQueryError', status: 500 });
    await flushErrors(2000);
    const [event] = sink.events();
    expect(event).toBeDefined();
    const frames = framesOf(event);
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      expect(frame.filename ?? '').toMatch(/error-frames\.test\.ts$|node_modules|node:/);
    }
    for (const value of [NAME, PHONE, NOTE, 'Medhat', 'clinic']) {
      expect(sink.text().includes(value), value).toBe(false);
    }
  });

  it('a non-Error value is reported by its type alone', async () => {
    reportError(`rejected for ${NAME}`, { type: 'string' });
    await flushErrors(2000);
    expect(sink.events()).toHaveLength(1);
    expect(sink.text().includes(NAME)).toBe(false);
  });
});

describe('trace context of an event', () => {
  it('carries the active span: trace id and span id', async () => {
    const tracer = trace.getTracer('error-frames');
    const ids = tracer.startActiveSpan('probe', (span) => {
      reportError(new Error('x'), { type: 'Error', status: 500 });
      span.end();
      return span.spanContext();
    });
    await flushErrors(2000);
    const [event] = sink.events();
    expect(event?.['contexts']).toEqual({
      trace: { trace_id: ids.traceId, span_id: ids.spanId },
    });
    expect((event?.['tags'] as Record<string, unknown>)['trace_id']).toBe(ids.traceId);
  });

  it('without a span (a crash): no trace context and no trace_id tag', async () => {
    reportError(new Error('x'), { type: 'Error' });
    await flushErrors(2000);
    const [event] = sink.events();
    expect(event).toBeDefined();
    expect(event?.['contexts']).toBeUndefined();
    expect((event?.['tags'] as Record<string, unknown>)['trace_id']).toBeUndefined();
  });
});
