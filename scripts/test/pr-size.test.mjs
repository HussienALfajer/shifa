import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FAIL_LINES, judge, measure, WARN_LINES } from '../lib/pr-size.mjs';

describe('measure', () => {
  it('sums added and deleted lines of text files', () => {
    const out = measure('10\t5\tsrc/a.ts\n3\t0\tdocs/b.md\n', new Set());
    assert.deepEqual(out, { counted: 18, excluded: 0 });
  });

  it('excludes binary files, lockfiles and linguist-generated files', () => {
    const numstat = [
      '-\t-\tdocs/brand/logo.png',
      '900\t100\tpnpm-lock.yaml',
      '500\t0\tpackages/api-client-ts/src/gen.ts',
      '7\t1\tsrc/real.ts',
    ].join('\n');
    const out = measure(numstat, new Set(['packages/api-client-ts/src/gen.ts']));
    assert.deepEqual(out, { counted: 8, excluded: 3 });
  });

  it('keeps paths that contain tabs intact', () => {
    const out = measure('1\t1\tweird\tname.ts\n', new Set(['weird\tname.ts']));
    assert.deepEqual(out, { counted: 0, excluded: 1 });
  });

  it('ignores blank lines', () => {
    assert.deepEqual(measure('\n\n', new Set()), { counted: 0, excluded: 0 });
  });
});

describe('judge', () => {
  it('passes at the budget', () => {
    assert.equal(judge(WARN_LINES, false).level, 'ok');
  });

  it('warns above the budget and at the hard limit', () => {
    assert.equal(judge(WARN_LINES + 1, false).level, 'warn');
    assert.equal(judge(FAIL_LINES, false).level, 'warn');
  });

  it('fails above the hard limit without the override', () => {
    assert.equal(judge(FAIL_LINES + 1, false).level, 'fail');
  });

  it('only warns above the hard limit with the owner override', () => {
    const verdict = judge(FAIL_LINES + 1, true);
    assert.equal(verdict.level, 'warn');
    assert.match(verdict.message, /override/);
  });
});
