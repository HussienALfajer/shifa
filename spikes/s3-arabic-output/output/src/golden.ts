// Golden images (criteria 4 and 6). Committed goldens live in `goldens/`; until the owner has
// checked them by eye they do not exist and the comparison runs against the candidates in
// `.verify/s3/candidates/` (written by `goldens:update`). Diffs go to `.verify/s3/diff/`.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface GoldenPolicy {
  /** pixelmatch per-pixel colour threshold (0–1). */
  threshold: number;
  /** Largest share of differing pixels that still passes. */
  maxDiffRatio: number;
}

export const PDF_GOLDEN: GoldenPolicy = { threshold: 0.1, maxDiffRatio: 0.005 };
export const THERMAL_GOLDEN: GoldenPolicy = { threshold: 0.1, maxDiffRatio: 0.002 };

const PACKAGE = join(import.meta.dirname, '..');
export const GOLDEN_DIR = join(PACKAGE, 'goldens');
export const VERIFY_DIR = join(PACKAGE, '..', '..', '..', '.verify', 's3');
export const CANDIDATE_DIR = join(VERIFY_DIR, 'candidates');
const DIFF_DIR = join(VERIFY_DIR, 'diff');

export interface GoldenResult {
  diffRatio: number;
  diffPath?: string;
  message: string;
}

/** Where the reference image for `name` is: the committed golden, else the candidate. */
export function referencePath(name: string): string | undefined {
  const golden = join(GOLDEN_DIR, name);
  if (existsSync(golden)) return golden;
  const candidate = join(CANDIDATE_DIR, name);
  return existsSync(candidate) ? candidate : undefined;
}

export async function compareGolden(
  name: string,
  actual: Uint8Array,
  policy: GoldenPolicy,
  options: { diffName?: string } = {},
): Promise<GoldenResult> {
  const reference = referencePath(name);
  if (!reference) {
    return { diffRatio: 1, message: `no golden or candidate for ${name}: run goldens:update` };
  }
  const expected = PNG.sync.read(await readFile(reference));
  const got = PNG.sync.read(Buffer.from(actual));
  if (expected.width !== got.width || expected.height !== got.height) {
    return {
      diffRatio: 1,
      message: `${name}: size ${String(got.width)}x${String(got.height)} vs ${String(expected.width)}x${String(expected.height)}`,
    };
  }
  const diff = new PNG({ width: got.width, height: got.height });
  const differing = pixelmatch(expected.data, got.data, diff.data, got.width, got.height, {
    threshold: policy.threshold,
  });
  const diffRatio = differing / (got.width * got.height);
  let diffPath: string | undefined;
  if (diffRatio > policy.maxDiffRatio) {
    diffPath = join(DIFF_DIR, options.diffName ?? name);
    await mkdir(dirname(diffPath), { recursive: true });
    await writeFile(diffPath, PNG.sync.write(diff));
  }
  return {
    diffRatio,
    ...(diffPath ? { diffPath } : {}),
    message: `${name}: ${(diffRatio * 100).toFixed(3)} % pixels differ (reference ${reference.includes('candidates') ? 'candidate' : 'golden'})`,
  };
}

/** Writes a candidate image for the owner's eye check (never into goldens/). */
export async function writeCandidate(name: string, png: Uint8Array): Promise<string> {
  const path = join(CANDIDATE_DIR, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, png);
  return path;
}
