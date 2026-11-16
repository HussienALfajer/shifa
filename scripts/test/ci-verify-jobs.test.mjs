// ci.yml's verify jobs (OD-34, OD-30): each part runs once in its own job and cannot be switched
// off quietly; the required `verify (full)` job reads every part's result and fails unless all
// passed; only the `caches` job saves caches, on pushes to main, and every job that runs
// repository code waits for it; no job uses a Turborepo cache.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

const root = join(import.meta.dirname, '..', '..');
const ci = parse(readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8'));
const PART_JOBS = ['node', 'build', 'dart'];
const CODE_JOBS = ['checks', ...PART_JOBS];
const runs = (job) => (job.steps ?? []).map((s) => (typeof s.run === 'string' ? s.run : ''));

describe('ci.yml verify jobs', () => {
  it('runs verify docs once and each part once, in its own job', () => {
    const verifyRuns = Object.entries(ci.jobs).flatMap(([id, job]) =>
      runs(job)
        .filter((r) => r.includes('scripts/verify.mjs'))
        .map((r) => `${id}: ${r.trim()}`),
    );
    assert.deepEqual(verifyRuns.sort(), [
      'build: node scripts/verify.mjs full --part build',
      'checks: node scripts/verify.mjs docs',
      'dart: node scripts/verify.mjs full --part dart',
      'node: node scripts/verify.mjs full --part node',
    ]);
  });

  it('runs the parts only in full mode, checks in every mode, never after a failed scope', () => {
    for (const id of CODE_JOBS) {
      const cond = ci.jobs[id].if;
      assert.match(cond, /!cancelled\(\)/, id);
      assert.match(cond, /needs\.scope\.result == 'success'/, id);
      const full = /needs\.scope\.outputs\.mode == 'full'/.test(cond);
      assert.equal(full, PART_JOBS.includes(id), id);
    }
    assert.ok(runs(ci.jobs.dart).some((r) => r.includes('git diff --exit-code -- pubspec.lock')));
  });

  it('cannot switch a verify step off: no if, shell or continue-on-error on it or its job', () => {
    for (const id of [...CODE_JOBS, 'verify']) {
      const job = ci.jobs[id];
      assert.equal(job['continue-on-error'], undefined, id);
      for (const step of job.steps ?? []) {
        const gate =
          (typeof step.run === 'string' &&
            /scripts\/verify\.mjs|pubspec\.lock|^if \[ "\$SCOPE"/m.test(step.run)) ||
          id === 'verify';
        if (!gate) continue;
        for (const key of ['if', 'shell', 'continue-on-error']) {
          assert.equal(step[key], undefined, `${id}: ${key} on "${step.name}"`);
        }
      }
    }
  });

  it('keeps the required check name on an aggregator wired to every part', () => {
    const verify = ci.jobs.verify;
    assert.equal(verify.name, 'verify (full)');
    assert.equal(verify.if, 'always()');
    assert.deepEqual([...verify.needs].sort(), ['build', 'checks', 'dart', 'node', 'scope']);
    assert.deepEqual(verify.permissions, {});
    assert.equal(verify.steps.length, 1);
    assert.deepEqual(verify.steps[0].env, {
      MODE: '${{ needs.scope.outputs.mode }}',
      SCOPE: '${{ needs.scope.result }}',
      CHECKS: '${{ needs.checks.result }}',
      NODE: '${{ needs.node.result }}',
      BUILD: '${{ needs.build.result }}',
      DART: '${{ needs.dart.result }}',
    });
    const names = Object.values(ci.jobs).map((j) => j.name);
    assert.equal(names.filter((n) => n === 'verify (full)').length, 1);
  });

  it('uses no Turborepo cache, local or remote, in any job or the workflow env', () => {
    assert.ok(!/TURBO_(TOKEN|TEAM|API|REMOTE)/.test(JSON.stringify(ci.env ?? {})));
    for (const [id, job] of Object.entries(ci.jobs)) {
      assert.ok(!/TURBO_(TOKEN|TEAM|API|REMOTE)/.test(JSON.stringify(job)), `${id}: remote cache`);
      for (const step of job.steps ?? []) {
        assert.ok(!/turbo/i.test(String(step.with?.path ?? '')), `${id}: caches a turbo path`);
      }
    }
  });
});

describe('ci.yml caches (OD-30)', () => {
  const saves = (job) =>
    (job.steps ?? []).filter((s) => /actions\/cache\/save@/.test(s.uses ?? ''));

  it('only the caches job saves, only on pushes to main', () => {
    for (const [id, job] of Object.entries(ci.jobs)) {
      if (id !== 'caches') assert.deepEqual(saves(job), [], `${id} saves a cache`);
    }
    const caches = ci.jobs.caches;
    assert.match(caches.if, /github\.event_name == 'push'/);
    assert.equal(saves(caches).length, 2);
    for (const step of saves(caches)) assert.match(step.if, /github\.event_name == 'push'/);
  });

  it('the caches job runs no repository code, and every job that does waits for it', () => {
    for (const r of runs(ci.jobs.caches)) {
      assert.ok(!/\bpnpm\b|\bnode\b|scripts\//.test(r), `caches runs: ${r.split('\n')[0]}`);
    }
    for (const [id, job] of Object.entries(ci.jobs)) {
      const code = runs(job).some((r) => /pnpm install|node scripts\//.test(r));
      // Pull-request-only jobs never share a run with a save.
      if (!code || job.if === "github.event_name == 'pull_request'") continue;
      const needs = [job.needs ?? []].flat();
      assert.ok(needs.includes('caches'), `${id} runs repository code without waiting for caches`);
    }
  });

  it('no job uses setup-node or pnpm caches', () => {
    for (const [id, job] of Object.entries(ci.jobs)) {
      for (const step of job.steps ?? []) {
        if (/actions\/setup-node@/.test(step.uses ?? '')) {
          if (step.with?.cache !== undefined) assert.fail(`${id}: setup-node cache`);
        }
        if (/pnpm\/action-setup@/.test(step.uses ?? '')) {
          assert.ok([undefined, false, 'false'].includes(step.with?.cache), `${id}: pnpm cache`);
        }
      }
    }
  });
});

describe('verify (full) aggregator script', () => {
  const script = ci.jobs.verify.steps[0].run;
  const bash = spawnSync('bash', ['-c', 'exit 0']);
  const skip = bash.status === 0 || process.env.CI ? false : 'bash is not available';
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
