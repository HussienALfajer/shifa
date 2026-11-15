#!/usr/bin/env node
// One entry point for every check. Usage: node scripts/verify.mjs [fast|full|docs]
//   fast — packages affected since main (cached); used after each layer and by hooks.
//   full — everything, no affected filter, plus build and the API boot check; before a PR and in CI.
//   docs — only the steps that read docs and repository scripts (no Flutter, no packages); CI uses
//          it for pull requests that change nothing outside docs/.
// Prints a short summary; full output of each step is written to .verify/logs/<step>.log.
// Only one verify may run at a time (lock file), so parallel runs never fight over test databases.
// A fast or full run that ends all green records the tree (lib/green-tree.mjs), so the Stop hook
// does not run the same checks again on an unchanged tree.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { recordGreen, treeState } from './lib/green-tree.mjs';
import { acquireLock, LockBusyError } from './lib/lock.mjs';

const MODES = ['fast', 'full', 'docs'];
const mode = process.argv[2] ?? 'fast';
if (!MODES.includes(mode)) {
  process.stderr.write(`verify: unknown mode "${mode}" (use ${MODES.join(', ')})\n`);
  process.exit(2);
}

const root = join(import.meta.dirname, '..');
const stateDir = join(root, '.verify');
const logDir = join(stateDir, 'logs');
const lockFile = join(stateDir, 'lock');
mkdirSync(logDir, { recursive: true });

// verify never waits: a second run fails at once (exit 3) and the caller retries later.
let releaseLock;
try {
  releaseLock = await acquireLock(lockFile);
} catch (err) {
  if (!(err instanceof LockBusyError)) throw err;
  process.stderr.write(
    err.pid
      ? `verify: another run is in progress (pid ${err.pid}); wait for it\n`
      : 'verify: another run is starting; try again in a few seconds\n',
  );
  process.exit(3);
}
process.on('exit', releaseLock);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => process.exit(130));
}

const hasMain = await run('git', ['rev-parse', '--verify', '--quiet', 'main'], null);
const affected = mode === 'fast' && hasMain.code === 0 ? ['--affected'] : [];
const treeBefore = mode === 'docs' ? null : treeState(root);

// `docs: true` marks the steps docs mode runs; every other step needs packages or Flutter.
const steps = [
  {
    name: 'format',
    docs: true,
    cmd: 'pnpm',
    args: ['exec', 'biome', mode === 'fast' ? 'check' : 'ci', '.'],
  },
  { name: 'instructions', docs: true, cmd: 'node', args: ['scripts/check-instruction-size.mjs'] },
  {
    name: 'lint-root',
    docs: true,
    cmd: 'pnpm',
    // The cache is keyed on each file's content and the resolved config. That is enough only
    // while the root config uses single-file rules; a rule that reads other files (type-aware,
    // import resolution) would need the cache removed.
    args: [
      'exec',
      'eslint',
      '--max-warnings=0',
      '--cache',
      '--cache-strategy',
      'content',
      '--cache-location',
      '.verify/eslint-root.cache',
      '.',
    ],
  },
  { name: 'scripts-test', docs: true, cmd: 'node', args: ['scripts/run-script-tests.mjs'] },
  { name: 'file-length', docs: true, cmd: 'node', args: ['scripts/check-file-length.mjs'] },
  // Resolves the pub workspace from pubspec.lock without changing it (fast when up to date).
  // Runs before drift: the Dart client check resolves offline from the pub cache this fills.
  {
    name: 'pub-get',
    cmd: 'node',
    args: ['scripts/dart.mjs', 'flutter', 'pub', 'get', '--enforce-lockfile'],
  },
  // Generated files and migrations match their sources (scripts/drift.config.mjs).
  {
    name: 'drift',
    cmd: 'node',
    args: ['scripts/check-drift.mjs', ...(mode === 'full' ? ['--full'] : [])],
  },
  {
    name: 'typecheck+lint+test',
    // `dart test` re-resolves the workspace and would rewrite pubspec.lock if pub-get failed.
    requires: 'pub-get',
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
  // Full only: build every app and boot the built API against a real database
  // (apps/api/scripts/boot-check.ts; needs Docker like the DB tests).
  {
    name: 'build',
    full: true,
    cmd: 'pnpm',
    args: ['exec', 'turbo', 'run', 'build', '--output-logs=errors-only', '--force'],
  },
  {
    name: 'boot',
    full: true,
    requires: 'build',
    cmd: 'pnpm',
    args: ['--filter', '@shifa/api', 'run', 'boot-check'],
  },
].filter((step) => (mode === 'docs' ? step.docs : mode === 'full' || !step.full));

const results = [];
for (const step of steps) {
  const logPath = join(logDir, `${step.name.replaceAll('+', '-')}.log`);
  const prerequisite = results.find((r) => r.name === step.requires);
  if (prerequisite && prerequisite.code !== 0) {
    const output = `skipped: ${step.requires} failed\n`;
    writeFileSync(logPath, output);
    results.push({ ...step, code: 1, output, logPath, seconds: '0.0' });
    continue;
  }
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

// Recorded only when the tree did not change while the checks ran (an edit mid-run, or a step
// that rewrote a file, must not mark the new tree green).
if (!failed && treeBefore) {
  const treeAfter = treeState(root);
  if (treeAfter?.fingerprint === treeBefore.fingerprint) {
    try {
      recordGreen(root, treeBefore.fingerprint);
    } catch {
      // A read-only state folder only costs the Stop hook a repeat run.
    }
  }
}

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
