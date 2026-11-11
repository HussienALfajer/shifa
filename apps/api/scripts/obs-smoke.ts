// Smoke check of the local observability stack (spec 0.2-09b criterion 10). Run through
// `pnpm obs:smoke`, which builds the API and passes the stack's endpoints and the GlitchTip DSN
// and token in this process's environment (never on a command line):
//   1. starts PostgreSQL through the @shifa/db harness and the built API (NODE_ENV=test) with
//      OTLP to the local Collector and the Sentry SDK to the local GlitchTip,
//   2. calls /health/ready and the test-only /_test/fail with a traceparent of its own, so the
//      trace id is known,
//   3. within 60 s expects the server span in Tempo, a log line with that trace id in Loki, the
//      request metric in Prometheus and one event tagged with that trace id in GlitchTip,
//   4. checks that the failing route's synthetic marker reached none of them.
// One line per check; exit code 1 on any miss or leak.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { acquireDbTestLock, startHarnessContainer } from '@shifa/db/harness';
import {
  freePort,
  INSTRUMENT,
  MAIN,
  type Running,
  startApi,
  waitReady,
  withTimeout,
} from './api-process.ts';
import {
  glitchtipEventFor,
  hasServerSpan,
  leaks,
  lokiLines,
  maskDsn,
  prometheusSeries,
} from './obs-smoke-parse.ts';

/** Must match TEST_FAILURE_MARKER in src/platform/test-support.ts (quoted by GET /_test/fail). */
const TEST_FAILURE_MARKER = 'synthetic-patient-marker-7f3a91';
const FAILING_SPAN = 'GET /_test/fail';
/** The error filter's log message for an unhandled error (src/platform/errors.ts). */
const FAILURE_LOG_LINE = 'request failed';
const WAIT_MS = 60_000;
const POLL_MS = 2000;
const EXIT_TIMEOUT_MS = 15_000;

const say = (line: string) => process.stdout.write(`obs-smoke: ${line}\n`);

class SmokeError extends Error {
  override name = 'SmokeError';
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new SmokeError(`${name} is not set; run this through pnpm obs:smoke`);
  return value;
}

const settings = () => ({
  dsn: required('OBS_SENTRY_DSN'),
  token: required('OBS_GLITCHTIP_TOKEN'),
  glitchtip: required('OBS_GLITCHTIP_URL'),
  org: required('OBS_GLITCHTIP_ORG'),
  project: required('OBS_GLITCHTIP_PROJECT'),
  otlp: required('OBS_OTLP_ENDPOINT'),
  tempo: required('OBS_TEMPO_URL'),
  loki: required('OBS_LOKI_URL'),
  prometheus: required('OBS_PROMETHEUS_URL'),
});
type Settings = ReturnType<typeof settings>;

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json', ...headers } });
    return res.ok ? await res.json() : undefined;
  } catch {
    return undefined; // not there yet, or the store is restarting: poll again
  }
}

/** A check polls until `probe` returns a payload (what was stored) or the time is up. */
interface Check {
  name: string;
  probe: () => Promise<unknown>;
}

async function poll(check: Check, deadline: number): Promise<unknown> {
  while (Date.now() < deadline) {
    const found = await check.probe();
    if (found !== undefined) return found;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return undefined;
}

function checksFor(s: Settings, traceId: string, startMs: number): Check[] {
  const startSec = Math.floor(startMs / 1000);
  const startNs = BigInt(startMs - 60_000) * 1_000_000n;
  const glitchtipAuth = { authorization: `Bearer ${s.token}` };
  const projectApi = `${s.glitchtip}/api/0/projects/${s.org}/${s.project}`;
  return [
    {
      name: 'trace in Tempo',
      probe: async () => {
        const body = await getJson(`${s.tempo}/api/v2/traces/${traceId}`);
        return hasServerSpan(body, traceId, FAILING_SPAN) ? body : undefined;
      },
    },
    {
      name: 'log lines in Loki',
      probe: async () => {
        const query = `{service_name="shifa-api"} | trace_id="${traceId}"`;
        const params = new URLSearchParams({ query, start: String(startNs), limit: '100' });
        const body = await getJson(`${s.loki}/loki/api/v1/query_range?${params.toString()}`);
        // Wait for the failing request's own error line (src/platform/errors.ts), so the marker
        // search runs on it, not only on the health check's lines.
        return lokiLines(body, traceId).includes(FAILURE_LOG_LINE) ? body : undefined;
      },
    },
    {
      name: 'request metric in Prometheus',
      probe: async () => {
        // Only samples written during this run: the series has the same labels on every run, and
        // Prometheus keeps answering with the last sample for five minutes.
        const query = `timestamp(http_server_request_duration_seconds_count{job="shifa-api",http_route="/_test/fail"}) > ${String(startSec)}`;
        const body = await getJson(
          `${s.prometheus}/api/v1/query?${new URLSearchParams({ query }).toString()}`,
        );
        return prometheusSeries(body) > 0 ? body : undefined;
      },
    },
    {
      name: 'error event in GlitchTip',
      probe: async () => {
        const events = await getJson(`${projectApi}/events/`, glitchtipAuth);
        const id = glitchtipEventFor(events, traceId);
        if (id === undefined) return undefined;
        return getJson(`${projectApi}/events/${id}/`, glitchtipAuth);
      },
    },
  ];
}

async function stop(app: Running): Promise<void> {
  app.child.kill('SIGTERM');
  await withTimeout(app.exited, EXIT_TIMEOUT_MS, 'the API did not exit').catch(() => {
    app.child.kill('SIGKILL');
  });
}

async function runChecks(s: Settings, databaseUrl: string): Promise<boolean> {
  const port = await freePort();
  const app = startApi(databaseUrl, port, {
    NODE_ENV: 'test',
    OTEL_EXPORTER_OTLP_ENDPOINT: s.otlp,
    SENTRY_DSN: s.dsn,
  });
  try {
    await waitReady(port, app);
    say(`API ready (OTLP ${s.otlp}, GlitchTip ${maskDsn(s.dsn)})`);
    const traceId = randomBytes(16).toString('hex');
    const startMs = Date.now();
    const traceparent = () => `00-${traceId}-${randomBytes(8).toString('hex')}-01`;
    const base = `http://127.0.0.1:${String(port)}`;
    const ready = await fetch(`${base}/health/ready`, { headers: { traceparent: traceparent() } });
    const fail = await fetch(`${base}/_test/fail`, { headers: { traceparent: traceparent() } });
    if (ready.status !== 200 || fail.status !== 500) {
      throw new SmokeError(
        `unexpected answers: /health/ready ${String(ready.status)}, /_test/fail ${String(fail.status)}`,
      );
    }
    say(`requests sent with trace id ${traceId}`);
    const deadline = Date.now() + WAIT_MS;
    const checks = checksFor(s, traceId, startMs);
    const found = await Promise.all(checks.map((check) => poll(check, deadline)));
    let passed = true;
    checks.forEach((check, i) => {
      const stored = found[i];
      if (stored === undefined) {
        passed = false;
        say(`FAIL ${check.name}: nothing within ${String(WAIT_MS / 1000)} s`);
      } else if (
        check.name !== 'request metric in Prometheus' &&
        leaks(stored, TEST_FAILURE_MARKER)
      ) {
        passed = false;
        say(`FAIL ${check.name}: the synthetic marker was stored`);
      } else {
        say(`ok   ${check.name}${check.name.includes('Prometheus') ? '' : ', no marker'}`);
      }
    });
    return passed;
  } catch (err) {
    process.stdout.write(app.output());
    throw err;
  } finally {
    await stop(app);
  }
}

async function main(): Promise<boolean> {
  const s = settings();
  for (const file of [MAIN, INSTRUMENT]) {
    if (!existsSync(file)) throw new SmokeError(`${file} is missing; run the build first`);
  }
  const release = await acquireDbTestLock();
  try {
    const harness = await startHarnessContainer();
    try {
      return await runChecks(s, harness.url('app'));
    } finally {
      await harness.stop();
    }
  } finally {
    release();
  }
}

try {
  const passed = await main();
  say(passed ? 'passed' : 'FAILED');
  if (!passed) process.exitCode = 1;
} catch (err) {
  say(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
}
