#!/usr/bin/env node
// Runs the node:test suites in scripts/test and fails if none are found, so moving or renaming
// the tests cannot turn this step silently green.
//   node scripts/run-script-tests.mjs          every suite (verify full and docs, CI)
//   node scripts/run-script-tests.mjs --fast   leaves out the Docker suites whose covered files
//                                              did not change since main (lib/script-tests.mjs)
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { changedSinceMain, selectScriptTests } from './lib/script-tests.mjs';

const args = process.argv.slice(2);
if (args.some((a) => a !== '--fast')) {
  process.stderr.write(`scripts-test: unknown argument (use --fast or none): ${args.join(' ')}\n`);
  process.exit(2);
}
const fast = args.includes('--fast');

const dir = join(import.meta.dirname, 'test');
const found = readdirSync(dir).filter((f) => f.endsWith('.test.mjs'));
if (found.length === 0) {
  process.stderr.write('scripts-test: no test files found in scripts/test\n');
  process.exit(1);
}
const root = join(import.meta.dirname, '..');
const { run, left } = selectScriptTests(found, {
  fast,
  changed: fast ? changedSinceMain(root) : null,
});
if (left.length > 0) {
  process.stdout.write(
    `scripts-test: fast mode leaves out ${left.length} Docker suite(s), run by verify full and CI: ${left.join(', ')}\n`,
  );
}
if (run.length === 0) {
  process.stderr.write('scripts-test: no test files selected\n');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['--test', ...run.map((f) => join(dir, f))], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
