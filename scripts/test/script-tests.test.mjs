// Script test selection (scripts/lib/script-tests.mjs, OD-32): full and docs run every suite;
// fast leaves out the listed Docker suites unless a covered file changed; the list matches the
// suites that really start containers, so a new Docker suite cannot be missed by the check.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  changedSinceMain,
  DOCKER_SUITES,
  selectScriptTests,
  startsContainer,
} from '../lib/script-tests.mjs';
import { verifySteps } from '../lib/verify-steps.mjs';

const testDir = import.meta.dirname;
const suites = readdirSync(testDir).filter((f) => f.endsWith('.test.mjs'));
const docker = Object.keys(DOCKER_SUITES);
const plain = suites.filter((f) => !docker.includes(f));

describe('selectScriptTests', () => {
  it('runs every suite outside fast mode, whatever changed', () => {
    assert.deepEqual(selectScriptTests(suites, { fast: false, changed: [] }).run, suites);
    assert.deepEqual(selectScriptTests(suites, { fast: false, changed: null }).run, suites);
  });

  it('runs every suite in fast mode when the change set is unknown', () => {
    assert.deepEqual(selectScriptTests(suites, { fast: true, changed: null }).run, suites);
  });

  it('leaves out exactly the Docker suites in fast mode when nothing they cover changed', () => {
    const { run, left } = selectScriptTests(suites, { fast: true, changed: ['docs/roadmap.md'] });
    assert.deepEqual(run, plain);
    assert.deepEqual(left.sort(), [...docker].sort());
  });

  it('brings a Docker suite back when a file it covers changed', () => {
    const pick = (changed) => selectScriptTests(suites, { fast: true, changed }).left.sort();
    assert.deepEqual(pick(['infra/observability/collector.yaml']), []);
    assert.deepEqual(pick(['scripts/test/fixtures/obs/denied-keys.mjs']), [
      'obs-collector-scrub.test.mjs',
      'obs-collector-validate.test.mjs',
    ]);
    assert.deepEqual(pick(['scripts/test/obs-collector-validate.test.mjs']), [
      'obs-collector-run.test.mjs',
      'obs-collector-scrub.test.mjs',
    ]);
    for (const common of [
      'scripts/run-script-tests.mjs',
      'scripts/lib/script-tests.mjs',
      'pnpm-lock.yaml',
    ]) {
      assert.deepEqual(pick([common]), [], common);
    }
  });
});

describe('the Docker suite list', () => {
  it('names only suites that exist', () => {
    for (const file of docker) assert.ok(suites.includes(file), `${file} is not in scripts/test`);
  });

  it('lists exactly the suites that start a container', () => {
    const starting = suites.filter((f) => startsContainer(readFileSync(join(testDir, f), 'utf8')));
    assert.deepEqual(starting.sort(), [...docker].sort());
  });

  it('recognises container starts and ignores other docker calls', () => {
    // Samples are assembled at run time, so this file itself does not look like a Docker suite.
    const d = ['doc', 'ker'].join('');
    assert.ok(startsContainer(`spawnSync('${d}', ['run', '--rm', image])`));
    assert.ok(startsContainer(`spawnSync(\n  '${d}',\n  [\n    'run',\n    '-d',`));
    assert.ok(startsContainer(`execFileSync("${d}", ["compose", "up"])`));
    assert.equal(startsContainer(`spawnSync('${d}', ['info'])`), false);
    assert.equal(startsContainer(`spawnSync('${d}', ['rm', '-f', name])`), false);
    assert.equal(startsContainer(`assert.equal(cmd, '${d}')`), false);
  });
});

describe('changedSinceMain', () => {
  const git = (cwd, ...args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  const newRepo = (branch) => {
    const repo = mkdtempSync(join(tmpdir(), 'shifa-script-tests-'));
    git(repo, 'init', '-q', '-b', branch);
    git(repo, 'config', 'user.email', 'test@example.invalid');
    git(repo, 'config', 'user.name', 'test');
    git(repo, 'config', 'core.autocrlf', 'false');
    return repo;
  };

  it('lists commits since main, staged, unstaged and untracked files', () => {
    const repo = newRepo('main');
    for (const f of ['base.txt', 'staged.txt', 'unstaged.txt']) writeFileSync(join(repo, f), 'a');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'base');
    git(repo, 'switch', '-q', '-c', 'work');
    writeFileSync(join(repo, 'committed.txt'), 'b');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'work');
    writeFileSync(join(repo, 'staged.txt'), 'b');
    git(repo, 'add', 'staged.txt');
    writeFileSync(join(repo, 'unstaged.txt'), 'b');
    writeFileSync(join(repo, 'untracked.txt'), 'b');
    assert.deepEqual(changedSinceMain(repo)?.sort(), [
      'committed.txt',
      'staged.txt',
      'unstaged.txt',
      'untracked.txt',
    ]);
  });

  it('is null without a main branch or outside a work tree', () => {
    const repo = newRepo('trunk');
    writeFileSync(join(repo, 'a.txt'), 'a');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'base');
    assert.equal(changedSinceMain(repo), null);
    assert.equal(changedSinceMain(mkdtempSync(join(tmpdir(), 'shifa-no-git-'))), null);
  });
});

describe('scripts-test step', () => {
  const argsOf = (mode) => verifySteps(mode).find((s) => s.name === 'scripts-test')?.args;

  it('passes --fast only in fast mode', () => {
    assert.deepEqual(argsOf('fast'), ['scripts/run-script-tests.mjs', '--fast']);
    assert.deepEqual(argsOf('full'), ['scripts/run-script-tests.mjs']);
    assert.deepEqual(argsOf('docs'), ['scripts/run-script-tests.mjs']);
  });

  it('refuses an unknown argument', () => {
    const cli = join(testDir, '..', 'run-script-tests.mjs');
    const r = spawnSync(process.execPath, [cli, '--full'], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /unknown argument/);
  });
});
