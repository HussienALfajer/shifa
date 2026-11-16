// Spike suites stay out of `verify` but not out of CI (OD-31). Turborepo runs a package's `test`
// script, so a spike package must not have one; its Vitest suite is a `test:spike` script
// instead, and the spike's manual workflow (.github/workflows/<spike>.yml) must run every such
// script. Typecheck and lint of spike packages stay in `verify`.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

const root = join(import.meta.dirname, '..', '..');
const spikesDir = join(root, 'spikes');

// Every workspace package spikes/<spike>/<package> (the pattern in pnpm-workspace.yaml).
function spikePackages() {
  const found = [];
  for (const spike of readdirSync(spikesDir, { withFileTypes: true })) {
    if (!spike.isDirectory()) continue;
    for (const pkg of readdirSync(join(spikesDir, spike.name), { withFileTypes: true })) {
      const manifest = join(spikesDir, spike.name, pkg.name, 'package.json');
      if (!pkg.isDirectory() || !existsSync(manifest)) continue;
      found.push({
        spike: spike.name,
        dir: `spikes/${spike.name}/${pkg.name}`,
        scripts: JSON.parse(readFileSync(manifest, 'utf8')).scripts ?? {},
      });
    }
  }
  return found;
}

// `working-directory` of every workflow step that runs `pnpm run test:spike`.
function workflowSpikeTestDirs(file) {
  const path = join(root, '.github', 'workflows', file);
  if (!existsSync(path)) return [];
  const workflow = parse(readFileSync(path, 'utf8'));
  const dirs = [];
  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps ?? []) {
      if (typeof step.run === 'string' && /^pnpm run test:spike$/.test(step.run.trim())) {
        dirs.push(step['working-directory']);
      }
    }
  }
  return dirs;
}

describe('spike test suites', () => {
  const packages = spikePackages();

  it('finds the spike packages', () => {
    assert.ok(packages.length > 0, 'no package under spikes/<spike>/<package>');
  });

  it('no spike package has a `test` script (Turborepo would run it in verify)', () => {
    const withTest = packages.filter((p) => 'test' in p.scripts).map((p) => p.dir);
    assert.deepEqual(withTest, []);
  });

  it('spike packages keep typecheck and lint in verify', () => {
    for (const p of packages) {
      assert.ok('typecheck' in p.scripts, `${p.dir} has no typecheck script`);
      assert.ok('lint' in p.scripts, `${p.dir} has no lint script`);
    }
  });

  it("the spike's manual workflow runs every `test:spike` suite", () => {
    const suites = packages.filter((p) => 'test:spike' in p.scripts);
    assert.ok(suites.length > 0, 'no spike package has a test:spike script');
    for (const p of suites) {
      const dirs = workflowSpikeTestDirs(`${p.spike}.yml`);
      assert.ok(dirs.includes(p.dir), `.github/workflows/${p.spike}.yml does not run ${p.dir}`);
    }
  });
});
