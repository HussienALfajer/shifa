// The synthetic study catalogue (criterion 7, OD-44). Sizes are exact: 16-bit voxels, so a
// volume is rows × columns × slices × 2 bytes plus a few kilobytes of tags per file.

export type StudyName =
  | 'cbct-20-multi'
  | 'cbct-20-single'
  | 'cbct-300-multi'
  | 'cbct-300-single'
  | 'cbct-1g-multi'
  | 'pano'
  | 'with-dicomdir';

export type StudyKind = 'cbct-multi' | 'cbct-single' | 'pano';

export interface StudySpec {
  name: StudyName;
  kind: StudyKind;
  rows: number;
  columns: number;
  /** Slices (CBCT) or 1 (panoramic). */
  frames: number;
  /** Target size in bytes for the ± 5 % check. */
  targetBytes: number;
  /** Adds a DICOMDIR and one non-DICOM file next to the images. */
  dicomdir?: boolean;
}

const MB = 1_000_000;

export const STUDIES: Readonly<Record<StudyName, StudySpec>> = {
  'cbct-20-multi': {
    name: 'cbct-20-multi',
    kind: 'cbct-multi',
    rows: 256,
    columns: 256,
    frames: 152,
    targetBytes: 20 * MB,
  },
  'cbct-20-single': {
    name: 'cbct-20-single',
    kind: 'cbct-single',
    rows: 256,
    columns: 256,
    frames: 152,
    targetBytes: 20 * MB,
  },
  'cbct-300-multi': {
    name: 'cbct-300-multi',
    kind: 'cbct-multi',
    rows: 512,
    columns: 512,
    frames: 576,
    targetBytes: 300 * MB,
  },
  'cbct-300-single': {
    name: 'cbct-300-single',
    kind: 'cbct-single',
    rows: 512,
    columns: 512,
    frames: 576,
    targetBytes: 300 * MB,
  },
  'cbct-1g-multi': {
    name: 'cbct-1g-multi',
    kind: 'cbct-multi',
    rows: 800,
    columns: 800,
    frames: 800,
    targetBytes: 1000 * MB,
  },
  pano: { name: 'pano', kind: 'pano', rows: 1500, columns: 3000, frames: 1, targetBytes: 9 * MB },
  'with-dicomdir': {
    name: 'with-dicomdir',
    kind: 'cbct-multi',
    rows: 256,
    columns: 256,
    frames: 152,
    targetBytes: 20 * MB,
    dicomdir: true,
  },
};

/** Pixel bytes of a study (what the ± 5 % size check is about). */
export const pixelBytes = (spec: StudySpec): number => spec.rows * spec.columns * spec.frames * 2;

/** Number of DICOM image files the study writes. */
export const fileCount = (spec: StudySpec): number =>
  spec.kind === 'cbct-multi' ? spec.frames : 1;
