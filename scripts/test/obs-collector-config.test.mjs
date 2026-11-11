// Spec 0.2-09b criterion 7 (shape): every Collector pipeline deletes the denied keys and redacts
// before anything is batched or exported, and nothing the API allowlists is deleted. The run
// test (obs-collector-run.test.mjs) proves the same on the pinned image.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';
import { DENIED_KEYS, KEPT_KEYS } from './fixtures/obs/denied-keys.mjs';

const root = join(import.meta.dirname, '..', '..');
const config = parse(readFileSync(join(root, 'infra', 'observability', 'collector.yaml'), 'utf8'));
const scrubSource = readFileSync(join(root, 'apps', 'api', 'src', 'telemetry', 'scrub.ts'), 'utf8');

/** The string entries of `export const NAME ... = new Set([ ... ])` in scrub.ts. */
function allowedSet(name) {
  const match = new RegExp(`export const ${name}\\b[^=]*= new Set\\(\\[([\\s\\S]*?)\\]\\)`).exec(
    scrubSource,
  );
  assert.ok(match, `${name} not found in scrub.ts`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const API_ALLOWED = [
  ...allowedSet('ALLOWED_SPAN_ATTRIBUTES'),
  ...allowedSet('ALLOWED_METRIC_LABELS'),
  ...allowedSet('ALLOWED_RESOURCE_ATTRIBUTES'),
];

/** Applies an attributes/resource processor's actions to a map, as the Collector does. */
function applyActions(actions, input) {
  const attrs = new Map(Object.entries(input));
  for (const action of actions) {
    const keys = action.pattern
      ? [...attrs.keys()].filter((key) => new RegExp(action.pattern).test(key))
      : [action.key];
    switch (action.action) {
      case 'delete':
        for (const key of keys) attrs.delete(key);
        break;
      case 'insert':
        if (!attrs.has(action.key) && attrs.has(action.from_attribute)) {
          attrs.set(action.key, attrs.get(action.from_attribute));
        }
        break;
      default:
        assert.fail(`unexpected action ${action.action} in ${JSON.stringify(action)}`);
    }
  }
  return attrs;
}

const pipelines = Object.entries(config.service?.pipelines ?? {});
const DENY = ['resource/deny', 'attributes/deny'];

describe('Collector config', () => {
  it('has a traces, a metrics and a logs pipeline, all from the OTLP receiver', () => {
    assert.deepEqual(pipelines.map(([name]) => name).sort(), ['logs', 'metrics', 'traces']);
    for (const [name, pipeline] of pipelines) {
      assert.deepEqual(pipeline.receivers, ['otlp'], `${name}: receivers`);
    }
  });

  it('runs memory_limiter first, then deny and redaction, before batch and any exporter', () => {
    for (const [name, pipeline] of pipelines) {
      const processors = pipeline.processors ?? [];
      assert.equal(processors[0], 'memory_limiter', `${name}: memory_limiter first`);
      const batch = processors.indexOf('batch');
      assert.equal(batch, processors.length - 1, `${name}: batch is the last processor`);
      for (const step of [...DENY, 'redaction']) {
        const at = processors.indexOf(step);
        assert.ok(at > 0 && at < batch, `${name}: ${step} must run before batch`);
      }
      assert.ok(processors.indexOf('redaction') > processors.indexOf('attributes/deny'));
    }
  });

  it('exports only to otel-lgtm over OTLP, never to a debug or file exporter', () => {
    const exporters = Object.keys(config.exporters ?? {});
    assert.ok(exporters.length > 0);
    for (const name of exporters) {
      assert.match(name, /^otlp/, `exporter ${name}`);
      assert.match(String(config.exporters[name].endpoint), /^(http:\/\/)?lgtm:43(17|18)$/);
    }
    for (const [name, pipeline] of pipelines) {
      for (const exporter of pipeline.exporters ?? []) {
        assert.ok(exporters.includes(exporter), `${name}: exporter ${exporter} undefined`);
      }
    }
  });

  it('deletes every denied key from resource, span, log and data point attributes', () => {
    const input = Object.fromEntries(
      [...DENIED_KEYS, ...Object.keys(KEPT_KEYS)].map((k) => [k, 'v']),
    );
    for (const name of DENY) {
      const actions = config.processors?.[name]?.attributes ?? config.processors?.[name]?.actions;
      assert.ok(Array.isArray(actions), `${name}: no actions`);
      const left = applyActions(actions, input);
      for (const key of DENIED_KEYS) assert.ok(!left.has(key), `${name} keeps ${key}`);
      for (const key of Object.keys(KEPT_KEYS)) assert.ok(left.has(key), `${name} deletes ${key}`);
    }
  });

  it('deletes no key the API allowlists (scrub.ts)', () => {
    const input = Object.fromEntries(API_ALLOWED.map((key) => [key, 'v']));
    for (const name of DENY) {
      const actions = config.processors[name].attributes ?? config.processors[name].actions;
      const left = applyActions(actions, input);
      for (const key of API_ALLOWED) assert.ok(left.has(key), `${name} deletes allowed ${key}`);
    }
  });

  it('redacts with an allowlist that covers scrub.ts and holds no denied key', () => {
    const redaction = config.processors?.redaction ?? {};
    assert.notEqual(redaction.allow_all_keys, true, 'redaction must not allow all keys');
    const allowed = new Set(redaction.allowed_keys ?? []);
    for (const key of API_ALLOWED) assert.ok(allowed.has(key), `redaction drops allowed ${key}`);
    for (const key of DENIED_KEYS) assert.ok(!allowed.has(key), `redaction allows ${key}`);
    assert.ok((redaction.blocked_values ?? []).length > 0, 'no blocked value patterns');
    assert.equal(redaction.summary, 'silent', 'the summary would list the redacted keys');
  });

  it('receives OTLP only on the container ports the host binds to 127.0.0.1', () => {
    const protocols = config.receivers?.otlp?.protocols ?? {};
    assert.equal(protocols.grpc?.endpoint, '0.0.0.0:4317');
    assert.equal(protocols.http?.endpoint, '0.0.0.0:4318');
    assert.deepEqual(Object.keys(config.receivers).sort(), ['otlp']);
  });
});
