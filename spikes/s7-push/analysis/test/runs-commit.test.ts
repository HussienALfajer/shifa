// Criterion 10: rerunning the analysis on the committed runs reproduces the committed
// `analysis.json`, so a reviewer can check the report's numbers against the raw logs.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyse } from '../src/analyse.ts';

const RUNS = join(import.meta.dirname, '..', '..', 'runs');

describe('committed runs', () => {
  it('reproduce the committed analysis.json', async () => {
    const dirs = readdirSync(RUNS)
      .map((d) => join(RUNS, d))
      .filter((d) => statSync(d).isDirectory());
    const { results, verdict } = await analyse(dirs);
    const committed: unknown = JSON.parse(readFileSync(join(RUNS, 'analysis.json'), 'utf8'));
    expect(JSON.parse(JSON.stringify({ verdict, results }))).toEqual(committed);
    expect(verdict.pass).toBe(true);
  });
});
