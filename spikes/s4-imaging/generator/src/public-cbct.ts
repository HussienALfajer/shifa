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

/** A path inside the case folder: plain segments only, so nothing is written outside it. */
const SAFE_PATH = /^(?!.*(^|\/)\.\.?(\/|$))[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;
function safe(path: string): string {
  assertSafePath(path);
  return path;
}
function assertSafePath(path: string): void {
  if (!SAFE_PATH.test(path)) throw new Error('unsafe entry path in the ZIP or the lock');
}

/** Bytes start…end of the ZIP; refuses a ZIP whose total size is not `zipBytes`. */
async function range(url: string, start: number, end: number, zipBytes: number): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { range: `bytes=${String(start)}-${String(end)}` },
        // 32 MB at the server's ~170 KB/s takes about 3 minutes.
        signal: AbortSignal.timeout(15 * 60_000),
      });
      const total = /\/(\d+)$/.exec(res.headers.get('content-range') ?? '')?.[1];
      if (res.status !== 206) throw new Error(`range request: HTTP ${String(res.status)}`);
      if (Number(total) !== zipBytes) {
        throw new Error('the ZIP on the server is not the pinned one (size changed)');
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      // The server rate-limits (HTTP 429): back off for minutes, not seconds.
      if (attempt >= 8 || String(error).includes('pinned')) throw error;
      const wait = String(error).includes('429') ? 60_000 * attempt : 5_000 * attempt;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

const CHUNK = 32 * 1024 * 1024;

/**
 * Every entry's bytes from one contiguous span of the ZIP, read in 32 MB ranges one after the
 * other (a request per entry trips the server's rate limit). The case's entries sit together
 * in the archive, so the span is barely larger than the case.
 */
async function entries(
  url: string,
  files: readonly Omit<PublicCbctFile, 'sha256' | 'path'>[],
  zipBytes: number,
): Promise<Buffer[]> {
  const start = Math.min(...files.map((f) => f.zipOffset));
  // Local headers may carry more extra bytes than the central directory: allow 64 KB.
  const end = Math.max(...files.map((f) => f.zipOffset + f.compressedBytes)) + 65_536;
  const parts: Buffer[] = [];
  for (let from = start; from < end; from += CHUNK) {
    parts.push(await range(url, from, Math.min(end, from + CHUNK) - 1, zipBytes));
  }
  const span = Buffer.concat(parts);
  return files.map((file) => {
    const at = file.zipOffset - start;
    if (span.readUInt32LE(at) !== 0x04034b50) throw new Error('not a ZIP local header');
    const dataStart = at + 30 + span.readUInt16LE(at + 26) + span.readUInt16LE(at + 28);
    const data = span.subarray(dataStart, dataStart + file.compressedBytes);
    // Capped at the pinned size: a hostile server cannot inflate past it.
    const bytes =
      file.method === 8
        ? inflateRawSync(data, { maxOutputLength: Math.max(1, file.bytes) })
        : Buffer.from(data);
    if (bytes.byteLength !== file.bytes) throw new Error('entry size does not match');
    return bytes;
  });
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export async function fetchPublicCbct(options: { outDir?: string } = {}): Promise<{ dir: string }> {
  const lock = PUBLIC_CBCT_LOCK;
  if (lock.files.length === 0)
    throw new Error('public-cbct.lock.json has no files: run the pin first');
  const dir = options.outDir ?? cacheDir('public-cbct');
  const missing: PublicCbctFile[] = [];
  for (const file of lock.files) {
    assertSafePath(file.path);
    const target = join(dir, file.path);
    if (!existsSync(target) || sha256(await readFile(target)) !== file.sha256) missing.push(file);
  }
  if (missing.length > 0) {
    const bytes = await entries(lock.url, missing, lock.zipBytes);
    for (const [i, file] of missing.entries()) {
      const data = bytes[i] ?? Buffer.alloc(0);
      if (sha256(data) !== file.sha256) throw new Error(`SHA-256 mismatch: ${file.path}`);
      const target = join(dir, file.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
    }
  }
  await writeFile(
    join(dir, 'SOURCE.md'),
    `# Public CBCT sample (never commit)\n\nDOI: https://doi.org/${lock.doi}\nLicence: ${lock.licence}\nCase: ${lock.case}\n\n${lock.attribution}\n`,
  );
  return { dir };
}

/**
 * Writes public-cbct.lock.json for one case: reads the ZIP's central directory (ZIP64), keeps
 * the case's entries, downloads them in one span and records each SHA-256. Run by hand, reviewed, and
 * committed; fetchPublicCbct then refuses anything else.
 */
export async function pinPublicCbct(options: {
  url: string;
  casePrefix: string;
  /** Total size of the ZIP, from the record page (the pin checks it on every range). */
  zipBytes: number;
  attribution: string;
}): Promise<PublicCbctLock> {
  const { zipBytes } = options;
  const tail = await range(options.url, zipBytes - 65_536, zipBytes - 1, zipBytes);
  const eocd64 = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x06]));
  if (eocd64 === -1) throw new Error('ZIP64 end of central directory not found');
  const cdSize = Number(tail.readBigUInt64LE(eocd64 + 40));
  const cdOffset = Number(tail.readBigUInt64LE(eocd64 + 48));
  const cd = await range(options.url, cdOffset, cdOffset + cdSize - 1, zipBytes);
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
        path: safe(name.slice(options.casePrefix.length)),
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
  // Kept in the cache while pinning, so the fetch that follows downloads nothing again.
  const dir = cacheDir('public-cbct');
  const span =
    Math.max(...files.map((f) => f.zipOffset + f.compressedBytes)) -
    Math.min(...files.map((f) => f.zipOffset));
  const compressedTotal = files.reduce((sum, f) => sum + f.compressedBytes, 0);
  if (span > compressedTotal * 1.1) throw new Error('the case is not contiguous in the ZIP');
  const all = await entries(options.url, files, zipBytes);
  for (const [i, file] of files.entries()) {
    const bytes = all[i] ?? Buffer.alloc(0);
    file.sha256 = sha256(bytes);
    const target = join(dir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
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
