// The drift cache (scripts/lib/drift-cache.mjs, `cacheInputs` in lib/drift.mjs): a check skips
// its generator only when its inputs, cache inputs and committed outputs hash to the key recorded
// after the last clean run; --fix, any change and a drifted run regenerate; CI and a branch that
// tracks .verify/ never read markers.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { formatReport, runDrift } from '../lib/drift.mjs';
import { driftCacheDir, readMarker } from '../lib/drift-cache.mjs';

const cli = join(import.meta.dirname, '..', 'check-drift.mjs');
const LOCAL = { CI: '', GITHUB_ACTIONS: '' };

let root;
let logDir;
let cacheDir;
let runs;

function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });

// Upper-cases input.txt into gen/a.txt; gen.cfg stands in for the generator's own source.
const upper = () => ({
  name: 'upper',
  inputs: ['input.txt'],
  cacheInputs: ['gen.cfg'],
  outputs: ['gen'],
  generate(outDir, { root: r }) {
    runs += 1;
    write(join(outDir, 'gen', 'a.txt'), readFileSync(join(r, 'input.txt'), 'utf8').toUpperCase());
  },
});

const drift = (options = {}) =>
  runDrift({ root, checks: [upper()], logDir, cacheDir, full: true, ...options });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'drift-cache-'));
  logDir = join(root, '.logs');
  cacheDir = join(root, '.verify', 'drift-cache');
  runs = 0;
  write(join(root, 'input.txt'), 'hello\n');
  write(join(root, 'gen.cfg'), 'v1\n');
  write(join(root, 'gen', 'a.txt'), 'HELLO\n');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('drift cache', () => {
  it('records a clean run and skips the generator while nothing changed', async () => {
    const first = await drift();
    assert.equal(first.results[0].status, 'clean');
    assert.equal(first.results[0].cached, false);
    assert.match(readMarker(cacheDir, 'upper'), /^[0-9a-f]{64}$/);
    const second = await drift();
    assert.equal(second.code, 0);
    assert.equal(second.results[0].status, 'clean');
    assert.equal(second.results[0].cached, true);
    assert.equal(runs, 1);
  });

  it('regenerates when an input changes', async () => {
    await drift();
    write(join(root, 'input.txt'), 'bye\n');
    write(join(root, 'gen', 'a.txt'), 'BYE\n');
    const again = await drift();
    assert.equal(again.results[0].cached, false);
    assert.equal(again.results[0].status, 'clean');
    assert.equal(runs, 2);
  });

  it('regenerates when a cache input (the generator) changes', async () => {
    await drift();
    write(join(root, 'gen.cfg'), 'v2\n');
    await drift();
    assert.equal(runs, 2);
  });

  it('regenerates and reports drift when only the committed output changes', async () => {
    await drift();
    write(join(root, 'gen', 'a.txt'), 'HAND EDITED\n');
    const edited = await drift();
    assert.equal(edited.code, 1);
    assert.deepEqual(edited.results[0].stale, ['gen/a.txt']);
    write(join(root, 'gen', 'a.txt'), 'HELLO\n');
    write(join(root, 'gen', 'extra.txt'), 'x');
    const extra = await drift();
    assert.equal(extra.code, 1);
    assert.deepEqual(extra.results[0].extra, ['gen/extra.txt']);
    assert.equal(runs, 3);
  });

  it('never records a drifted run, so the drift is reported again', async () => {
    write(join(root, 'gen', 'a.txt'), 'STALE\n');
    assert.equal((await drift()).code, 1);
    assert.equal(readMarker(cacheDir, 'upper'), null);
    assert.equal((await drift()).code, 1);
    assert.equal(runs, 2);
  });

  it('--fix always regenerates, even when the marker matches', async () => {
    await drift();
    const fixed = await drift({ fix: true });
    assert.equal(fixed.results[0].cached, false);
    assert.equal(runs, 2);
  });

  it('regenerates when the size budget changes', async () => {
    await drift();
    const budgeted = { ...upper(), budget: { files: 5 } };
    await runDrift({ root, checks: [budgeted], logDir, cacheDir, full: true });
    assert.equal(runs, 2);
  });

  it('is off without a cache directory, and for checks without cacheInputs', async () => {
    await drift({ cacheDir: undefined });
    await drift({ cacheDir: undefined });
    assert.equal(runs, 2);
    const plain = { ...upper(), cacheInputs: undefined };
    await runDrift({ root, checks: [plain], logDir, cacheDir });
    await runDrift({ root, checks: [plain], logDir, cacheDir });
    assert.equal(runs, 4);
    assert.equal(readMarker(cacheDir, 'upper'), null);
  });

  it('ignores a marker recorded for another tree', async () => {
    write(join(cacheDir, 'upper.sha256'), `${'0'.repeat(64)}\n`);
    const r = await drift();
    assert.equal(r.results[0].cached, false);
    assert.equal(runs, 1);
  });

  it('does not record a tree that changed while the generator ran', async () => {
    const racy = {
      ...upper(),
      generate(outDir, ctx) {
        upper().generate(outDir, ctx);
        write(join(root, 'gen.cfg'), 'edited mid-run\n');
      },
    };
    await runDrift({ root, checks: [racy], logDir, cacheDir });
    assert.equal(readMarker(cacheDir, 'upper'), null);
  });
});

describe('driftCacheDir', () => {
  it('uses .verify/drift-cache in a git work tree outside CI', () => {
    git('init', '-q');
    assert.deepEqual(driftCacheDir(root, { env: LOCAL }), { dir: cacheDir });
  });

  it('is off in CI, with --no-cache and outside a git work tree', () => {
    git('init', '-q');
    assert.equal(driftCacheDir(root, { env: { CI: 'true' } }).reason, 'CI');
    assert.equal(driftCacheDir(root, { env: { CI: '1' } }).reason, 'CI');
    assert.equal(driftCacheDir(root, { env: { GITHUB_ACTIONS: 'true' } }).reason, 'CI');
    assert.equal(driftCacheDir(root, { env: { CI: 'false' } }).dir, cacheDir);
    assert.equal(driftCacheDir(root, { env: LOCAL, noCache: true }).dir, null);
    rmSync(join(root, '.git'), { recursive: true, force: true });
    assert.match(driftCacheDir(root, { env: LOCAL }).reason, /not a git work tree/);
  });

  it('is off when the branch tracks anything under .verify/ (a committed marker)', () => {
    git('init', '-q');
    write(join(cacheDir, 'upper.sha256'), 'planted\n');
    assert.equal(git('add', '-f', '.verify/drift-cache/upper.sha256').status, 0);
    assert.match(driftCacheDir(root, { env: LOCAL }).reason, /tracks files under \.verify/);
  });
});

describe('check-drift CLI cache', () => {
  function runCli(extra = [], env = LOCAL) {
    // Every CLI test needs --root/--config (a temp tree), which is exactly what turns the cache
    // off; the cached path itself is covered through runDrift above.
    const config = join(root, 'drift.config.mjs');
    write(
      config,
      [
        `import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';`,
        `import { join } from 'node:path';`,
        'export default [{ name: "copy", inputs: ["input.txt"], cacheInputs: [], outputs: ["gen"],',
        '  generate(out, { root }) { mkdirSync(join(out, "gen"), { recursive: true });',
        '    writeFileSync(join(out, "gen", "a.txt"),',
        '      readFileSync(join(root, "input.txt"), "utf8").toUpperCase()); } }];',
      ].join('\n'),
    );
    return spawnSync(process.execPath, [cli, '--root', root, '--config', config, ...extra], {
      encoding: 'utf8',
      env: { ...process.env, DRIFT_LOG_DIR: logDir, ...env },
    });
  }

  it('is off with --root/--config: the generator that runs is not the one hashed', () => {
    git('init', '-q');
    for (let i = 0; i < 2; i += 1) {
      const res = runCli();
      assert.equal(res.status, 0, res.stderr);
      assert.doesNotMatch(res.stdout, /\(cached\)/);
      assert.match(res.stdout, /cache off: --root\/--config/);
    }
    assert.equal(readMarker(cacheDir, 'copy'), null);
  });

  it('formatReport marks a cached check', () => {
    const r = { name: 'copy', status: 'clean', cached: true, problems: [] };
    for (const k of ['stale', 'missing', 'extra']) r[k] = [];
    assert.match(formatReport([r]), /CLEAN {4}copy \(cached\)/);
  });
});
