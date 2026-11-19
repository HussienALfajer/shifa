// Criterion 9: the gap between joined clips is measured from a recording of the audio output.
// Synthetic WAVs with known silences between two tones are each reported within 2 ms.
import { describe, expect, it } from 'vitest';
import { measureGaps } from '../scripts/measure-gaps.ts';
import { concatSamples, encodeWav, toneSamples } from '../src/wav.ts';

const RATE = 48_000;

function joined(gapMs: number, opts: { lead?: number; noise?: number } = {}): Uint8Array {
  const silence = (ms: number) => new Float32Array(Math.round((ms / 1000) * RATE));
  const parts = [
    silence(opts.lead ?? 100),
    toneSamples({ hz: 440, ms: 400, sampleRate: RATE, fadeMs: 1 }),
    silence(gapMs),
    toneSamples({ hz: 550, ms: 400, sampleRate: RATE, fadeMs: 1 }),
    silence(150),
  ];
  const samples = concatSamples(parts);
  if (opts.noise) {
    // Deterministic low-level noise, as a recording would have.
    let x = 1;
    for (let i = 0; i < samples.length; i += 1) {
      x = (x * 1_103_515_245 + 12_345) % 2_147_483_648;
      samples[i] = (samples[i] ?? 0) + (x / 2_147_483_648 - 0.5) * 2 * opts.noise;
    }
  }
  return encodeWav(samples, RATE);
}

describe('measure-gaps', () => {
  it('reports no gap for clips joined back to back', () => {
    const result = measureGaps(joined(0));
    expect(result.longestMs).toBeLessThanOrEqual(2);
  });

  for (const gap of [5, 50, 200]) {
    it(`reports a ${String(gap)} ms silence within 2 ms`, () => {
      const result = measureGaps(joined(gap));
      expect(result.gaps).toHaveLength(1);
      expect(Math.abs((result.gaps[0]?.ms ?? -1) - gap)).toBeLessThanOrEqual(2);
      expect(Math.abs(result.longestMs - gap)).toBeLessThanOrEqual(2);
      // Leading and trailing silence are not gaps.
      expect(result.gaps[0]?.startMs).toBeGreaterThan(450);
    });
  }

  it('ignores noise below the threshold', () => {
    const result = measureGaps(joined(50, { noise: 0.0005 }), { thresholdDb: -50 });
    expect(result.gaps).toHaveLength(1);
    expect(Math.abs((result.gaps[0]?.ms ?? -1) - 50)).toBeLessThanOrEqual(2);
  });
});
