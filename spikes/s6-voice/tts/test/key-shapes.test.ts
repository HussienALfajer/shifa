// Review fix: the key check also catches env-style, JSON and header-dump shapes and the newer
// 84-character Azure key. Values are built at run time (no key-shaped literal in the repository).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanForKeys } from '../src/keys.ts';
import { tempOutDir } from './helpers.ts';

const value = 'Zq'.repeat(12);

describe('key shapes', () => {
  const shapes: Record<string, string> = {
    'env.bak': `S6_GOOGLE_KEY=${value}\n`,
    'headers.json': JSON.stringify({ 'ocp-apim-subscription-key': value }),
    'config.json': JSON.stringify({ apiKey: value }),
    'azure84.txt': `x ${'Ab3'.repeat(28)} y\n`,
  };
  for (const [name, text] of Object.entries(shapes)) {
    it(`finds ${name}`, () => {
      const dir = tempOutDir();
      writeFileSync(join(dir, name), text);
      expect(scanForKeys([dir])).toHaveLength(1);
    });
  }
});
