// Builds the test pack (criterion 7) from the fake provider: public/pack/manifest.json (the
// generation manifest plus a packVersion hash) and its clips, tones of known length. Git-ignored.
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeProvider, generate, readManifest, sha256Hex } from '@shifa-spike/s6-tts';

export const PACK_DIR = join(import.meta.dirname, '..', 'public', 'pack');

const work = mkdtempSync(join(tmpdir(), 's6-pack-'));
try {
  const result = await generate({
    provider: createFakeProvider(),
    voice: 'fake-1',
    set: 'full',
    outDir: work,
    now: () => new Date('2026-11-18T00:00:00Z'),
  });
  if (result.exitCode !== 0) throw new Error(`fake generation failed: ${String(result.exitCode)}`);
  const runDir = join(work, 'fake', 'fake-1');
  const manifest = readManifest(join(runDir, 'manifest.json'));
  const packVersion = sha256Hex(
    new TextEncoder().encode(manifest.clips.map((c) => `${c.clipId}:${c.sha256 ?? ''}`).join('\n')),
  ).slice(0, 16);

  rmSync(PACK_DIR, { recursive: true, force: true });
  mkdirSync(PACK_DIR, { recursive: true });
  for (const name of readdirSync(runDir)) {
    if (name.endsWith('.wav')) copyFileSync(join(runDir, name), join(PACK_DIR, name));
  }
  writeFileSync(
    join(PACK_DIR, 'manifest.json'),
    `${JSON.stringify({ packVersion, ...manifest }, null, 2)}\n`,
  );
  process.stdout.write(`test pack ${packVersion}: ${String(manifest.clips.length)} clips\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
