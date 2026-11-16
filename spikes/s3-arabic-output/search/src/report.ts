// Counts-only JSON reports under the repository's `.verify/s3/` (git-ignored, uploaded by the
// manual workflow). Callers pass numbers and ids of rules, never names or search terms.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const REPORT_DIR = join(import.meta.dirname, '..', '..', '..', '..', '.verify', 's3');

export async function writeReport(name: string, body: unknown): Promise<string> {
  await mkdir(REPORT_DIR, { recursive: true });
  const path = join(REPORT_DIR, name);
  await writeFile(path, `${JSON.stringify(body, null, 2)}\n`);
  return path;
}
