import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import checks from '../drift.config.mjs';
import { formatReport, measureOutputs, runDrift } from '../lib/drift.mjs';

let root;
let logDir;

function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

// Writes `files` files of `lines` lines each under gen/ (a stand-in for a client generator).
function generator({ files, lines, budget }) {
  return {
    name: 'client',
    inputs: [],
    outputs: ['gen'],
    budget,
    generate(outDir) {
      for (let i = 0; i < files; i += 1) {
        write(join(outDir, 'gen', `m${i}.dart`), 'x\n'.repeat(lines));
      }
    },
  };
}

function commit(files, lines) {
  for (let i = 0; i < files; i += 1) write(join(root, 'gen', `m${i}.dart`), 'x\n'.repeat(lines));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'drift-budget-'));
  logDir = join(root, '.logs');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('measureOutputs', () => {
  it('counts files and lines under every output path', () => {
    commit(3, 4);
    write(join(root, 'single.txt'), 'a\nb');
    assert.deepEqual(measureOutputs(root, ['gen', 'single.txt', 'absent']), {
      files: 4,
      lines: 14,
    });
  });
});

describe('size budget', () => {
  it('stays clean when the output is within the budget', async () => {
    commit(3, 10);
    const check = generator({ files: 3, lines: 10, budget: { files: 3, lines: 30 } });
    const { code, results } = await runDrift({ root, checks: [check], logDir });
    assert.equal(code, 0);
    assert.equal(results[0].status, 'clean');
  });

  it('reports drift naming the file ceiling when the output has too many files', async () => {
    commit(3, 1);
    const check = generator({ files: 12, lines: 1, budget: { files: 10, lines: 1000 } });
    const { code, results } = await runDrift({ root, checks: [check], logDir });
    assert.equal(code, 1);
    assert.equal(results[0].status, 'drift');
    assert.match(results[0].problems.join('\n'), /size budget.*12 files.*max 10/);
    // A budget failure replaces the per-file listing, so an inflated output is one line, not 10k.
    assert.deepEqual(results[0].missing, []);
  });

  it('reports drift naming the line ceiling when the output is too long', async () => {
    commit(2, 10);
    const check = generator({ files: 2, lines: 600, budget: { files: 10, lines: 1000 } });
    const { code, results } = await runDrift({ root, checks: [check], logDir });
    assert.equal(code, 1);
    assert.match(results[0].problems.join('\n'), /size budget.*1200 lines.*max 1000/);
  });

  it('is never fixed by --fix, so an inflated output cannot be committed by accident', async () => {
    commit(1, 1);
    const check = generator({ files: 12, lines: 1, budget: { files: 10, lines: 1000 } });
    const { code, results } = await runDrift({ root, checks: [check], fix: true, logDir });
    assert.equal(code, 1);
    assert.equal(results[0].status, 'drift');
    assert.match(formatReport(results), /problem\s+size budget/);
  });
});

describe('drift registry', () => {
  it('registers both API clients after openapi, reading the committed document', () => {
    const names = checks.map((c) => c.name);
    assert.ok(names.indexOf('openapi') < names.indexOf('api-client-ts'));
    assert.ok(names.indexOf('openapi') < names.indexOf('api-client-dart'));
    for (const name of ['api-client-ts', 'api-client-dart']) {
      const check = checks.find((c) => c.name === name);
      assert.ok(check.inputs.includes('packages/contracts/generated/openapi.json'), name);
    }
  });

  it('gives the Dart client a file and line budget', () => {
    const dart = checks.find((c) => c.name === 'api-client-dart');
    assert.ok(Number.isInteger(dart.budget?.files) && dart.budget.files > 0);
    assert.ok(Number.isInteger(dart.budget?.lines) && dart.budget.lines > 0);
  });
});
