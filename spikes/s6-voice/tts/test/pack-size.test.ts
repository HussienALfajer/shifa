// Criterion 10: pack size and cost are extrapolated from per-category means of the measured clips
// (no full pack is generated). The ffmpeg image is pinned by digest.
import { describe, expect, it } from 'vitest';
import {
  encodeArgs,
  estimateMonthlyCharacters,
  extrapolatePack,
  FFMPEG_IMAGE,
  FORMATS,
  FULL_PACK,
} from '../scripts/pack-size.ts';
import type { ManifestClip } from '../src/manifest.ts';

function clip(clipId: string, category: ManifestClip['category'], text: string): ManifestClip {
  return {
    clipId,
    category,
    text,
    provider: 'fake',
    voice: 'fake-1',
    file: `${clipId}.wav`,
    sha256: 'a'.repeat(64),
    durationMs: 1000,
    charactersBilled: Array.from(text).length,
    elapsedMs: 0,
    attempts: 1,
    status: 'ok',
  };
}

const CLIPS: ManifestClip[] = [
  clip('chime', 'chime', ''),
  clip('number-001', 'number', 'الرقم واحد'),
  clip('number-111', 'number', 'الرقم مئة وأحد عشر'),
  clip('room-1', 'room', 'إلى العيادة رقم واحد'),
  clip('room-2', 'room', 'إلى العيادة رقم اثنان'),
  clip('name-m01', 'name', 'أَحْمَد'),
  clip('name-f01', 'name', 'فَاطِمَة'),
];

describe('pack size', () => {
  it('pins the ffmpeg image by digest and encodes the planned formats', () => {
    expect(FFMPEG_IMAGE).toMatch(/^[a-z0-9./-]+(:[\w.-]+)?@sha256:[0-9a-f]{64}$/u);
    expect(FORMATS.map((f) => f.id)).toEqual(['opus-24', 'opus-32', 'mp3-48', 'mp3-64']);
    const opus24 = FORMATS[0];
    if (!opus24) throw new Error('no format');
    const args = encodeArgs('/work', 'number-001.wav', opus24);
    expect(args.slice(0, 2)).toEqual(['run', '--rm']);
    expect(args).toContain('--network=none');
    expect(args).toContain(FFMPEG_IMAGE);
    expect(args.join(' ')).toContain('-c:a libopus -b:a 24k');
  });

  it('extrapolates a full 1-999 + rooms pack from per-category means', () => {
    const sizes = new Map<string, number>([
      ['chime', 4000],
      ['number-001', 3000],
      ['number-111', 5000],
      ['room-1', 6000],
      ['room-2', 8000],
      ['name-m01', 2000],
      ['name-f01', 4000],
    ]);
    const result = extrapolatePack(CLIPS, sizes);
    // chime 4000 + 999 × mean(3000, 5000) + FULL_PACK.rooms × mean(6000, 8000)
    expect(FULL_PACK).toEqual({ numbers: 999, rooms: 20 });
    expect(result.packBytes).toBe(4000 + 999 * 4000 + 20 * 7000);
    expect(result.meanNameBytes).toBe(3000);
    expect(result.measuredClips).toBe(7);
  });

  it('estimates characters per clinic per month from the pack, rooms and new names', () => {
    const estimate = estimateMonthlyCharacters(CLIPS, { newPatientsPerMonth: 300 });
    const meanNumber = (10 + 18) / 2;
    const meanRoom = (20 + 21) / 2;
    const meanName = (7 + 8) / 2;
    expect(estimate.packCharacters).toBe(Math.round(999 * meanNumber));
    expect(estimate.roomCharacters).toBe(Math.round(20 * meanRoom));
    expect(estimate.nameCharactersPerMonth).toBe(Math.round(300 * meanName));
  });
});
