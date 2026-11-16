// Folder → upload manifest. With a DICOMDIR, only the files it references are uploaded (the
// DICOMDIR and everything else is listed as skipped); without one, files lacking the DICM
// preamble are skipped. Each file's SHA-256 is computed incrementally (4 MiB slices), so a
// 300 MB single file is never held in memory.
import dicomParser from 'dicom-parser';
import { createSHA256 } from 'hash-wasm';

export interface Item {
  file: File;
  /** Path inside the selected folder, forward slashes (display and manifest only). */
  path: string;
  size: number;
  sha256: string;
}

const SLICE = 4 * 1024 * 1024;

const relative = (file: File) => {
  const parts = (file.webkitRelativePath || file.name).split('/');
  return parts.length > 1 ? parts.slice(1).join('/') : (parts[0] ?? file.name);
};

const bytes = async (file: File, start: number, end: number) =>
  new Uint8Array(await file.slice(start, end).arrayBuffer());

export async function isDicom(file: File): Promise<boolean> {
  if (file.size < 132) return false;
  const marker = await bytes(file, 128, 132);
  return String.fromCharCode(...marker) === 'DICM';
}

export async function sha256(file: File): Promise<string> {
  const hasher = await createSHA256();
  hasher.init();
  for (let offset = 0; offset < file.size; offset += SLICE) {
    hasher.update(await bytes(file, offset, Math.min(offset + SLICE, file.size)));
  }
  return hasher.digest('hex');
}

/** Paths a DICOMDIR references (ReferencedFileID, relative to the DICOMDIR's folder). */
async function referenced(dicomdir: File, base: string): Promise<Set<string>> {
  const data = dicomParser.parseDicom(await bytes(dicomdir, 0, dicomdir.size));
  const records = data.elements['x00041220']?.items ?? [];
  const paths = new Set<string>();
  for (const record of records) {
    const id = record.dataSet?.string('x00041500');
    if (id) paths.add(`${base}${id.split('\\').join('/')}`.toUpperCase());
  }
  return paths;
}

export async function buildManifest(
  files: readonly File[],
): Promise<{ items: Item[]; skipped: string[] }> {
  const all = files.map((file) => ({ file, path: relative(file) }));
  const dir = all.find((f) => f.path.split('/').at(-1)?.toUpperCase() === 'DICOMDIR');
  const keep: { file: File; path: string }[] = [];
  const skipped: string[] = [];
  if (dir) {
    const base = dir.path.includes('/') ? dir.path.slice(0, dir.path.lastIndexOf('/') + 1) : '';
    const refs = await referenced(dir.file, base);
    for (const f of all) {
      if (refs.has(f.path.toUpperCase())) keep.push(f);
      else skipped.push(f.path);
    }
  } else {
    for (const f of all) {
      if (await isDicom(f.file)) keep.push(f);
      else skipped.push(f.path);
    }
  }
  const items: Item[] = [];
  for (const f of keep) {
    items.push({ file: f.file, path: f.path, size: f.file.size, sha256: await sha256(f.file) });
  }
  return { items, skipped };
}
