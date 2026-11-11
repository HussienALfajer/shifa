// The OpenTelemetry SDK, built from its parts (no NodeSDK, no auto-instrumentations bundle, no
// resource detectors): only what this file names runs, and every exporter is wrapped or viewed
// through the scrub.ts allowlists. Loaded only when OTEL_EXPORTER_OTLP_ENDPOINT is set (see
// bootstrap.ts) or by tests that opt in with in-memory exporters.
import {
  type MeterProvider as ApiMeterProvider,
  context,
  createNoopMeter,
  type DiagLogger,
  DiagLogLevel,
  diag,
  logs,
  metrics,
  propagation,
  trace,
} from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { setGlobalErrorHandler, W3CTraceContextPropagator } from '@opentelemetry/core';
import { type Instrumentation, registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  type LogRecordExporter,
} from '@opentelemetry/sdk-logs';
import {
  createAllowListAttributesProcessor,
  type IMetricReader,
  MeterProvider,
} from '@opentelemetry/sdk-metrics';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  type SpanExporter,
  TraceIdRatioBasedSampler,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { register as registerImportHooks } from 'import-in-the-middle/register-hooks.mjs';
import { ALLOWED_METRIC_LABELS, ScrubbingSpanExporter } from './scrub.ts';

export const SERVICE_NAME = 'shifa-api';

/** Bounded export: when the Collector is down, data is dropped after these limits. */
const QUEUE = { maxQueueSize: 2048, maxExportBatchSize: 512, exportTimeoutMillis: 10_000 };

/** Export failures are reported at most this often, never per request. */
export const EXPORT_WARNING_INTERVAL_MS = 60_000;

interface Instrumentations {
  http: HttpInstrumentation;
  pg: PgInstrumentation;
  runtime: RuntimeNodeInstrumentation;
}

const INSTALLED = Symbol.for('shifa.api.telemetry.instrumentations');
type WithInstalled = typeof globalThis & { [INSTALLED]?: Instrumentations };

/** First SQL keyword, if it is one of these: `db.operation.name` without any of the text. */
const OPERATION = /^\s*(select|insert|update|delete|with|begin|commit|rollback|set|show|call)\b/i;

/** A meter provider that records nothing, for instrumentations whose metrics carry too much. */
const NO_METRICS: ApiMeterProvider = { getMeter: () => createNoopMeter() };

/**
 * Patches `http` (server spans, through the CJS require hook: Fastify requires it) and `pg`
 * (query spans, through the ESM loader hook), once per process, before Fastify or @shifa/db
 * load them.
 */
export function installInstrumentations(): Instrumentation[] {
  const global = globalThis as WithInstalled;
  let installed = global[INSTALLED];
  if (!installed) {
    // @shifa/db loads pg with an ESM import, which the CJS require hook never sees: this
    // in-thread loader hook (module.registerHooks) hands pg, and only pg, to the instrumentation
    // when it is first imported.
    registerImportHooks({ include: ['pg'] });
    installed = {
      http: new HttpInstrumentation({
        disableOutgoingRequestInstrumentation: true,
        // Never copy headers onto spans; the allowlist would drop them anyway.
        headersToSpanAttributes: { server: { requestHeaders: [], responseHeaders: [] } },
      }),
      pg: new PgInstrumentation({
        enhancedDatabaseReporting: false,
        requireParentSpan: true,
        requestHook: (span, info) => {
          // The instrumentation writes only the stable `db.system.name`; Tempo and Grafana's
          // service graph still key on the older `db.system`.
          span.setAttribute('db.system', 'postgresql');
          const operation = OPERATION.exec(info.query.text)?.[1]?.toUpperCase();
          if (operation) span.setAttribute('db.operation.name', operation);
          // The instrumentation names the span from the SQL text up to its first space (or from
          // a prepared statement's name); a known keyword is all the name may carry.
          span.updateName(operation ? `pg.query:${operation}` : 'pg.query');
        },
      }),
      // Event-loop delay sampled every 10 ms (the default), reported as min/max/mean/percentiles.
      runtime: new RuntimeNodeInstrumentation({ monitoringPrecision: 10 }),
    };
    registerInstrumentations({
      instrumentations: [installed.http, installed.pg, installed.runtime],
    });
    // Their own metrics carry addresses, pool names and full URLs: requests are measured by
    // telemetry/http.ts instead.
    installed.http.setMeterProvider(NO_METRICS);
    installed.pg.setMeterProvider(NO_METRICS);
    global[INSTALLED] = installed;
  }
  return [installed.http, installed.pg, installed.runtime];
}

export interface TelemetryOptions {
  serviceVersion: string;
  environment: string;
  samplerRatio: number;
  spanExporter: SpanExporter;
  metricReader: IMetricReader;
  logExporter: LogRecordExporter;
  /** Called at most once per EXPORT_WARNING_INTERVAL_MS when the SDK reports a failure. */
  onExportFailure?: () => void;
}

export interface Telemetry {
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
}

/** At most one call per interval; the rest are dropped. */
export function throttle(fn: () => void, intervalMs: number, now = Date.now): () => void {
  let last = Number.NEGATIVE_INFINITY;
  return () => {
    const at = now();
    if (at - last < intervalMs) return;
    last = at;
    fn();
  };
}

/**
 * The SDK's diagnostics carry exporter error text (addresses, payload fragments): they are
 * never written out, only counted into one throttled warning.
 */
function quietDiag(report: () => void): DiagLogger {
  const ignore = () => undefined;
  return { error: report, warn: report, info: ignore, debug: ignore, verbose: ignore };
}

export function startTelemetry(options: TelemetryOptions): Telemetry {
  const instrumentations = installInstrumentations();
  const report = throttle(options.onExportFailure ?? (() => undefined), EXPORT_WARNING_INTERVAL_MS);
  diag.setLogger(quietDiag(report), DiagLogLevel.WARN);
  setGlobalErrorHandler(report);

  const resource = resourceFromAttributes({
    'service.name': SERVICE_NAME,
    'service.version': options.serviceVersion,
    'deployment.environment': options.environment,
  });

  const tracerProvider = new TracerProvider({
    resource,
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(options.samplerRatio) }),
    spanProcessors: [
      new BatchSpanProcessor({
        exporter: new ScrubbingSpanExporter(options.spanExporter),
        ...QUEUE,
      }),
    ],
  });
  const meterProvider = new MeterProvider({
    resource,
    readers: [options.metricReader],
    views: [
      {
        instrumentName: '*',
        attributesProcessors: [createAllowListAttributesProcessor([...ALLOWED_METRIC_LABELS])],
      },
    ],
  });
  const loggerProvider = new LoggerProvider({
    resource,
    processors: [new BatchLogRecordProcessor({ exporter: options.logExporter, ...QUEUE })],
  });

  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(tracerProvider);
  metrics.setGlobalMeterProvider(meterProvider);
  logs.setGlobalLoggerProvider(loggerProvider);
  for (const instrumentation of instrumentations) {
    instrumentation.setTracerProvider(tracerProvider);
  }
  const runtime = instrumentations.find((i) => i instanceof RuntimeNodeInstrumentation);
  runtime?.setMeterProvider(meterProvider);

  return {
    forceFlush: async () => {
      await Promise.all([
        tracerProvider.forceFlush(),
        meterProvider.forceFlush(),
        loggerProvider.forceFlush(),
      ]);
    },
    shutdown: async () => {
      await Promise.allSettled([
        tracerProvider.shutdown(),
        meterProvider.shutdown(),
        loggerProvider.shutdown(),
      ]);
      trace.disable();
      metrics.disable();
      logs.disable();
      propagation.disable();
      context.disable();
      diag.disable();
    },
  };
}
