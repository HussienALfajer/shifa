// Criteria 6 and 12: the committed listening results, key and analysis belong together. Rerunning
// the analysis on the committed results and key reproduces the committed analysis.md and
// analysis.json byte for byte, so a reviewer can check the report against the raw ratings.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { main } from '../src/analyse.ts';

const RESULTS_DIR = fileURLToPath(new URL('../../results/', import.meta.url));
const SET_HASH = '0837814499865b20';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('committed listening results', () => {
  it('reproduce the committed analysis exactly', () => {
    const out = mkdtempSync(join(tmpdir(), 's6-results-commit-'));
    dirs.push(out);
    const code = main([
      '--results',
      join(RESULTS_DIR, `s6-results-${SET_HASH}.json`),
      '--key',
      join(RESULTS_DIR, 'listening-key.json'),
      '--out',
      out,
    ]);
    expect(code).toBe(0);
    for (const file of ['analysis.md', 'analysis.json']) {
      expect(readFileSync(join(out, file), 'utf8')).toBe(
        readFileSync(join(RESULTS_DIR, file), 'utf8'),
      );
    }
  });

  it('record SILMA as accepted under OD-51', () => {
    const analysis = JSON.parse(readFileSync(join(RESULTS_DIR, 'analysis.json'), 'utf8')) as {
      decision: { kind: string };
    };
    expect(analysis.decision.kind).toBe('accepted');
  });
});
