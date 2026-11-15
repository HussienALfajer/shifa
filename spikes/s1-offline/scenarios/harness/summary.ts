// Counts-only JSON summary per spec (CI artefact and report input). No ids, names or values
// beyond counts and per-currency totals.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TestInfo } from '@playwright/test';

export async function recordSummary(info: TestInfo, name: string, data: unknown): Promise<void> {
  const dir = join(info.project.outputDir, '..', 'summary');
  await mkdir(dir, { recursive: true });
  const engine = process.env['S1_ENGINE'] ?? 'unknown';
  const body = JSON.stringify(
    { engine, spec: name, at: new Date().toISOString(), data },
    (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v),
    2,
  );
  // Device ids are random per run; drop the per-device keys' names from the summary.
  await writeFile(join(dir, `${engine}-${name}.json`), body);
  await info.attach(`${name}.json`, { body, contentType: 'application/json' });
}
