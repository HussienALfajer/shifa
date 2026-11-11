// A fake world for the `backup` script tests: files in a Map, every child recorded and answered
// by `answer(cmd, args, options)` (default: success with empty output).
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_PATH, parseEnv, SCHEDULE_PATH } from '../../lib/backup-env.mjs';

export const ROOT = join('/', 'repo');
export const ENV_FILE = join(ROOT, ENV_PATH);
const repoRoot = join(import.meta.dirname, '..', '..', '..');
export const fixture = (name) =>
  readFileSync(join(import.meta.dirname, '..', 'fixtures', 'backup', name), 'utf8');

/** A complete .env as `up` leaves it. */
export const FULL_ENV = {
  BACKUP_POSTGRES_PASSWORD: 'a'.repeat(64),
  BACKUP_CIPHER_PASS: 'b'.repeat(64),
  BACKUP_GARAGE_RPC_SECRET: 'c'.repeat(64),
  BACKUP_GARAGE_ADMIN_TOKEN: 'd'.repeat(64),
  BACKUP_S3_KEY_ID: 'GK0123456789abcdef01234567',
  BACKUP_S3_KEY_SECRET: 'e'.repeat(64),
};

export const envText = (env) =>
  Object.entries(env)
    .map(([k, v]) => `${k}=${v}\n`)
    .join('');

export function world({
  env,
  files = new Map(),
  answer = () => undefined,
  now,
  processEnv = {},
} = {}) {
  const calls = [];
  const lines = [];
  if (env) files.set(ENV_FILE, envText(env));
  files.set(join(ROOT, SCHEDULE_PATH), readFileSync(join(repoRoot, SCHEDULE_PATH), 'utf8'));
  let clock = now ? now.getTime() : Date.UTC(2026, 10, 11, 15, 0, 0);
  const io = {
    root: ROOT,
    env: processEnv,
    randomBytes,
    now: () => new Date(clock),
    sleep: async (ms) => {
      clock += ms;
    },
    out: (line) => lines.push(line),
    readFile: (path) => files.get(path),
    writeFile: (path, text, mode) => files.set(path, Object.assign(new String(text), { mode })),
    makeDir: () => undefined,
    removeFile: (path) => files.delete(path),
    removeDir: (path) => {
      for (const key of [...files.keys()]) if (key.startsWith(path)) files.delete(key);
    },
    run: async (cmd, args, options = {}) => {
      calls.push({ cmd, args, options });
      const result = answer(cmd, args, options);
      return { code: 0, stdout: '', stderr: '', ...result };
    },
  };
  return {
    io,
    files,
    calls,
    lines,
    env: () => parseEnv(String(files.get(ENV_FILE) ?? '')),
    output: () => lines.join('\n'),
  };
}

/** True when `args` contains `sub` as a contiguous run. */
export const has = (args, ...sub) => args.some((_, i) => sub.every((s, j) => args[i + j] === s));
