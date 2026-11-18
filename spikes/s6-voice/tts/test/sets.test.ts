// Review fix: the pre-round and the full set of one voice keep separate manifests, so a re-run of
// either regenerates nothing (the two Chirp voices the owner picks run both sets).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/generate.ts';
import { readManifest } from '../src/manifest.ts';
import type { SynthesisResult, TtsProvider } from '../src/provider.ts';
import { ProviderError } from '../src/provider.ts';
import { createFakeProvider } from '../src/providers/fake.ts';
import { withRetry } from '../src/retry.ts';
import { FIXED_NOW, fakeSleep, recordingLog, tempOutDir } from './helpers.ts';

function counting(): { provider: TtsProvider; calls: () => number } {
  const inner = createFakeProvider();
  let calls = 0;
  return {
    provider: {
      name: 'fake',
      synthesize(text: string, voice: string): Promise<SynthesisResult> {
        calls += 1;
        return inner.synthesize(text, voice);
      },
    },
    calls: () => calls,
  };
}

describe('pre-round and full set of one voice', () => {
  it('keep separate manifests; a second full run makes no call', async () => {
    const outDir = tempOutDir();
    const { provider, calls } = counting();
    const run = (set: 'full' | 'pre-round') =>
      generate({
        provider,
        voice: 'fake-1',
        set,
        outDir,
        now: FIXED_NOW,
        log: recordingLog().log,
        sleep: fakeSleep().sleep,
      });
    await run('pre-round');
    expect(calls()).toBe(5);
    await run('full');
    expect(calls()).toBe(182);
    await run('pre-round');
    await run('full');
    expect(calls()).toBe(182);

    const runDir = join(outDir, 'fake', 'fake-1');
    expect(readManifest(join(runDir, 'manifest.json')).header.set).toBe('full');
    expect(readManifest(join(runDir, 'manifest.pre-round.json')).header.set).toBe('pre-round');
    expect(existsSync(join(runDir, 'pre-1.wav'))).toBe(true);
  });
});

describe('Retry-After cap', () => {
  it('waits at most a minute however long the vendor asks', async () => {
    const { waits, sleep } = fakeSleep();
    let attempt = 0;
    await withRetry(
      () => {
        attempt += 1;
        return attempt === 1
          ? Promise.reject(new ProviderError('limited', { status: 429, retryAfterMs: 3_600_000 }))
          : Promise.resolve(1);
      },
      { sleep },
    );
    expect(waits).toEqual([60_000]);
  });
});
