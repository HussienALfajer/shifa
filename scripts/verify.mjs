#!/usr/bin/env node
// One entry point for every check. Usage: node scripts/verify.mjs [fast|full]
//   fast — packages affected since main (cached); used after each layer and by hooks.
//   full — everything, no affected filter; used before a PR and in CI.
// Prints a short summary; full output of each step is written to .verify/logs/<step>.log.
// Only one verify may run at a time (lock file), so parallel runs never fight over test databases.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const mode = process.argv[2] ?? 'fast';
if (mode !== 'fast' && mode !== 'full') {
  process.stderr.write(`verify: unknown mode "${mode}" (use fast or full)\n`);
  process.exit(2);
}

const root = join(import.meta.dirname, '..');
const stateDir = join(root, '.verify');
const logDir = join(stateDir, 'logs');
const lockFile = join(stateDir, 'lock');
mkdirSync(logDir, { recursive: true });

/**
 * Creates the lock atomically ('wx'). A lock left by a dead process, or an empty/garbage lock
 * older than a few seconds (a run killed while writing it), is removed and the create retried once.
 */
function acquireLock() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
      return;
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err;
    }
    const pid = Number(readFileSync(lockFile, 'utf8').trim());
    const validPid = Number.isInteger(pid) && pid > 0;
    if (validPid && isAlive(pid)) {
      process.stderr.write(`verify: another run is in progress (pid ${pid}); wait for it\n`);
      process.exit(3);
    }
    const ageMs = Date.now() - statSync(lockFile).mtimeMs;
    if (!validPid && ageMs < 5000) {
      process.stderr.write('verify: another run is starting; try again in a few seconds\n');
      process.exit(3);
    }
    rmSync(lockFile, { force: true });
  }
  process.stderr.write('verify: could not acquire the lock\n');
  process.exit(3);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

acquireLock();
const releaseLock = () => rmSync(lockFile, { force: true });
process.on('exit', releaseLock);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => process.exit(130));
}

const hasMain = await run('git', ['rev-parse', '--verify', '--quiet', 'main'], null);
const affected = mode === 'fast' && hasMain.code === 0 ? ['--affected'] : [];

const steps = [
  {
    name: 'format',
    cmd: 'pnpm',
    args: ['exec', 'biome', mode === 'full' ? 'ci' : 'check', '.'],
  },
  { name: 'instructions', cmd: 'node', args: ['scripts/check-instruction-size.mjs'] },
  { name: 'lint-root', cmd: 'pnpm', args: ['exec', 'eslint', '--max-warnings=0', '.'] },
  { name: 'scripts-test', cmd: 'node', args: ['--test', 'scripts/test/*.test.mjs'] },
  {
    name: 'typecheck+lint+test',
    cmd: 'pnpm',
    args: [
      'exec',
      'turbo',
      'run',
      'typecheck',
      'lint',
      'test',
      '--output-logs=errors-only',
      // full never trusts the cache, so CI and pre-PR runs re-execute every task
      ...(mode === 'full' ? ['--force'] : affected),
    ],
  },
];

const results = [];
for (const step of steps) {
  const logPath = join(logDir, `${step.name.replaceAll('+', '-')}.log`);
  const started = performance.now();
  const { code, output } = await run(step.cmd, step.args, logPath);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  results.push({ ...step, code, output, logPath, seconds });
}

let failed = 0;
process.stdout.write(`verify (${mode}${affected.length ? ', affected' : ''})\n`);
for (const r of results) {
  const ok = r.code === 0;
  if (!ok) failed += 1;
  process.stdout.write(`  ${ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(22)} ${r.seconds}s\n`);
}
for (const r of results.filter((x) => x.code !== 0)) {
  const tail = r.output.trimEnd().split('\n').slice(-25).join('\n');
  process.stdout.write(`\n--- ${r.name} (last 25 lines; full log: ${r.logPath}) ---\n${tail}\n`);
}
process.stdout.write(failed ? `\n${failed} step(s) failed\n` : '\nall green\n');
process.exitCode = failed ? 1 : 0;

function run(cmd, args, logPath) {
  return new Promise((resolve) => {
    // On Windows, pnpm is a .cmd shim that needs a shell. Arguments here are fixed strings
    // from this file (never user input), so joining them into one command line is safe.
    const win = process.platform === 'win32';
    const child = spawn(win ? [cmd, ...args].join(' ') : cmd, win ? [] : args, {
      cwd: root,
      shell: win,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', TURBO_TELEMETRY_DISABLED: '1' },
    });
    let output = '';
    child.stdout.on('data', (d) => {
      output += d;
    });
    child.stderr.on('data', (d) => {
      output += d;
    });
    child.on('close', (code) => {
      if (logPath) writeFileSync(logPath, output);
      resolve({ code: code ?? 1, output });
    });
    child.on('error', (err) => {
      output += String(err);
      if (logPath) writeFileSync(logPath, output);
      resolve({ code: 1, output });
    });
  });
}
