// A small deterministic WAV writer and reader (16-bit PCM mono): the chime and the fake provider's
// tones, and duration checks on every provider's lossless output.

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataBytes: number;
  durationMs: number;
}

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) v.setUint8(offset + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, 'data');
  v.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    v.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return new Uint8Array(buf);
}

/** Walks the RIFF chunks (vendors may add LIST or other chunks before `data`). */
export function parseWav(bytes: Uint8Array): WavInfo {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) =>
    String.fromCharCode(...Array.from(bytes.subarray(offset, offset + 4)));
  if (bytes.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let offset = 12;
  let fmt: { channels: number; sampleRate: number; bitsPerSample: number } | undefined;
  while (offset + 8 <= bytes.byteLength) {
    const id = tag(offset);
    const size = v.getUint32(offset + 4, true);
    if (id === 'fmt ') {
      fmt = {
        channels: v.getUint16(offset + 10, true),
        sampleRate: v.getUint32(offset + 12, true),
        bitsPerSample: v.getUint16(offset + 22, true),
      };
    } else if (id === 'data') {
      if (!fmt) throw new Error('data chunk before fmt chunk');
      // Streaming writers may leave 0 or 0xFFFFFFFF as the size: use what is there.
      const available = bytes.byteLength - offset - 8;
      const dataBytes = size === 0 || size > available ? available : size;
      const bytesPerSecond = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8);
      return { ...fmt, dataBytes, durationMs: (dataBytes / bytesPerSecond) * 1000 };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error('no data chunk');
}

export interface ToneOptions {
  hz: number;
  ms: number;
  sampleRate: number;
  amplitude?: number;
  /** Linear fade in and out, to avoid clicks. */
  fadeMs?: number;
}

export function toneSamples({
  hz,
  ms,
  sampleRate,
  amplitude = 0.3,
  fadeMs = 5,
}: ToneOptions): Float32Array {
  const n = Math.round((ms / 1000) * sampleRate);
  const fade = Math.max(1, Math.round((fadeMs / 1000) * sampleRate));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const env = Math.min(1, i / fade, (n - 1 - i) / fade);
    out[i] = amplitude * env * Math.sin((2 * Math.PI * hz * i) / sampleRate);
  }
  return out;
}

export function concatSamples(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
