// End-to-end check of the built API (run with plain Node after `pnpm build`):
//   1. starts the pinned PostgreSQL image through the @shifa/db harness (roles + migrations),
//   2. runs `node --import dist/instrument.js dist/main.js` as shifa_app, waits for
//      /health/ready, sends SIGTERM and expects exit 0 within 15 s (Linux/macOS; Windows cannot
//      deliver SIGTERM, so it only stops it), once with telemetry off and once with
//      OTEL_EXPORTER_OTLP_ENDPOINT on a port where no Collector listens (the API stays ready and
//      logs exactly one export warning), and once against a stub Collector (server span, pg span
//      and log lines arrive over OTLP/HTTP), and once with SENTRY_DSN on a stub GlitchTip and
//      NODE_ENV=test (GET /_test/fail sends one scrubbed error event),
//   3. runs it again with the owner's URL and expects a non-zero exit (createDb refuses owners),
//   4. checks that no database password ever appeared in the app's output.
import { existsSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { acquireDbTestLock, startHarnessContainer } from '@shifa/db/harness';
import { freePort, INSTRUMENT, MAIN, startApi, waitReady, withTimeout } from './api-process.ts';

const EXPORT_WARNING = 'telemetry export failed';
/** The exporters retry with backoff before reporting a failure: wait up to this long for it. */
const COLLECTOR_DOWN_WAIT_MS = 30_000;
/** After the first warning, keep sending requests this long to show no second one follows. */
const AFTER_WARNING_MS = 3000;
const READY_TIMEOUT_MS = 30_000;
const EXIT_TIMEOUT_MS = 15_000;
const GRACEFUL_SIGNALS = process.platform !== 'win32';

const say = (line: string) => process.stdout.write(`boot-check: ${line}\n`);

class BootCheckError extends Error {
  override name = 'BootCheckError';
}

const countOf = (text: string, needle: string) => text.split(needle).length - 1;

interface StubCollector {
  url: string;
  /** Everything received on an OTLP path so far (protobuf bytes; strings appear verbatim). */
  received(path: string): Buffer;
  close(): Promise<void>;
}

/** Accepts OTLP/HTTP like a Collector and keeps the request bodies. */
async function startStubCollector(): Promise<StubCollector> {
  const bodies = new Map<string, Buffer[]>();
  const server = createHttpServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      // Without the query string: the Sentry envelope URL carries the key and client name there.
      const path = (req.url ?? '').split('?')[0] ?? '';
      bodies.set(path, [...(bodies.get(path) ?? []), Buffer.concat(chunks)]);
      res.writeHead(200, { 'content-type': 'application/x-protobuf' }).end();
    });
  });
  const port = await freePort();
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${String(port)}`,
    received: (path) => Buffer.concat(bodies.get(path) ?? []),
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** With a Collector listening, the built bundle exports server spans, pg spans and logs. */
async function checkCollectorUp(url: string): Promise<string> {
  const collector = await startStubCollector();
  const port = await freePort();
  const app = startApi(url, port, { OTEL_EXPORTER_OTLP_ENDPOINT: collector.url });
  try {
    await waitReady(port, app);
    const wanted = [
      ['/v1/traces', 'GET /health/ready'],
      ['/v1/traces', 'pg.query'],
      ['/v1/logs', 'request completed'],
    ] as const;
    const deadline = Date.now() + COLLECTOR_DOWN_WAIT_MS;
    const missing = () => wanted.filter(([path, text]) => !collector.received(path).includes(text));
    while (missing().length > 0 && Date.now() < deadline) {
      await fetch(`http://127.0.0.1:${String(port)}/health/ready`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (missing().length > 0) {
      const names = missing().map(([path, text]) => `${path} "${text}"`);
      throw new BootCheckError(`collector up: not exported: ${names.join(', ')}`);
    }
    if (app.output().includes(EXPORT_WARNING)) {
      throw new BootCheckError('collector up: export warning although the Collector answered');
    }
    say('collector up: server span, pg span and log lines exported');
    app.child.kill('SIGTERM');
    await withTimeout(app.exited, EXIT_TIMEOUT_MS, 'no exit after SIGTERM');
    return app.output();
  } catch (err) {
    app.child.kill('SIGKILL');
    process.stdout.write(app.output());
    throw err;
  } finally {
    await collector.close();
  }
}

/** Must match TEST_FAILURE_MARKER in src/platform/test-support.ts (quoted by GET /_test/fail). */
const TEST_FAILURE_MARKER = 'synthetic-patient-marker-7f3a91';

/**
 * With SENTRY_DSN pointing at a stub GlitchTip and NODE_ENV=test, the built bundle sends one
 * scrubbed error event for GET /_test/fail (fetch transport, client created by instrument.js).
 */
async function checkErrorReporting(url: string): Promise<string> {
  const glitchtip = await startStubCollector();
  const port = await freePort();
  const dsn = glitchtip.url.replace('http://', 'http://public@');
  const app = startApi(url, port, { SENTRY_DSN: `${dsn}/1`, NODE_ENV: 'test' });
  try {
    await waitReady(port, app);
    const res = await fetch(`http://127.0.0.1:${String(port)}/_test/fail`);
    if (res.status !== 500) {
      throw new BootCheckError(`error reporting: /_test/fail answered ${String(res.status)}`);
    }
    const path = '/api/1/envelope/';
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (!glitchtip.received(path).includes('"route":"/_test/fail"') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const sent = glitchtip.received(path).toString('utf8');
    if (!sent.includes('"route":"/_test/fail"') || !sent.includes('"status":"500"')) {
      throw new BootCheckError('error reporting: no event with route and status arrived');
    }
    if (sent.includes(TEST_FAILURE_MARKER)) {
      throw new BootCheckError('error reporting: the exception message reached the event');
    }
    say('error reporting: one scrubbed event for GET /_test/fail');
    app.child.kill('SIGTERM');
    await withTimeout(app.exited, EXIT_TIMEOUT_MS, 'no exit after SIGTERM');
    return app.output();
  } catch (err) {
    app.child.kill('SIGKILL');
    process.stdout.write(app.output());
    throw err;
  } finally {
    await glitchtip.close();
  }
}

async function checkAppRole(url: string, telemetry: 'off' | 'collector down'): Promise<string> {
  const port = await freePort();
  const extra: Record<string, string> =
    telemetry === 'off'
      ? {}
      : { OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${String(await freePort())}` };
  const app = startApi(url, port, extra);
  try {
    await waitReady(port, app);
    say(`ready as shifa_app (telemetry ${telemetry})`);
    const live = await fetch(`http://127.0.0.1:${String(port)}/health/live`);
    if (live.status !== 200)
      throw new BootCheckError(`/health/live answered ${String(live.status)}`);
    if (telemetry === 'collector down') {
      // Requests keep being served while exports fail; failures are logged once, not per request.
      let deadline = Date.now() + COLLECTOR_DOWN_WAIT_MS;
      let warned = false;
      while (Date.now() < deadline) {
        const res = await fetch(`http://127.0.0.1:${String(port)}/health/ready`);
        if (res.status !== 200) {
          throw new BootCheckError(`collector down: /health/ready answered ${String(res.status)}`);
        }
        if (!warned && app.output().includes(EXPORT_WARNING)) {
          warned = true;
          deadline = Date.now() + AFTER_WARNING_MS;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      const warnings = countOf(app.output(), EXPORT_WARNING);
      if (warnings !== 1) {
        throw new BootCheckError(`collector down: ${String(warnings)} export warnings, expected 1`);
      }
      if (!app.output().includes('"trace_id"')) {
        throw new BootCheckError('collector down: log lines carry no trace_id');
      }
      say(`collector down: still serving, ${String(warnings)} export warning(s)`);
    } else if (app.output().includes('"trace_id"') || app.output().includes(EXPORT_WARNING)) {
      throw new BootCheckError('telemetry off: output shows telemetry activity');
    }
    app.child.kill('SIGTERM');
    const { code, signal } = await withTimeout(
      app.exited,
      EXIT_TIMEOUT_MS,
      'no exit after SIGTERM',
    );
    if (GRACEFUL_SIGNALS) {
      if (code !== 0) {
        throw new BootCheckError(`SIGTERM exit: code ${String(code)}, signal ${String(signal)}`);
      }
      say('SIGTERM → exit 0');
    } else {
      say('stopped (graceful SIGTERM exit is checked on Linux/macOS only)');
    }
    return app.output();
  } catch (err) {
    app.child.kill('SIGKILL');
    process.stdout.write(app.output());
    throw err;
  }
}

async function checkOwnerRefused(url: string): Promise<string> {
  const app = startApi(url, await freePort());
  try {
    const { code } = await withTimeout(app.exited, READY_TIMEOUT_MS, 'owner URL: API kept running');
    if (code === 0 || code === null) {
      throw new BootCheckError(`owner URL: expected a non-zero exit, got ${String(code)}`);
    }
    if (!app.output().includes('database check failed at startup')) {
      throw new BootCheckError('owner URL: exited, but not through the startup database check');
    }
    say(`owner URL refused (exit ${String(code)})`);
    return app.output();
  } catch (err) {
    // A still-running child would hold the pipes open and hang this script.
    app.child.kill('SIGKILL');
    process.stdout.write(app.output());
    throw err;
  }
}

async function main(): Promise<void> {
  for (const file of [MAIN, INSTRUMENT]) {
    if (!existsSync(file)) throw new BootCheckError(`${file} is missing; run the build first`);
  }
  const release = await acquireDbTestLock();
  try {
    const harness = await startHarnessContainer();
    try {
      const output = [
        await checkAppRole(harness.url('app'), 'off'),
        await checkAppRole(harness.url('app'), 'collector down'),
        await checkCollectorUp(harness.url('app')),
        await checkErrorReporting(harness.url('app')),
        await checkOwnerRefused(harness.url('owner')),
      ].join('\n');
      const { appPassword, ownerPassword, superuserPassword } = harness.info;
      if ([appPassword, ownerPassword, superuserPassword].some((pw) => output.includes(pw))) {
        throw new BootCheckError('a database password appeared in the API output');
      }
      say('no credentials in the output');
    } finally {
      await harness.stop();
    }
  } finally {
    release();
  }
  say('passed');
}

try {
  await main();
} catch (err) {
  say(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
}
