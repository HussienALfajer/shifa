// OD-51: a listening set from one voice (SILMA alone): every clip but the chime to rate, no pairs.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/generate.ts';
import { buildListeningSet } from '../src/listening-set.ts';
import { readManifest } from '../src/manifest.ts';
import { createFakeProvider } from '../src/providers/fake.ts';
import { FIXED_NOW, fakeSleep, recordingLog, tempOutDir } from './helpers.ts';

describe('single-voice listening set', () => {
  it('rates every clip but the chime and plans no pairs', async () => {
    const outDir = tempOutDir();
    await generate({
      provider: createFakeProvider(),
      voice: 'fake-1',
      set: 'full',
      outDir,
      now: FIXED_NOW,
      log: recordingLog().log,
      sleep: fakeSleep().sleep,
    });
    const dir = join(outDir, 'fake', 'fake-1');
    const built = buildListeningSet({
      inputs: [{ manifest: readManifest(join(dir, 'manifest.json')), dir }],
      seed: 3,
    });
    if (built.set.kind !== 'full') throw new Error('full set expected');
    expect(built.set.items).toHaveLength(177);
    expect(built.set.pairs).toEqual([]);
    expect(built.key.pairs).toEqual([]);
    expect(built.key.voices.map((v) => v.voiceId)).toEqual(['fake/fake-1']);
  });

  it('still needs two voices for a pre-round', () => {
    expect(() => buildListeningSet({ inputs: [], seed: 1, mode: 'pre-round' })).toThrow(
      /at least 2/u,
    );
  });
});
