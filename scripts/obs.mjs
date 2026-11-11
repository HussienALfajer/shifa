#!/usr/bin/env node
// `pnpm obs:up | obs:down | obs:reset --yes | obs:smoke`: the local observability stack
// (infra/observability, docs/process/observability.md). The logic is in lib/obs.mjs; this file
// only connects it to the real file system and child processes.
//
// Children run from argument arrays, never through a shell. pnpm is run from npm_execpath (set
// when this runs through a pnpm script), so Windows needs no shell for a .cmd shim either.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join } from 'node:path';
import { obs } from './lib/obs.mjs';

const root = join(import.meta.dirname, '..');

function resolve(cmd, args) {
  if (cmd !== 'pnpm') return [cmd, args];
  const pnpm = process.env.npm_execpath;
  if (!pnpm) throw new Error('run this through pnpm (pnpm obs:smoke)');
  // pnpm 12 is a native executable; older installs point at a JavaScript entry point.
  return /\.[cm]?js$/.test(pnpm) ? [process.execPath, [pnpm, ...args]] : [pnpm, args];
}

function run(cmd, args, options = {}) {
  const [program, argv] = resolve(cmd, args);
  return new Promise((done) => {
    const child = spawn(program, argv, {
      cwd: root,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', options.capture ? 'pipe' : 'inherit', 'inherit'],
    });
    let stdout = '';
    child.stdout?.on('data', (chunk) => (stdout += chunk.toString()));
    child.once('error', (err) => {
      process.stderr.write(`obs: could not run ${cmd}: ${err.message}\n`);
      done({ code: 1, stdout });
    });
    child.once('close', (code) => done({ code: code ?? 1, stdout }));
  });
}

/**
 * Windows ignores the mode: replace the inherited ACL (often "Authenticated Users: modify" on
 * a data drive) with full control for the current user only.
 */
function ownerOnly(path) {
  const domain = process.env.USERDOMAIN;
  const user = userInfo().username;
  const account = domain ? `${domain}\\${user}` : user;
  const result = spawnSync('icacls', [path, '/inheritance:r', '/grant:r', `${account}:F`], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(`obs: could not restrict access to ${path}; restrict it by hand\n`);
  }
}

const io = {
  root,
  run,
  randomBytes,
  out: (line) => process.stdout.write(`${line}\n`),
  readFile: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined),
  writeFile: (path, text, mode) => {
    writeFileSync(path, text, { mode });
    // writeFileSync applies `mode` only when it creates the file.
    if (process.platform !== 'win32') chmodSync(path, mode);
    else ownerOnly(path);
  },
  removeFile: (path) => rmSync(path, { force: true }),
};

process.exitCode = await obs(process.argv.slice(2), io);
