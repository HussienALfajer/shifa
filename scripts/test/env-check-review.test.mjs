// Cases added after the 0.2-09a review (the original env-check tests are locked).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runEnvChecks } from '../lib/env-check.mjs';

function probes(overrides = {}) {
  return {
    nodeVersion: () => 'v24.11.0',
    pnpmVersion: () => '12.4.1',
    packageManager: () => 'pnpm@12.4.1',
    fvmFlutterVersion: () => '3.47.9',
    pinnedFlutter: () => '3.47.9',
    dockerReachable: () => '29.1.0',
    gitConfig: () => null,
    lsFilesEol: () => '',
    which: () => true,
    ...overrides,
  };
}

const linux = { platform: 'linux', repoRoot: '/home/u/src/shifa' };
const win = { platform: 'win32', repoRoot: 'D:\\shifa' };
const row = (r, item) => r.rows.find((x) => x.item === item);

describe('env-check review cases', () => {
  it('reports files with mixed line endings in the index', () => {
    const eol = 'i/mixed w/mixed attr/                 \tscripts/a.mjs\n';
    const r = runEnvChecks(probes({ lsFilesEol: () => eol }), linux);
    assert.equal(row(r, 'line endings').status, 'fail');
    assert.match(row(r, 'line endings').detail, /scripts\/a\.mjs/);
  });

  it('fails when git ls-files could not run', () => {
    const r = runEnvChecks(probes({ lsFilesEol: () => null }), linux);
    assert.equal(row(r, 'line endings').status, 'fail');
  });

  it('fails when git config could not run', () => {
    const gitConfig = () => {
      throw new Error('git config failed');
    };
    const r = runEnvChecks(probes({ gitConfig }), linux);
    assert.equal(row(r, 'git autocrlf').status, 'fail');
  });

  for (const value of ['yes', 'on', '1', 'TRUE']) {
    it(`treats autocrlf=${value} as true`, () => {
      const r = runEnvChecks(probes({ gitConfig: () => value }), linux);
      assert.equal(row(r, 'git autocrlf').status, 'fail');
    });
  }

  it('autocrlf=true is a warning on the Windows fallback (.gitattributes overrides it)', () => {
    const r = runEnvChecks(probes({ gitConfig: () => 'true' }), win);
    assert.equal(row(r, 'git autocrlf').status, 'warn');
    assert.equal(r.exitCode, 0);
  });

  it('ignores the hash suffix corepack adds to packageManager', () => {
    const r = runEnvChecks(probes({ packageManager: () => 'pnpm@12.4.1+sha512.abc' }), linux);
    assert.equal(row(r, 'pnpm').status, 'ok');
  });
});
