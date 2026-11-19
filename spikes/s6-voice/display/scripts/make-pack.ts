// Builds a real voice pack for the emulator run (0.3-S6b checkpoint E) from one generated voice:
// public/voice/manifest.json (the generation manifest plus a packVersion hash) and its clips.
// Git-ignored; open the display with ?pack=voice.
// CLI: node scripts/make-pack.ts --from <spikes/s6-voice/.out/<provider>/<voice>>
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { readManifest, sha256Hex } from '@shifa-spike/s6-tts';

export const VOICE_PACK_DIR = join(import.meta.dirname, '..', 'public', 'voice');

const { values } = parseArgs({ options: { from: { type: 'string' } } });
if (!values.from) throw new Error('usage: make-pack --from <run folder with manifest.json>');
const manifest = readManifest(join(values.from, 'manifest.json'));
const failed = manifest.clips.filter((c) => c.status !== 'ok').map((c) => c.clipId);
if (failed.length > 0) throw new Error(`failed clips: ${failed.join(', ')}; regenerate first`);
const packVersion = sha256Hex(
  new TextEncoder().encode(manifest.clips.map((c) => `${c.clipId}:${c.sha256 ?? ''}`).join('\n')),
).slice(0, 16);

rmSync(VOICE_PACK_DIR, { recursive: true, force: true });
mkdirSync(VOICE_PACK_DIR, { recursive: true });
for (const clip of manifest.clips) {
  const source = join(values.from, clip.file);
  if (!existsSync(source)) throw new Error(`missing clip file: ${clip.file}`);
  copyFileSync(source, join(VOICE_PACK_DIR, clip.file));
}
writeFileSync(
  join(VOICE_PACK_DIR, 'manifest.json'),
  `${JSON.stringify({ packVersion, ...manifest }, null, 2)}\n`,
);
process.stdout.write(
  `voice pack ${packVersion}: ${manifest.header.provider}/${manifest.header.voice}, ${String(manifest.clips.length)} clips\n`,
);
