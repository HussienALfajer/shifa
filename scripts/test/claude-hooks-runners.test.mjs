// Slice 0.4-10 review (B1): the runner unwrap of the shell guard fails closed. Runner options the
// guard does not know, `--`, options after `exec`, a `@version` on the program corepack starts and
// pnpm's fallback to exec (`pnpm npx …`) must not let a fetch-and-run through (ADR-0041).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkBash } from '../../.claude/hooks/lib/policy.mjs';

describe('checkBash: runners fail closed (0.4-10 review B1)', () => {
  const blocked = [
    'pnpm --workspace-root exec npx -y skills',
    'pnpm -w exec npx -y skills',
    'pnpm --reporter silent exec npx -y skills',
    'pnpm --loglevel error exec npx -y skills',
    'pnpm --filter=ui exec npx -y skills',
    'pnpm --store-dir s exec npx -y skills',
    'yarn --cwd apps/x exec npx -y skills',
    'yarn workspace ui exec npx -y skills',
    'pnpm exec -- npx -y skills',
    'yarn exec -- npx -y skills',
    'pnpm exec --parallel npx -y skills',
    'pnpm exec -C packages/ui npx -y skills',
    'pnpm -r exec --resume-from a npx -y skills',
    'corepack pnpm@9.0.0 dlx skills',
    'corepack npm@10.0.0 install x',
    'corepack yarn@1.22.0 add react',
    'pnpm npx -y skills',
    'pnpm pnpx skills',
    'pnpm exec env npx -y skills',
    'pnpm exec sudo npm install x',
    'pnpm.cmd exec npx.cmd -y skills',
    // older routes of the same kind (review N1)
    'npx pnpm dlx skills',
    'npx corepack npm install x',
    'timeout 60 npx -y skills',
    'nohup npx -y skills',
    'echo x | xargs npx -y skills',
    // wrappers with options (security review N3)
    'sudo -u root npx -y skills',
    'env -i npx -y skills',
    'cross-env A=1 npx -y skills',
    'pnpm --filter-prod ui exec npx -y skills',
    'pnpm --workspace-concurrency 1 exec npx -y skills',
    'corepack pnpm@latest exec npx -y skills',
    'pnpm exec -r npx -y skills',
  ];
  for (const cmd of blocked) {
    it(`blocks: ${cmd}`, () => assert.notEqual(checkBash(cmd), null));
  }

  const allowed = [
    'pnpm exec tsc -p tsconfig.json',
    'pnpm -r exec rm -rf dist',
    'pnpm --filter @shifa/ui exec playwright install chromium',
    'pnpm --reporter silent exec vitest run',
    'pnpm exec -- tsc --noEmit',
    'pnpm exec npm --version',
    'pnpm why yarn',
    'pnpm add -D npm-run-all2',
    'corepack prepare pnpm@12.4.1 --activate',
    'corepack pnpm --version',
    'npx tsc -p tsconfig.json',
    'timeout 60 pnpm verify',
    'git ls-files | xargs grep -n npm',
    // odd program names are handled, not thrown on (security review N6)
    'constructor x',
    '__proto__ x',
    'sudo -u root ls',
    'git commit -m "pnpm exec npx -y x is refused"',
  ];
  for (const cmd of allowed) {
    it(`allows: ${cmd}`, () => assert.equal(checkBash(cmd), null));
  }
});
