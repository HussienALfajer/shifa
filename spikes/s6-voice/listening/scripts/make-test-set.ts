// Builds the fake listening and pre-round sets for the Playwright suite (git-ignored test-set/).
// Five fake voices speak the clips of the ten announcements plus two plain names and a doctor
// phrase (a shorter run than the 885 clips of the owner's set); six fake voices make the
// pre-round, three of each gender.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildListeningSet,
  createFakeProvider,
  generate,
  type ListeningInput,
  readManifest,
  writeListeningSet,
} from '@shifa-spike/s6-tts';

export const TEST_SET_DIR = join(import.meta.dirname, '..', 'test-set');
const NOW = () => new Date('2026-11-18T00:00:00Z');

async function fakeRun(work: string, voice: string, set: 'full' | 'pre-round') {
  const result = await generate({
    provider: createFakeProvider(),
    voice,
    set,
    outDir: work,
    now: NOW,
    log: () => undefined,
  });
  if (result.exitCode !== 0) throw new Error(`fake ${voice} failed`);
  const dir = join(work, 'fake', voice);
  const file = set === 'full' ? 'manifest.json' : 'manifest.pre-round.json';
  return { dir, manifest: readManifest(join(dir, file)) };
}

const work = mkdtempSync(join(tmpdir(), 's6-listening-'));
try {
  rmSync(TEST_SET_DIR, { recursive: true, force: true });
  const full: ListeningInput[] = [];
  for (const voice of ['fake-1', 'fake-2', 'fake-3', 'fake-4', 'fake-5']) {
    const { dir, manifest } = await fakeRun(work, voice, 'full');
    const keep = new Set(manifest.announcements.flatMap((a) => a.clipIds));
    for (const id of ['name-plain-m01', 'name-plain-f01', 'doctor-1']) keep.add(id);
    full.push({
      dir,
      manifest: { ...manifest, clips: manifest.clips.filter((c) => keep.has(c.clipId)) },
    });
  }
  const built = buildListeningSet({ inputs: full, seed: 42 });
  writeListeningSet(built, TEST_SET_DIR);

  const genders: Record<string, 'male' | 'female'> = {};
  const pre: ListeningInput[] = [];
  for (const [i, voice] of [
    'fake-p1',
    'fake-p2',
    'fake-p3',
    'fake-p4',
    'fake-p5',
    'fake-p6',
  ].entries()) {
    genders[voice] = i < 3 ? 'male' : 'female';
    pre.push(await fakeRun(work, voice, 'pre-round'));
  }
  writeListeningSet(
    buildListeningSet({ inputs: pre, seed: 42, mode: 'pre-round', genders }),
    TEST_SET_DIR,
  );
  const items = built.set.kind === 'full' ? built.set.items.length : 0;
  process.stdout.write(`test set ${built.set.setHash}: ${String(items)} clips to rate\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
