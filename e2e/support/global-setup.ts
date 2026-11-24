// Playwright's global setup (slice A-01-06): starts scripts/backend.ts with plain Node, waits for
// its READY line and hands the URLs and the seed to the workers through their environment (never
// a file, never a log). The teardown closes the backend's stdin, which stops everything; a
// backend that does not stop in time is killed (the harness container's reaper removes the rest).
import { type ChildProcessByStdio, spawn } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { READY_PREFIX, RUN_ENV, type RunUrls, SEED_ENV, type Seeded } from './run.ts';

const BACKEND = fileURLToPath(new URL('../scripts/backend.ts', import.meta.url));
const START_TIMEOUT_MS = 240_000;
const STOP_TIMEOUT_MS = 30_000;

type Backend = ChildProcessByStdio<Writable, Readable, null>;

function waitForReady(child: Backend): Promise<{ run: RunUrls; seeded: Seeded }> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      reject(new Error(`the e2e backend was not ready within ${String(START_TIMEOUT_MS)} ms`));
    }, START_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const line = buffer.split('\n').find((l) => l.startsWith(READY_PREFIX));
      if (line === undefined) return;
      clearTimeout(timer);
      resolve(JSON.parse(line.slice(READY_PREFIX.length)) as { run: RunUrls; seeded: Seeded });
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`the e2e backend exited (${String(code)}) before it was ready`));
    });
  });
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const child: Backend = spawn(process.execPath, [BACKEND], { stdio: ['pipe', 'pipe', 'inherit'] });
  const exited = new Promise<boolean>((resolve) => {
    child.once('exit', () => {
      resolve(true);
    });
  });
  const teardown = async () => {
    child.stdin.end();
    const timeout = new Promise<boolean>((resolve) => {
      setTimeout(() => {
        resolve(false);
      }, STOP_TIMEOUT_MS);
    });
    if (!(await Promise.race([exited, timeout]))) child.kill('SIGKILL');
  };
  try {
    const { run, seeded } = await waitForReady(child);
    process.env[RUN_ENV] = JSON.stringify(run);
    process.env[SEED_ENV] = JSON.stringify(seeded);
    return teardown;
  } catch (err) {
    await teardown();
    throw err;
  }
}
