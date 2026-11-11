// Criterion 6 (PLT-52), layer one: every exported span attribute, event, status, link and
// resource attribute passes an allowlist.
import { type Attributes, SpanKind, SpanStatusCode, TraceFlags } from '@opentelemetry/api';
import { ExportResultCode } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { InMemorySpanExporter, type ReadableSpan } from '@opentelemetry/sdk-trace';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_METRIC_LABELS,
  ALLOWED_RESOURCE_ATTRIBUTES,
  ALLOWED_SPAN_ATTRIBUTES,
  ScrubbingSpanExporter,
  scrubSpan,
} from '../../src/telemetry/scrub.ts';

const VALUE = 'synthetic-value-5521';
const ctx = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceFlags: TraceFlags.SAMPLED };

function span(overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  return {
    name: 'GET /patients/:id',
    kind: SpanKind.SERVER,
    spanContext: () => ctx,
    startTime: [1, 0],
    endTime: [2, 0],
    duration: [1, 0],
    ended: true,
    status: { code: SpanStatusCode.UNSET },
    attributes: {},
    links: [],
    events: [],
    resource: resourceFromAttributes({ 'service.name': 'shifa-api' }),
    instrumentationScope: { name: 'test' },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    ...overrides,
  };
}

const keys = (attributes: Attributes) => Object.keys(attributes).sort();

describe('span attributes', () => {
  it('keeps the allowed keys and drops everything else', () => {
    const scrubbed = scrubSpan(
      span({
        attributes: {
          'http.request.method': 'GET',
          'http.route': '/patients/:id',
          'http.response.status_code': 200,
          'user_agent.original': 'probe/1.0',
          'tenant.id': '0190a8a0-0000-7000-8000-000000000001',
          'url.full': `http://127.0.0.1/patients/${VALUE}`,
          'url.path': `/patients/${VALUE}`,
          'url.query': `phone=${VALUE}`,
          'http.target': `/patients/${VALUE}?q=${VALUE}`,
          'client.address': '10.0.0.7',
          'network.peer.address': '10.0.0.7',
          'http.request.header.cookie': VALUE,
          'patient.name': VALUE,
        },
      }),
    );
    expect(keys(scrubbed.attributes)).toEqual([
      'http.request.method',
      'http.response.status_code',
      'http.route',
      'tenant.id',
      'user_agent.original',
    ]);
    expect(JSON.stringify(scrubbed.attributes)).not.toContain(VALUE);
  });

  it('keeps no PostgreSQL statement, only system, operation and table', () => {
    const scrubbed = scrubSpan(
      span({
        name: 'SELECT shifa',
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system': 'postgresql',
          'db.system.name': 'postgresql',
          'db.operation.name': 'SELECT',
          'db.collection.name': 'patients',
          'db.statement': `select * from patients where name = '${VALUE}'`,
          'db.query.text': `select * from patients where name = '${VALUE}'`,
          'db.postgresql.values': [VALUE],
          'db.connection_string': 'postgresql://127.0.0.1:5432/shifa',
          'db.user': 'shifa_app',
        },
      }),
    );
    expect(keys(scrubbed.attributes)).toEqual([
      'db.collection.name',
      'db.operation.name',
      'db.system',
      'db.system.name',
    ]);
  });

  it('allowlists are the documented sets', () => {
    for (const denied of ['url.query', 'url.full', 'client.address', 'db.statement']) {
      expect(ALLOWED_SPAN_ATTRIBUTES.has(denied)).toBe(false);
    }
    expect([...ALLOWED_METRIC_LABELS].sort()).toEqual(
      expect.arrayContaining(['http.request.method', 'http.response.status_class', 'http.route']),
    );
    for (const denied of ['http.target', 'url.full', 'tenant.id', 'user.id']) {
      expect(ALLOWED_METRIC_LABELS.has(denied)).toBe(false);
    }
    for (const denied of ['process.command_args', 'host.name', 'process.owner']) {
      expect(ALLOWED_RESOURCE_ATTRIBUTES.has(denied)).toBe(false);
    }
  });
});

describe('events, status, links and resource', () => {
  it('drops every event except exception, whose message becomes the error type', () => {
    const stack = `DatabaseError: invalid input syntax for type uuid: "${VALUE}"\n    at Parser.parseErrorMessage (/app/node_modules/pg-protocol/dist/parser.js:285:98)\n    at handler (/app/dist/main.js:10:5)`;
    const scrubbed = scrubSpan(
      span({
        events: [
          { name: 'request body', time: [1, 1], attributes: { body: VALUE } },
          {
            name: 'exception',
            time: [1, 2],
            attributes: {
              'exception.type': '22P02',
              'exception.message': `invalid input syntax for type uuid: "${VALUE}"`,
              'exception.stacktrace': stack,
              'extra.value': VALUE,
            },
          },
        ],
      }),
    );
    expect(scrubbed.events).toHaveLength(1);
    const [event] = scrubbed.events;
    expect(event?.name).toBe('exception');
    expect(event?.attributes?.['exception.type']).toBe('22P02');
    expect(event?.attributes?.['exception.message']).toBe('22P02');
    expect(String(event?.attributes?.['exception.stacktrace'])).toContain(
      'at Parser.parseErrorMessage (/app/node_modules/pg-protocol/dist/parser.js:285:98)',
    );
    expect(JSON.stringify(scrubbed.events)).not.toContain(VALUE);
    expect(keys(event?.attributes ?? {})).toEqual([
      'exception.message',
      'exception.stacktrace',
      'exception.type',
    ]);
  });

  it('keeps the status code and drops its message', () => {
    const scrubbed = scrubSpan(
      span({ status: { code: SpanStatusCode.ERROR, message: `bad value "${VALUE}"` } }),
    );
    expect(scrubbed.status).toEqual({ code: SpanStatusCode.ERROR });
  });

  it('keeps link contexts and drops their attributes', () => {
    const scrubbed = scrubSpan(span({ links: [{ context: ctx, attributes: { note: VALUE } }] }));
    expect(scrubbed.links).toEqual([{ context: ctx, attributes: {} }]);
  });

  it('keeps only allowed resource attributes', () => {
    const scrubbed = scrubSpan(
      span({
        resource: resourceFromAttributes({
          'service.name': 'shifa-api',
          'service.version': '0.0.0',
          'deployment.environment': 'development',
          'process.command_args': ['node', VALUE],
          'host.name': 'clinic-laptop',
        }),
      }),
    );
    expect(keys(scrubbed.resource.attributes)).toEqual([
      'deployment.environment',
      'service.name',
      'service.version',
    ]);
  });

  it('keeps the span identity and timing', () => {
    const original = span({ parentSpanContext: { ...ctx, spanId: 'c'.repeat(16) } });
    const scrubbed = scrubSpan(original);
    expect(scrubbed.spanContext()).toEqual(ctx);
    expect(scrubbed.parentSpanContext?.spanId).toBe('c'.repeat(16));
    expect(scrubbed.name).toBe(original.name);
    expect(scrubbed.kind).toBe(original.kind);
    expect(scrubbed.startTime).toEqual(original.startTime);
    expect(scrubbed.endTime).toEqual(original.endTime);
    expect(scrubbed.duration).toEqual(original.duration);
  });
});

describe('ScrubbingSpanExporter', () => {
  it('passes only scrubbed copies to the wrapped exporter', async () => {
    const inner = new InMemorySpanExporter();
    const exporter = new ScrubbingSpanExporter(inner);
    const code = await new Promise((resolve) => {
      exporter.export([span({ attributes: { 'url.query': VALUE, 'http.route': '/x' } })], (r) => {
        resolve(r.code);
      });
    });
    expect(code).toBe(ExportResultCode.SUCCESS);
    const [exported] = inner.getFinishedSpans();
    expect(exported?.attributes).toEqual({ 'http.route': '/x' });
    await exporter.shutdown();
  });
});
