#!/usr/bin/env node
// `node scripts/run-e2e.mjs [--fast]`: verify's `e2e` step (slice A-01-06; plan in lib/e2e.mjs).
// Needs Docker (the harness database) and Playwright's Chromium.
import { spawnSync } from 'node:child_process';
import { e2eAffected, e2ePlan } from './lib/e2e.mjs';

const fast = process.argv.includes('--fast');
const shell = process.platform === 'win32';

function affected() {
  const result = spawnSync('pnpm', ['exec', 'turbo', 'ls', '--affected', '--output=json'], {
    encoding: 'utf8',
    shell,
  });
  // Without a comparison (no main, shallow clone), run the journeys rather than skip them.
  if (result.status !== 0) return true;
  return e2eAffected(result.stdout);
}

for (const step of e2ePlan({ fast, affected: fast ? affected() : false })) {
  if ('note' in step) {
    process.stdout.write(`verify-note: ${step.note}\n`);
    continue;
  }
  const result = spawnSync(step.cmd, step.args, { stdio: 'inherit', shell });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
