#!/usr/bin/env node
// Stop: when code (not only docs) changed, runs `verify fast` and sends Claude back to work with
// the summary if it fails. It makes one attempt per stop (Claude Code sets stop_hook_active on
// the retry). Skipped when:
//   - nothing in code changed, or the tree is identical to the last green run (cached hash);
//   - `.claude/state/red-phase` exists (/build-slice writes failing tests first, on purpose);
//   - another verify holds the lock.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, projectDir, readEvent } from './lib/io.mjs';
import { codeChanges } from './lib/policy.mjs';

const event = await readEvent();
if (event.stop_hook_active) process.exit(0);

const root = projectDir(event);
const stateDir = join(root, '.claude', 'state');
if (existsSync(join(stateDir, 'red-phase'))) process.exit(0);

let changed;
let fingerprint;
try {
  const status = git(['status', '--porcelain', '--untracked-files=all'], root);
  changed = codeChanges(status);
  fingerprint = createHash('sha256')
    .update(git(['rev-parse', 'HEAD'], root))
    .update(status)
    .update(git(['diff', 'HEAD'], root))
    .digest('hex');
} catch {
  process.exit(0);
}
if (changed.length === 0) process.exit(0);

const greenFile = join(stateDir, 'last-green-verify');
if (existsSync(greenFile) && readFileSync(greenFile, 'utf8').trim() === fingerprint) {
  process.exit(0);
}

// Stay under the hook's 600 s timeout so verify is never orphaned holding its lock.
const run = spawnSync(process.execPath, [join(root, 'scripts', 'verify.mjs'), 'fast'], {
  cwd: root,
  encoding: 'utf8',
  timeout: 540_000,
});
if (run.status === 0) {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(greenFile, fingerprint);
  process.exit(0);
}
if (run.status === 3) process.exit(0);

const summary = (run.stdout || run.stderr || String(run.error ?? ''))
  .trim()
  .split('\n')
  .slice(-40)
  .join('\n');
process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason: `verify (fast) failed for uncommitted code changes. Fix the cause, then stop again. If you are waiting for the owner on purpose (for example a wrong locked test), say so and stop.\n${summary}`,
  }),
);
process.exit(0);
