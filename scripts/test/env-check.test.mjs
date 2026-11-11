import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatRows, runEnvChecks } from '../lib/env-check.mjs';

/** Probes for a machine where everything is ready; override one item per case. */
function probes(overrides = {}) {
  return {
    nodeVersion: () => 'v24.11.0',
    pnpmVersion: () => '12.4.1',
    packageManager: () => 'pnpm@12.4.1',
    fvmFlutterVersion: () => '3.47.9',
    pinnedFlutter: () => '3.47.9',
    dockerReachable: () => '29.1.0',
    gitConfig: () => null,
    lsFilesEol: () => 'i/lf    w/lf    attr/text=auto eol=lf \tpackage.json\n',
    which: () => true,
    ...overrides,
  };
}

const linux = { platform: 'linux', repoRoot: '/home/u/src/shifa' };
const win = { platform: 'win32', repoRoot: 'D:\\shifa' };

function row(result, item) {
  const found = result.rows.find((r) => r.item === item);
  assert.ok(found, `no row for ${item}; rows: ${result.rows.map((r) => r.item).join(', ')}`);
  return found;
}

describe('runEnvChecks: Node', () => {
  for (const [version, status] of [
    ['v22.12.0', 'fail'],
    ['v24.11.0', 'ok'],
    ['v25.0.0', 'fail'],
  ]) {
    it(`Node ${version} → ${status}`, () => {
      const r = runEnvChecks(probes({ nodeVersion: () => version }), linux);
      assert.equal(row(r, 'node').status, status);
      if (status === 'fail') assert.match(row(r, 'node').detail, /24/);
    });
  }
});

describe('runEnvChecks: pnpm', () => {
  it('matching packageManager → ok', () => {
    assert.equal(row(runEnvChecks(probes(), linux), 'pnpm').status, 'ok');
  });

  it('mismatch → fail naming both versions', () => {
    const r = runEnvChecks(probes({ pnpmVersion: () => '11.0.0' }), linux);
    assert.equal(row(r, 'pnpm').status, 'fail');
    assert.match(row(r, 'pnpm').detail, /11\.0\.0/);
    assert.match(row(r, 'pnpm').detail, /12\.4\.1/);
  });

  it('pnpm missing → fail', () => {
    const r = runEnvChecks(probes({ pnpmVersion: () => null }), linux);
    assert.equal(row(r, 'pnpm').status, 'fail');
  });
});

describe('runEnvChecks: Flutter', () => {
  it('FVM SDK equal to .fvmrc → ok', () => {
    assert.equal(row(runEnvChecks(probes(), linux), 'flutter').status, 'ok');
  });

  it('SDK missing → fail with fvm install', () => {
    const r = runEnvChecks(probes({ fvmFlutterVersion: () => null }), linux);
    assert.equal(row(r, 'flutter').status, 'fail');
    assert.match(row(r, 'flutter').detail, /fvm install/);
  });

  it('SDK of another version → fail naming both', () => {
    const r = runEnvChecks(probes({ fvmFlutterVersion: () => '3.40.0' }), linux);
    assert.equal(row(r, 'flutter').status, 'fail');
    assert.match(row(r, 'flutter').detail, /3\.40\.0/);
    assert.match(row(r, 'flutter').detail, /3\.47\.9/);
  });
});

describe('runEnvChecks: Docker', () => {
  it('daemon reachable → ok with its version', () => {
    const r = runEnvChecks(probes(), linux);
    assert.equal(row(r, 'docker').status, 'ok');
    assert.match(row(r, 'docker').detail, /29\.1\.0/);
  });

  it('daemon unreachable → fail naming the WSL integration setting', () => {
    const r = runEnvChecks(probes({ dockerReachable: () => null }), linux);
    assert.equal(row(r, 'docker').status, 'fail');
    assert.match(row(r, 'docker').detail, /WSL integration/);
  });
});

describe('runEnvChecks: git core.autocrlf', () => {
  for (const [value, status] of [
    ['true', 'fail'],
    ['input', 'ok'],
    ['false', 'ok'],
    [null, 'ok'],
  ]) {
    it(`autocrlf=${value} → ${status}`, () => {
      const r = runEnvChecks(
        probes({ gitConfig: (k) => (k === 'core.autocrlf' ? value : null) }),
        linux,
      );
      assert.equal(row(r, 'git autocrlf').status, status);
    });
  }
});

describe('runEnvChecks: line endings', () => {
  it('no i/crlf entry → ok', () => {
    assert.equal(row(runEnvChecks(probes(), linux), 'line endings').status, 'ok');
  });

  it('w/crlf only (Windows checkout) is not a failure', () => {
    const eol = 'i/lf    w/crlf  attr/text=auto eol=lf \tREADME.md\n';
    const r = runEnvChecks(probes({ lsFilesEol: () => eol }), win);
    assert.equal(row(r, 'line endings').status, 'ok');
  });

  it('lists i/crlf paths, capped at 10', () => {
    const lines = Array.from(
      { length: 12 },
      (_, i) => `i/crlf  w/crlf  attr/                 \tdocs/file-${i}.md`,
    );
    const r = runEnvChecks(probes({ lsFilesEol: () => `${lines.join('\n')}\n` }), linux);
    const { status, detail } = row(r, 'line endings');
    assert.equal(status, 'fail');
    assert.match(detail, /12/);
    assert.match(detail, /docs\/file-0\.md/);
    assert.match(detail, /docs\/file-9\.md/);
    assert.doesNotMatch(detail, /docs\/file-10\.md/);
  });
});

describe('runEnvChecks: Linux (WSL2)', () => {
  it('repository under /mnt/ → fail with the ~/src/shifa fix', () => {
    const r = runEnvChecks(probes(), { platform: 'linux', repoRoot: '/mnt/d/shifa' });
    const { status, detail } = row(r, 'repo location');
    assert.equal(status, 'fail');
    assert.match(detail, /~\/src\/shifa/);
    assert.match(detail, /slow/i);
  });

  it('repository on the Linux filesystem → ok', () => {
    assert.equal(row(runEnvChecks(probes(), linux), 'repo location').status, 'ok');
  });

  for (const tool of ['bwrap', 'socat']) {
    it(`missing ${tool} → fail with the apt command`, () => {
      const r = runEnvChecks(probes({ which: (cmd) => cmd !== tool }), linux);
      assert.equal(row(r, tool).status, 'fail');
      assert.match(row(r, tool).detail, /sudo apt install bubblewrap socat/);
    });
  }

  it('has no Windows sandbox warning', () => {
    const r = runEnvChecks(probes(), linux);
    assert.equal(
      r.rows.find((x) => x.item === 'sandbox'),
      undefined,
    );
  });
});

describe('runEnvChecks: Windows fallback', () => {
  it('warns that the sandbox is unavailable and skips Linux-only rows', () => {
    const r = runEnvChecks(probes(), win);
    const { status, detail } = row(r, 'sandbox');
    assert.equal(status, 'warn');
    assert.match(detail, /sandbox unavailable on Windows/);
    assert.match(detail, /docs\/process\/wsl2-setup\.md/);
    for (const item of ['repo location', 'bwrap', 'socat']) {
      assert.equal(
        r.rows.find((x) => x.item === item),
        undefined,
        item,
      );
    }
    assert.equal(r.exitCode, 0);
  });
});

describe('runEnvChecks: exit code', () => {
  it('all ok → 0', () => {
    const r = runEnvChecks(probes(), linux);
    assert.ok(r.rows.every((x) => x.status === 'ok'));
    assert.equal(r.exitCode, 0);
  });

  it('any fail → 1', () => {
    assert.equal(runEnvChecks(probes({ dockerReachable: () => null }), linux).exitCode, 1);
  });

  it('a probe that throws is a fail, not a crash', () => {
    const r = runEnvChecks(
      probes({
        dockerReachable: () => {
          throw new Error('boom at /home/secret-user/.docker');
        },
      }),
      linux,
    );
    assert.equal(row(r, 'docker').status, 'fail');
    assert.doesNotMatch(row(r, 'docker').detail, /secret-user/);
    assert.equal(r.exitCode, 1);
  });
});

describe('formatRows', () => {
  it('prints one aligned line per row', () => {
    const out = formatRows([
      { item: 'node', status: 'ok', detail: 'v24' },
      { item: 'line endings', status: 'fail', detail: 'x' },
    ]);
    const lines = out.trimEnd().split('\n');
    assert.equal(lines.length, 2);
    assert.equal(lines[0].indexOf('ok'), lines[1].indexOf('fail'));
  });
});

describe('privacy', () => {
  it('prints no environment value and no home path', () => {
    const sentinel = 'sk-sentinel-0123456789abcdef';
    const home = '/home/sentinel-user';
    const saved = { token: process.env.SHIFA_TEST_TOKEN, home: process.env.HOME };
    process.env.SHIFA_TEST_TOKEN = sentinel;
    process.env.HOME = home;
    try {
      const failing = probes({
        nodeVersion: () => 'v22.0.0',
        pnpmVersion: () => null,
        fvmFlutterVersion: () => null,
        dockerReachable: () => null,
        which: () => false,
        gitConfig: () => 'true',
      });
      for (const ctx of [
        { platform: 'linux', repoRoot: `${home}/src/shifa` },
        { platform: 'linux', repoRoot: '/mnt/c/Users/sentinel-user/shifa' },
      ]) {
        const out = formatRows(runEnvChecks(failing, ctx).rows);
        assert.doesNotMatch(out, /sk-sentinel/);
        assert.doesNotMatch(out, /sentinel-user/);
      }
    } finally {
      if (saved.token === undefined) delete process.env.SHIFA_TEST_TOKEN;
      else process.env.SHIFA_TEST_TOKEN = saved.token;
      if (saved.home === undefined) delete process.env.HOME;
      else process.env.HOME = saved.home;
    }
  });
});
