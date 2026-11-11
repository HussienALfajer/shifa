// Spec 0.2-08 criterion 1: the synthetic generator does no I/O and reads no environment.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SOURCE_DIR = join(import.meta.dirname, '..', '..', 'src', 'synthetic');

const listSources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSources(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });

const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  ['Math.random', /Math\.random/],
  ['Date.now', /Date\.now/],
  ['new Date() without argument', /new Date\(\s*\)/],
  ['process', /\bprocess\./],
  ['globalThis', /\bglobalThis\b/],
  ['fetch', /\bfetch\s*\(/],
  ['node: import', /from\s+['"]node:/],
  ['performance', /\bperformance\./],
  ['crypto', /\bcrypto\b/],
];

describe('source scan of src/synthetic', () => {
  const files = listSources(SOURCE_DIR);

  it('finds the generator sources', () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  it('uses no ambient randomness, time, environment or network', () => {
    const hits: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        for (const [label, pattern] of FORBIDDEN) {
          if (pattern.test(line))
            hits.push(`${relative(SOURCE_DIR, file)}:${String(index + 1)} ${label}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });
});

describe('runtime purity', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('imports and runs with an empty frozen environment, no fetch and a throwing env', async () => {
    const fetchCalls: unknown[] = [];
    vi.stubGlobal('fetch', (...args: unknown[]) => {
      fetchCalls.push(args);
      throw new Error('network access is not allowed');
    });
    process.env = Object.freeze({});
    vi.resetModules();
    const synthetic = await import('../../src/synthetic/index.ts');

    // From here on any read of the environment throws.
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
    const random = synthetic.createRandom(1).fork('purity');
    const registry = new synthetic.IdRegistry();
    registry.next(random);
    synthetic.generatePersonName(random, { sex: 'female', adult: true, region: 'azaz' });
    synthetic.generatePhone(random, 'SY');
    synthetic.generatePhone(random, 'TR');
    synthetic.generatePrice(random, 'SYP');
    process.env = originalEnv;

    expect(fetchCalls).toEqual([]);
  });
});
