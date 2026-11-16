// Criterion 11 (0.3-S4c): the bench writes one transfer row per profile × study × method, viewer
// rows per profile and study, encryption rows, and the machine and versions; nothing in the
// file names a patient or a study (no synthetic marker, no Study Instance UID). A small matrix
// here (P3, the 20 MB study); the real runs are `bench:s4` locally and the `bench` CI job.
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureStudy, repoRoot, SYNTHETIC_MARKER } from '@shifa-spike/s4-generator';
import { describe, expect, it } from 'vitest';
import { type BenchFile, METHODS, runBench } from './bench.ts';

const out = join(repoRoot(), '.verify', 's4', 'bench-selftest.json');

describe('bench', () => {
  it('writes one row per profile × study × method and no tag values', async () => {
    await rm(out, { force: true });
    await runBench({
      profiles: ['P3'],
      studies: ['cbct-20-multi'],
      methods: [...METHODS],
      viewer: true,
      encryption: true,
      out,
    });
    const text = await readFile(out, 'utf8');
    const file = JSON.parse(text) as BenchFile;

    const transfers = file.rows.filter((r) => r.kind === 'transfer');
    expect(transfers.map((r) => r.method).sort()).toEqual([...METHODS].sort());
    for (const row of transfers) {
      expect(row.profile).toBe('P3');
      expect(row.study).toBe('cbct-20-multi');
      expect(row.outcome).toBe('done');
      expect(row.ms).toBeGreaterThan(0);
      expect(row.studyBytes).toBeGreaterThan(0);
      expect(row.wireUpBytes).toBeGreaterThan(0);
      expect(row.throughputMbit).toBeGreaterThan(0);
      expect(row.peakMemMiB.orthanc).toBeGreaterThan(0);
      expect(row.peakMemMiB.gateway).toBeGreaterThan(0);
    }

    const viewer = file.rows.filter((r) => r.kind === 'viewer');
    expect(viewer.map((r) => `${r.place}/${r.study}`).sort()).toEqual([
      'P3/cbct-20-multi',
      'P3/pano',
      'edge LAN/cbct-20-multi',
      'edge LAN/pano',
    ]);
    for (const row of viewer) expect(row.firstImageMs).toBeGreaterThan(0);

    const encryption = file.rows.filter((r) => r.kind === 'encryption');
    expect(encryption.map((r) => r.encrypted).sort()).toEqual([false, true]);
    for (const row of encryption) {
      expect(row.storeMs).toBeGreaterThan(0);
      expect(row.readMs).toBeGreaterThan(0);
    }

    expect(file.machine.cpus).toBeGreaterThan(0);
    expect(file.versions.orthanc).toMatch(/^orthancteam\/orthanc:/);

    const { manifest } = await ensureStudy('cbct-20-multi');
    expect(text.includes(SYNTHETIC_MARKER)).toBe(false);
    expect(text.includes(manifest.studyInstanceUid)).toBe(false);
  });
});
