// ci.yml's verify jobs (OD-34, OD-30): each part runs once in its own job and cannot be switched
// off quietly; the required `verify (full)` job reads every part's result (and, on pushes, the
// caches job's) and fails unless all passed; only the `caches` job saves caches, on pushes to
// main, and every job that runs repository code starts only after it succeeded; no job uses a
// Turborepo cache.
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
// Jobs that run only pinned tools (never repository or dependency code) or nothing at all.
const TOOL_JOBS = ['scope', 'caches', 'verify', 'audit', 'secrets', 'workflows'];
const CACHES_OK =
  "(needs.caches.result == 'success' || (github.event_name != 'push' && needs.caches.result == 'skipped'))";
const runs = (job) => (job.steps ?? []).map((s) => (typeof s.run === 'string' ? s.run : ''));
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ');
const stepNamed = (job, name) => ci.jobs[job].steps.find((s) => s.name === name);

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

  it('runs code jobs only after scope and caches succeeded; parts only in full mode', () => {
    for (const id of CODE_JOBS) {
      const cond = oneLine(ci.jobs[id].if);
      assert.ok(cond.includes("!cancelled() && needs.scope.result == 'success'"), id);
      assert.ok(cond.includes(CACHES_OK), id);
      assert.equal(cond.includes("needs.scope.outputs.mode == 'full'"), PART_JOBS.includes(id), id);
    }
    assert.ok(runs(ci.jobs.dart).some((r) => r.includes('git diff --exit-code -- pubspec.lock')));
  });

  it('every job outside the tool-only list waits for caches, unless it runs on pull requests only', () => {
    for (const [id, job] of Object.entries(ci.jobs)) {
      if (TOOL_JOBS.includes(id) || job.if === "github.event_name == 'pull_request'") continue;
      assert.ok([job.needs ?? []].flat().includes('caches'), `${id} does not wait for caches`);
    }
  });

  it('cannot switch a verify step off: no if, shell or continue-on-error on it or its job', () => {
    for (const id of [...CODE_JOBS, 'caches', 'verify']) {
      const job = ci.jobs[id];
      assert.equal(job['continue-on-error'], undefined, id);
      for (const step of job.steps ?? []) {
        assert.equal(step['continue-on-error'], undefined, `${id}: "${step.name}"`);
        const gate =
          (typeof step.run === 'string' && /scripts\/verify\.mjs|pubspec\.lock/.test(step.run)) ||
          id === 'verify';
        if (!gate) continue;
        for (const key of ['if', 'shell']) {
          assert.equal(step[key], undefined, `${id}: ${key} on "${step.name}"`);
        }
      }
    }
  });

  it('keeps the required check name on an aggregator wired to every result', () => {
    const verify = ci.jobs.verify;
    assert.equal(verify.name, 'verify (full)');
    assert.equal(verify.if, 'always()');
    assert.deepEqual([...verify.needs].sort(), [
      'build',
      'caches',
      'checks',
      'dart',
      'node',
      'scope',
    ]);
    assert.deepEqual(verify.permissions, {});
    assert.equal(verify.steps.length, 1);
    assert.deepEqual(verify.steps[0].env, {
      EVENT: '${{ github.event_name }}',
      MODE: '${{ needs.scope.outputs.mode }}',
      SCOPE: '${{ needs.scope.result }}',
      CACHES: '${{ needs.caches.result }}',
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
  // actions/cache (not /restore) saves at the end of the job, after repository code ran.
  const isSave = (s) => /actions\/cache(\/save)?@/.test(s.uses ?? '');

  it('runs on pushes to main only, with exactly these steps in this order', () => {
    const caches = ci.jobs.caches;
    assert.equal(caches.if, "github.event_name == 'push' && needs.scope.outputs.mode == 'full'");
    assert.deepEqual(
      caches.steps.map((s) => s.name ?? s.uses.split('@')[0]),
      [
        'actions/checkout',
        'Restore Flutter SDK',
        'Install Flutter',
        'Save Flutter SDK',
        'Check Flutter SDK was saved',
        'Set up Flutter',
        'Restore pub cache',
        'Fetch pub packages',
        'Save pub cache',
        'Check pub cache was saved',
      ],
    );
    for (const s of caches.steps.filter(isSave)) assert.match(s.if, /github\.event_name == 'push'/);
  });

  it('a save is followed by a lookup that fails on a miss (a failed save only warns)', () => {
    for (const [save, check] of [
      ['Save Flutter SDK', 'Check Flutter SDK was saved'],
      ['Save pub cache', 'Check pub cache was saved'],
    ]) {
      const s = stepNamed('caches', save);
      const c = stepNamed('caches', check);
      assert.match(c.uses, /^actions\/cache\/restore@/);
      assert.equal(c.with['lookup-only'], true);
      assert.equal(c.with['fail-on-cache-miss'], true);
      assert.equal(c.with.key, s.with.key);
      assert.equal(oneLine(c.if), oneLine(s.if));
    }
  });

  it('no other job saves; restores take exact keys only', () => {
    for (const [id, job] of Object.entries(ci.jobs)) {
      for (const step of job.steps ?? []) {
        if (id !== 'caches') assert.ok(!isSave(step), `${id} saves a cache`);
        if (/actions\/cache/.test(step.uses ?? '')) {
          assert.equal(step.with?.['restore-keys'], undefined, `${id}: restore-keys`);
        }
      }
    }
  });

  it('the dart job checks the Flutter tree digest exactly as the caches job does', () => {
    const script = (job) => stepNamed(job, 'Install Flutter').run;
    assert.equal(script('dart'), script('caches'));
    assert.match(
      script('dart'),
      /if \[ -e "\$sdk" \]; then\s+restored="\$\(tree_digest "\$sdk"\)"/,
    );
    assert.match(script('dart'), /\[ "\$restored" = "\$FLUTTER_TREE_SHA256" \]/);
    assert.ok(/^[0-9a-f]{64}$/.test(ci.env.FLUTTER_TREE_SHA256));
  });

  it('the caches job runs no repository code', () => {
    for (const r of runs(ci.jobs.caches)) {
      assert.ok(!/\bpnpm\b|\bnode\b|scripts\/|\bdart run\b/.test(r), r.split('\n')[0]);
    }
  });

  it('no job uses setup-node or pnpm caches', () => {
    for (const [id, job] of Object.entries(ci.jobs)) {
      for (const step of job.steps ?? []) {
        if (/actions\/setup-node@/.test(step.uses ?? '')) {
          assert.equal(step.with?.cache, undefined, `${id}: setup-node cache`);
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
  const pr = { EVENT: 'pull_request', SCOPE: 'success', CACHES: 'skipped', CHECKS: 'success' };
  const push = { ...pr, EVENT: 'push', CACHES: 'success' };

  it('passes when every part passed in full mode, on a pull request and on a push', {
    skip,
  }, () => {
    assert.equal(decide({ MODE: 'full', ...pr, ...all('success') }), 0);
    assert.equal(decide({ MODE: 'full', ...push, ...all('success') }), 0);
  });

  it('passes a docs-only pull request whose parts were skipped', { skip }, () => {
    assert.equal(decide({ MODE: 'docs', ...pr, ...all('skipped') }), 0);
  });

  it('fails on any failed, cancelled or wrongly skipped part', { skip }, () => {
    for (const bad of ['failure', 'cancelled', 'skipped']) {
      for (const job of ['NODE', 'BUILD', 'DART']) {
        assert.equal(decide({ MODE: 'full', ...pr, ...all('success'), [job]: bad }), 1);
      }
    }
    assert.equal(decide({ MODE: 'docs', ...pr, ...all('skipped'), DART: 'success' }), 1);
    assert.equal(decide({ MODE: 'full', ...pr, CHECKS: 'failure', ...all('success') }), 1);
    assert.equal(decide({ MODE: 'full', ...pr, SCOPE: 'failure', ...all('success') }), 1);
    assert.equal(decide({ MODE: '', ...pr, ...all('skipped') }), 1);
  });

  it('fails a push whose caches job did not succeed, and a pull request that ran it', {
    skip,
  }, () => {
    for (const bad of ['failure', 'cancelled', 'skipped']) {
      assert.equal(decide({ MODE: 'full', ...push, CACHES: bad, ...all('success') }), 1, bad);
    }
    assert.equal(decide({ MODE: 'full', ...pr, CACHES: 'success', ...all('success') }), 1);
  });
});
