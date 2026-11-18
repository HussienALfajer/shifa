// SILMA TTS v1 (criteria 1, 10). The pins are checked everywhere; the live call runs only with
// S6_SILMA=1 against the container on the owner's machine (OD-50), never in CI.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPIKE_DIR } from '../src/paths.ts';
import { createSilmaProvider } from '../src/providers/silma.ts';
import { parseWav } from '../src/wav.ts';

const silmaFile = (name: string) => readFileSync(join(SPIKE_DIR, 'silma', name), 'utf8');

describe('SILMA image pins', () => {
  it('pins the base image by digest and installs only hash-checked packages', () => {
    const dockerfile = silmaFile('Dockerfile');
    expect(dockerfile).toMatch(/^FROM python:3\.12-slim-bookworm@sha256:[0-9a-f]{64}$/mu);
    expect(dockerfile).toContain('--require-hashes');
    expect(dockerfile).toMatch(/^USER silma$/mu);
    expect(silmaFile('lock.sh')).toContain(/@sha256:[0-9a-f]{64}/u.exec(dockerfile)?.[0] ?? 'x');
  });

  it('pins the package version and the weights by commit and SHA-256', () => {
    expect(silmaFile('requirements.in')).toMatch(/^silma-tts==1\.0\.5$/mu);
    const fetch = silmaFile('fetch.py');
    expect(fetch).toMatch(/^REVISION = "[0-9a-f]{40}"$/mu);
    expect(fetch).toMatch(/^MODEL_SHA256 = "[0-9a-f]{64}"$/mu);
  });

  it('keeps the wrapper on its two routes with bounded input', () => {
    const server = silmaFile('server.py');
    expect(server).toContain('"/synthesize"');
    expect(server).toContain('MAX_TEXT = 500');
  });
});

describe.skipIf(process.env['S6_SILMA'] !== '1')('SILMA container (owner machine)', () => {
  it('synthesizes a phrase into WAV through the local wrapper', async () => {
    const provider = createSilmaProvider({
      endpoint: process.env['S6_SILMA_URL'] ?? 'http://127.0.0.1:8088',
    });
    const result = await provider.synthesize('الرقم مئة وأحد عشر', 'default');
    const info = parseWav(result.audio);
    expect(info.durationMs).toBeGreaterThan(300);
    expect(result.charactersBilled).toBe(0);
  }, 300_000);
});
