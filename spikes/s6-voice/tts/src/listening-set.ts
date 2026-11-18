// The blind listening set (criterion 5) and the pre-round set (criterion 2). Clips are copied under
// random codes; the served set file carries only codes, categories and the intended text of numbers
// and names. The code-to-voice key is written outside the served folder and joined only by the
// analysis script. Order and pairs are fixed by the seed; codes come from a CSPRNG.
import { createHash, randomBytes as cryptoRandomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import {
  type ListeningKey,
  type ListeningSet,
  listeningKeySchema,
  listeningSetSchema,
  type PreRoundVoice,
  type SetItem,
} from './listening-schemas.ts';
import type { Manifest } from './manifest.ts';
import type { Category } from './testset.ts';

export * from './listening-schemas.ts';

export interface ListeningInput {
  manifest: Manifest;
  /** Folder of the manifest; clip files are relative to it. */
  dir: string;
}

export type Gender = 'male' | 'female';

/** The six Chirp 3 HD voices of the pre-round (criterion 2), by Google's published gender. */
export const VOICE_GENDERS: Record<string, Gender> = {
  'ar-XA-Chirp3-HD-Charon': 'male',
  'ar-XA-Chirp3-HD-Fenrir': 'male',
  'ar-XA-Chirp3-HD-Orus': 'male',
  'ar-XA-Chirp3-HD-Aoede': 'female',
  'ar-XA-Chirp3-HD-Kore': 'female',
  'ar-XA-Chirp3-HD-Leda': 'female',
};

export interface BuildOptions {
  inputs: ListeningInput[];
  seed: number;
  mode?: 'full' | 'pre-round';
  /** Pre-round only: gender per voice; defaults to VOICE_GENDERS. */
  genders?: Record<string, Gender>;
  /** Test knob; defaults to node:crypto. */
  randomBytes?: (n: number) => Uint8Array;
}

export interface BuiltListeningSet {
  set: ListeningSet;
  key: ListeningKey;
  /** Clip files to copy: source path → served file (relative to the served folder). */
  files: { source: string; file: string }[];
}

/** Categories where the owner judges correct / wrong and therefore sees the intended text. */
export const JUDGED_CATEGORIES: readonly Category[] = ['number', 'name', 'name-plain'];
export const PAIR_COUNT = 20;

/** mulberry32: a small seeded PRNG; the order must be reproducible from the recorded seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function shuffle<T>(list: readonly T[], rnd: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function codeMaker(forbidden: string[], randomBytes: (n: number) => Uint8Array) {
  const used = new Set<string>();
  const words = forbidden.map((w) => w.toLowerCase()).filter((w) => w.length >= 3);
  return (): string => {
    for (;;) {
      const bytes = randomBytes(8);
      const code = Array.from(bytes, (b) => BASE32[b % 32]).join('');
      const lower = code.toLowerCase();
      if (used.has(code) || words.some((w) => lower.includes(w))) continue;
      used.add(code);
      return code;
    }
  };
}

/** Orders items so that no two neighbours share a clip id (the same text by two voices). */
export function interleave<T>(items: readonly T[], keyOf: (t: T) => string): T[] {
  const out: T[] = [];
  const pending = [...items];
  while (pending.length > 0) {
    const last = out.at(-1);
    const i = pending.findIndex((t) => last === undefined || keyOf(t) !== keyOf(last));
    if (i >= 0) {
      out.push(...pending.splice(i, 1));
      continue;
    }
    // Only items with the previous key remain: place each between two others.
    const item = pending.shift() as T;
    const k = keyOf(item);
    const at = out.findIndex((t, j) => keyOf(t) !== k && (j === 0 || keyOf(out[j - 1] as T) !== k));
    if (at < 0) throw new Error(`cannot interleave clip ${k}`);
    out.splice(at, 0, item);
  }
  return out;
}

export function hashSet(set: Omit<ListeningSet, 'setHash'>): string {
  return createHash('sha256').update(JSON.stringify(set)).digest('hex').slice(0, 16);
}

const voiceIdOf = (m: Manifest) => `${m.header.provider}/${m.header.voice}`;

function checkInputs(inputs: ListeningInput[], mode: 'full' | 'pre-round'): void {
  if (inputs.length < 2) throw new Error('at least two voices are needed');
  const ids = new Set<string>();
  for (const { manifest } of inputs) {
    const id = voiceIdOf(manifest);
    if (ids.has(id)) throw new Error(`voice given twice: ${id}`);
    ids.add(id);
    if (manifest.header.set !== mode) throw new Error(`${id}: manifest set is not ${mode}`);
    const failed = manifest.clips.filter((c) => c.status === 'failed').map((c) => c.clipId);
    if (failed.length > 0) {
      throw new Error(`${id}: manifest has failed clip(s): ${failed.join(', ')}; regenerate first`);
    }
  }
}

function forbiddenWords(inputs: ListeningInput[]): string[] {
  return [
    ...inputs.flatMap(({ manifest }) => [
      manifest.header.provider,
      manifest.header.voice,
      ...manifest.clips.map((c) => c.clipId),
    ]),
  ];
}

/** 20 pairs: each announcement twice, each voice pair at least twice, no repeat of the same trio. */
function planPairs(
  announcementIds: string[],
  voiceIds: string[],
  rnd: () => number,
): { announcementId: string; a: string; b: string }[] {
  const voicePairs: [string, string][] = [];
  for (const [i, x] of voiceIds.entries()) {
    for (const y of voiceIds.slice(i + 1)) {
      voicePairs.push([x, y]);
    }
  }
  const slotsA = [...announcementIds, ...announcementIds].slice(0, PAIR_COUNT);
  const slotsV: [string, string][] = [];
  while (slotsV.length < PAIR_COUNT) slotsV.push(...shuffle(voicePairs, rnd));
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const anns = shuffle(slotsA, rnd);
    const vps = shuffle(slotsV.slice(0, PAIR_COUNT), rnd);
    const trios = anns.map((a, i) => `${a}|${(vps[i] ?? []).join('|')}`);
    if (new Set(trios).size !== trios.length) continue;
    return anns.map((announcementId, i) => {
      const [x, y] = vps[i] ?? ['', ''];
      // Which voice is side A is random too.
      return rnd() < 0.5 ? { announcementId, a: x, b: y } : { announcementId, a: y, b: x };
    });
  }
  throw new Error('could not plan the pairs');
}

export function buildListeningSet(opts: BuildOptions): BuiltListeningSet {
  const mode = opts.mode ?? 'full';
  checkInputs(opts.inputs, mode);
  const rnd = seededRandom(opts.seed);
  const newCode = codeMaker(forbiddenWords(opts.inputs), opts.randomBytes ?? cryptoRandomBytes);
  const files: BuiltListeningSet['files'] = [];
  const codes: ListeningKey['codes'] = {};

  const addClip = (input: ListeningInput, clipId: string, use: 'rating' | 'pair' | 'pre-round') => {
    const clip = input.manifest.clips.find((c) => c.clipId === clipId);
    if (!clip) throw new Error(`${voiceIdOf(input.manifest)}: no clip ${clipId}`);
    // Every provider writes lossless WAV; the page relies on it for pair clips.
    if (extname(clip.file).toLowerCase() !== '.wav') throw new Error(`not a WAV: ${clip.file}`);
    const code = newCode();
    const file = `clips/${code}.wav`;
    files.push({ source: join(input.dir, clip.file), file });
    const { provider, voice, category, text } = clip;
    codes[code] = { provider, voice, clipId, category, text, use };
    return { code, file, clip };
  };

  const voices = opts.inputs.map(({ manifest }) => ({
    voiceId: voiceIdOf(manifest),
    provider: manifest.header.provider,
    voice: manifest.header.voice,
  }));

  if (mode === 'pre-round') return buildPreRound(opts, rnd, voices, addClip, files, codes);

  const ratingPlan = shuffle(
    opts.inputs.flatMap((input) =>
      input.manifest.clips
        .filter((c) => c.category !== 'chime')
        .map((c) => ({ input, clipId: c.clipId })),
    ),
    rnd,
  );
  const items: SetItem[] = interleave(ratingPlan, (p) => p.clipId).map(({ input, clipId }) => {
    const { code, file, clip } = addClip(input, clipId, 'rating');
    return JUDGED_CATEGORIES.includes(clip.category)
      ? { code, file, category: clip.category, text: clip.text }
      : { code, file, category: clip.category };
  });

  const announcements = opts.inputs[0]?.manifest.announcements ?? [];
  const byVoice = new Map(opts.inputs.map((i) => [voiceIdOf(i.manifest), i]));
  const plan = planPairs(
    announcements.map((a) => a.id),
    voices.map((v) => v.voiceId),
    rnd,
  );
  const keyPairs: ListeningKey['pairs'] = [];
  const pairs = plan.map((p, i) => {
    const id = `p${String(i + 1).padStart(2, '0')}`;
    const clipIds = announcements.find((a) => a.id === p.announcementId)?.clipIds ?? [];
    const side = (voiceId: string) => {
      const input = byVoice.get(voiceId);
      if (!input) throw new Error(`no voice ${voiceId}`);
      return clipIds.map((clipId) => addClip(input, clipId, 'pair').code);
    };
    keyPairs.push({ id, ...p });
    return { id, a: side(p.a), b: side(p.b) };
  });

  // The seed stays in the key only: with the public builder it would reveal each item's voice.
  const body = { schemaVersion: 1 as const, kind: 'full' as const, items, pairs };
  const setHash = hashSet(body);
  const set = listeningSetSchema.parse({ ...body, setHash });
  const key = listeningKeySchema.parse({
    schemaVersion: 1,
    kind: 'full',
    setHash,
    seed: opts.seed,
    voices,
    codes,
    pairs: keyPairs,
  });
  return { set, key, files };
}

function buildPreRound(
  opts: BuildOptions,
  rnd: () => number,
  voices: ListeningKey['voices'],
  addClip: (
    input: ListeningInput,
    clipId: string,
    use: 'pre-round',
  ) => { code: string; file: string },
  files: BuiltListeningSet['files'],
  codes: ListeningKey['codes'],
): BuiltListeningSet {
  const genders = opts.genders ?? VOICE_GENDERS;
  const order = shuffle(opts.inputs, rnd);
  const phrases = (opts.inputs[0]?.manifest.clips ?? []).map((c) => c.text);
  const keyVoices: ListeningKey['voices'] = [];
  const setVoices: PreRoundVoice[] = order.map((input, i) => {
    const label = i + 1;
    const voice = input.manifest.header.voice;
    const gender = genders[voice];
    if (!gender) throw new Error(`no gender for voice ${voice}`);
    const base = voices.find(
      (v) => v.voice === voice && v.provider === input.manifest.header.provider,
    );
    if (base) keyVoices.push({ ...base, label, gender });
    const clips = input.manifest.clips.map((c, phrase) => {
      const { code, file } = addClip(input, c.clipId, 'pre-round');
      return { code, file, phrase: phrase + 1 };
    });
    return { label, gender, clips };
  });
  const body = {
    schemaVersion: 1 as const,
    kind: 'pre-round' as const,
    phrases,
    voices: setVoices,
  };
  const setHash = hashSet(body);
  const set = listeningSetSchema.parse({ ...body, setHash });
  const key = listeningKeySchema.parse({
    schemaVersion: 1,
    kind: 'pre-round',
    setHash,
    seed: opts.seed,
    voices: keyVoices,
    codes,
    pairs: [],
  });
  return { set, key, files };
}

/**
 * Writes `<outDir>/served/` (the set file and its clips: what the page may read) and the key next
 * to it, outside the served folder.
 */
export function writeListeningSet(
  built: BuiltListeningSet,
  outDir: string,
): { servedDir: string; keyFile: string; setFile: string } {
  const servedDir = join(outDir, 'served');
  mkdirSync(join(servedDir, 'clips'), { recursive: true });
  for (const { source, file } of built.files) copyFileSync(source, join(servedDir, file));
  const full = built.set.kind === 'full';
  const setFile = join(servedDir, full ? 'listening-set.json' : 'pre-round-set.json');
  const keyFile = join(outDir, full ? 'listening-key.json' : 'pre-round-key.json');
  writeFileSync(setFile, `${JSON.stringify(built.set, null, 2)}\n`);
  writeFileSync(keyFile, `${JSON.stringify(built.key, null, 2)}\n`);
  return { servedDir, keyFile, setFile };
}
