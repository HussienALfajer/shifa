// Route naming and request metrics. The http instrumentation starts the server span before
// Fastify routes the request; this hook renames it to `METHOD /route/:template` (never the URL)
// and records duration and count labelled with method, route template and status class only.
// Without the SDK every call here is a no-op of @opentelemetry/api.
import { context, metrics, trace } from '@opentelemetry/api';
import { getRPCMetadata, RPCType } from '@opentelemetry/core';
import type { FastifyInstance } from 'fastify';
import { routeTemplate } from '../platform/logging.ts';

const METER = 'shifa-api';

/** Seconds; request latency buckets from 5 ms to 10 s. */
const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

const statusClass = (status: number) => `${String(Math.floor(status / 100))}xx`;

export function registerTelemetryHooks(fastify: FastifyInstance): void {
  const meter = metrics.getMeter(METER);
  const duration = meter.createHistogram('http.server.request.duration', {
    unit: 's',
    description: 'Duration of HTTP server requests',
    advice: { explicitBucketBoundaries: DURATION_BUCKETS },
  });
  const count = meter.createCounter('http.server.request.count', {
    unit: '{request}',
    description: 'HTTP server requests',
  });

  fastify.addHook('onRequest', (request, _reply, done) => {
    const span = trace.getActiveSpan();
    if (span?.isRecording()) {
      const route = routeTemplate(request);
      span.updateName(`${request.method} ${route}`);
      span.setAttribute('http.route', route);
      span.setAttribute('shifa.request_id', request.id);
      // The http instrumentation names the span from this when it ends.
      const rpc = getRPCMetadata(context.active());
      if (rpc?.type === RPCType.HTTP) rpc.route = route;
    }
    done();
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    const attributes = {
      'http.request.method': request.method,
      'http.route': routeTemplate(request),
      'http.response.status_class': statusClass(reply.statusCode),
    };
    duration.record(reply.elapsedTime / 1000, attributes);
    count.add(1, attributes);
    done();
  });
}
