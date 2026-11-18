// Criterion 1: one command generates the whole set into an untracked folder with a manifest.
import { createHash } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/generate.ts';
import { checkCompleteness, manifestSchema, readManifest } from '../src/manifest.ts';
import { createFakeProvider } from '../src/providers/fake.ts';
import { buildTestSet } from '../src/testset.ts';
import { parseWav } from '../src/wav.ts';
import { FIXED_NOW, fakeSleep, recordingLog, tempOutDir } from './helpers.ts';

describe('fake run and manifest', () => {
  it('covers every clip with a matching SHA-256, a positive duration and status ok', async () => {
    const outDir = tempOutDir();
    const { log } = recordingLog();
    const result = await generate({
      provider: createFakeProvider(),
      voice: 'fake-1',
      set: 'full',
      outDir,
      now: FIXED_NOW,
      log,
      sleep: fakeSleep().sleep,
    });
    expect(result.exitCode).toBe(0);

    const runDir = join(outDir, 'fake', 'fake-1');
    const manifest = readManifest(join(runDir, 'manifest.json'));
    expect(manifestSchema.parse(manifest)).toEqual(manifest);
    expect(manifest.header.provider).toBe('fake');
    expect(manifest.header.voice).toBe('fake-1');
    expect(manifest.header.set).toBe('full');
    expect(manifest.header.generatedAt).toBe('2026-11-18T10:00:00.000Z');
    expect(manifest.clips).toHaveLength(178);
    expect(manifest.announcements).toHaveLength(10);

    const set = buildTestSet('full');
    for (const clip of manifest.clips) {
      expect(clip.status, clip.clipId).toBe('ok');
      const bytes = readFileSync(join(runDir, clip.file));
      expect(clip.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
      expect(clip.durationMs, clip.clipId).toBeGreaterThan(0);
      expect(parseWav(bytes).durationMs).toBeCloseTo(clip.durationMs, 0);
      const planned = set.clips.find((c) => c.id === clip.clipId);
      expect(clip.text).toBe(planned?.text);
      expect(clip.provider).toBe('fake');
      expect(clip.voice).toBe('fake-1');
    }
    // The chime is the same synthetic file for every provider and is never billed.
    const chime = manifest.clips.find((c) => c.clipId === 'chime');
    expect(chime?.charactersBilled).toBe(0);
    expect(checkCompleteness(manifest, set, runDir)).toEqual({
      ok: true,
      missing: [],
      failed: [],
      mismatched: [],
    });
  });

  it('fails the completeness check when a clip file or entry is missing', async () => {
    const outDir = tempOutDir();
    await generate({
      provider: createFakeProvider(),
      voice: 'fake-1',
      set: 'full',
      outDir,
      now: FIXED_NOW,
      log: recordingLog().log,
      sleep: fakeSleep().sleep,
    });
    const runDir = join(outDir, 'fake', 'fake-1');
    const manifest = readManifest(join(runDir, 'manifest.json'));
    const set = buildTestSet('full');

    rmSync(join(runDir, manifest.clips.find((c) => c.clipId === 'number-011')?.file ?? 'x'));
    const withoutEntry = {
      ...manifest,
      clips: manifest.clips.filter((c) => c.clipId !== 'room-3'),
    };
    const report = checkCompleteness(withoutEntry, set, runDir);
    expect(report.ok).toBe(false);
    expect(report.missing.sort()).toEqual(['number-011', 'room-3']);
  });
});
