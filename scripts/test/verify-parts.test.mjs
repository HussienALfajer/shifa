// CI's split of `verify full` into parallel jobs (OD-34): `verify docs` plus the parts node,
// dart and build run every full step with the same arguments, and the Turborepo filters split
// the packages without a gap or an overlap. ci.yml itself: ci-verify-jobs.test.mjs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { PARTS, verifySteps } from '../lib/verify-steps.mjs';
import { dartWorkspacePackages } from '../lib/workspace.mjs';

const root = join(import.meta.dirname, '..', '..');
const dart = dartWorkspacePackages(root);
const part = (name) => verifySteps('full', { part: name, dartPackages: dart });
const turboOf = (steps) => steps.find((s) => s.name === 'typecheck+lint+test');
const filters = (step) => step.args.filter((a) => a.startsWith('--filter='));

describe('verify parts', () => {
  it('docs plus the parts run every full step, each exactly where expected', () => {
    const covered = [
      ...verifySteps('docs').map((s) => `docs:${s.name}`),
      ...PARTS.flatMap((p) => part(p).map((s) => `${p}:${s.name}`)),
    ];
    assert.deepEqual(covered.sort(), [
      'build:boot',
      'build:build',
      'dart:drift',
      'dart:pub-get',
      'dart:typecheck+lint+test',
      'docs:file-length',
      'docs:format',
      'docs:instructions',
      'docs:lint-root',
      'docs:scripts-test',
      'e2e:build',
      'e2e:e2e',
      'node:typecheck+lint+test',
      'ui:ui-browser',
      'ui:ui-screenshots',
      'ui:ui-storybook',
      'ui:ui-storybook-build',
    ]);
    const fullNames = new Set(verifySteps('full').map((s) => s.name));
    assert.deepEqual(new Set(covered.map((c) => c.split(':')[1])), fullNames);
  });

  it('a part keeps the full arguments of each step it runs', () => {
    const full = Object.fromEntries(verifySteps('full').map((s) => [s.name, s]));
    for (const p of PARTS) {
      for (const step of part(p)) {
        const base = full[step.name].args;
        assert.deepEqual(step.args.slice(0, base.length), base, `${p}:${step.name}`);
        assert.deepEqual(step.args.slice(base.length), filters(step), `${p}:${step.name}`);
      }
    }
    // CI's `checks` job runs `verify docs` in place of these full steps: same command, same args.
    for (const step of verifySteps('docs')) {
      assert.deepEqual([step.cmd, step.args], [full[step.name].cmd, full[step.name].args]);
    }
    assert.ok(turboOf(part('node')).args.includes('--force'));
    assert.ok(turboOf(part('dart')).args.includes('--force'));
    assert.ok(part('build')[0].args.includes('--force'));
  });

  it('splits Turborepo packages into the pub workspace and everything else', () => {
    assert.deepEqual(dart.sort(), [
      '@shifa/api-client-dart',
      '@shifa/dart-testing',
      '@shifa/dart-ui',
    ]);
    assert.deepEqual(
      filters(turboOf(part('dart'))),
      dart.map((p) => `--filter=${p}`),
    );
    assert.deepEqual(
      filters(turboOf(part('node'))),
      dart.map((p) => `--filter=!${p}`),
    );
  });

  it('dart keeps pub-get before drift and Turborepo; node needs no pub-get', () => {
    const steps = part('dart');
    assert.deepEqual(steps.find((s) => s.name === 'drift')?.after, ['pub-get']);
    assert.equal(turboOf(steps).requires, 'pub-get');
    assert.equal(turboOf(part('node')).requires, undefined);
    assert.equal(part('build').find((s) => s.name === 'boot')?.requires, 'build');
  });

  // Slice 0.4-03: the browser checks of packages/ui (component tests, Storybook test run with axe,
  // Storybook build, screenshots in Docker) are their own part; fast mode stays without a browser.
  it('ui runs the four UI steps, in full mode only, screenshots after the Storybook build', () => {
    const ui = part('ui');
    assert.deepEqual(
      ui.map((s) => [s.name, s.cmd, ...s.args]),
      [
        ['ui-browser', 'pnpm', '--filter', '@shifa/ui', 'test:browser'],
        ['ui-storybook', 'pnpm', '--filter', '@shifa/ui', 'test:storybook'],
        ['ui-storybook-build', 'pnpm', '--filter', '@shifa/ui', 'storybook:build'],
        ['ui-screenshots', 'pnpm', '--filter', '@shifa/ui', 'screenshots'],
      ],
    );
    assert.equal(ui.find((s) => s.name === 'ui-screenshots')?.requires, 'ui-storybook-build');
    const fullNames = verifySteps('full').map((s) => s.name);
    for (const s of ui) assert.ok(fullNames.includes(s.name), `full without a part runs ${s.name}`);
    const fastNames = verifySteps('fast').map((s) => s.name);
    assert.deepEqual(
      fastNames.filter((n) => n.startsWith('ui-')),
      [],
    );
    assert.deepEqual(
      verifySteps('docs').filter((s) => s.name.startsWith('ui-')),
      [],
    );
  });

  it('refuses a part outside full mode, an unknown part or no Dart packages', () => {
    assert.throws(() => verifySteps('fast', { part: 'node', dartPackages: dart }), /full mode/);
    assert.throws(() => verifySteps('full', { part: 'docs', dartPackages: dart }), /unknown part/);
    assert.throws(() => verifySteps('full', { part: 'node', dartPackages: [] }), /no pub/);
  });

  it('the CLI refuses a malformed part before running anything', () => {
    const cli = join(root, 'scripts', 'verify.mjs');
    for (const args of [
      ['full', '--part'],
      ['fast', '--part', 'node'],
      ['full', '--part', 'x'],
    ]) {
      const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
      assert.equal(r.status, 2, args.join(' '));
      assert.match(r.stderr, /expected "full --part/);
    }
  });
});
