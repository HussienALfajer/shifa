// The real-world side of the local stacks (`pnpm obs:*`, `pnpm backup:*`): child processes,
// files with owner-only access, and output. The pure cores (lib/obs.mjs, lib/backup*.mjs) take
// this object as `io`, so their tests swap it for a fake.
//
// Children run from argument arrays, never through a shell. pnpm is run from npm_execpath (set
// when this runs through a pnpm script), so Windows needs no shell for a .cmd shim either.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { userInfo } from 'node:os';

function resolve(cmd, args) {
  if (cmd !== 'pnpm') return [cmd, args];
  const pnpm = process.env.npm_execpath;
  if (!pnpm) throw new Error('run this through pnpm (e.g. pnpm obs:smoke)');
  // pnpm 12 is a native executable; older installs point at a JavaScript entry point.
  return /\.[cm]?js$/.test(pnpm) ? [process.execPath, [pnpm, ...args]] : [pnpm, args];
}

/**
 * Windows ignores the mode: replace the inherited ACL (often "Authenticated Users: modify" on
 * a data drive) with full control for the current user only.
 */
function ownerOnly(path, label) {
  const domain = process.env.USERDOMAIN;
  const user = userInfo().username;
  const account = domain ? `${domain}\\${user}` : user;
  const result = spawnSync('icacls', [path, '/inheritance:r', '/grant:r', `${account}:F`], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(`${label}: could not restrict access to ${path}; restrict it by hand\n`);
  }
}

/**
 * @param {string} root repository root (children run there)
 * @param {string} label prefix for the few messages this module prints itself
 */
export function createStackIo(root, label) {
  /**
   * Runs a child. `capture` collects stdout (and stderr with `captureErr`) instead of showing
   * it; `env` adds variables to the child's environment only.
   */
  function run(cmd, args, options = {}) {
    const [program, argv] = resolve(cmd, args);
    return new Promise((done) => {
      const child = spawn(program, argv, {
        cwd: root,
        env: { ...process.env, ...options.env },
        stdio: [
          'ignore',
          options.capture ? 'pipe' : 'inherit',
          options.captureErr ? 'pipe' : 'inherit',
        ],
      });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk) => (stdout += chunk.toString()));
      child.stderr?.on('data', (chunk) => (stderr += chunk.toString()));
      child.once('error', (err) => {
        process.stderr.write(`${label}: could not run ${cmd}: ${err.message}\n`);
        done({ code: 1, stdout, stderr });
      });
      child.once('close', (code) => done({ code: code ?? 1, stdout, stderr }));
    });
  }

  return {
    root,
    run,
    randomBytes,
    env: process.env,
    now: () => new Date(),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    out: (line) => process.stdout.write(`${line}\n`),
    readFile: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined),
    writeFile: (path, text, mode) => {
      writeFileSync(path, text, { mode });
      // writeFileSync applies `mode` only when it creates the file.
      if (process.platform !== 'win32') chmodSync(path, mode);
      else if ((mode & 0o077) === 0) ownerOnly(path, label);
    },
    makeDir: (path) => mkdirSync(path, { recursive: true }),
    removeFile: (path) => rmSync(path, { force: true }),
    removeDir: (path) => rmSync(path, { force: true, recursive: true }),
  };
}
