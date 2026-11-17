// Thin wrapper over the docker CLI (as in 0.3-S4, copied: no import from another throwaway
// spike). The boundary needs internal networks and containers on two networks at start.
import { spawn } from 'node:child_process';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface DockerOptions {
  input?: string;
  /** Throw on a non-zero exit (default true). */
  check?: boolean;
  timeoutMs?: number;
  /** Secrets go here and reach containers as `-e NAME`, never on a command line. */
  env?: Record<string, string>;
}

export function docker(args: readonly string[], options: DockerOptions = {}): Promise<ExecResult> {
  const { input, check = true, timeoutMs = 600_000, env } = options;
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: env ? { ...process.env, ...env } : process.env,
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      const result = {
        code: code ?? -1,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
      };
      // Only the subcommand goes into the error: arguments may hold per-run values.
      if (check && result.code !== 0) {
        reject(
          new Error(
            `docker ${args[0] ?? ''} failed (${String(result.code)}): ${result.stderr.slice(0, 400)}`,
          ),
        );
      } else resolve(result);
    });
    child.stdin.end(input);
  });
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Polls `probe` until it returns true or `timeoutMs` passes. */
export async function waitFor(
  what: string,
  probe: () => Promise<boolean>,
  timeoutMs = 180_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe().catch(() => false)) return;
    await sleep(500);
  }
  throw new Error(`timed out waiting for ${what}`);
}
