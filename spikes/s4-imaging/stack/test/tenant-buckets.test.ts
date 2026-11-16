// Criterion 5 (IMG-02): bucket per tenant. Tenant A's Garage key is refused on tenant B's bucket
// (list, get, put) while it works on its own. The shared-bucket variant (one bucket, a key per
// tenant, prefixes a/ and b/) is tried too and its result written for the report: Garage grants
// per bucket, so a key allowed on the shared bucket reaches the other tenant's prefix.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from '@shifa-spike/s4-generator';
import { describe, expect, it } from 'vitest';
import { listKeys, s3, useStack } from './use-stack.ts';

const stack = useStack();

const parseKey = (text: string) => {
  const id = /Key ID:\s+(GK[0-9a-f]+)/.exec(text)?.[1];
  const secret = /Secret key:\s+([0-9a-f]{64})/.exec(text)?.[1];
  if (!id || !secret) throw new Error('could not read the Garage key');
  return { accessKeyId: id, secretAccessKey: secret };
};

describe('per-tenant buckets', () => {
  it("refuses tenant A's key on tenant B's bucket and allows it on its own", async () => {
    const a = stack.tenants.a;
    const b = stack.tenants.b;
    expect((await s3(stack, a.s3, `/${a.bucket}?list-type=2`)).status).toBe(200);
    const put = await s3(stack, a.s3, `/${a.bucket}/probe`, { method: 'PUT', body: 'x' });
    expect(put.status).toBe(200);

    const refused = [
      await s3(stack, a.s3, `/${b.bucket}?list-type=2`),
      await s3(stack, a.s3, `/${b.bucket}/probe`),
      await s3(stack, a.s3, `/${b.bucket}/probe`, { method: 'PUT', body: 'x' }),
    ];
    for (const res of refused) {
      expect(res.status).toBe(403);
      expect(await res.text()).toContain('AccessDenied');
    }
  });

  it('records whether a shared bucket with prefixes keeps tenants apart', async () => {
    const created = await stack.garage.cli('bucket', 'create', 's4-shared');
    expect(created.code).toBe(0);
    const keyA = parseKey((await stack.garage.cli('key', 'create', 's4-shared-a')).stdout);
    const keyB = parseKey((await stack.garage.cli('key', 'create', 's4-shared-b')).stdout);
    for (const key of [keyA, keyB]) {
      const allow = ['bucket', 'allow', '--read', '--write', 's4-shared', '--key', key.accessKeyId];
      expect((await stack.garage.cli(...allow)).code).toBe(0);
    }
    const write = await s3(stack, keyA, '/s4-shared/a/instance.dcm', { method: 'PUT', body: 'x' });
    expect(write.status).toBe(200);
    const crossRead = await s3(stack, keyB, '/s4-shared/a/instance.dcm');
    const crossList = await listKeys(stack, keyB, 's4-shared');
    const result = {
      bucketPerTenant: 'cross-tenant list, get and put refused (403 AccessDenied)',
      sharedBucket: {
        crossTenantGetStatus: crossRead.status,
        crossTenantListSeesOtherPrefix: crossList.includes('a/instance.dcm'),
        isolated: crossRead.status === 403 && !crossList.includes('a/instance.dcm'),
      },
      note: 'Garage grants read/write per bucket and key; it has no per-prefix grant.',
    };
    const out = join(repoRoot(), '.verify', 's4');
    await mkdir(out, { recursive: true });
    await writeFile(join(out, 'bucket-layout.json'), `${JSON.stringify(result, null, 2)}\n`);
    expect(typeof result.sharedBucket.isolated).toBe('boolean');
  });
});
