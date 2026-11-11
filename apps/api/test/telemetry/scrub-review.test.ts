// Review follow-ups of 0.2-09b1: tracestate never leaves in a span context, export failures are
// reported at most once a minute, and a blank sampler ratio is refused instead of meaning 0.
import { SpanKind, SpanStatusCode, TraceFlags } from '@opentelemetry/api';
import { TraceState } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { ReadableSpan } from '@opentelemetry/sdk-trace';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config/env.ts';
import { scrubSpan } from '../../src/telemetry/scrub.ts';
import { EXPORT_WARNING_INTERVAL_MS, throttle } from '../../src/telemetry/sdk.ts';

const VALUE = 'synthetic-phone-963912345678';
const URL_OK = 'postgres://shifa_app:synthetic-pw-4417@db.internal:5432/shifa';

describe('span contexts', () => {
  it('drop the client tracestate on the span, its parent and its links', () => {
    const traceState = new TraceState(`p=${VALUE},n=synthetic-name`);
    const ctx = {
      traceId: 'a'.repeat(32),
      spanId: 'b'.repeat(16),
      traceFlags: TraceFlags.SAMPLED,
      traceState,
    };
    const span: ReadableSpan = {
      name: 'GET /health/live',
      kind: SpanKind.SERVER,
      spanContext: () => ctx,
      parentSpanContext: { ...ctx, spanId: 'c'.repeat(16), isRemote: true },
      startTime: [1, 0],
      endTime: [2, 0],
      duration: [1, 0],
      ended: true,
      status: { code: SpanStatusCode.UNSET },
      attributes: {},
      links: [{ context: ctx, attributes: {} }],
      events: [],
      resource: resourceFromAttributes({ 'service.name': 'shifa-api' }),
      instrumentationScope: { name: 'test' },
      droppedAttributesCount: 0,
      droppedEventsCount: 0,
      droppedLinksCount: 0,
    };
    const scrubbed = scrubSpan(span);
    expect(scrubbed.spanContext().traceState).toBeUndefined();
    expect(scrubbed.parentSpanContext?.traceState).toBeUndefined();
    expect(scrubbed.parentSpanContext?.isRemote).toBe(true);
    expect(scrubbed.links[0]?.context.traceState).toBeUndefined();
    expect(scrubbed.spanContext().traceId).toBe(ctx.traceId);
  });
});

describe('export failure warnings', () => {
  it('fire at most once per minute', () => {
    let now = 0;
    let calls = 0;
    const report = throttle(
      () => {
        calls += 1;
      },
      EXPORT_WARNING_INTERVAL_MS,
      () => now,
    );
    expect(EXPORT_WARNING_INTERVAL_MS).toBe(60_000);
    report();
    now = 59_999;
    report();
    expect(calls).toBe(1);
    now = 60_000;
    report();
    expect(calls).toBe(2);
  });
});

describe('OTEL_TRACES_SAMPLER_ARG', () => {
  it.each(['', ' ', '.5'])('refuses %j instead of sampling nothing', (value) => {
    expect(() => loadConfig({ DATABASE_URL: URL_OK, OTEL_TRACES_SAMPLER_ARG: value })).toThrow(
      ConfigError,
    );
  });

  it.each([
    ['0', 0],
    ['1', 1],
    ['1.0', 1],
    ['0.05', 0.05],
  ])('reads %s', (value, ratio) => {
    const config = loadConfig({ DATABASE_URL: URL_OK, OTEL_TRACES_SAMPLER_ARG: value });
    expect(config.telemetry.samplerRatio).toBe(ratio);
  });
});
