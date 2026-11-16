// Criterion 1: every image is pinned by version and digest, the Dockerfiles build on the same
// pins, the running containers are those images, and each Orthanc loads exactly the required
// plugins (no scripting plugin, no Orthanc Explorer 2).
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { docker } from '../src/docker.ts';
import { IMAGES, PINNED_IMAGE, REQUIRED_ORTHANC_PLUGINS } from '../src/images.ts';
import { orthanc, useStack } from './use-stack.ts';

const stack = useStack();

const imageId = async (ref: string) =>
  (await docker(['image', 'inspect', '--format', '{{.Id}}', ref])).stdout.trim();
const containerImageId = async (name: string) =>
  (await docker(['inspect', '--format', '{{.Image}}', name])).stdout.trim();

describe('pinned images', () => {
  it('pins every image as name:version@sha256:<64 hex>', () => {
    for (const [key, ref] of Object.entries(IMAGES)) expect(ref, key).toMatch(PINNED_IMAGE);
  });

  it('builds the link, gateway and dcmtk images FROM the same pins', async () => {
    const from = async (path: string) =>
      /^FROM\s+(\S+)/m.exec(await readFile(new URL(path, import.meta.url), 'utf8'))?.[1];
    expect(await from('../../link/Dockerfile')).toBe(IMAGES.alpine);
    expect(await from('../../gateway/Dockerfile')).toBe(IMAGES.node);
    expect(await from('../../generator/dcmtk.Dockerfile')).toBe(IMAGES.debian);
  });

  it('runs exactly the pinned images', async () => {
    const expected: [string, string][] = [
      [stack.postgres.container, IMAGES.postgres],
      [stack.garage.container, IMAGES.garage],
      ...Object.values(stack.tenants).map((t): [string, string] => [t.container, IMAGES.orthanc]),
    ];
    for (const [container, ref] of expected) {
      expect(await containerImageId(container), container).toBe(await imageId(ref));
    }
  });

  it('loads exactly the required Orthanc plugins in every tenant', async () => {
    for (const tenant of Object.values(stack.tenants)) {
      const res = await orthanc(tenant, '/plugins');
      expect(res.status).toBe(200);
      const plugins = ((await res.json()) as string[]).sort();
      expect(plugins, tenant.id).toEqual([...REQUIRED_ORTHANC_PLUGINS].sort());
    }
  });
});
