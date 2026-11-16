// Criterion 4: the S3 plugin encrypts before the first write. No stored object holds the DICM
// marker or a 64-byte pixel run of its source; an Orthanc restarted with a wrong master key
// fails to read the instance (an error, not wrong bytes) and reads it again with the right key.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureStudy } from '@shifa-spike/s4-generator';
import { describe, expect, it } from 'vitest';
import { listKeys, orthanc, s3, sha256, storeInstance, useStack } from './use-stack.ts';

const stack = useStack();

describe('encryption at rest', () => {
  it('stores no DICM marker and no source pixel run; a wrong key cannot read', async () => {
    const tenant = stack.tenants.a;
    const { dir, manifest } = await ensureStudy('cbct-20-multi');
    const sources: Buffer[] = [];
    let firstId = '';
    for (const file of manifest.files) {
      const bytes = await readFile(join(dir, file.path));
      sources.push(bytes);
      const stored = await storeInstance(tenant, bytes);
      firstId ||= stored.ID;
    }
    // A run from the end of each file: inside the noisy pixel data.
    const runs = sources.map((b) => b.subarray(b.length - 4096, b.length - 4096 + 64));

    const keys = await listKeys(stack, tenant.s3, tenant.bucket);
    expect(keys.length).toBeGreaterThanOrEqual(manifest.files.length);
    const leaks: string[] = [];
    for (const key of keys) {
      const res = await s3(stack, tenant.s3, `/${tenant.bucket}/${encodeURIComponent(key)}`);
      expect(res.status).toBe(200);
      const object = Buffer.from(await res.arrayBuffer());
      if (object.indexOf('DICM') !== -1) leaks.push(`${key}: DICM`);
      if (runs.some((run) => object.indexOf(run) !== -1)) leaks.push(`${key}: pixel run`);
    }
    expect(leaks).toEqual([]);

    const expected = sha256(sources[0] ?? Buffer.alloc(0));
    await stack.restartOrthanc('a', { masterKey: 'wrong' });
    const wrong = await orthanc(tenant, `/instances/${firstId}/file`);
    expect(wrong.status).toBeGreaterThanOrEqual(400);
    await wrong.arrayBuffer();

    await stack.restartOrthanc('a', { masterKey: 'current' });
    const right = await orthanc(tenant, `/instances/${firstId}/file`);
    expect(right.status).toBe(200);
    expect(sha256(new Uint8Array(await right.arrayBuffer()))).toBe(expected);
  });
});
