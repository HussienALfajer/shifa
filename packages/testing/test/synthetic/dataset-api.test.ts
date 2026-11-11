// Spec 0.2-08 criterion 1: `generateDataset` is a public export and does no I/O.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PACKAGE_DIR = join(import.meta.dirname, '..', '..');

describe('generateDataset public API', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('is exported from the package entry point', async () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf8')) as {
      exports: Record<string, string>;
    };
    expect(manifest.exports['.']).toBe('./src/index.ts');
    const entry = await import('../../src/index.ts');
    expect(typeof entry.generateDataset).toBe('function');
    expect(typeof entry.canonicalJson).toBe('function');
  });

  it('runs every preset with a throwing environment and no network', async () => {
    const fetchCalls: unknown[] = [];
    vi.stubGlobal('fetch', (...args: unknown[]) => {
      fetchCalls.push(args);
      throw new Error('network access is not allowed');
    });
    process.env = Object.freeze({});
    vi.resetModules();
    const entry = await import('../../src/index.ts');

    process.env = new Proxy(
      {},
      {
        get: () => {
          throw new Error('environment read');
        },
        has: () => {
          throw new Error('environment read');
        },
        ownKeys: () => {
          throw new Error('environment read');
        },
      },
    );
    const minimal = entry.generateDataset({ seed: 1, preset: 'minimal' });
    const demo = entry.generateDataset({ seed: 1, preset: 'demo' });
    const load = entry.generateDataset({
      seed: 1,
      preset: 'load',
      load: { tenants: 2, patientsPerTenant: 20 },
    });
    process.env = originalEnv;

    expect(fetchCalls).toEqual([]);
    expect(minimal.tenants.length).toBe(2);
    expect(demo.tenants.length).toBeGreaterThanOrEqual(4);
    expect(load.tenants.length).toBe(2);
  });
});
