// PLT-52, scrubbing layer one: nothing leaves the API in a span, metric or resource unless its
// key is on an allowlist. Allowlist, not denylist: a new instrumentation attribute stays inside
// the process until someone adds it here on purpose (docs/process/observability.md, 0.2-09b3).
// The Collector deletes the denied keys again (layer two, 0.2-09b3).
import type { Attributes, Link, SpanContext } from '@opentelemetry/api';
import type { ExportResult } from '@opentelemetry/core';
import { type Resource, resourceFromAttributes } from '@opentelemetry/resources';
import type { ReadableSpan, SpanExporter, TimedEvent } from '@opentelemetry/sdk-trace';

/**
 * Span attributes that can never hold patient data: the route template (never the URL),
 * method, status, protocol, the client's user agent, opaque UUIDs, and for PostgreSQL the
 * system, operation and table (never the statement: literals in raw SQL could hold values).
 * Old and stable semantic-convention names are both listed.
 */
export const ALLOWED_SPAN_ATTRIBUTES: ReadonlySet<string> = new Set([
  'http.route',
  'http.request.method',
  'http.method',
  'http.response.status_code',
  'http.status_code',
  'http.response.status_class',
  'http.flavor',
  'network.protocol.version',
  'network.protocol.name',
  'url.scheme',
  'http.scheme',
  'user_agent.original',
  'http.user_agent',
  'http.request.header.content-type',
  'error.type',
  'shifa.request_id',
  'tenant.id',
  'user.id',
  'db.system',
  'db.system.name',
  'db.operation.name',
  'db.operation',
  'db.collection.name',
  'db.sql.table',
]);

/**
 * Metric labels: request metrics (method, route template, status class) and the runtime
 * metrics' own enumerations. No id of any kind: ids explode cardinality and identify people.
 */
export const ALLOWED_METRIC_LABELS: ReadonlySet<string> = new Set([
  'http.request.method',
  'http.route',
  'http.response.status_class',
  'nodejs.eventloop.state',
  'v8js.heap.space.name',
  'v8js.gc.type',
]);

/** Who emitted the data; never host names, command lines or process owners. */
export const ALLOWED_RESOURCE_ATTRIBUTES: ReadonlySet<string> = new Set([
  'service.name',
  'service.version',
  'deployment.environment',
  'telemetry.sdk.name',
  'telemetry.sdk.language',
  'telemetry.sdk.version',
]);

/** The one span event kept: an exception, as its type and stack frames. */
const EXCEPTION_EVENT = 'exception';

export function pickAttributes(
  attributes: Attributes | undefined,
  allowed: ReadonlySet<string>,
): Attributes {
  const kept: Attributes = {};
  for (const [key, value] of Object.entries(attributes ?? {})) {
    if (allowed.has(key)) kept[key] = value;
  }
  return kept;
}

const FRAME = /^\s+at /;

/**
 * Only the frames of a stack (`    at fn (file:line:col)`): its first lines repeat the message,
 * which can quote a value, so they are replaced by the error type.
 */
export function stackFrames(stack: string, type: string): string {
  const frames = stack.split('\n').filter((line) => FRAME.test(line));
  return [type, ...frames].join('\n');
}

function scrubEvent(event: TimedEvent): TimedEvent | undefined {
  if (event.name !== EXCEPTION_EVENT) return undefined;
  const raw = event.attributes ?? {};
  const type = typeof raw['exception.type'] === 'string' ? raw['exception.type'] : 'Error';
  const attributes: Attributes = { 'exception.type': type, 'exception.message': type };
  const stack = raw['exception.stacktrace'];
  if (typeof stack === 'string') attributes['exception.stacktrace'] = stackFrames(stack, type);
  return { name: EXCEPTION_EVENT, time: event.time, attributes, droppedAttributesCount: 0 };
}

const resources = new WeakMap<Resource, Resource>();

function scrubResource(resource: Resource): Resource {
  let scrubbed = resources.get(resource);
  if (!scrubbed) {
    scrubbed = resourceFromAttributes(
      pickAttributes(resource.attributes, ALLOWED_RESOURCE_ATTRIBUTES),
    );
    resources.set(resource, scrubbed);
  }
  return scrubbed;
}

/** A copy of `span` holding only allowed data; identity and timing unchanged. */
export function scrubSpan(span: ReadableSpan): ReadableSpan {
  const context: SpanContext = span.spanContext();
  const events = span.events.map(scrubEvent).filter((e): e is TimedEvent => e !== undefined);
  const links: Link[] = span.links.map((link) => ({ context: link.context, attributes: {} }));
  return {
    name: span.name,
    kind: span.kind,
    spanContext: () => context,
    ...(span.parentSpanContext ? { parentSpanContext: span.parentSpanContext } : {}),
    startTime: span.startTime,
    endTime: span.endTime,
    duration: span.duration,
    ended: span.ended,
    // The status message is free text (often an error message): only the code leaves.
    status: { code: span.status.code },
    attributes: pickAttributes(span.attributes, ALLOWED_SPAN_ATTRIBUTES),
    links,
    events,
    resource: scrubResource(span.resource),
    instrumentationScope: span.instrumentationScope,
    droppedAttributesCount: span.droppedAttributesCount,
    droppedEventsCount: span.droppedEventsCount + (span.events.length - events.length),
    droppedLinksCount: span.droppedLinksCount,
  };
}

/** Wraps the real exporter: it only ever sees scrubbed copies. */
export class ScrubbingSpanExporter implements SpanExporter {
  readonly #inner: SpanExporter;

  constructor(inner: SpanExporter) {
    this.#inner = inner;
  }

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.#inner.export(spans.map(scrubSpan), resultCallback);
  }

  shutdown(): Promise<void> {
    return this.#inner.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.#inner.forceFlush?.() ?? Promise.resolve();
  }
}
