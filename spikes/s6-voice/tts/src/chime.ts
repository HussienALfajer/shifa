// The synthetic two-tone chime (~1 s): written by code, never downloaded, the same file for every
// provider. The tones decay gently but never fall silent, so the gapless render sees no silence.
import { concatSamples, encodeWav, toneSamples } from './wav.ts';

export const CHIME_SAMPLE_RATE = 24_000;

function decaying(hz: number, ms: number): Float32Array {
  const tone = toneSamples({ hz, ms, sampleRate: CHIME_SAMPLE_RATE, amplitude: 0.5, fadeMs: 10 });
  for (let i = 0; i < tone.length; i += 1) {
    tone[i] = (tone[i] ?? 0) * (0.5 + 0.5 * Math.exp((-3 * i) / tone.length));
  }
  return tone;
}

export function makeChime(): Uint8Array {
  // E5 then C5, 500 ms each.
  return encodeWav(
    concatSamples([decaying(659.25, 500), decaying(523.25, 500)]),
    CHIME_SAMPLE_RATE,
  );
}
