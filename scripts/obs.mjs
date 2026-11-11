#!/usr/bin/env node
// `pnpm obs:up | obs:down | obs:reset --yes | obs:smoke`: the local observability stack
// (infra/observability, docs/process/observability.md). The logic is in lib/obs.mjs; this file
// only connects it to the real file system and child processes.
//
// Children run from argument arrays, never through a shell. pnpm is run as
// `node <npm_execpath>` (set when this runs through a pnpm script), so Windows needs no shell
// for its .cmd shim either.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { obs } from './lib/obs.mjs';

const root = join(import.meta.dirname, '..');

function resolve(cmd, args) {
  if (cmd !== 'pnpm') return [cmd, args];
  const pnpm = process.env.npm_execpath;
  if (!pnpm) throw new Error('run this through pnpm (pnpm obs:smoke)');
  return [process.execPath, [pnpm, ...args]];
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
  },
  removeFile: (path) => rmSync(path, { force: true }),
};

process.exitCode = await obs(process.argv.slice(2), io);
