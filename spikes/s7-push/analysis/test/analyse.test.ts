// Criteria 4, 7, 8: the analysis joins send log, watcher log, probe receipts and inbox per run,
// and prints the per-state table (n, shown, within 60 s, p50/p95/max, collapsed, expired, lost,
// detectability) as Markdown and JSON. Fixed run set in test/fixtures/runs.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyse } from '../src/analyse.ts';
import { main } from '../src/cli.ts';

const RUNS = join(import.meta.dirname, 'fixtures', 'runs');
const dirs = readdirSync(RUNS)
  .sort()
  .map((d) => join(RUNS, d));

describe('analyse', () => {
  it('computes the per-run numbers on one clock', async () => {
    const { results } = await analyse(dirs);
    const by = Object.fromEntries(results.map((r) => [r.state, r]));

    // Doze: latencies 1, 2, 3 and 70 s after removing the emulator's +120 ms skew.
    expect(by.doze).toMatchObject({
      n: 4,
      expected: 4,
      shown: 4,
      within60: 3,
      within60Pct: 75,
      p50S: 2,
      p95S: 70,
      maxS: 70,
      lost: [],
    });

    // Offline: latency starts when the network came back; b1 collapsed, b3 expired, b4 lost.
    expect(by['offline-ttl-expire']).toMatchObject({
      n: 4,
      expected: 2,
      shown: 1,
      within60: 1,
      within60Pct: 50,
      p50S: 2,
      collapsed: 1,
      expired: 1,
      inboxOnly: 0,
      lost: ['s7-b4'],
    });

    // Permission denied: nothing shown, everything in the inbox, detectable from the report.
    expect(by['permission-denied']).toMatchObject({
      grading: 'excluded',
      shown: 0,
      inboxOnly: 2,
      lost: [],
      detectability: 'permission in device state',
    });

    // Foreground: shown via the probe's own receipt (device clock, skew −55 ms); drift flagged.
    expect(by.foreground).toMatchObject({
      shown: 2,
      within60Pct: 100,
      p50S: 0.5,
      maxS: 0.8,
      skewFlagged: true,
    });
  });

  it('the verdict names the failing states and the lost message', async () => {
    const { verdict } = await analyse(dirs);
    expect(verdict.pass).toBe(false);
    const reasons = verdict.reasons.join('\n');
    expect(reasons).toMatch(/doze/);
    expect(reasons).toMatch(/offline-ttl-expire/);
    expect(reasons).toMatch(/s7-b4/);
    expect(reasons).not.toMatch(/permission-denied/);
  });

  it('the CLI writes analysis.md and analysis.json (snapshot)', async () => {
    const out = mkdtempSync(join(tmpdir(), 's7-analysis-'));
    try {
      await main(['--runs-root', RUNS, '--out', out]);
      const md = readFileSync(join(out, 'analysis.md'), 'utf8');
      const json = JSON.parse(readFileSync(join(out, 'analysis.json'), 'utf8')) as {
        verdict: { pass: boolean };
        results: { run: string }[];
      };
      expect(json.verdict.pass).toBe(false);
      expect(json.results.map((r) => r.run)).toEqual(readdirSync(RUNS).sort());
      expect(md).toContain('| Run | State | API |');
      expect(md).toContain('Detectable');
      await expect(md).toMatchFileSnapshot('fixtures/expected-analysis.md');

      // --run takes run directories one by one, same result.
      const out2 = mkdtempSync(join(tmpdir(), 's7-analysis-'));
      await main([...dirs.flatMap((d) => ['--run', d]), '--out', out2]);
      expect(readFileSync(join(out2, 'analysis.md'), 'utf8')).toBe(md);
      rmSync(out2, { recursive: true, force: true });
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('refuses a run directory without meta.json', async () => {
    const empty = mkdtempSync(join(tmpdir(), 's7-empty-'));
    try {
      await expect(analyse([empty])).rejects.toThrow(/meta\.json/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
