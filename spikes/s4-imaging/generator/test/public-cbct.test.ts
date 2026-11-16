// Criterion 7: the public de-identified CBCT case is pinned file by file (SHA-256), never
// committed, and has no patient tag other than an anonymised placeholder. The negative case
// proves the check fails on a filled PatientBirthDate. Only tag keywords are reported.
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  checkPhi,
  fetchPublicCbct,
  generateStudy,
  PUBLIC_CBCT_LOCK,
  readDicom,
} from '../src/index.ts';

let dir = '';
let scratch = '';
beforeAll(async () => {
  ({ dir } = await fetchPublicCbct());
  scratch = await mkdtemp(join(tmpdir(), 's4-phi-'));
});
afterAll(async () => {
  await rm(scratch, { recursive: true, force: true });
});

describe('public CBCT case', () => {
  it('is CC BY 4.0 data with every file pinned and matching its SHA-256', async () => {
    expect(PUBLIC_CBCT_LOCK.licence).toBe('CC BY 4.0');
    expect(PUBLIC_CBCT_LOCK.doi).toBe('10.57760/sciencedb.26465');
    expect(PUBLIC_CBCT_LOCK.files.length).toBeGreaterThan(100);
    for (const file of PUBLIC_CBCT_LOCK.files) {
      const bytes = await readFile(join(dir, file.path));
      expect(bytes.byteLength, file.path).toBe(file.bytes);
      expect(createHash('sha256').update(bytes).digest('hex'), file.path).toBe(file.sha256);
    }
  });

  it('has no patient or study identity tag holding a real-looking value', async () => {
    const failures: string[] = [];
    for (const file of PUBLIC_CBCT_LOCK.files) {
      const found = checkPhi(readDicom(await readFile(join(dir, file.path))));
      if (found.length > 0) failures.push(`${file.path}: ${found.join(', ')}`);
    }
    expect(failures).toEqual([]);
  });

  it('fails on a generated file with a filled PatientBirthDate (negative evidence)', async () => {
    const manifest = await generateStudy('pano', { outDir: scratch });
    const [file] = manifest.files;
    if (!file) throw new Error('empty manifest');
    const ds = readDicom(await readFile(join(scratch, file.path)));
    expect(checkPhi(ds)).toEqual([]);
    ds.PatientBirthDate = '19750312';
    expect(checkPhi(ds)).toContain('PatientBirthDate');
  });
});
