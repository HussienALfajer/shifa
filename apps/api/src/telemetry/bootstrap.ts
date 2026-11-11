// Telemetry start-up, run by dist/instrument.js before dist/main.js imports anything else.
// Off unless OTEL_EXPORTER_OTLP_ENDPOINT is set: then, and only then, the SDK modules are
// loaded and the OTLP/HTTP exporters created.
import { loadConfig } from '../config/env.ts';
import { createLogger } from '../platform/logging.ts';
import { startErrorReporting } from './errors.ts';
import type { Telemetry } from './sdk.ts';

/** Collector data paths of OTLP/HTTP. */
const PATHS = { traces: '/v1/traces', metrics: '/v1/metrics', logs: '/v1/logs' } as const;

/** Metrics are pushed every 15 s; the exporter request itself times out after 10 s. */
const METRIC_INTERVAL_MS = 15_000;
const EXPORT_TIMEOUT_MS = 10_000;

export async function bootstrapTelemetry(
  env: Readonly<Record<string, string | undefined>>,
  serviceVersion = 'unknown',
): Promise<Telemetry | undefined> {
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig(env);
  } catch {
    return undefined; // main.ts reports the configuration error and exits
  }
  const { endpoint, samplerRatio, environment } = config.telemetry;
  if (endpoint === undefined) return undefined;

  const [sdk, traces, metricsExporter, logsExporter, sdkMetrics] = await Promise.all([
    import('./sdk.ts'),
    import('@opentelemetry/exporter-trace-otlp-proto'),
    import('@opentelemetry/exporter-metrics-otlp-proto'),
    import('@opentelemetry/exporter-logs-otlp-proto'),
    import('@opentelemetry/sdk-metrics'),
  ]);
  const base = endpoint.replace(/\/+$/, '');
  const logger = createLogger({ level: config.logLevel });
  return sdk.startTelemetry({
    serviceVersion,
    environment,
    samplerRatio,
    spanExporter: new traces.OTLPTraceExporter({
      url: `${base}${PATHS.traces}`,
      timeoutMillis: EXPORT_TIMEOUT_MS,
    }),
    metricReader: new sdkMetrics.PeriodicExportingMetricReader({
      exporter: new metricsExporter.OTLPMetricExporter({
        url: `${base}${PATHS.metrics}`,
        timeoutMillis: EXPORT_TIMEOUT_MS,
      }),
      exportIntervalMillis: METRIC_INTERVAL_MS,
      exportTimeoutMillis: EXPORT_TIMEOUT_MS,
    }),
    logExporter: new logsExporter.OTLPLogExporter({
      url: `${base}${PATHS.logs}`,
      timeoutMillis: EXPORT_TIMEOUT_MS,
    }),
    // A fixed text: exporter errors can quote addresses and payload fragments.
    onExportFailure: () => {
      logger.warn(
        { component: 'telemetry' },
        'telemetry export failed; further failures are not logged for 60 s',
      );
    },
  });
}

/**
 * Error reporting (GlitchTip, Sentry protocol). Off unless SENTRY_DSN is set: then, and only
 * then, a Sentry client is created. Returns whether it was.
 */
export function bootstrapErrorReporting(
  env: Readonly<Record<string, string | undefined>>,
  serviceVersion = 'unknown',
): boolean {
  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig(env);
  } catch {
    return false; // main.ts reports the configuration error and exits
  }
  const { dsn, release } = config.errors;
  if (dsn === undefined) return false;
  startErrorReporting({
    dsn,
    release: release ?? serviceVersion,
    environment: config.telemetry.environment,
  });
  return true;
}
