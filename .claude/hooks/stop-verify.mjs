#!/usr/bin/env node
// Stop: when code (not only docs) changed, runs `verify fast` and keeps Claude working until it
// is green. Skips when already continuing from this hook, when nothing changed, or when another
// verify run holds the lock.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { git, projectDir, readEvent } from './lib/io.mjs';
import { codeChanges } from './lib/policy.mjs';

const event = await readEvent();
if (event.stop_hook_active) process.exit(0);

const root = projectDir(event);
let changed = [];
try {
  changed = codeChanges(git(['status', '--porcelain', '--untracked-files=all'], root));
} catch {
  process.exit(0);
}
if (changed.length === 0) process.exit(0);

const run = spawnSync(process.execPath, [join(root, 'scripts', 'verify.mjs'), 'fast'], {
  cwd: root,
  encoding: 'utf8',
});
if (run.status === 0 || run.status === 3) process.exit(0);

const summary = (run.stdout || run.stderr || '').trim().split('\n').slice(-40).join('\n');
process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason: `verify (fast) failed for uncommitted code changes. Fix the cause, then stop again.\n${summary}`,
  }),
);
process.exit(0);
