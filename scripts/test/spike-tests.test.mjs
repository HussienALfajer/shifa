// Test suites leave `verify` only where OD-31 allows it. Turborepo runs a package's `test`
// script, so a spike package must not have one: its Vitest suite is a `test:spike` script, and
// the spike's manual workflow (.github/workflows/<spike>.yml) must run every such suite, able to
// fail. Typecheck and lint of spike packages stay in `verify`. Every other package with a test/
// folder keeps its `test` script, so the same rename cannot take a product suite out of CI.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

const root = join(import.meta.dirname, '..', '..');

// Workspace packages two levels down (apps/*, packages/*, tooling/*) or three (spikes/*/*), the
// patterns in pnpm-workspace.yaml.
function workspacePackages() {
  const found = [];
  const add = (dir) => {
    const manifest = join(root, dir, 'package.json');
    if (!existsSync(manifest)) return;
    found.push({
      dir,
      spike: dir.startsWith('spikes/') ? dir.split('/')[1] : null,
      scripts: JSON.parse(readFileSync(manifest, 'utf8')).scripts ?? {},
      hasTests: existsSync(join(root, dir, 'test')),
      hasVitest: readdirSync(join(root, dir)).some((f) => /^vitest\.config\./.test(f)),
    });
  };
  const subdirs = (dir) =>
    readdirSync(join(root, dir), { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== 'node_modules')
      .map((e) => `${dir}/${e.name}`);
  for (const group of ['apps', 'packages', 'tooling']) subdirs(group).forEach(add);
  for (const spike of subdirs('spikes')) subdirs(spike).forEach(add);
  return found;
}

// Steps that run `pnpm run test:spike` in a workflow that can be dispatched by hand, and that
// can fail: no `if` and no `continue-on-error` on the step or its job.
function workflowSpikeTestDirs(file) {
  const path = join(root, '.github', 'workflows', file);
  if (!existsSync(path)) return [];
  const workflow = parse(readFileSync(path, 'utf8'));
  assert.ok(workflow.on?.workflow_dispatch !== undefined, `${file} has no workflow_dispatch`);
  const dirs = [];
  for (const job of Object.values(workflow.jobs)) {
    for (const step of job.steps ?? []) {
      if (typeof step.run !== 'string' || step.run.trim() !== 'pnpm run test:spike') continue;
      for (const unit of [job, step]) {
        assert.equal(unit.if, undefined, `${file}: a test:spike step or its job has an if`);
        assert.equal(unit['continue-on-error'], undefined, `${file}: continue-on-error`);
      }
      dirs.push(step['working-directory']);
    }
  }
  return dirs;
}

describe('test suites outside verify (OD-31)', () => {
  const packages = workspacePackages();
  const spikes = packages.filter((p) => p.spike);
  const product = packages.filter((p) => !p.spike);

  it('finds the workspace and spike packages', () => {
    assert.ok(product.some((p) => p.dir === 'packages/db'));
    assert.ok(spikes.length > 0, 'no package under spikes/<spike>/<package>');
  });

  it('every non-spike package with a test/ folder keeps its `test` script', () => {
    for (const p of product.filter((x) => x.hasTests)) {
      assert.ok(p.scripts.test, `${p.dir} has a test/ folder but no test script`);
    }
    for (const dir of ['packages/db', 'apps/api']) {
      const pkg = product.find((p) => p.dir === dir);
      assert.equal(pkg?.scripts.test, 'vitest run', `${dir} test script`);
    }
  });

  it('only spike packages have `test:spike` scripts', () => {
    const outside = product.filter((p) => 'test:spike' in p.scripts).map((p) => p.dir);
    assert.deepEqual(outside, []);
  });

  it('no spike package has a `test` script (Turborepo would run it in verify)', () => {
    assert.deepEqual(
      spikes.filter((p) => 'test' in p.scripts).map((p) => p.dir),
      [],
    );
  });

  it('every spike package with a Vitest config has a plain `test:spike` script', () => {
    const vitest = spikes.filter((p) => p.hasVitest);
    assert.ok(vitest.length > 0, 'no spike package has a Vitest config');
    for (const p of vitest) assert.equal(p.scripts['test:spike'], 'vitest run', p.dir);
  });

  it('spike packages keep typecheck and lint in verify', () => {
    for (const p of spikes) {
      assert.ok('typecheck' in p.scripts, `${p.dir} has no typecheck script`);
      assert.ok('lint' in p.scripts, `${p.dir} has no lint script`);
    }
  });

  it("the spike's manual workflow runs every `test:spike` suite", () => {
    for (const p of spikes.filter((x) => 'test:spike' in x.scripts)) {
      const dirs = workflowSpikeTestDirs(`${p.spike}.yml`);
      assert.ok(dirs.includes(p.dir), `.github/workflows/${p.spike}.yml does not run ${p.dir}`);
    }
  });
});
