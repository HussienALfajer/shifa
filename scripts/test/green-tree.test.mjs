import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { isGreen, recordGreen, treeState } from '../lib/green-tree.mjs';

const hook = join(import.meta.dirname, '..', '..', '.claude', 'hooks', 'stop-verify.mjs');
const verify = join(import.meta.dirname, '..', 'verify.mjs');

/** A repository with one commit and an uncommitted code change (apps/a.ts). */
function repoWithCodeChange() {
  const dir = mkdtempSync(join(tmpdir(), 'shifa-green-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '--quiet');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('config', 'core.autocrlf', 'false');
  // Hermetic: a machine-wide commit.gpgsign (cloud sessions sign commits) must not apply here.
  git('config', 'commit.gpgsign', 'false');
  mkdirSync(join(dir, 'apps'));
  // As in the real repository: the record itself must not change the tree it describes.
  writeFileSync(join(dir, '.gitignore'), '.claude/state/\n');
  writeFileSync(join(dir, 'apps', 'a.ts'), 'export const a = 1;\n');
  git('add', '.');
  git('commit', '--quiet', '-m', 'init');
  writeFileSync(join(dir, 'apps', 'a.ts'), 'export const a = 2;\n');
  return dir;
}

/** Runs the Stop hook against `dir`; the temp repo has no scripts/verify.mjs, so a run fails. */
function stopHook(dir) {
  return spawnSync(process.execPath, [hook], {
    input: '{}',
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
  });
}

describe('green tree record (verify and the Stop hook)', () => {
  it('fingerprints HEAD, status and diff, and changes with any edit', () => {
    const dir = repoWithCodeChange();
    const first = treeState(dir);
    assert.ok(first);
    assert.equal(treeState(dir)?.fingerprint, first.fingerprint);
    writeFileSync(join(dir, 'apps', 'a.ts'), 'export const a = 3;\n');
    assert.notEqual(treeState(dir)?.fingerprint, first.fingerprint);
    writeFileSync(join(dir, 'apps', 'new.ts'), '');
    assert.match(treeState(dir)?.status ?? '', /apps\/new\.ts/);
  });

  it('changes when only the content of an untracked file changes', () => {
    const dir = repoWithCodeChange();
    writeFileSync(join(dir, 'apps', 'new.ts'), 'export const b = 1;\n');
    const before = treeState(dir)?.fingerprint;
    writeFileSync(join(dir, 'apps', 'new.ts'), 'export const b = 2;\n');
    assert.notEqual(treeState(dir)?.fingerprint, before);
  });

  it('changes when the local main moves (fast verify compares against it)', () => {
    const dir = repoWithCodeChange();
    const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
    git('branch', '-M', 'work');
    const noMain = treeState(dir)?.fingerprint;
    git('branch', 'main');
    assert.notEqual(treeState(dir)?.fingerprint, noMain);
  });

  it('ignores ignored files', () => {
    const dir = repoWithCodeChange();
    const before = treeState(dir)?.fingerprint;
    mkdirSync(join(dir, '.claude', 'state'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'state', 'scratch'), 'x');
    assert.equal(treeState(dir)?.fingerprint, before);
  });

  it('is null outside a git repository', () => {
    assert.equal(treeState(mkdtempSync(join(tmpdir(), 'shifa-nogit-'))), null);
  });

  it('isGreen matches only the recorded fingerprint', () => {
    const dir = repoWithCodeChange();
    const { fingerprint } = treeState(dir);
    assert.equal(isGreen(dir, fingerprint), false);
    recordGreen(dir, fingerprint);
    assert.equal(isGreen(dir, fingerprint), true);
    assert.equal(isGreen(dir, 'other'), false);
    assert.equal(isGreen(dir, ''), false);
  });

  it('the Stop hook skips a tree that verify recorded green', () => {
    const dir = repoWithCodeChange();
    recordGreen(dir, treeState(dir).fingerprint);
    const run = stopHook(dir);
    assert.equal(run.status, 0);
    assert.equal(run.stdout, '');
  });

  it('the Stop hook runs verify again once the tree changes', () => {
    const dir = repoWithCodeChange();
    recordGreen(dir, treeState(dir).fingerprint);
    writeFileSync(join(dir, 'apps', 'a.ts'), 'export const a = 4;\n');
    const run = stopHook(dir);
    assert.equal(run.status, 0);
    assert.equal(JSON.parse(run.stdout).decision, 'block');
  });
});

describe('verify modes', () => {
  it('refuses an unknown mode before taking the lock', () => {
    const run = spawnSync(process.execPath, [verify, 'everything'], { encoding: 'utf8' });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /use fast, full, docs/);
  });
});
