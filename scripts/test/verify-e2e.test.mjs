// Slice A-01-06: the end-to-end journeys run in verify. Full mode always runs them after the
// build; fast mode only when Turborepo's --affected reaches @shifa/e2e (an app, the web shell, the
// API or e2e/ changed), and says so when it skips; CI runs them as the part `e2e`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { e2eAffected, e2ePlan } from '../lib/e2e.mjs';
import { PARTS, verifySteps } from '../lib/verify-steps.mjs';

const byName = (steps) => Object.fromEntries(steps.map((s) => [s.name, s]));
const DART = ['shifa_ui'];

describe('verify step e2e', () => {
  it('runs in full mode after the build it requires', () => {
    const steps = verifySteps('full');
    const e2e = byName(steps).e2e;
    assert.ok(e2e, 'full mode has an e2e step');
    assert.equal(e2e.requires, 'build');
    assert.ok(steps.indexOf(e2e) > steps.findIndex((s) => s.name === 'build'));
    assert.deepEqual([e2e.cmd, ...e2e.args], ['node', 'scripts/run-e2e.mjs']);
  });

  it('runs in fast mode through the affected check', () => {
    const e2e = byName(verifySteps('fast')).e2e;
    assert.ok(e2e, 'fast mode has an e2e step');
    assert.deepEqual([e2e.cmd, ...e2e.args], ['node', 'scripts/run-e2e.mjs', '--fast']);
  });

  it('is not a docs step', () => {
    assert.equal(byName(verifySteps('docs')).e2e, undefined);
  });

  it('is the part e2e: the build, then the journeys', () => {
    assert.ok(PARTS.includes('e2e'));
    const steps = verifySteps('full', { part: 'e2e', dartPackages: DART });
    assert.deepEqual(
      steps.map((s) => s.name),
      ['build', 'e2e'],
    );
  });
});

describe('the e2e runner', () => {
  const ls = (...names) =>
    JSON.stringify({ packages: { count: names.length, items: names.map((name) => ({ name })) } });

  it('reads Turborepo’s affected list', () => {
    assert.equal(e2eAffected(ls('@shifa/e2e', '@shifa/api')), true);
    assert.equal(e2eAffected(ls('@shifa/i18n')), false);
    assert.equal(e2eAffected(ls()), false);
    assert.throws(() => e2eAffected('not json'));
  });

  it('full mode runs the journeys on the build verify made', () => {
    assert.deepEqual(e2ePlan({ fast: false }), [
      { cmd: 'pnpm', args: ['--filter', '@shifa/e2e', 'run', 'e2e'] },
    ]);
  });

  it('fast mode asks Turborepo, then builds what e2e needs and runs it', () => {
    const plan = e2ePlan({ fast: true, affected: true });
    assert.deepEqual(plan, [
      {
        cmd: 'pnpm',
        args: [
          'exec',
          'turbo',
          'run',
          'build',
          '--filter=@shifa/e2e...',
          '--output-logs=errors-only',
        ],
      },
      { cmd: 'pnpm', args: ['--filter', '@shifa/e2e', 'run', 'e2e'] },
    ]);
  });

  it('fast mode skips with a verify-note when nothing e2e covers changed', () => {
    assert.deepEqual(e2ePlan({ fast: true, affected: false }), [
      { note: 'e2e skipped: nothing it covers changed since main' },
    ]);
  });
});
