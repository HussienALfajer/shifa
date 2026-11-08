import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { judge, measure, parseNumstatZ, WARN_LINES } from '../lib/pr-size.mjs';

describe('parseNumstatZ', () => {
  it('reads plain, binary and renamed records', () => {
    const raw = '10\t5\tsrc/a.ts\0-\t-\tlogo.png\0' + '2\t1\t\0old/b.ts\0new/b.ts\0';
    assert.deepEqual(parseNumstatZ(raw), [
      { added: 10, deleted: 5, path: 'src/a.ts' },
      { added: null, deleted: null, path: 'logo.png' },
      { added: 2, deleted: 1, path: 'new/b.ts' },
    ]);
  });

  it('keeps spaces and non-ASCII paths unquoted', () => {
    assert.deepEqual(parseNumstatZ('1\t0\tمجلد/a b.ts\0'), [
      { added: 1, deleted: 0, path: 'مجلد/a b.ts' },
    ]);
  });

  it('returns nothing for empty output', () => {
    assert.deepEqual(parseNumstatZ(''), []);
  });
});

describe('measure', () => {
  const entry = (added, deleted, path) => ({ added, deleted, path });

  it('sums added and deleted lines of text files', () => {
    const out = measure([entry(10, 5, 'src/a.ts'), entry(3, 0, 'docs/b.md')], new Set());
    assert.deepEqual(out, { counted: 18, excluded: 0 });
  });

  it('excludes binary files, lockfiles (any folder) and linguist-generated files', () => {
    const out = measure(
      [
        entry(null, null, 'docs/brand/logo.png'),
        entry(900, 100, 'pnpm-lock.yaml'),
        entry(40, 0, 'مجلد/pubspec.lock'),
        entry(500, 0, 'packages/api-client-ts/src/gen.ts'),
        entry(7, 1, 'src/real.ts'),
      ],
      new Set(['packages/api-client-ts/src/gen.ts']),
    );
    assert.deepEqual(out, { counted: 8, excluded: 4 });
  });
});

describe('judge', () => {
  it('passes at the budget', () => {
    assert.equal(judge(WARN_LINES).level, 'ok');
  });

  it('warns above the budget', () => {
    assert.equal(judge(WARN_LINES + 1).level, 'warn');
  });

  it('never fails, however large the PR (owner decision 2026-11-09: no hard limit)', () => {
    const verdict = judge(100_000);
    assert.equal(verdict.level, 'warn');
    assert.match(verdict.message, /100000 hand-written lines/);
  });
});
