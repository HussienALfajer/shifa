// The fake provider for every automated test (CI never calls a vendor): a deterministic tone whose
// length grows with the text (120 ms + 8 ms per code point) and whose pitch depends on the text.
import { createHash } from 'node:crypto';
import { billedCharacters, type SynthesisResult, type TtsProvider } from '../provider.ts';
import { encodeWav, toneSamples } from '../wav.ts';

export const FAKE_SAMPLE_RATE = 24_000;

export function fakeDurationMs(text: string): number {
  return 120 + 8 * Array.from(text).length;
}

export function createFakeProvider(): TtsProvider {
  return {
    name: 'fake',
    synthesize(text: string, voice: string): Promise<SynthesisResult> {
      const digest = createHash('sha256').update(`${voice}\n${text}`).digest();
      const hz = 300 + ((digest[0] ?? 0) / 255) * 400;
      const samples = toneSamples({ hz, ms: fakeDurationMs(text), sampleRate: FAKE_SAMPLE_RATE });
      return Promise.resolve({
        audio: encodeWav(samples, FAKE_SAMPLE_RATE),
        mime: 'audio/wav',
        sampleRate: FAKE_SAMPLE_RATE,
        charactersBilled: billedCharacters(text),
        elapsedMs: 0,
      });
    },
  };
}
