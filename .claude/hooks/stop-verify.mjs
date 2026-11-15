#!/usr/bin/env node
// Stop: when code (not only docs) changed, runs `verify fast` and sends Claude back to work with
// the summary if it fails. It makes one attempt per stop (Claude Code sets stop_hook_active on
// the retry). Skipped when:
//   - nothing in code changed, or the tree is identical to the last green verify, whether the
//     hook or `pnpm verify` ran it (scripts/lib/green-tree.mjs; verify records it);
//   - `.claude/state/red-phase` exists (/build-slice writes failing tests first, on purpose);
//   - another verify holds the lock.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isGreen, treeState } from '../../scripts/lib/green-tree.mjs';
import { projectDir, readEvent } from './lib/io.mjs';
import { codeChanges } from './lib/policy.mjs';

const event = await readEvent();
if (event.stop_hook_active) process.exit(0);

const root = projectDir(event);
if (existsSync(join(root, '.claude', 'state', 'red-phase'))) process.exit(0);

const tree = treeState(root);
if (!tree) process.exit(0);
if (codeChanges(tree.status).length === 0) process.exit(0);
if (isGreen(root, tree.fingerprint)) process.exit(0);

// Stay under the hook's 600 s timeout so verify is never orphaned holding its lock. A green run
// records the tree itself, so the next stop on the same tree is skipped.
const run = spawnSync(process.execPath, [join(root, 'scripts', 'verify.mjs'), 'fast'], {
  cwd: root,
  encoding: 'utf8',
  timeout: 540_000,
});
if (run.status === 0 || run.status === 3) process.exit(0);

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
