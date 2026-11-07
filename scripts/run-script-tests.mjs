#!/usr/bin/env node
// Runs the node:test suites in scripts/test and fails if none are found,
// so moving or renaming the tests cannot turn this step silently green.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, 'test');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.mjs'))
  .map((f) => join(dir, f));
if (files.length === 0) {
  process.stderr.write('scripts-test: no test files found in scripts/test\n');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
