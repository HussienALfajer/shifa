// Slice 0.4-10 F1 (audit 0.4, 2026-11-23): outside Linux neither alchemist config is on, so a
// golden test would register an empty variant and fail `verify` on Windows. `shifaGoldenTest`
// skips the test there with a reason that names the Docker script; every golden file goes
// through it, so the guard cannot be bypassed by calling alchemist's `goldenTest` directly.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const goldensDir = join(import.meta.dirname, '..', '..', 'packages', 'shifa_ui', 'test', 'goldens');
const support = readFileSync(join(goldensDir, 'support.dart'), 'utf8');
const goldenFiles = readdirSync(goldensDir).filter((f) => f.endsWith('_golden_test.dart'));

/** Dart source without `//` comments, so a commented-out call does not count. */
const code = (text) => text.replace(/\/\/[^\n]*/g, '');

describe('shifa_ui golden tests outside Linux (0.4-10 F1)', () => {
  it('shifaGoldenTest reads both alchemist configs from AlchemistConfig.current()', () => {
    const body = code(support);
    assert.match(body, /AlchemistConfig\.current\(\)/);
    assert.match(body, /platformGoldensConfig\.enabled/);
    assert.match(body, /ciGoldensConfig\.enabled/);
  });

  it('skips with a reason that names the Docker goldens script', () => {
    const body = code(support);
    assert.match(body, /skip:/, 'a skip argument');
    assert.ok(
      support.includes('node packages/shifa_ui/scripts/goldens.mjs'),
      'the skip reason names node packages/shifa_ui/scripts/goldens.mjs',
    );
  });

  it('finds the five golden files', () => {
    assert.equal(goldenFiles.length, 5, goldenFiles.join(', '));
  });

  for (const file of goldenFiles) {
    it(`${file} calls shifaGoldenTest, never goldenTest directly`, () => {
      const body = code(readFileSync(join(goldensDir, file), 'utf8'));
      assert.match(body, /\bshifaGoldenTest\(/);
      assert.doesNotMatch(body, /(?<![\w.])goldenTest\(/);
      assert.doesNotMatch(
        body,
        /package:alchemist\//,
        'imports alchemist only through support.dart',
      );
    });
  }
});
