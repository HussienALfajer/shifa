// One public de-identified dental CBCT case (OD-44): Science Data Bank, DOI
// 10.57760/sciencedb.26465, data licence CC BY 4.0. The DICOM comes in one 23.5 GB ZIP; the
// server honours HTTP ranges, so only this case's entries are read (local header + data),
// inflated and checked against the per-file SHA-256 pins in public-cbct.lock.json. Written to
// the git-ignored .cache/s4/public-cbct/, never committed.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { cacheDir } from './paths.ts';

export interface PublicCbctFile {
  /** Path inside the case folder. */
  path: string;
  sha256: string;
  bytes: number;
  /** Offset of the entry's local header in the ZIP. */
  zipOffset: number;
  compressedBytes: number;
  /** 0 stored, 8 deflate. */
  method: number;
}

export interface PublicCbctLock {
  doi: string;
  licence: string;
  attribution: string;
  url: string;
  zipBytes: number;
  case: string;
  files: PublicCbctFile[];
}

const LOCK_PATH = new URL('../public-cbct.lock.json', import.meta.url);

export const PUBLIC_CBCT_LOCK: PublicCbctLock = existsSync(LOCK_PATH)
  ? (JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as PublicCbctLock)
  : {
      doi: '10.57760/sciencedb.26465',
      licence: 'CC BY 4.0',
      attribution: '',
      url: '',
      zipBytes: 0,
      case: '',
      files: [],
    };

async function range(url: string, start: number, end: number): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { range: `bytes=${String(start)}-${String(end)}` } });
      const total = /\/(\d+)$/.exec(res.headers.get('content-range') ?? '')?.[1];
      if (res.status !== 206) throw new Error(`range request: HTTP ${String(res.status)}`);
      if (Number(total) !== PUBLIC_CBCT_LOCK.zipBytes && PUBLIC_CBCT_LOCK.zipBytes !== 0) {
        throw new Error('the ZIP on the server is not the pinned one (size changed)');
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (attempt >= 4 || String(error).includes('pinned')) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

/** The bytes of one entry, read through its local header. */
async function entry(url: string, file: Omit<PublicCbctFile, 'sha256' | 'path'>): Promise<Buffer> {
  const header = await range(url, file.zipOffset, file.zipOffset + 29);
  if (header.readUInt32LE(0) !== 0x04034b50) throw new Error('not a ZIP local header');
  const dataStart = file.zipOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  const data = await range(url, dataStart, dataStart + file.compressedBytes - 1);
  const bytes = file.method === 8 ? inflateRawSync(data) : data;
  if (bytes.byteLength !== file.bytes) throw new Error('entry size does not match');
  return bytes;
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

async function inBatches<T>(items: readonly T[], size: number, work: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size)
    await Promise.all(items.slice(i, i + size).map(work));
}

export async function fetchPublicCbct(options: { outDir?: string } = {}): Promise<{ dir: string }> {
  const lock = PUBLIC_CBCT_LOCK;
  if (lock.files.length === 0)
    throw new Error('public-cbct.lock.json has no files: run the pin first');
  const dir = options.outDir ?? cacheDir('public-cbct');
  await inBatches(lock.files, 8, async (file) => {
    const target = join(dir, file.path);
    if (existsSync(target) && sha256(await readFile(target)) === file.sha256) return;
    const bytes = await entry(lock.url, file);
    if (sha256(bytes) !== file.sha256) throw new Error(`SHA-256 mismatch: ${file.path}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  });
  await writeFile(
    join(dir, 'SOURCE.md'),
    `# Public CBCT sample (never commit)\n\nDOI: https://doi.org/${lock.doi}\nLicence: ${lock.licence}\nCase: ${lock.case}\n\n${lock.attribution}\n`,
  );
  return { dir };
}

/**
 * Writes public-cbct.lock.json for one case: reads the ZIP's central directory (ZIP64), keeps
 * the case's entries, downloads each once and records its SHA-256. Run by hand, reviewed, and
 * committed; fetchPublicCbct then refuses anything else.
 */
export async function pinPublicCbct(options: {
  url: string;
  casePrefix: string;
  attribution: string;
}): Promise<PublicCbctLock> {
  const head = await fetch(options.url, { headers: { range: 'bytes=0-0' } });
  const zipBytes = Number(/\/(\d+)$/.exec(head.headers.get('content-range') ?? '')?.[1]);
  await head.arrayBuffer();
  const tail = await range(options.url, zipBytes - 65_536, zipBytes - 1);
  const eocd64 = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x06]));
  if (eocd64 === -1) throw new Error('ZIP64 end of central directory not found');
  const cdSize = Number(tail.readBigUInt64LE(eocd64 + 40));
  const cdOffset = Number(tail.readBigUInt64LE(eocd64 + 48));
  const cd = await range(options.url, cdOffset, cdOffset + cdSize - 1);
  const files: PublicCbctFile[] = [];
  for (let p = 0; p + 46 <= cd.length && cd.readUInt32LE(p) === 0x02014b50; ) {
    const method = cd.readUInt16LE(p + 10);
    let compressed = cd.readUInt32LE(p + 20);
    let size = cd.readUInt32LE(p + 24);
    const nameLength = cd.readUInt16LE(p + 28);
    const extraLength = cd.readUInt16LE(p + 30);
    const commentLength = cd.readUInt16LE(p + 32);
    let offset = cd.readUInt32LE(p + 42);
    const name = cd.subarray(p + 46, p + 46 + nameLength).toString('utf8');
    // ZIP64 extra field: 64-bit values replace the 0xffffffff ones, in this order.
    for (let e = p + 46 + nameLength; e < p + 46 + nameLength + extraLength; ) {
      const id = cd.readUInt16LE(e);
      const length = cd.readUInt16LE(e + 2);
      if (id === 1) {
        let q = e + 4;
        if (size === 0xffffffff) [size, q] = [Number(cd.readBigUInt64LE(q)), q + 8];
        if (compressed === 0xffffffff) [compressed, q] = [Number(cd.readBigUInt64LE(q)), q + 8];
        if (offset === 0xffffffff) offset = Number(cd.readBigUInt64LE(q));
      }
      e += 4 + length;
    }
    if (name.startsWith(options.casePrefix) && !name.endsWith('/')) {
      files.push({
        path: name.slice(options.casePrefix.length),
        sha256: '',
        bytes: size,
        zipOffset: offset,
        compressedBytes: compressed,
        method,
      });
    }
    p += 46 + nameLength + extraLength + commentLength;
  }
  if (files.length === 0) throw new Error(`no entries under ${options.casePrefix}`);
  await inBatches(files, 8, async (file) => {
    file.sha256 = sha256(await entry(options.url, file));
  });
  files.sort((a, b) => a.path.localeCompare(b.path));
  const lock: PublicCbctLock = {
    doi: '10.57760/sciencedb.26465',
    licence: 'CC BY 4.0',
    attribution: options.attribution,
    url: options.url,
    zipBytes,
    case: options.casePrefix,
    files,
  };
  await writeFile(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
  return lock;
}
