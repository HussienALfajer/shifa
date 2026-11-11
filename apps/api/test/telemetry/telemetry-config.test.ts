// Criterion 1: telemetry is configured by env.ts and is off (no SDK object at all) unless
// OTEL_EXPORTER_OTLP_ENDPOINT is set.
import { context, metrics, trace } from '@opentelemetry/api';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config/env.ts';
import { bootstrapTelemetry } from '../../src/telemetry/bootstrap.ts';

const URL_OK = 'postgres://shifa_app:synthetic-pw-4417@db.internal:5432/shifa';

function errorOf(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ConfigError);
    return err as ConfigError;
  }
  throw new Error('expected loadConfig to throw');
}

describe('telemetry configuration', () => {
  it('is off by default, samples everything and names the development environment', () => {
    const config = loadConfig({ DATABASE_URL: URL_OK });
    expect(config.telemetry).toEqual({
      endpoint: undefined,
      samplerRatio: 1,
      environment: 'development',
    });
  });

  it('reads an http(s) endpoint, a sampler ratio and the environment', () => {
    const config = loadConfig({
      DATABASE_URL: URL_OK,
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:4318',
      OTEL_TRACES_SAMPLER_ARG: '0.25',
      DEPLOYMENT_ENVIRONMENT: 'staging',
    });
    expect(config.telemetry).toEqual({
      endpoint: 'http://127.0.0.1:4318',
      samplerRatio: 0.25,
      environment: 'staging',
    });
  });

  it.each([
    ['not a URL', 'collector:4318'],
    ['another protocol', 'grpc://127.0.0.1:4317'],
  ])('rejects an endpoint that is %s, naming the key only', (_what, value) => {
    const err = errorOf(() =>
      loadConfig({ DATABASE_URL: URL_OK, OTEL_EXPORTER_OTLP_ENDPOINT: value }),
    );
    expect(err.message).toContain('OTEL_EXPORTER_OTLP_ENDPOINT');
    expect(err.message).not.toContain(value);
  });

  it.each(['-0.1', '1.5', 'half'])('rejects the sampler ratio %s', (value) => {
    const err = errorOf(() => loadConfig({ DATABASE_URL: URL_OK, OTEL_TRACES_SAMPLER_ARG: value }));
    expect(err.message).toContain('OTEL_TRACES_SAMPLER_ARG');
  });

  it('rejects a near-miss of the endpoint key', () => {
    const err = errorOf(() =>
      loadConfig({ DATABASE_URL: URL_OK, OTEL_EXPORTER_OTLP_ENDPIONT: 'http://127.0.0.1:4318' }),
    );
    expect(err.message).toContain('OTEL_EXPORTER_OTLP_ENDPIONT');
  });

  it('ignores the standard OTEL_* keys it does not read', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: URL_OK,
        OTEL_EXPORTER_OTLP_HEADERS: 'x=y',
        OTEL_TRACES_SAMPLER: 'parentbased_traceidratio',
      }),
    ).not.toThrow();
  });
});

describe('bootstrapTelemetry without an endpoint', () => {
  it('creates no provider: the global tracer, meter and context stay no-ops', async () => {
    const telemetry = await bootstrapTelemetry({ DATABASE_URL: URL_OK });
    expect(telemetry).toBeUndefined();
    const span = trace.getTracer('probe').startSpan('probe');
    expect(span.isRecording()).toBe(false);
    expect(trace.isSpanContextValid(span.spanContext())).toBe(false);
    span.end();
    // No context manager: `with` does not make anything active.
    const active = context.with(trace.setSpan(context.active(), span), () => trace.getActiveSpan());
    expect(active).toBeUndefined();
    const counter = metrics.getMeter('probe').createCounter('probe');
    expect(counter.constructor.name).toMatch(/Noop/);
  });

  it('does nothing when the configuration is invalid (main.ts reports it)', async () => {
    await expect(bootstrapTelemetry({})).resolves.toBeUndefined();
  });
});
