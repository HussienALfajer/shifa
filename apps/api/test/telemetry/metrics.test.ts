// Criterion 3: request count and duration by method, route template and status class only;
// process metrics (event-loop lag, memory); no label holds an id or user input.
import type { MetricData, ResourceMetrics } from '@opentelemetry/sdk-metrics';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ALLOWED_METRIC_LABELS } from '../../src/telemetry/scrub.ts';
import { buildTestApp, offlineDb, type TestApp } from '../support.ts';
import { listen, startTestTelemetry, type TestTelemetry } from './support.ts';

let test: TestTelemetry;
let current: TestApp | undefined;

beforeAll(() => {
  test = startTestTelemetry();
});

afterAll(async () => {
  await test.telemetry.shutdown();
});

afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

const all = (resourceMetrics: ResourceMetrics): MetricData[] =>
  resourceMetrics.scopeMetrics.flatMap((scope) => scope.metrics);

const named = (resourceMetrics: ResourceMetrics, name: string) =>
  all(resourceMetrics).find((metric) => metric.descriptor.name === name);

const pointsOf = (metric: MetricData | undefined) =>
  (metric?.dataPoints ?? []) as { attributes: Record<string, unknown>; value: unknown }[];

const REQUEST_LABELS = ['http.request.method', 'http.response.status_class', 'http.route'];

async function traffic(): Promise<void> {
  current = await buildTestApp({ db: offlineDb() });
  const base = await listen(current.app);
  await fetch(`${base}/health/live`);
  await fetch(`${base}/health/live`);
  await fetch(`${base}/health/ready`); // offline database → 503
  await fetch(`${base}/patients/synthetic-path-7710?phone=synthetic-query-7711`); // 404
  // onResponse runs after the reply has been sent.
  await new Promise((resolve) => setTimeout(resolve, 50));
}

describe('request metrics', () => {
  it('records duration and count labelled with method, route template and status class', async () => {
    await traffic();
    const metrics = await test.metrics();
    const duration = named(metrics, 'http.server.request.duration');
    const count = named(metrics, 'http.server.request.count');
    expect(duration).toBeDefined();
    expect(count).toBeDefined();
    for (const metric of [duration, count]) {
      for (const point of pointsOf(metric)) {
        expect(Object.keys(point.attributes).sort()).toEqual(REQUEST_LABELS);
      }
    }
    const live = pointsOf(count).find((p) => p.attributes['http.route'] === '/health/live');
    expect(live?.attributes).toEqual({
      'http.request.method': 'GET',
      'http.route': '/health/live',
      'http.response.status_class': '2xx',
    });
    expect(live?.value).toBe(2);
    const ready = pointsOf(count).find((p) => p.attributes['http.route'] === '/health/ready');
    expect(ready?.attributes['http.response.status_class']).toBe('5xx');
  });

  it('labels an unmatched URL [unmatched] and never carries a path or query value', async () => {
    await traffic();
    const metrics = await test.metrics();
    const routes = pointsOf(named(metrics, 'http.server.request.count')).map(
      (p) => p.attributes['http.route'],
    );
    expect(routes).toContain('[unmatched]');
    expect(JSON.stringify(all(metrics))).not.toMatch(/synthetic-(path|query)/);
  });

  it('exports no http instrumentation metric with its wider label set', async () => {
    await traffic();
    const metrics = await test.metrics();
    const scopes = metrics.scopeMetrics.map((scope) => scope.scope.name);
    expect(scopes).not.toContain('@opentelemetry/instrumentation-http');
  });

  it('labels every metric with allowed keys only', async () => {
    await traffic();
    const metrics = await test.metrics();
    for (const metric of all(metrics)) {
      for (const point of pointsOf(metric)) {
        for (const key of Object.keys(point.attributes)) {
          expect(ALLOWED_METRIC_LABELS.has(key), `${metric.descriptor.name}: ${key}`).toBe(true);
        }
      }
    }
  });
});

describe('process metrics', () => {
  it('reports event-loop delay and memory', async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const names = all(await test.metrics()).map((metric) => metric.descriptor.name);
    expect(names.some((name) => name.startsWith('nodejs.eventloop.delay'))).toBe(true);
    expect(names.some((name) => name.startsWith('v8js.memory') || name.includes('memory'))).toBe(
      true,
    );
  });
});
