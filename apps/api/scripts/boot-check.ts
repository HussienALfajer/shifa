// End-to-end check of the built API (run with plain Node after `pnpm build`):
//   1. starts the pinned PostgreSQL image through the @shifa/db harness (roles + migrations),
//   2. runs `node dist/main.js` as shifa_app, waits for /health/ready, sends SIGTERM and expects
//      exit 0 within 15 s (Linux/macOS; Windows cannot deliver SIGTERM, so it only stops it),
//   3. runs it again with the owner's URL and expects a non-zero exit (createDb refuses owners),
//   4. checks that no database password ever appeared in the app's output.
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { acquireDbTestLock, startHarnessContainer } from '@shifa/db/harness';

const APP_DIR = join(import.meta.dirname, '..');
const MAIN = join(APP_DIR, 'dist', 'main.js');
const READY_TIMEOUT_MS = 30_000;
const EXIT_TIMEOUT_MS = 15_000;
const GRACEFUL_SIGNALS = process.platform !== 'win32';

const say = (line: string) => process.stdout.write(`boot-check: ${line}\n`);

class BootCheckError extends Error {
  override name = 'BootCheckError';
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new BootCheckError('could not pick a free port'));
      });
    });
  });
}

interface Running {
  child: ChildProcess;
  output: () => string;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

function startApi(databaseUrl: string, port: number): Running {
  // A minimal environment: nothing from the developer's shell leaks into the app.
  const env: Record<string, string> = {
    DATABASE_URL: databaseUrl,
    API_HOST: '127.0.0.1',
    API_PORT: String(port),
    LOG_LEVEL: 'info',
  };
  for (const key of ['PATH', 'SYSTEMROOT', 'TEMP', 'TMP']) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  const child = spawn(process.execPath, [MAIN], { cwd: APP_DIR, env });
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
  return { child, output: () => output, exited };
}

async function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new BootCheckError(`${what} (${String(ms)} ms)`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function waitReady(port: number, app: Running): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  const state = { exited: false };
  void app.exited.then(() => {
    state.exited = true;
  });
  while (Date.now() < deadline) {
    if (state.exited) throw new BootCheckError('the API exited before it was ready');
    try {
      const res = await fetch(`http://127.0.0.1:${String(port)}/health/ready`);
      if (res.status === 200) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new BootCheckError(
    `/health/ready did not answer 200 within ${String(READY_TIMEOUT_MS)} ms`,
  );
}

async function checkAppRole(url: string): Promise<string> {
  const port = await freePort();
  const app = startApi(url, port);
  try {
    await waitReady(port, app);
    say('ready as shifa_app');
    const live = await fetch(`http://127.0.0.1:${String(port)}/health/live`);
    if (live.status !== 200)
      throw new BootCheckError(`/health/live answered ${String(live.status)}`);
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
  const { code } = await withTimeout(app.exited, READY_TIMEOUT_MS, 'owner URL: API kept running');
  if (code === 0 || code === null) {
    app.child.kill('SIGKILL');
    throw new BootCheckError(`owner URL: expected a non-zero exit, got ${String(code)}`);
  }
  if (!app.output().includes('database check failed at startup')) {
    process.stdout.write(app.output());
    throw new BootCheckError('owner URL: exited, but not through the startup database check');
  }
  say(`owner URL refused (exit ${String(code)})`);
  return app.output();
}

async function main(): Promise<void> {
  if (!existsSync(MAIN)) throw new BootCheckError(`${MAIN} is missing; run the build first`);
  const release = await acquireDbTestLock();
  try {
    const harness = await startHarnessContainer();
    try {
      const output = [
        await checkAppRole(harness.url('app')),
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
