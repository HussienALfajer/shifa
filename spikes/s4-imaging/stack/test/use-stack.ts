// Per-file stack for the spike suites (stack and gateway): started before the file's tests,
// stopped after, with helpers that talk to the cloud side through the ops tunnel.
import { createHash } from 'node:crypto';
import { afterAll, beforeAll } from 'vitest';
import { s3Client } from '../src/garage.ts';
import { startStack } from '../src/stack.ts';
import type { S3Credentials, Stack, StackOptions, TenantHandle } from '../src/types.ts';

export function useStack(options: StackOptions = {}): Stack {
  const holder = {} as { stack?: Stack };
  beforeAll(async () => {
    holder.stack = await startStack(options);
  });
  afterAll(async () => {
    await holder.stack?.stop();
  });
  // Tests read the stack lazily (inside `it`), after beforeAll filled it.
  return new Proxy({} as Stack, {
    get(_target, key) {
      if (!holder.stack) throw new Error('stack not started');
      return Reflect.get(holder.stack, key) as unknown;
    },
  });
}

/** fetch against a tenant's Orthanc REST API with the gateway's credential. */
export function orthanc(
  tenant: TenantHandle,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('authorization', tenant.orthancAuth);
  return fetch(`${tenant.orthancUrl}${path}`, { ...init, headers });
}

/** Stores one DICOM file through Orthanc REST; returns Orthanc's ids. */
export async function storeInstance(
  tenant: TenantHandle,
  bytes: Uint8Array,
): Promise<{ ID: string; ParentStudy: string }> {
  const res = await orthanc(tenant, '/instances', {
    method: 'POST',
    body: new Uint8Array(bytes),
    headers: { 'content-type': 'application/dicom' },
  });
  if (!res.ok) throw new Error(`store failed: ${String(res.status)}`);
  return (await res.json()) as { ID: string; ParentStudy: string };
}

/** S3 request to Garage through the ops tunnel, signed with the given key. */
export function s3(stack: Stack, key: S3Credentials, path: string, init: RequestInit = {}) {
  return s3Client(key).fetch(`${stack.garage.s3Url}${path}`, init);
}

/** Object keys in a bucket (one listing page is enough for the test studies). */
export async function listKeys(
  stack: Stack,
  key: S3Credentials,
  bucket: string,
): Promise<string[]> {
  const res = await s3(stack, key, `/${bucket}?list-type=2&max-keys=1000`);
  if (!res.ok) throw new Error(`list ${bucket}: ${String(res.status)}`);
  return [...(await res.text()).matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1] ?? '');
}

export const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');
