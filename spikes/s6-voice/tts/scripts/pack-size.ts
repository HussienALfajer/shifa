// Criterion 10: pack size and cost per voice. Each clip of a manifest is encoded with a pinned
// ffmpeg image (by digest, no network) to Opus 24/32 kbps and MP3 48/64 kbps; a full pack
// (chime, numbers 1-999, rooms) is extrapolated from per-category means, since no full pack is
// generated in the spike. Characters come from the manifest's billed counts.
// CLI: node scripts/pack-size.ts --manifest <manifest.json> [--new-patients 300]
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { type ManifestClip, readManifest } from '../src/manifest.ts';

/** jrottenberg/ffmpeg 7.1 (Alpine, with libopus and libmp3lame), pinned by digest. */
export const FFMPEG_IMAGE =
  'jrottenberg/ffmpeg:7.1-alpine@sha256:8ec1ee1f6a0fcd37c97725827b6b7832795c9596e3439b8da56d7700d61ae778';

export interface Format {
  id: string;
  codec: 'libopus' | 'libmp3lame';
  kbps: number;
  ext: 'opus' | 'mp3';
}

export const FORMATS: Format[] = [
  { id: 'opus-24', codec: 'libopus', kbps: 24, ext: 'opus' },
  { id: 'opus-32', codec: 'libopus', kbps: 32, ext: 'opus' },
  { id: 'mp3-48', codec: 'libmp3lame', kbps: 48, ext: 'mp3' },
  { id: 'mp3-64', codec: 'libmp3lame', kbps: 64, ext: 'mp3' },
];

/** What a clinic's pack holds (ADR-0020): every number 1-999 and up to 20 rooms. */
export const FULL_PACK = { numbers: 999, rooms: 20 } as const;

/** docker arguments that encode one clip of `workDir` into `workDir/out/<format>/`. */
export function encodeArgs(workDir: string, file: string, format: Format): string[] {
  const base = basename(file).replace(/\.[^.]+$/u, '');
  return [
    'run',
    '--rm',
    '--network=none',
    '-v',
    `${workDir}:/work`,
    FFMPEG_IMAGE,
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    `/work/${file}`,
    '-ac',
    '1',
    '-c:a',
    format.codec,
    '-b:a',
    `${String(format.kbps)}k`,
    `/work/out/${format.id}/${base}.${format.ext}`,
  ];
}

const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length);

function categoryMean(
  clips: ManifestClip[],
  category: ManifestClip['category'],
  value: (c: ManifestClip) => number | undefined,
): number {
  return mean(
    clips
      .filter((c) => c.category === category)
      .map(value)
      .filter((x): x is number => x !== undefined),
  );
}

export interface PackEstimate {
  packBytes: number;
  meanNameBytes: number;
  measuredClips: number;
}

/** A full pack from per-category means of the measured clip sizes (bytes per clip id). */
export function extrapolatePack(
  clips: ManifestClip[],
  sizes: ReadonlyMap<string, number>,
): PackEstimate {
  const size = (c: ManifestClip) => sizes.get(c.clipId);
  const chime = sizes.get('chime') ?? 0;
  return {
    packBytes: Math.round(
      chime +
        FULL_PACK.numbers * categoryMean(clips, 'number', size) +
        FULL_PACK.rooms * categoryMean(clips, 'room', size),
    ),
    meanNameBytes: Math.round(categoryMean(clips, 'name', size)),
    measuredClips: clips.filter((c) => sizes.has(c.clipId)).length,
  };
}

export interface CharacterEstimate {
  /** Once per voice (shared by every clinic). */
  packCharacters: number;
  /** Once per clinic. */
  roomCharacters: number;
  /** Every month: one name clip per new patient (VOX-03). */
  nameCharactersPerMonth: number;
}

export function estimateMonthlyCharacters(
  clips: ManifestClip[],
  opts: { newPatientsPerMonth: number },
): CharacterEstimate {
  const chars = (c: ManifestClip) => c.charactersBilled;
  return {
    packCharacters: Math.round(FULL_PACK.numbers * categoryMean(clips, 'number', chars)),
    roomCharacters: Math.round(FULL_PACK.rooms * categoryMean(clips, 'room', chars)),
    nameCharactersPerMonth: Math.round(
      opts.newPatientsPerMonth * categoryMean(clips, 'name', chars),
    ),
  };
}

function encodeAll(manifestFile: string, clips: ManifestClip[]): Map<string, Map<string, number>> {
  const dir = dirname(manifestFile);
  // A throwaway copy is mounted, so the container never writes next to the generated clips.
  const work = mkdtempSync(join(tmpdir(), 's6-pack-size-'));
  const out = new Map<string, Map<string, number>>();
  try {
    const ok = clips.filter((c) => c.status === 'ok');
    for (const clip of ok) copyFileSync(join(dir, clip.file), join(work, basename(clip.file)));
    for (const format of FORMATS) {
      mkdirSync(join(work, 'out', format.id), { recursive: true });
      const sizes = new Map<string, number>();
      for (const clip of ok) {
        const file = basename(clip.file);
        execFileSync('docker', encodeArgs(work, file, format), { stdio: 'inherit' });
        const encoded = join(work, 'out', format.id, file.replace(/\.[^.]+$/u, `.${format.ext}`));
        sizes.set(clip.clipId, statSync(encoded).size);
      }
      out.set(format.id, sizes);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return out;
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      manifest: { type: 'string' },
      'new-patients': { type: 'string', default: '300' },
    },
  });
  if (!values.manifest) throw new Error('usage: pack-size --manifest <manifest.json>');
  const manifest = readManifest(values.manifest);
  const sizes = encodeAll(values.manifest, manifest.clips);
  const lines = [`## ${manifest.header.provider}/${manifest.header.voice}`, ''];
  lines.push(
    '| format | measured clips | full pack (MB) | mean name clip (KB) |',
    '|---|---|---|---|',
  );
  for (const format of FORMATS) {
    const e = extrapolatePack(manifest.clips, sizes.get(format.id) ?? new Map());
    lines.push(
      `| ${format.id} | ${String(e.measuredClips)} | ${(e.packBytes / 1e6).toFixed(2)} | ${(e.meanNameBytes / 1e3).toFixed(1)} |`,
    );
  }
  const chars = estimateMonthlyCharacters(manifest.clips, {
    newPatientsPerMonth: Number(values['new-patients']),
  });
  const ok = manifest.clips.filter((c) => c.status === 'ok' && c.category !== 'chime');
  lines.push(
    '',
    `Characters: pack ${String(chars.packCharacters)} (once per voice), rooms ${String(chars.roomCharacters)} (once per clinic), names ${String(chars.nameCharactersPerMonth)} per month at ${values['new-patients']} new patients.`,
    `Generation time per clip: mean ${mean(ok.map((c) => c.elapsedMs)).toFixed(0)} ms over ${String(ok.length)} clips.`,
    '',
  );
  process.stdout.write(lines.join('\n'));
}
