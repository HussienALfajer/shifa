// DICOM Part 10 writer for the synthetic studies (criterion 7, OD-44): Explicit VR Little
// Endian, uncompressed. CBCT as one CT file per slice or one Enhanced CT multi-frame file;
// the panoramic as one DX image. Identity tags come from @shifa/testing's synthetic Arabic names
// with the S4SYN marker; no birth date. Same seed, same bytes.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRandom, fullName, generatePersonName } from '@shifa/testing';
import { dcmjs } from './dcmjs.ts';
import { dcmtk } from './dcmtk.ts';
import { cacheDir } from './paths.ts';
import { cbctSlice, panoImage } from './phantom.ts';
import { STUDIES, type StudyName, type StudySpec } from './studies.ts';

/** Every synthetic PatientName starts with this, so a log scan can find leaks. */
export const SYNTHETIC_MARKER = 'S4SYN';

const CT = '1.2.840.10008.5.1.4.1.1.2';
const ENHANCED_CT = '1.2.840.10008.5.1.4.1.1.2.1';
const DX_PRESENTATION = '1.2.840.10008.5.1.4.1.1.1.1';
const EXPLICIT_LE = '1.2.840.10008.1.2.1';
const SPACING_MM = 0.3;

export interface ManifestFile {
  /** Path relative to the study directory, with forward slashes. */
  path: string;
  sha256: string;
  bytes: number;
  sopInstanceUid: string;
  seriesInstanceUid: string;
  frames: number;
}

export interface Manifest {
  study: StudyName;
  seed: number;
  studyInstanceUid: string;
  files: ManifestFile[];
  /** Files in the folder that are not DICOM images (DICOMDIR, the non-DICOM file). */
  extras: string[];
}

/** A naturalised dataset (dcmjs): keyword → value; the tags the spike reads are typed. */
export interface DicomDataset {
  [keyword: string]: unknown;
  SOPClassUID?: string;
  SOPInstanceUID?: string;
  StudyInstanceUID?: string;
  SeriesInstanceUID?: string;
  Modality?: string;
  Rows?: number;
  Columns?: number;
  BitsAllocated?: number;
  BitsStored?: number;
  PixelRepresentation?: number;
  NumberOfFrames?: number | string;
  PatientName?: string | { Alphabetic?: string }[];
  PatientBirthDate?: string;
  DirectoryRecordSequence?: unknown[];
}

/** A deterministic 2.25 UID (UUID-derived form) from the seed and a label. */
const uid = (seed: number, label: string) =>
  `2.25.${BigInt(
    `0x${createHash('sha256')
      .update(`${String(seed)}:${label}`)
      .digest('hex')
      .slice(0, 30)}`,
  ).toString()}`;

function write(meta: Record<string, unknown>, dataset: Record<string, unknown>): Buffer {
  const { DicomDict, DicomMetaDictionary } = dcmjs.data;
  const dict = new DicomDict(DicomMetaDictionary.denaturalizeDataset(meta));
  dict.dict = DicomMetaDictionary.denaturalizeDataset(dataset);
  return Buffer.from(dict.write());
}

export function readDicom(bytes: Uint8Array): DicomDataset {
  const copy = new Uint8Array(bytes).buffer;
  const message = dcmjs.data.DicomMessage.readFile(copy, { ignoreErrors: true });
  return dcmjs.data.DicomMetaDictionary.naturalizeDataset(message.dict);
}

function identity(spec: StudySpec, seed: number) {
  const random = createRandom(seed).fork(spec.name);
  const sex = random.chance(0.5) ? 'female' : 'male';
  const name = fullName(generatePersonName(random, { sex, adult: true, region: 'aleppo' }));
  return {
    SpecificCharacterSet: 'ISO_IR 192',
    PatientName: [{ Alphabetic: `${SYNTHETIC_MARKER}^${name}` }],
    PatientID: `${SYNTHETIC_MARKER}-${String(random.int(1000, 9999))}`,
    PatientBirthDate: '',
    PatientSex: sex === 'female' ? 'F' : 'M',
    StudyInstanceUID: uid(seed, `${spec.name}:study`),
    // Dates stay empty (type 2): the PHI check counts any real-looking date.
    StudyDate: '',
    StudyTime: '',
    StudyID: '1',
    AccessionNumber: '',
    ReferringPhysicianName: '',
    Manufacturer: 'Shifa imaging spike (synthetic)',
    SeriesInstanceUID: uid(seed, `${spec.name}:series`),
    SeriesNumber: 1,
  };
}

const metaFor = (sopClass: string, sopInstance: string, seed: number) => ({
  FileMetaInformationVersion: new Uint8Array([0, 1]).buffer,
  MediaStorageSOPClassUID: sopClass,
  MediaStorageSOPInstanceUID: sopInstance,
  TransferSyntaxUID: EXPLICIT_LE,
  ImplementationClassUID: uid(seed, 'implementation'),
  ImplementationVersionName: 'S4GEN',
});

const pixelModule = (spec: StudySpec, signed: boolean) => ({
  SamplesPerPixel: 1,
  PhotometricInterpretation: 'MONOCHROME2',
  Rows: spec.rows,
  Columns: spec.columns,
  BitsAllocated: 16,
  BitsStored: 16,
  HighBit: 15,
  PixelRepresentation: signed ? 1 : 0,
});

const slicePosition = (spec: StudySpec, z: number) => [
  (-spec.columns * SPACING_MM) / 2,
  (-spec.rows * SPACING_MM) / 2,
  z * SPACING_MM,
];

/** The files of a study as (relative path, bytes, frames); generated lazily, one at a time. */
function* studyFiles(
  spec: StudySpec,
  seed: number,
): Generator<{ path: string; data: Buffer; sop: string; frames: number }> {
  const id = identity(spec, seed);
  const frameOfReference = uid(seed, `${spec.name}:for`);
  const fileId = (n: number) => `DICOM/I${String(n).padStart(7, '0')}`;
  if (spec.kind === 'cbct-multi') {
    for (let z = 0; z < spec.frames; z += 1) {
      const sop = uid(seed, `${spec.name}:instance:${String(z)}`);
      const pixels = cbctSlice(spec.rows, spec.columns, z, spec.frames, seed + z);
      const data = write(metaFor(CT, sop, seed), {
        ...id,
        ImageType: ['ORIGINAL', 'PRIMARY', 'AXIAL'],
        SOPClassUID: CT,
        SOPInstanceUID: sop,
        Modality: 'CT',
        FrameOfReferenceUID: frameOfReference,
        PositionReferenceIndicator: '',
        InstanceNumber: z + 1,
        ImagePositionPatient: slicePosition(spec, z),
        ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
        SliceThickness: SPACING_MM,
        PixelSpacing: [SPACING_MM, SPACING_MM],
        KVP: 90,
        ...pixelModule(spec, true),
        RescaleIntercept: 0,
        RescaleSlope: 1,
        RescaleType: 'HU',
        WindowCenter: 400,
        WindowWidth: 2000,
        PixelData: [pixels.buffer],
      });
      yield { path: fileId(z + 1), data, sop, frames: 1 };
    }
  } else if (spec.kind === 'cbct-single') {
    const sop = uid(seed, `${spec.name}:instance:0`);
    const frameBytes = spec.rows * spec.columns * 2;
    const all = new Uint8Array(frameBytes * spec.frames);
    for (let z = 0; z < spec.frames; z += 1) {
      const slice = cbctSlice(spec.rows, spec.columns, z, spec.frames, seed + z);
      all.set(new Uint8Array(slice.buffer), z * frameBytes);
    }
    const data = write(metaFor(ENHANCED_CT, sop, seed), {
      ...id,
      ImageType: ['ORIGINAL', 'PRIMARY', 'AXIAL', 'NONE'],
      SOPClassUID: ENHANCED_CT,
      SOPInstanceUID: sop,
      Modality: 'CT',
      FrameOfReferenceUID: frameOfReference,
      PositionReferenceIndicator: '',
      InstanceNumber: 1,
      ContentDate: '',
      ContentTime: '',
      NumberOfFrames: spec.frames,
      ...pixelModule(spec, true),
      SharedFunctionalGroupsSequence: [
        {
          PixelMeasuresSequence: [
            { PixelSpacing: [SPACING_MM, SPACING_MM], SliceThickness: SPACING_MM },
          ],
          PlaneOrientationSequence: [{ ImageOrientationPatient: [1, 0, 0, 0, 1, 0] }],
          PixelValueTransformationSequence: [
            { RescaleIntercept: 0, RescaleSlope: 1, RescaleType: 'HU' },
          ],
          FrameVOILUTSequence: [{ WindowCenter: 400, WindowWidth: 2000 }],
        },
      ],
      PerFrameFunctionalGroupsSequence: Array.from({ length: spec.frames }, (_, z) => ({
        PlanePositionSequence: [{ ImagePositionPatient: slicePosition(spec, z) }],
        FrameContentSequence: [{ StackID: '1', InStackPositionNumber: z + 1 }],
      })),
      PixelData: [all.buffer],
    });
    yield { path: fileId(1), data, sop, frames: spec.frames };
  } else {
    const sop = uid(seed, `${spec.name}:instance:0`);
    const data = write(metaFor(DX_PRESENTATION, sop, seed), {
      ...id,
      ImageType: ['ORIGINAL', 'PRIMARY'],
      SOPClassUID: DX_PRESENTATION,
      SOPInstanceUID: sop,
      Modality: 'PX',
      PresentationIntentType: 'FOR PRESENTATION',
      InstanceNumber: 1,
      ImagerPixelSpacing: [0.1, 0.1],
      PixelSpacing: [0.1, 0.1],
      ...pixelModule(spec, false),
      WindowCenter: 20_000,
      WindowWidth: 40_000,
      PixelData: [panoImage(spec.rows, spec.columns, seed).buffer],
    });
    yield { path: fileId(1), data, sop, frames: 1 };
  }
}

export async function generateStudy(
  name: StudyName,
  options: { outDir: string; seed?: number },
): Promise<Manifest> {
  const spec = STUDIES[name];
  const seed = options.seed ?? 1;
  const manifest: Manifest = {
    study: name,
    seed,
    studyInstanceUid: uid(seed, `${name}:study`),
    files: [],
    extras: [],
  };
  for (const file of studyFiles(spec, seed)) {
    const target = join(options.outDir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.data);
    manifest.files.push({
      path: file.path,
      sha256: createHash('sha256').update(file.data).digest('hex'),
      bytes: file.data.byteLength,
      sopInstanceUid: file.sop,
      seriesInstanceUid: uid(seed, `${name}:series`),
      frames: file.frames,
    });
  }
  if (spec.dicomdir) {
    // dcmmkdir (general-purpose profile) over the image files; then one non-DICOM file.
    await dcmtk(options.outDir, ['dcmmkdir', '--invent', '+r', '+D', 'DICOMDIR', 'DICOM']);
    await writeFile(join(options.outDir, 'README.TXT'), 'Synthetic study for the imaging spike.\n');
    manifest.extras.push('DICOMDIR', 'README.TXT');
  }
  return manifest;
}

const pending = new Map<string, Promise<{ dir: string; manifest: Manifest }>>();

/** Hash of the generator's own sources: a code change makes a new cache entry. */
const GENERATOR_HASH = (() => {
  const hash = createHash('sha256');
  for (const file of ['dicom.ts', 'phantom.ts', 'studies.ts']) {
    hash.update(readFileSync(new URL(`./${file}`, import.meta.url)));
  }
  return hash.digest('hex').slice(0, 12);
})();

/** The manifest of a published study whose files are all present at their sizes, or undefined. */
async function intact(dir: string): Promise<Manifest | undefined> {
  const manifestPath = join(dir, 'manifest.json');
  if (!existsSync(manifestPath)) return undefined;
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
  const sizes = await Promise.all(
    manifest.files.map((f) =>
      stat(join(dir, f.path)).then(
        (s) => s.size,
        () => -1,
      ),
    ),
  );
  return sizes.every((size, i) => size === manifest.files[i]?.bytes) ? manifest : undefined;
}

/** A lock shared by every process on this machine: an atomic mkdir; a stale one (30 min) is broken. */
async function withLock<T>(path: string, work: () => Promise<T>): Promise<T> {
  const lock = `${path}.lock`;
  await mkdir(dirname(lock), { recursive: true });
  for (;;) {
    try {
      await mkdir(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const age = await stat(lock).then(
        (s) => Date.now() - s.mtimeMs,
        () => 0,
      );
      if (age > 30 * 60_000) await rm(lock, { recursive: true, force: true });
      else await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  try {
    return await work();
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}

/**
 * The study under `.cache/s4/studies/<name>-<seed>-<generator hash>/`, generated once and
 * reused while every file is intact. Checking, generating and publishing happen under a lock
 * shared by all processes, and a published directory is only set aside after it was found
 * damaged under that lock, so a reader of an intact study never loses it.
 */
export function ensureStudy(
  name: StudyName,
  options: { seed?: number } = {},
): Promise<{ dir: string; manifest: Manifest }> {
  const seed = options.seed ?? 1;
  const key = `${name}-${String(seed)}-${GENERATOR_HASH}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const work = (async () => {
    const dir = cacheDir('studies', key);
    const ready = await intact(dir);
    if (ready) return { dir, manifest: ready };
    return withLock(dir, async () => {
      // Another process may have published it while this one waited for the lock.
      const published = await intact(dir);
      if (published) return { dir, manifest: published };
      const temp = `${dir}.tmp-${String(process.pid)}`;
      await rm(temp, { recursive: true, force: true });
      await mkdir(temp, { recursive: true });
      const manifest = await generateStudy(name, { outDir: temp, seed });
      await writeFile(join(temp, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
      // Damaged (checked under the lock): set it aside rather than delete it in place.
      if (existsSync(dir)) await rename(dir, `${dir}.stale-${String(Date.now())}`);
      await rename(temp, dir);
      return { dir, manifest };
    });
  })();
  pending.set(key, work);
  // A failure is not cached: the next call tries again.
  work.catch(() => pending.delete(key));
  return work;
}
