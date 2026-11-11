// Opt-in telemetry for tests (spec edge case: tests run with telemetry off unless they opt in).
// The `telemetry` Vitest project installs the instrumentations before anything loads `http` or
// `pg` (setup.ts); a test file then starts the SDK once with in-memory exporters.
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import { MetricReader, type ResourceMetrics } from '@opentelemetry/sdk-metrics';
import { InMemorySpanExporter, type ReadableSpan } from '@opentelemetry/sdk-trace';
import { startTelemetry, type Telemetry } from '../../src/telemetry/sdk.ts';

/** A pull reader: `collect()` reads every instrument on demand. */
class TestMetricReader extends MetricReader {
  protected override onForceFlush(): Promise<void> {
    return Promise.resolve();
  }
  protected override onShutdown(): Promise<void> {
    return Promise.resolve();
  }
}

export interface TestTelemetry {
  telemetry: Telemetry;
  spanExporter: InMemorySpanExporter;
  logExporter: InMemoryLogRecordExporter;
  /** Exports pending spans and log records, then returns the spans exported so far. */
  spans(): Promise<ReadableSpan[]>;
  metrics(): Promise<ResourceMetrics>;
  reset(): void;
}

export const TEST_SERVICE_VERSION = '0.0.0-test';

export function startTestTelemetry(): TestTelemetry {
  const spanExporter = new InMemorySpanExporter();
  const logExporter = new InMemoryLogRecordExporter();
  const reader = new TestMetricReader();
  const telemetry = startTelemetry({
    serviceVersion: TEST_SERVICE_VERSION,
    environment: 'test',
    samplerRatio: 1,
    spanExporter,
    metricReader: reader,
    logExporter,
  });
  return {
    telemetry,
    spanExporter,
    logExporter,
    spans: async () => {
      await telemetry.forceFlush();
      return spanExporter.getFinishedSpans();
    },
    metrics: async () => {
      const { resourceMetrics } = await reader.collect();
      return resourceMetrics;
    },
    reset: () => {
      spanExporter.reset();
      logExporter.reset();
    },
  };
}

/** Real sockets: the http instrumentation sees only requests that reach an http.Server. */
export async function listen(app: NestFastifyApplication): Promise<string> {
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.getHttpServer().address();
  if (address === null || typeof address === 'string') throw new Error('no TCP address');
  return `http://127.0.0.1:${String(address.port)}`;
}

/** Waits until the server span of a request has ended (onResponse runs after the reply). */
export async function serverSpans(
  test: TestTelemetry,
  count: number,
  isServer: (span: ReadableSpan) => boolean,
): Promise<ReadableSpan[]> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const found = (await test.spans()).filter(isServer);
    if (found.length >= count) return found;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`expected ${String(count)} server span(s)`);
}
