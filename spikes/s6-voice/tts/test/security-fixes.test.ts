// Security review fixes: the owner's real key values are found literally whatever their shape,
// UTF-16 files are read, and a malformed Azure region is refused before any request.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { localSecrets } from '../src/env.ts';
import { scanForKeys } from '../src/keys.ts';
import { createAzureProvider } from '../src/providers/azure.ts';
import { tempOutDir } from './helpers.ts';

describe('literal key values from .env.local', () => {
  it('finds a value of an unknown shape and never reports .env.local itself', () => {
    const dir = tempOutDir();
    const secret = 'odd.Shape~'.repeat(3);
    const env = join(dir, '.env.local');
    writeFileSync(env, `S6_AZURE_KEY="${secret}"\nS6_AZURE_REGION=westeurope\n`);
    expect(localSecrets(env)).toEqual([secret]);
    writeFileSync(join(dir, 'notes.md'), `line one\npasted ${secret} here\n`);
    expect(scanForKeys([dir], localSecrets(env))).toEqual([
      { file: join(dir, 'notes.md'), line: 2, kind: 'local-secret' },
    ]);
  });

  it('reads UTF-16 files written by Windows PowerShell 5.1', () => {
    const dir = tempOutDir();
    const text = `x AIza${'Q7'.repeat(17)}x\n`;
    writeFileSync(
      join(dir, 'ps.log'),
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]),
    );
    expect(scanForKeys([dir]).map((f) => f.kind)).toEqual(['google-api-key']);
  });
});

describe('Azure region', () => {
  it('refuses anything but a bare region name', () => {
    expect(() => createAzureProvider({ key: 'k', region: 'x.example/#' })).toThrow(/region/u);
    expect(() => createAzureProvider({ key: 'k', region: 'westeurope' })).not.toThrow();
  });
});
