// Runs the built API as a child process, exactly as `pnpm start` does. Shared by boot-check.ts
// and obs-smoke.ts.
import { type ChildProcess, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const APP_DIR = join(import.meta.dirname, '..');
export const MAIN = join(APP_DIR, 'dist', 'main.js');
export const INSTRUMENT = join(APP_DIR, 'dist', 'instrument.js');
const INSTRUMENT_URL = pathToFileURL(INSTRUMENT).href;
const READY_TIMEOUT_MS = 30_000;

export class ApiProcessError extends Error {
  override name = 'ApiProcessError';
}

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new ApiProcessError('could not pick a free port'));
      });
    });
  });
}

export interface Running {
  child: ChildProcess;
  output: () => string;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

export function startApi(
  databaseUrl: string,
  port: number,
  extra: Record<string, string> = {},
): Running {
  // A minimal environment: nothing from the developer's shell leaks into the app.
  const env: Record<string, string> = {
    DATABASE_URL: databaseUrl,
    API_HOST: '127.0.0.1',
    API_PORT: String(port),
    LOG_LEVEL: 'info',
    ...extra,
  };
  for (const key of ['PATH', 'SYSTEMROOT', 'TEMP', 'TMP']) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  // Exactly as `pnpm start`: the telemetry bootstrap runs before main.js imports anything.
  const child = spawn(process.execPath, ['--import', INSTRUMENT_URL, MAIN], { cwd: APP_DIR, env });
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

export async function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ApiProcessError(`${what} (${String(ms)} ms)`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function waitReady(port: number, app: Running): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  const state = { exited: false };
  void app.exited.then(() => {
    state.exited = true;
  });
  while (Date.now() < deadline) {
    if (state.exited) throw new ApiProcessError('the API exited before it was ready');
    try {
      const res = await fetch(`http://127.0.0.1:${String(port)}/health/ready`);
      if (res.status === 200) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new ApiProcessError(
    `/health/ready did not answer 200 within ${String(READY_TIMEOUT_MS)} ms`,
  );
}
