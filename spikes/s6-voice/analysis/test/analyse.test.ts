// Criterion 6: the CLI joins a results file with the key and writes the report table (Markdown)
// and the same numbers as JSON. Snapshots pin both; a results file from another set is refused.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { main } from '../src/analyse.ts';
import { makeFixture } from './fixtures/build.ts';

const dirs: string[] = [];
function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 's6-analysis-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const A = 'azure/ar-SY-LaithNeural';
const G = 'google/ar-XA-Chirp3-HD-Kore';
const S = 'silma/default';

function writeFixture(dir: string) {
  const { key, results } = makeFixture(
    {
      [A]: { score: { 'number-001': 5, 'name-m01': 4 }, wrong: ['name-plain-f01'] },
      [G]: { score: 4, wrong: ['number-111'] },
      [S]: { score: 2, wrong: ['name-m02'] },
    },
    [
      { a: A, b: G, choice: 'a' },
      { a: G, b: S, choice: 'a' },
      { a: S, b: A, choice: 'b' },
      { a: A, b: G, choice: 'same' },
    ],
  );
  const resultsFile = join(dir, 'results.json');
  const keyFile = join(dir, 'key.json');
  writeFileSync(resultsFile, JSON.stringify(results));
  writeFileSync(keyFile, JSON.stringify(key));
  return { resultsFile, keyFile, key, results };
}

describe('analyse CLI', () => {
  it('writes analysis.md and analysis.json matching the snapshots', async () => {
    const dir = temp();
    const { resultsFile, keyFile } = writeFixture(dir);
    const out = join(dir, 'out');
    const code = main(['--results', resultsFile, '--key', keyFile, '--out', out]);
    expect(code).toBe(0);
    const md = readFileSync(join(out, 'analysis.md'), 'utf8');
    const json = JSON.parse(readFileSync(join(out, 'analysis.json'), 'utf8')) as {
      decision: { kind: string; voiceId?: string };
      voices: { voiceId: string; pairs: { wins: number; losses: number; ties: number } }[];
    };
    await expect(md).toMatchFileSnapshot('__snapshots__/analysis.md');
    await expect(`${JSON.stringify(json, null, 2)}\n`).toMatchFileSnapshot(
      '__snapshots__/analysis.json',
    );
    // G sounds better than S but misread a number; A is the winner.
    expect(json.decision).toMatchObject({ kind: 'winner', voiceId: A });
    expect(json.voices.find((v) => v.voiceId === A)?.pairs).toEqual({
      wins: 2,
      losses: 0,
      ties: 1,
    });
    expect(json.voices.find((v) => v.voiceId === G)?.pairs).toEqual({
      wins: 1,
      losses: 1,
      ties: 1,
    });
    expect(md).toContain('no significance claim');
  });

  it('is deterministic: a second run writes the same bytes', () => {
    const dir = temp();
    const { resultsFile, keyFile } = writeFixture(dir);
    main(['--results', resultsFile, '--key', keyFile, '--out', join(dir, 'one')]);
    main(['--results', resultsFile, '--key', keyFile, '--out', join(dir, 'two')]);
    for (const f of ['analysis.md', 'analysis.json']) {
      expect(readFileSync(join(dir, 'two', f), 'utf8')).toBe(
        readFileSync(join(dir, 'one', f), 'utf8'),
      );
    }
  });

  it('refuses a results file from another listening set', () => {
    const dir = temp();
    const { keyFile, results } = writeFixture(dir);
    const other = join(dir, 'other.json');
    writeFileSync(other, JSON.stringify({ ...results, setHash: 'ffffffffffffffff' }));
    expect(() => main(['--results', other, '--key', keyFile, '--out', join(dir, 'x')])).toThrow(
      /set hash/u,
    );
  });

  it('refuses a results file with an identity field', () => {
    const dir = temp();
    const { keyFile, results } = writeFixture(dir);
    const other = join(dir, 'named.json');
    writeFileSync(other, JSON.stringify({ ...results, listener: 'someone' }));
    expect(() => main(['--results', other, '--key', keyFile, '--out', join(dir, 'x')])).toThrow();
  });

  it('maps a pre-round choice to the two picked voices', () => {
    const dir = temp();
    const key = {
      schemaVersion: 1,
      kind: 'pre-round',
      setHash: 'aaaaaaaaaaaaaaaa',
      seed: 3,
      voices: [
        {
          voiceId: 'google/ar-XA-Chirp3-HD-Orus',
          provider: 'google',
          voice: 'ar-XA-Chirp3-HD-Orus',
          label: 1,
          gender: 'male',
        },
        {
          voiceId: 'google/ar-XA-Chirp3-HD-Leda',
          provider: 'google',
          voice: 'ar-XA-Chirp3-HD-Leda',
          label: 2,
          gender: 'female',
        },
      ],
      codes: {},
      pairs: [],
    };
    const choice = {
      schemaVersion: 1,
      kind: 'pre-round',
      setHash: 'aaaaaaaaaaaaaaaa',
      male: 1,
      female: 2,
      chosenAt: '2026-11-19T08:00:00.000Z',
    };
    writeFileSync(join(dir, 'key.json'), JSON.stringify(key));
    writeFileSync(join(dir, 'choice.json'), JSON.stringify(choice));
    const out = join(dir, 'out');
    expect(
      main([
        '--pre-round',
        '--results',
        join(dir, 'choice.json'),
        '--key',
        join(dir, 'key.json'),
        '--out',
        out,
      ]),
    ).toBe(0);
    const json = JSON.parse(readFileSync(join(out, 'pre-round.json'), 'utf8')) as unknown;
    expect(json).toEqual({
      male: 'ar-XA-Chirp3-HD-Orus',
      female: 'ar-XA-Chirp3-HD-Leda',
      chosenAt: '2026-11-19T08:00:00.000Z',
    });
  });
});
