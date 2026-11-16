// Criterion 7: the synthetic studies have the planned size and shape, valid tags, the synthetic
// name marker, and are deterministic (same seed, same SHA-256). The 300 MB and 1 GB studies are
// checked by plan here (their pixel bytes); 0.3-S4b generates them for the bench.
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  fileCount,
  generateStudy,
  type Manifest,
  pixelBytes,
  readDicom,
  STUDIES,
  SYNTHETIC_MARKER,
} from '../src/index.ts';

const dirs: string[] = [];
async function fresh(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 's4-gen-'));
  dirs.push(dir);
  return dir;
}
afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const total = (m: Manifest) => m.files.reduce((sum, f) => sum + f.bytes, 0);
const within = (actual: number, target: number, share: number) =>
  Math.abs(actual - target) <= target * share;

describe('study catalogue', () => {
  it('plans every study within ± 5 % of its target size', () => {
    for (const spec of Object.values(STUDIES)) {
      expect(within(pixelBytes(spec), spec.targetBytes, 0.05), spec.name).toBe(true);
    }
  });
});

describe('generated studies', () => {
  it('writes cbct-20-multi: one 16-bit signed CT file per slice, marker, manifest hashes', async () => {
    const dir = await fresh();
    const manifest = await generateStudy('cbct-20-multi', { outDir: dir });
    const spec = STUDIES['cbct-20-multi'];
    expect(manifest.files).toHaveLength(fileCount(spec));
    expect(within(total(manifest), spec.targetBytes, 0.05)).toBe(true);
    expect(new Set(manifest.files.map((f) => f.sopInstanceUid)).size).toBe(manifest.files.length);
    for (const file of [manifest.files[0], manifest.files.at(-1)]) {
      if (!file) throw new Error('empty manifest');
      const bytes = await readFile(join(dir, file.path));
      expect(sha256(bytes)).toBe(file.sha256);
      const ds = readDicom(bytes);
      expect(ds.SOPInstanceUID).toBe(file.sopInstanceUid);
      expect(ds.StudyInstanceUID).toBe(manifest.studyInstanceUid);
      expect(ds.Modality).toBe('CT');
      expect([ds.Rows, ds.Columns]).toEqual([spec.rows, spec.columns]);
      expect([ds.BitsAllocated, ds.BitsStored, ds.PixelRepresentation]).toEqual([16, 16, 1]);
      const name = ds.PatientName as { Alphabetic?: string }[] | string;
      const alphabetic = typeof name === 'string' ? name : (name[0]?.Alphabetic ?? '');
      expect(alphabetic.startsWith(`${SYNTHETIC_MARKER}^`)).toBe(true);
      expect(ds.PatientBirthDate ?? '').toBe('');
    }
  });

  it('writes cbct-20-single as one Enhanced CT multi-frame file', async () => {
    const dir = await fresh();
    const manifest = await generateStudy('cbct-20-single', { outDir: dir });
    const spec = STUDIES['cbct-20-single'];
    expect(manifest.files).toHaveLength(1);
    const [file] = manifest.files;
    if (!file) throw new Error('empty manifest');
    expect(file.frames).toBe(spec.frames);
    expect(within(file.bytes, spec.targetBytes, 0.05)).toBe(true);
    const ds = readDicom(await readFile(join(dir, file.path)));
    expect(Number(ds.NumberOfFrames)).toBe(spec.frames);
    expect(ds.SOPClassUID).toBe('1.2.840.10008.5.1.4.1.1.2.1');
  });

  it('writes the panoramic as one 16-bit DX image', async () => {
    const dir = await fresh();
    const manifest = await generateStudy('pano', { outDir: dir });
    const [file] = manifest.files;
    if (!file) throw new Error('empty manifest');
    const ds = readDicom(await readFile(join(dir, file.path)));
    expect([ds.Rows, ds.Columns, ds.BitsAllocated]).toEqual([1500, 3000, 16]);
    expect(ds.Modality).toBe('PX');
  });

  it('is deterministic: the same seed gives the same hashes, another seed does not', async () => {
    const [a, b, c] = await Promise.all([
      generateStudy('cbct-20-multi', { outDir: await fresh(), seed: 7 }),
      generateStudy('cbct-20-multi', { outDir: await fresh(), seed: 7 }),
      generateStudy('cbct-20-multi', { outDir: await fresh(), seed: 8 }),
    ]);
    expect(b.files.map((f) => f.sha256)).toEqual(a.files.map((f) => f.sha256));
    expect(c.files[0]?.sha256).not.toBe(a.files[0]?.sha256);
  });

  it('with-dicomdir: the DICOMDIR references exactly the image files; extras are listed', async () => {
    const dir = await fresh();
    const manifest = await generateStudy('with-dicomdir', { outDir: dir });
    expect(manifest.extras.sort()).toEqual(['DICOMDIR', 'README.TXT']);
    const dicomdir = readDicom(await readFile(join(dir, 'DICOMDIR')));
    const records = (dicomdir.DirectoryRecordSequence ?? []) as {
      DirectoryRecordType: string;
      ReferencedFileID?: string | string[];
    }[];
    const referenced = records
      .filter((r) => r.DirectoryRecordType === 'IMAGE')
      .map((r) => [r.ReferencedFileID ?? []].flat().join('/'))
      .sort();
    expect(referenced).toEqual(manifest.files.map((f) => f.path).sort());
    const onDisk = await readdir(dir, { recursive: true });
    expect(onDisk).toContain('README.TXT');
  });
});
