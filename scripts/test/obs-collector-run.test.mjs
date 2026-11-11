// Spec 0.2-09b criterion 7 (behaviour): the pinned Collector image, running the production
// processors from infra/observability/collector.yaml, deletes every denied key and masks blocked
// values before export. Needs Docker; skipped with a printed reason otherwise (CI runs it).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { parse, stringify } from 'yaml';
import {
  BLOCKED_VALUES,
  DENIED_KEYS,
  deniedValue,
  KEPT_KEYS,
} from './fixtures/obs/denied-keys.mjs';

const dir = join(import.meta.dirname, '..', '..', 'infra', 'observability');
const TRACE_ID = '5b8efff798038103d269b633813fc60c';
const SPAN_ID = 'eee19b7ec3c1b174';
const WAIT_MS = 60_000;

const docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
  encoding: 'utf8',
  timeout: 20_000,
});
const skip = docker.status === 0 ? false : 'Docker is not reachable (runs in CI)';
if (skip) process.stdout.write(`obs-collector-run: skipped: ${skip}\n`);

const value = (v) => {
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  if (typeof v === 'number') return { intValue: String(v) };
  return { stringValue: String(v) };
};
const attributes = (record) => Object.entries(record).map(([key, v]) => ({ key, value: value(v) }));

/** Every denied key with its own synthetic value; header keys as arrays, like the semconv. */
const denied = Object.fromEntries(
  DENIED_KEYS.map((key, i) => [key, key.includes('.header.') ? [deniedValue(i)] : deniedValue(i)]),
);
const masked = {
  'http.user_agent': `probe ${BLOCKED_VALUES.email}`,
  'error.type': BLOCKED_VALUES.bearer,
};
const resource = {
  attributes: attributes({
    'service.name': 'shifa-api',
    'host.name': 'obs-host-fixture',
    ...denied,
  }),
};
const recordAttributes = attributes({ ...denied, ...KEPT_KEYS, ...masked });
const now = String(Date.now() * 1_000_000);

const FIXTURES = {
  'traces.json': {
    resourceSpans: [
      {
        resource,
        scopeSpans: [
          {
            scope: { name: 'obs-fixture' },
            spans: [
              {
                traceId: TRACE_ID,
                spanId: SPAN_ID,
                name: 'GET /patients/:id',
                kind: 2,
                startTimeUnixNano: now,
                endTimeUnixNano: now,
                attributes: recordAttributes,
              },
            ],
          },
        ],
      },
    ],
  },
  'logs.json': {
    resourceLogs: [
      {
        resource,
        scopeLogs: [
          {
            scope: { name: 'obs-fixture' },
            logRecords: [
              {
                timeUnixNano: now,
                severityNumber: 9,
                body: { stringValue: 'request completed' },
                traceId: TRACE_ID,
                spanId: SPAN_ID,
                attributes: [...recordAttributes, ...attributes({ requestId: 'req-0000000001' })],
              },
            ],
          },
        ],
      },
    ],
  },
  'metrics.json': {
    resourceMetrics: [
      {
        resource,
        scopeMetrics: [
          {
            scope: { name: 'obs-fixture' },
            metrics: [
              {
                name: 'http.server.request.count',
                sum: {
                  aggregationTemporality: 2,
                  isMonotonic: true,
                  dataPoints: [{ asInt: '1', timeUnixNano: now, attributes: recordAttributes }],
                },
              },
            ],
          },
        ],
      },
    ],
  },
};

function collectorImage() {
  const compose = parse(readFileSync(join(dir, 'compose.yml'), 'utf8'));
  return compose.services.collector.image;
}

/** The production config with a file receiver and a file exporter in place of OTLP. */
function testConfig() {
  const production = parse(readFileSync(join(dir, 'collector.yaml'), 'utf8'));
  const pipelines = {};
  for (const [name, pipeline] of Object.entries(production.service.pipelines)) {
    pipelines[name] = {
      receivers: ['otlpjsonfile'],
      processors: pipeline.processors,
      exporters: ['file'],
    };
  }
  return {
    receivers: { otlpjsonfile: { include: ['/in/*.json'], start_at: 'beginning' } },
    processors: production.processors,
    exporters: { file: { path: '/out/out.json' } },
    service: { telemetry: { metrics: { level: 'none' } }, pipelines },
  };
}

describe('Collector run (pinned image, production processors)', { skip }, () => {
  const work = skip ? '' : mkdtempSync(join(tmpdir(), 'obs-collector-'));
  const name = `shifa-obs-collector-test-${String(process.pid)}`;
  let output = '';

  before(async () => {
    mkdirSync(join(work, 'in'));
    mkdirSync(join(work, 'out'));
    for (const [file, body] of Object.entries(FIXTURES)) {
      writeFileSync(join(work, 'in', file), `${JSON.stringify(body)}\n`);
    }
    writeFileSync(join(work, 'config.yaml'), stringify(testConfig()));
    const user =
      typeof process.getuid === 'function'
        ? ['--user', `${process.getuid()}:${process.getgid()}`]
        : [];
    const run = spawnSync(
      'docker',
      [
        'run',
        '-d',
        '--name',
        name,
        ...user,
        '-v',
        `${join(work, 'in')}:/in:ro`,
        '-v',
        `${join(work, 'out')}:/out`,
        '-v',
        `${join(work, 'config.yaml')}:/etc/obs-test/config.yaml:ro`,
        collectorImage(),
        '--config=/etc/obs-test/config.yaml',
      ],
      { encoding: 'utf8', timeout: 120_000 },
    );
    assert.equal(run.status, 0, run.stderr);
    const file = join(work, 'out', 'out.json');
    const deadline = Date.now() + WAIT_MS;
    const complete = () =>
      ['resourceSpans', 'resourceLogs', 'resourceMetrics'].every((k) => output.includes(k));
    while (Date.now() < deadline) {
      output = existsSync(file) ? readFileSync(file, 'utf8') : '';
      if (complete()) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!complete()) {
      const logs = spawnSync('docker', ['logs', name], { encoding: 'utf8' });
      assert.fail(`no complete export within ${String(WAIT_MS)} ms:\n${logs.stdout}${logs.stderr}`);
    }
  });

  after(() => {
    if (skip) return;
    spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' });
    rmSync(work, { recursive: true, force: true });
  });

  /** Every attribute list in the exported batches, labelled by where it was found. */
  function attributeLists() {
    const lists = [];
    for (const line of output.split('\n').filter(Boolean)) {
      const batch = JSON.parse(line);
      for (const [kind, scopesKey, itemsKey] of [
        ['resourceSpans', 'scopeSpans', 'spans'],
        ['resourceLogs', 'scopeLogs', 'logRecords'],
        ['resourceMetrics', 'scopeMetrics', 'metrics'],
      ]) {
        for (const res of batch[kind] ?? []) {
          lists.push([`${kind} resource`, res.resource?.attributes ?? []]);
          for (const scope of res[scopesKey] ?? []) {
            for (const item of scope[itemsKey] ?? []) {
              if (kind === 'resourceMetrics') {
                for (const point of item.sum?.dataPoints ?? [])
                  lists.push([kind, point.attributes ?? []]);
              } else {
                lists.push([kind, item.attributes ?? []]);
              }
            }
          }
        }
      }
    }
    return lists;
  }

  it('exports no denied key and no denied value', () => {
    for (const [where, list] of attributeLists()) {
      const keys = list.map((a) => a.key);
      for (const key of DENIED_KEYS) assert.ok(!keys.includes(key), `${where} keeps ${key}`);
    }
    DENIED_KEYS.forEach((key, i) => {
      assert.ok(!output.includes(deniedValue(i)), `the value of ${key} was exported`);
    });
    assert.ok(!output.includes('obs-host-fixture'), 'an unlisted resource attribute was exported');
  });

  it('keeps the allowed keys with their values on spans, logs and data points', () => {
    const records = attributeLists().filter(([where]) => !where.endsWith('resource'));
    assert.equal(records.length, 3, 'one span, one log record and one data point');
    for (const [where, list] of records) {
      const kept = Object.fromEntries(list.map((a) => [a.key, a.value]));
      for (const [key, expected] of Object.entries(KEPT_KEYS)) {
        assert.ok(key in kept, `${where} lost ${key}`);
        const actual = kept[key].stringValue ?? Number(kept[key].intValue);
        assert.equal(actual, expected, `${where}: ${key}`);
      }
    }
    assert.match(output, /"requestId"/, 'the log record lost requestId');
    assert.match(output, /"service\.name"/, 'the resource lost service.name');
  });

  it('keeps trace and span ids', () => {
    assert.ok(output.includes(TRACE_ID), 'trace id');
    assert.ok(output.includes(SPAN_ID), 'span id');
  });

  it('masks blocked values in allowed keys', () => {
    assert.ok(!output.includes(BLOCKED_VALUES.email), 'an e-mail address was exported');
    assert.ok(!output.includes(BLOCKED_VALUES.bearer.slice(7)), 'a bearer token was exported');
    assert.match(output, /"http\.user_agent"/, 'the masked key itself is kept');
  });
});
