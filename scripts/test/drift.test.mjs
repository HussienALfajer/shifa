import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { runDrift } from '../lib/drift.mjs';

const cli = join(import.meta.dirname, '..', 'check-drift.mjs');

let root;
let logDir;

function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

// Trivial generator: upper-cases every line of input.txt into gen/a.txt and gen/b.txt.
const upper = {
  name: 'upper',
  inputs: ['input.txt'],
  outputs: ['gen'],
  generate(outDir, { root: r }) {
    const text = readFileSync(join(r, 'input.txt'), 'utf8').toUpperCase();
    write(join(outDir, 'gen', 'a.txt'), text);
    write(join(outDir, 'gen', 'sub', 'b.txt'), `b:${text}`);
  },
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'drift-'));
  logDir = join(root, '.logs');
  write(join(root, 'input.txt'), 'hello\nworld\n');
  write(join(root, 'gen', 'a.txt'), 'HELLO\nWORLD\n');
  write(join(root, 'gen', 'sub', 'b.txt'), 'b:HELLO\nWORLD\n');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('runDrift', () => {
  it('exits 0 on a clean tree', async () => {
    const { code, results } = await runDrift({ root, checks: [upper], logDir });
    assert.equal(code, 0);
    assert.equal(results[0].status, 'clean');
  });

  it('reports stale, missing and extra files by path with exit 1', async () => {
    write(join(root, 'gen', 'a.txt'), 'HELLO\n');
    rmSync(join(root, 'gen', 'sub', 'b.txt'));
    write(join(root, 'gen', 'old.txt'), 'leftover');
    const { code, results } = await runDrift({ root, checks: [upper], logDir });
    assert.equal(code, 1);
    assert.equal(results[0].status, 'drift');
    assert.deepEqual(results[0].stale, ['gen/a.txt']);
    assert.deepEqual(results[0].missing, ['gen/sub/b.txt']);
    assert.deepEqual(results[0].extra, ['gen/old.txt']);
  });

  it('exits 2 and names the check when a generator crashes', async () => {
    const boom = { ...upper, name: 'boom', generate: () => Promise.reject(new Error('kaput')) };
    const { code, results } = await runDrift({ root, checks: [upper, boom], logDir });
    assert.equal(code, 2);
    const crashed = results.find((r) => r.name === 'boom');
    assert.equal(crashed.status, 'crash');
    assert.match(readFileSync(crashed.logPath, 'utf8'), /kaput/);
  });

  it('--fix rewrites outputs and a second run is clean', async () => {
    write(join(root, 'gen', 'a.txt'), 'stale');
    write(join(root, 'gen', 'old.txt'), 'leftover');
    rmSync(join(root, 'gen', 'sub', 'b.txt'));
    const fixed = await runDrift({ root, checks: [upper], logDir, fix: true });
    assert.equal(fixed.code, 0);
    assert.equal(readFileSync(join(root, 'gen', 'a.txt'), 'utf8'), 'HELLO\nWORLD\n');
    const again = await runDrift({ root, checks: [upper], logDir });
    assert.equal(again.code, 0);
    assert.deepEqual(again.results[0].extra, []);
  });

  it('does not count a CRLF checkout as drift', async () => {
    write(join(root, 'gen', 'a.txt'), 'HELLO\r\nWORLD\r\n');
    const { code } = await runDrift({ root, checks: [upper], logDir });
    assert.equal(code, 0);
  });

  it('skips full checks in fast mode and runs them in full mode', async () => {
    let ran = 0;
    const slow = {
      ...upper,
      name: 'slow',
      full: true,
      generate: (o, c) => {
        ran += 1;
        return upper.generate(o, c);
      },
    };
    const fast = await runDrift({ root, checks: [slow], logDir });
    assert.equal(fast.results[0].status, 'skipped');
    assert.equal(ran, 0);
    const full = await runDrift({ root, checks: [slow], logDir, full: true });
    assert.equal(full.results[0].status, 'clean');
    assert.equal(ran, 1);
  });

  it('treats problems returned by a generator as drift', async () => {
    const picky = { ...upper, name: 'picky', generate: () => ({ problems: ['bad folder x'] }) };
    const { code, results } = await runDrift({ root, checks: [picky], logDir });
    assert.equal(code, 1);
    assert.deepEqual(results[0].problems, ['bad folder x']);
  });

  it('refuses --fix for a check that is not fixable', async () => {
    write(join(root, 'gen', 'a.txt'), 'stale');
    const locked = { ...upper, name: 'locked', fixable: false };
    const { code } = await runDrift({ root, checks: [locked], logDir, fix: true });
    assert.equal(code, 1);
    assert.equal(readFileSync(join(root, 'gen', 'a.txt'), 'utf8'), 'stale');
  });
});

describe('check-drift CLI', () => {
  function runCli(extra = []) {
    const config = join(root, 'drift.config.mjs');
    write(
      config,
      [
        `import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';`,
        `import { join } from 'node:path';`,
        'export default [{ name: "copy", inputs: ["input.txt"], outputs: ["gen/a.txt"],',
        '  generate(out, { root }) { mkdirSync(join(out, "gen"), { recursive: true });',
        '    writeFileSync(join(out, "gen", "a.txt"),',
        '      readFileSync(join(root, "input.txt"), "utf8").toUpperCase()); } }];',
      ].join('\n'),
    );
    return spawnSync(process.execPath, [cli, '--root', root, '--config', config, ...extra], {
      encoding: 'utf8',
      env: { ...process.env, DRIFT_LOG_DIR: logDir },
    });
  }

  it('prints the stale path, never the file contents, and exits 1', () => {
    write(join(root, 'gen', 'a.txt'), 'secret-ish content');
    const res = runCli();
    assert.equal(res.status, 1);
    assert.match(res.stdout, /gen\/a\.txt/);
    assert.doesNotMatch(res.stdout + res.stderr, /secret-ish/);
  });

  it('exits 0 when clean', () => {
    assert.equal(runCli().status, 0);
  });
});
