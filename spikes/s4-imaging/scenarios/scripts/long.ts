// The long P1 runs (criteria 8–10 evidence): the 300 MB studies with the spec's cuts. Sets
// S4_LONG and runs the scenario files that read it.
import { spawnSync } from 'node:child_process';

const files = ['upload-chunked', 'upload-stow', 'edge', 'viewer'].map((f) => `test/${f}.spec.ts`);
const result = spawnSync('pnpm', ['exec', 'vitest', 'run', ...files, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, S4_LONG: '1' },
});
process.exit(result.status ?? 1);
