// Starts a queue worker as a separate Node process (two of them prove "one send at a time per
// session" across processes, and a killed one proves the at-most-once rule).
import { type ChildProcess, spawn } from 'node:child_process';
import { join } from 'node:path';
import type { MessagingConfig } from './config.ts';

export interface WorkerProcess {
  ready: Promise<void>;
  /** SIGTERM and wait for exit. */
  stop(): Promise<void>;
  /** Hard kill (a crash) and wait for exit. */
  kill(): Promise<void>;
}

const exited = (child: ChildProcess) =>
  new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else
      child.once('exit', () => {
        resolve();
      });
  });

export function spawnWorker(config: MessagingConfig): WorkerProcess {
  const serialised = JSON.stringify({ ...config, allowlist: [...config.allowlist] });
  const child = spawn(process.execPath, [join(import.meta.dirname, 'worker.ts')], {
    env: { ...process.env, S5_WORKER_CONFIG: serialised },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const ready = new Promise<void>((resolve, reject) => {
    let buffered = '';
    child.stdout.on('data', (chunk: Buffer) => {
      buffered += chunk.toString('utf8');
      if (buffered.includes('"worker_ready"')) resolve();
    });
    let errors = '';
    child.stderr.on('data', (chunk: Buffer) => {
      errors += chunk.toString('utf8');
    });
    child.once('exit', (code) => {
      reject(new Error(`worker exited (${String(code)}): ${errors.slice(0, 400)}`));
    });
  });
  ready.catch(() => undefined);
  return {
    ready,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill(process.platform === 'win32' ? 'SIGKILL' : 'SIGTERM');
      }
      await exited(child);
    },
    async kill() {
      child.kill('SIGKILL');
      await exited(child);
    },
  };
}
