// Criterion 9: measures the audible gaps in a recording of the display's audio output (the
// emulator's output captured on the host). A gap is a run of samples below the threshold with sound
// on both sides; leading and trailing silence are not gaps. 16-bit PCM or 32-bit float WAV, any
// channel count (the loudest channel counts).
// CLI: node scripts/measure-gaps.ts <recording.wav> [--threshold-db=-50] [--min-gap-ms=1]
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

export interface Gap {
  startMs: number;
  ms: number;
}

export interface GapReport {
  sampleRate: number;
  durationMs: number;
  gaps: Gap[];
  longestMs: number;
}

export interface GapOptions {
  /** Level under which a sample counts as silence; default -50 dBFS. */
  thresholdDb?: number;
  /** Shorter runs (zero crossings, fades) are not gaps; default 1 ms. */
  minGapMs?: number;
}

interface Pcm {
  sampleRate: number;
  channels: number;
  frames: number;
  /** Absolute peak across channels per frame, 0..1. */
  level: (frame: number) => number;
}

function readPcm(bytes: Uint8Array): Pcm {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(...Array.from(bytes.subarray(o, o + 4)));
  if (bytes.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let offset = 12;
  let format = 0;
  let channels = 0;
  let sampleRate = 0;
  let bits = 0;
  while (offset + 8 <= bytes.byteLength) {
    const id = tag(offset);
    const size = v.getUint32(offset + 4, true);
    if (id === 'fmt ') {
      format = v.getUint16(offset + 8, true);
      channels = v.getUint16(offset + 10, true);
      sampleRate = v.getUint32(offset + 12, true);
      bits = v.getUint16(offset + 22, true);
      // WAVE_FORMAT_EXTENSIBLE: the real format is the first two bytes of the sub-format GUID.
      if (format === 0xfffe && size >= 26) format = v.getUint16(offset + 32, true);
    } else if (id === 'data') {
      const start = offset + 8;
      const available = bytes.byteLength - start;
      const dataBytes = size === 0 || size > available ? available : size;
      const width = bits / 8;
      const frames = Math.floor(dataBytes / (width * channels));
      let read: (at: number) => number;
      if (format === 1 && bits === 16) read = (at) => v.getInt16(at, true) / 32768;
      else if (format === 3 && bits === 32) read = (at) => v.getFloat32(at, true);
      else throw new Error(`unsupported WAV format ${String(format)}/${String(bits)}-bit`);
      return {
        sampleRate,
        channels,
        frames,
        level: (frame) => {
          let peak = 0;
          for (let c = 0; c < channels; c += 1) {
            peak = Math.max(peak, Math.abs(read(start + (frame * channels + c) * width)));
          }
          return peak;
        },
      };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error('no data chunk');
}

export function measureGaps(bytes: Uint8Array, opts: GapOptions = {}): GapReport {
  const pcm = readPcm(bytes);
  const threshold = 10 ** ((opts.thresholdDb ?? -50) / 20);
  const minFrames = Math.max(1, Math.round(((opts.minGapMs ?? 1) / 1000) * pcm.sampleRate));
  const toMs = (frames: number) => (frames / pcm.sampleRate) * 1000;
  const gaps: Gap[] = [];
  let heardSound = false;
  let runStart = -1;
  for (let f = 0; f < pcm.frames; f += 1) {
    const loud = pcm.level(f) >= threshold;
    if (!loud) {
      if (runStart < 0) runStart = f;
      continue;
    }
    if (runStart >= 0 && heardSound && f - runStart >= minFrames) {
      gaps.push({ startMs: toMs(runStart), ms: toMs(f - runStart) });
    }
    runStart = -1;
    heardSound = true;
  }
  return {
    sampleRate: pcm.sampleRate,
    durationMs: toMs(pcm.frames),
    gaps,
    longestMs: gaps.reduce((m, g) => Math.max(m, g.ms), 0),
  };
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'threshold-db': { type: 'string', default: '-50' },
      'min-gap-ms': { type: 'string', default: '1' },
    },
  });
  const file = positionals[0];
  if (!file) throw new Error('usage: measure-gaps <recording.wav> [--threshold-db=-50]');
  const thresholdDb = Number(values['threshold-db']);
  const minGapMs = Number(values['min-gap-ms']);
  if (!Number.isFinite(thresholdDb) || thresholdDb >= 0) {
    throw new Error('--threshold-db must be a negative number, e.g. --threshold-db=-50');
  }
  if (!Number.isFinite(minGapMs) || minGapMs <= 0) {
    throw new Error('--min-gap-ms must be a positive number');
  }
  const report = measureGaps(new Uint8Array(readFileSync(file)), { thresholdDb, minGapMs });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
