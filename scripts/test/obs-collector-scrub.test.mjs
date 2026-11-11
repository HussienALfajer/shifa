// PLT-52 layer two beyond attributes (security review of 0.2-09b3): span status messages and
// trace state are emptied, non-UUID tenant/user ids dropped, exception events keep only class
// and stack, a forged copy key cannot become the allowed content-type header, and phone numbers
// and basic credentials are masked. Unlike obs-collector-run.test.mjs, the committed
// collector.yaml is mounted unchanged and a second --config only swaps receiver and exporter.
// Needs Docker; skipped with a printed reason otherwise (CI runs it).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { parse, stringify } from 'yaml';

const dir = join(import.meta.dirname, '..', '..', 'infra', 'observability');
const TRACE_ID = '0af7651916cd43dd8448eb211c80319c';
const UUID = '00000000-0000-4000-8000-0000000000aa';
const LEAKS = {
  status: 'LEAK-STATUS-invalid input syntax for type uuid: "Fatima"',
  traceState: 'vendor=LEAK-TRACESTATE',
  tenant: 'LEAK-TENANT-not-a-uuid',
  eventMessage: 'LEAK-EVENT-MESSAGE',
  forged: 'LEAK-FORGED-CONTENT-TYPE',
  phone: '+963 944 123 456',
  phoneNational: '0944123456',
  basic: 'Basic dXNlcjpzZWNyZXQ=',
};
const WAIT_MS = 60_000;

const docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
  encoding: 'utf8',
  timeout: 20_000,
});
const skip = docker.status === 0 ? false : 'Docker is not reachable (runs in CI)';
if (skip) process.stdout.write(`obs-collector-scrub: skipped: ${skip}\n`);

const str = (key, value) => ({ key, value: { stringValue: value } });
const now = String(Date.now() * 1_000_000);

const traces = {
  resourceSpans: [
    {
      resource: { attributes: [str('service.name', 'shifa-api')] },
      scopeSpans: [
        {
          scope: { name: 'obs-scrub-fixture' },
          spans: [
            {
              traceId: TRACE_ID,
              spanId: 'b7ad6b7169203331',
              traceState: LEAKS.traceState,
              name: 'GET /patients/:id',
              kind: 2,
              startTimeUnixNano: now,
              endTimeUnixNano: now,
              status: { code: 2, message: LEAKS.status },
              attributes: [
                str('http.route', '/patients/:id'),
                str('tenant.id', LEAKS.tenant),
                str('user.id', UUID),
                str('shifa.keep.content_type', LEAKS.forged),
                str('user_agent.original', `probe ${LEAKS.phone}`),
                str('http.user_agent', `probe ${LEAKS.phoneNational}`),
                str('error.type', LEAKS.basic),
              ],
              events: [
                {
                  name: 'exception',
                  timeUnixNano: now,
                  attributes: [
                    str('exception.type', 'DatabaseError'),
                    str('exception.message', LEAKS.eventMessage),
                    str('exception.stacktrace', 'DatabaseError\n    at query (pg.js:1:1)'),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('Collector scrubbing beyond attributes (committed config)', { skip }, () => {
  const work = skip ? '' : mkdtempSync(join(tmpdir(), 'obs-scrub-'));
  const name = `shifa-obs-scrub-test-${String(process.pid)}`;
  let output = '';
  let span;

  before(async () => {
    mkdirSync(join(work, 'in'));
    mkdirSync(join(work, 'out'));
    writeFileSync(join(work, 'in', 'traces.json'), `${JSON.stringify(traces)}\n`);
    const production = parse(readFileSync(join(dir, 'collector.yaml'), 'utf8'));
    const override = {
      receivers: { otlp_json_file: { include: ['/in/*.json'], start_at: 'beginning' } },
      exporters: { file: { path: '/out/out.json' } },
      service: {
        telemetry: { metrics: { level: 'none' } },
        pipelines: {
          traces: {
            receivers: ['otlp_json_file'],
            processors: production.service.pipelines.traces.processors,
            exporters: ['file'],
          },
        },
      },
    };
    writeFileSync(join(work, 'override.yaml'), stringify(override));
    const image = parse(readFileSync(join(dir, 'compose.yml'), 'utf8')).services.collector.image;
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
        `${join(dir, 'collector.yaml')}:/etc/shifa/collector.yaml:ro`,
        '-v',
        `${join(work, 'override.yaml')}:/etc/shifa/override.yaml:ro`,
        '-v',
        `${join(work, 'in')}:/in:ro`,
        '-v',
        `${join(work, 'out')}:/out`,
        image,
        '--config=/etc/shifa/collector.yaml',
        '--config=/etc/shifa/override.yaml',
      ],
      { encoding: 'utf8', timeout: 120_000 },
    );
    assert.equal(run.status, 0, run.stderr);
    const file = join(work, 'out', 'out.json');
    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline && !output.includes('resourceSpans')) {
      output = existsSync(file) ? readFileSync(file, 'utf8') : '';
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!output.includes('resourceSpans')) {
      const logs = spawnSync('docker', ['logs', name], { encoding: 'utf8' });
      assert.fail(`no export within ${String(WAIT_MS)} ms:\n${logs.stdout}${logs.stderr}`);
    }
    span = JSON.parse(output.split('\n')[0]).resourceSpans[0].scopeSpans[0].spans[0];
  });

  after(() => {
    if (skip) return;
    spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' });
    rmSync(work, { recursive: true, force: true });
  });

  const attrs = (list) => Object.fromEntries((list ?? []).map((a) => [a.key, a.value.stringValue]));

  it('stores none of the synthetic leaks', () => {
    for (const [what, leak] of Object.entries(LEAKS)) {
      assert.ok(!output.includes(leak), `${what} was exported`);
    }
  });

  it('empties the status message and trace state, keeping the status code', () => {
    assert.ok(!span.status?.message, 'status message');
    assert.equal(span.status?.code, 2);
    assert.ok(!span.traceState, 'trace state');
    assert.equal(span.traceId, TRACE_ID);
  });

  it('drops a non-UUID tenant id and keeps a UUID user id', () => {
    const kept = attrs(span.attributes);
    assert.equal(kept['tenant.id'], undefined);
    assert.equal(kept['user.id'], UUID);
    assert.equal(kept['http.request.header.content-type'], undefined, 'forged copy promoted');
  });

  it('keeps an exception event as class and stack only', () => {
    const [event] = span.events ?? [];
    assert.ok(event, 'the exception event was dropped');
    const kept = attrs(event.attributes);
    assert.equal(kept['exception.type'], 'DatabaseError');
    assert.match(kept['exception.stacktrace'] ?? '', /at query/);
    assert.equal(kept['exception.message'], undefined);
  });
});
