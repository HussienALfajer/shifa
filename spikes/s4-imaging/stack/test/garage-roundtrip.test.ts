// Criterion 3 (IMG-06): through the unmodified S3 plugin, Orthanc stores, reads and deletes
// instances in Garage; every retrieved instance is byte-identical to the source; deleting the
// studies leaves no object in the bucket and Orthanc's statistics back at zero.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureStudy, type Manifest } from '@shifa-spike/s4-generator';
import { describe, expect, it } from 'vitest';
import { multipartParts } from '../src/dicomweb.ts';
import type { TenantHandle } from '../src/types.ts';
import { listKeys, orthanc, sha256, storeInstance, useStack } from './use-stack.ts';

const stack = useStack();

const bucketKeys = (tenant: TenantHandle) => listKeys(stack, tenant.s3, tenant.bucket);

async function wado(tenant: TenantHandle, manifest: Manifest, i: number): Promise<Buffer> {
  const file = manifest.files[i];
  if (!file) throw new Error('no file');
  const path = `/dicom-web/studies/${manifest.studyInstanceUid}/series/${file.seriesInstanceUid}/instances/${file.sopInstanceUid}`;
  const res = await orthanc(tenant, path, {
    headers: { accept: 'multipart/related; type="application/dicom"; transfer-syntax=*' },
  });
  expect(res.status).toBe(200);
  const parts = multipartParts(
    new Uint8Array(await res.arrayBuffer()),
    res.headers.get('content-type') ?? '',
  );
  expect(parts).toHaveLength(1);
  return parts[0] ?? Buffer.alloc(0);
}

describe('Garage through the Orthanc S3 plugin', () => {
  it('stores, retrieves losslessly and deletes without leftovers', async () => {
    const tenant = stack.tenants.a;
    const studies = [await ensureStudy('cbct-20-multi'), await ensureStudy('pano')];
    const orthancStudies = new Set<string>();
    for (const { dir, manifest } of studies) {
      for (const file of manifest.files) {
        const stored = await storeInstance(tenant, await readFile(join(dir, file.path)));
        orthancStudies.add(stored.ParentStudy);
      }
    }
    const stored = studies.reduce((n, s) => n + s.manifest.files.length, 0);
    expect((await bucketKeys(tenant)).length).toBeGreaterThanOrEqual(stored);

    for (const { manifest } of studies) {
      for (let i = 0; i < manifest.files.length; i += 1) {
        expect(sha256(await wado(tenant, manifest, i)), manifest.files[i]?.path).toBe(
          manifest.files[i]?.sha256,
        );
      }
    }

    for (const id of orthancStudies) {
      expect((await orthanc(tenant, `/studies/${id}`, { method: 'DELETE' })).status).toBe(200);
    }
    expect(await bucketKeys(tenant)).toEqual([]);
    const stats = (await (await orthanc(tenant, '/statistics')).json()) as {
      CountInstances: number;
      TotalDiskSize: string;
    };
    expect([stats.CountInstances, stats.TotalDiskSize]).toEqual([0, '0']);
  });
});
