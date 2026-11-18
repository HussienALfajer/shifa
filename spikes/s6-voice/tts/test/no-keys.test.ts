// Privacy (ADR-0026): keys never reach the repository, the manifest, errors or logs.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPIKE_DIR, scanForKeys } from '../scripts/check-no-keys.ts';
import { generate } from '../src/generate.ts';
import { createAzureProvider } from '../src/providers/azure.ts';
import { createGoogleProvider } from '../src/providers/google.ts';
import { FIXED_NOW, fakeSleep, recordingLog, tempOutDir } from './helpers.ts';
import { startMockServer } from './mock-server.ts';

// Built at run time so no key-shaped literal sits in the repository.
const AZURE_KEY = '9f3c'.repeat(8);
const GOOGLE_KEY = `AIza${'Q7'.repeat(17)}x`;

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name));
}

describe('check-no-keys', () => {
  it('fails on each planted key pattern and passes a clean folder', () => {
    const dir = tempOutDir();
    writeFileSync(join(dir, 'clean.json'), JSON.stringify({ sha256: 'a'.repeat(64), n: 1 }));
    expect(scanForKeys([dir])).toEqual([]);

    const planted: Record<string, string> = {
      'azure.log': `request failed with ${AZURE_KEY}\n`,
      'google.txt': `x\ny ${GOOGLE_KEY}\n`,
      'sa.json': JSON.stringify({ type: 'service_account', private_key: 'z' }),
      'conf.ini': `subscription_key=${'k'.repeat(24)}\n`,
    };
    mkdirSync(join(dir, 'nested'));
    for (const [name, text] of Object.entries(planted))
      writeFileSync(join(dir, 'nested', name), text);
    const findings = scanForKeys([dir]);
    expect(findings.map((f) => f.kind).sort()).toEqual([
      'azure-key',
      'generic-key',
      'google-api-key',
      'service-account',
    ]);
    const google = findings.find((f) => f.kind === 'google-api-key');
    expect(google?.line).toBe(2);
    // Findings name the file and the kind, never the matched value.
    expect(JSON.stringify(findings)).not.toContain(AZURE_KEY);
    expect(JSON.stringify(findings)).not.toContain(GOOGLE_KEY);
  });

  it('skips the git-ignored .env.local, where keys belong', () => {
    const dir = tempOutDir();
    writeFileSync(join(dir, '.env.local'), `S6_AZURE_KEY=${AZURE_KEY}\n`);
    expect(scanForKeys([dir])).toEqual([]);
  });

  it('finds nothing in the committed spike folder', () => {
    expect(scanForKeys([SPIKE_DIR])).toEqual([]);
  });
});

describe('a failing vendor run leaks no key', () => {
  for (const vendor of ['azure', 'google'] as const) {
    it(`${vendor}: errors, log and manifest hold status and vendor code only`, async () => {
      const server = await startMockServer();
      const key = vendor === 'azure' ? AZURE_KEY : GOOGLE_KEY;
      // A hostile vendor echoes the key back; the adapter must not pass the body on.
      server.respond({
        status: 401,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: { code: 401, status: 'UNAUTHENTICATED', message: key } }),
      });
      const provider =
        vendor === 'azure'
          ? createAzureProvider({ key, endpoint: server.url })
          : createGoogleProvider({ key, endpoint: server.url });

      const thrown = await provider.synthesize('الرقم واحد', 'v').catch((e: unknown) => e);
      expect(String(thrown)).not.toContain(key);
      expect(JSON.stringify(thrown)).not.toContain(key);

      const outDir = tempOutDir();
      const { lines, log } = recordingLog();
      const run = await generate({
        provider,
        voice: vendor === 'azure' ? 'ar-SY-LaithNeural' : 'ar-XA-Chirp3-HD-Charon',
        set: 'pre-round',
        outDir,
        now: FIXED_NOW,
        log,
        sleep: fakeSleep().sleep,
      });
      expect(run.exitCode).not.toBe(0);
      expect(lines.join('\n')).not.toContain(key);
      expect(lines.join('\n')).toContain('401');
      for (const file of filesUnder(outDir)) {
        expect(readFileSync(file, 'utf8'), file).not.toContain(key);
      }
      expect(scanForKeys([outDir])).toEqual([]);
    });
  }
});
