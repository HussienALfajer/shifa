// CI's split of `verify full` into parallel jobs (OD-34): `verify docs` plus the parts node,
// dart and build run every full step; the Turborepo filters split the packages without a gap or
// an overlap; ci.yml runs each part once and its `verify (full)` job fails unless all passed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';
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
      'node:typecheck+lint+test',
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
    assert.ok(turboOf(part('node')).args.includes('--force'));
    assert.ok(turboOf(part('dart')).args.includes('--force'));
  });

  it('splits Turborepo packages into the pub workspace and everything else', () => {
    assert.deepEqual(dart.sort(), ['@shifa/api-client-dart', '@shifa/dart-testing']);
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

describe('ci.yml verify jobs', () => {
  const ci = parse(readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8'));
  const runsOf = (job) => (ci.jobs[job].steps ?? []).map((s) => s.run).filter(Boolean);

  it('runs verify docs once and each part once, in its own job', () => {
    const verifyRuns = Object.entries(ci.jobs).flatMap(([id, job]) =>
      (job.steps ?? [])
        .filter((s) => typeof s.run === 'string' && s.run.includes('scripts/verify.mjs'))
        .map((s) => `${id}: ${s.run.trim()}`),
    );
    assert.deepEqual(verifyRuns.sort(), [
      'build: node scripts/verify.mjs full --part build',
      'checks: node scripts/verify.mjs docs',
      'dart: node scripts/verify.mjs full --part dart',
      'node: node scripts/verify.mjs full --part node',
    ]);
  });

  it('runs the parts only in full mode, and checks in every mode', () => {
    for (const job of ['node', 'build', 'dart']) {
      assert.equal(ci.jobs[job].if, "needs.scope.outputs.mode == 'full'", job);
      assert.equal(ci.jobs[job].needs, 'scope', job);
      assert.equal(
        ci.jobs[job].steps.some((s) => s['continue-on-error']),
        false,
        job,
      );
    }
    assert.equal(ci.jobs.checks.if, undefined);
    assert.ok(runsOf('dart').some((r) => r.includes('git diff --exit-code -- pubspec.lock')));
  });

  it('keeps the required check name on an aggregator that needs every part', () => {
    const verify = ci.jobs.verify;
    assert.equal(verify.name, 'verify (full)');
    assert.equal(verify.if, 'always()');
    assert.deepEqual([...verify.needs].sort(), ['build', 'checks', 'dart', 'node', 'scope']);
    assert.deepEqual(verify.permissions, {});
    const names = Object.values(ci.jobs).map((j) => j.name);
    assert.equal(names.filter((n) => n === 'verify (full)').length, 1);
  });

  it('restores no Turborepo cache in any job', () => {
    for (const [id, job] of Object.entries(ci.jobs)) {
      for (const step of job.steps ?? []) {
        const path = String(step.with?.path ?? '');
        assert.ok(!/turbo/i.test(path), `${id}: caches ${path}`);
        assert.ok(
          !/TURBO_(TOKEN|TEAM|API|REMOTE)/.test(JSON.stringify(step)),
          `${id}: remote cache`,
        );
      }
    }
  });
});

describe('verify (full) aggregator', () => {
  const ci = parse(readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8'));
  const script = ci.jobs.verify.steps[0].run;
  const bash = spawnSync('bash', ['-c', 'exit 0']);
  const skip = bash.status === 0 ? false : 'bash is not available';

  const decide = (env) =>
    spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, ...env },
    }).status;
  const all = (result) => ({ NODE: result, BUILD: result, DART: result });
  const ok = { SCOPE: 'success', CHECKS: 'success' };

  it('passes when every part passed in full mode', { skip }, () => {
    assert.equal(decide({ MODE: 'full', ...ok, ...all('success') }), 0);
  });

  it('passes a docs-only pull request whose parts were skipped', { skip }, () => {
    assert.equal(decide({ MODE: 'docs', ...ok, ...all('skipped') }), 0);
  });

  it('fails on any failed, cancelled or wrongly skipped part', { skip }, () => {
    for (const bad of ['failure', 'cancelled', 'skipped']) {
      for (const job of ['NODE', 'BUILD', 'DART']) {
        assert.equal(decide({ MODE: 'full', ...ok, ...all('success'), [job]: bad }), 1);
      }
    }
    assert.equal(decide({ MODE: 'docs', ...ok, ...all('skipped'), DART: 'success' }), 1);
    assert.equal(decide({ MODE: 'full', ...ok, CHECKS: 'failure', ...all('success') }), 1);
    assert.equal(decide({ MODE: 'full', ...ok, SCOPE: 'failure', ...all('success') }), 1);
    assert.equal(decide({ MODE: '', ...ok, ...all('skipped') }), 1);
  });
});
