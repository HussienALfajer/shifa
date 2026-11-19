// Criterion 5: the blind listening set. Codes carry nothing about the voice, the served file has no
// provider or voice field, the key (kept apart) covers every code, the order is fixed by the seed
// and never plays the same text twice in a row, and a manifest with a failed clip is refused.
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { generate } from '../src/generate.ts';
import {
  buildListeningSet,
  type ListeningInput,
  listeningKeySchema,
  listeningSetSchema,
  writeListeningSet,
} from '../src/listening-set.ts';
import { readManifest } from '../src/manifest.ts';
import { createFakeProvider } from '../src/providers/fake.ts';
import { FIXED_NOW, fakeSleep, recordingLog, tempOutDir } from './helpers.ts';

const VOICES = ['fake-1', 'fake-2', 'fake-3', 'fake-4', 'fake-5'];
let inputs: ListeningInput[] = [];

beforeAll(async () => {
  const outDir = tempOutDir();
  for (const voice of VOICES) {
    await generate({
      provider: createFakeProvider(),
      voice,
      set: 'full',
      outDir,
      now: FIXED_NOW,
      log: recordingLog().log,
      sleep: fakeSleep().sleep,
    });
  }
  inputs = VOICES.map((voice) => {
    const dir = join(outDir, 'fake', voice);
    return { manifest: readManifest(join(dir, 'manifest.json')), dir };
  });
}, 60_000);

const allCodes = (built: ReturnType<typeof buildListeningSet>) => {
  if (built.set.kind !== 'full') throw new Error('full set expected');
  return [
    ...built.set.items.map((i) => i.code),
    ...built.set.pairs.flatMap((p) => [...p.a, ...p.b]),
  ];
};

describe('listening set builder', () => {
  it('gives every clip a unique random code with no clip id or voice in it', () => {
    const built = buildListeningSet({ inputs, seed: 7 });
    const codes = allCodes(built);
    expect(new Set(codes).size).toBe(codes.length);
    const clipIds = inputs[0]?.manifest.clips.map((c) => c.clipId) ?? [];
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-7]{8}$/u);
      const lower = code.toLowerCase();
      for (const id of [...clipIds, ...VOICES, 'fake']) expect(lower).not.toContain(id);
    }
    // Every clip but the chime is rated once per voice: 177 × 5.
    if (built.set.kind !== 'full') throw new Error('full set expected');
    expect(built.set.items).toHaveLength(177 * 5);
  });

  it('writes a served set with no provider, voice, clip id or source file name', () => {
    const built = buildListeningSet({ inputs, seed: 7 });
    const text = JSON.stringify(listeningSetSchema.parse(built.set));
    for (const word of ['provider', 'voice', 'clipId', 'fake', 'manifest', 'number-0']) {
      expect(text).not.toContain(word);
    }
    // No source file name (number-011.wav, name-m01.wav, chime.wav): only clips/<code>.wav.
    const sourceFiles = inputs[0]?.manifest.clips.map((c) => c.file) ?? [];
    expect(sourceFiles.length).toBeGreaterThan(0);
    for (const file of sourceFiles) expect(text).not.toContain(file);
    if (built.set.kind !== 'full') throw new Error('full set expected');
    for (const item of built.set.items) {
      expect(Object.keys(item).sort()).toEqual(
        item.text === undefined
          ? ['category', 'code', 'file']
          : ['category', 'code', 'file', 'text'],
      );
      expect(item.file).toBe(`clips/${item.code}.wav`);
      // Intended text only where the owner judges correct / wrong.
      expect(item.text !== undefined).toBe(
        ['number', 'name', 'name-plain'].includes(item.category),
      );
    }

    const out = tempOutDir();
    const { servedDir, keyFile } = writeListeningSet(built, out);
    expect(relative(servedDir, keyFile).startsWith('..')).toBe(true);
    expect(existsSync(join(servedDir, 'listening-set.json'))).toBe(true);
    const first = built.set.items[0];
    expect(first && existsSync(join(servedDir, first.file))).toBe(true);
    const served = readFileSync(join(servedDir, 'listening-set.json'), 'utf8');
    expect(served).not.toContain('fake');
  });

  it('has a key that covers every code and nothing else', () => {
    const built = buildListeningSet({ inputs, seed: 7 });
    const key = listeningKeySchema.parse(built.key);
    expect(key.setHash).toBe(built.set.setHash);
    expect(Object.keys(key.codes).sort()).toEqual(allCodes(built).sort());
    for (const entry of Object.values(key.codes)) {
      expect(entry.provider).toBe('fake');
      expect(VOICES).toContain(entry.voice);
    }
  });

  it('fixes the order and the pairs by the seed', () => {
    const order = (seed: number) => {
      const built = buildListeningSet({ inputs, seed });
      if (built.set.kind !== 'full') throw new Error('full set expected');
      const items = built.set.items.map((i) => {
        const e = built.key.codes[i.code];
        return `${e?.voice ?? ''}:${e?.clipId ?? ''}`;
      });
      const pairs = built.key.pairs.map((p) => `${p.announcementId}:${p.a}:${p.b}`);
      return { items, pairs };
    };
    expect(order(7)).toEqual(order(7));
    expect(order(8).items).not.toEqual(order(7).items);
    expect(order(8).pairs).not.toEqual(order(7).pairs);
  });

  it('never plays the same text twice in a row and balances the 20 pairs', () => {
    for (const seed of [1, 2, 3]) {
      const built = buildListeningSet({ inputs, seed });
      if (built.set.kind !== 'full') throw new Error('full set expected');
      const clipIds = built.set.items.map((i) => built.key.codes[i.code]?.clipId);
      for (let i = 1; i < clipIds.length; i += 1) {
        expect(clipIds[i], `seed ${String(seed)} at ${String(i)}`).not.toBe(clipIds[i - 1]);
      }
      expect(built.set.pairs).toHaveLength(20);
      const perAnnouncement = new Map<string, number>();
      const perVoicePair = new Map<string, number>();
      for (const p of built.key.pairs) {
        expect(p.a).not.toBe(p.b);
        perAnnouncement.set(p.announcementId, (perAnnouncement.get(p.announcementId) ?? 0) + 1);
        const vp = [p.a, p.b].sort().join('|');
        perVoicePair.set(vp, (perVoicePair.get(vp) ?? 0) + 1);
      }
      expect([...perAnnouncement.values()]).toEqual(Array<number>(10).fill(2));
      expect(perVoicePair.size).toBe(10);
      expect([...perVoicePair.values()].every((n) => n >= 2)).toBe(true);
      // Each side is the announcement's four clips in order, all of one voice.
      for (const [i, pair] of built.set.pairs.entries()) {
        const keyPair = built.key.pairs[i];
        for (const [side, voiceId] of [
          [pair.a, keyPair?.a],
          [pair.b, keyPair?.b],
        ] as const) {
          const entries = side.map((code) => built.key.codes[code]);
          expect(entries.map((e) => e?.category)).toEqual(['chime', 'name', 'number', 'room']);
          expect(new Set(entries.map((e) => `${e?.provider ?? ''}/${e?.voice ?? ''}`))).toEqual(
            new Set([voiceId]),
          );
        }
      }
    }
  });

  it('refuses a manifest with a failed clip', () => {
    const [first, ...rest] = inputs;
    if (!first) throw new Error('no input');
    const broken: ListeningInput = {
      dir: first.dir,
      manifest: {
        ...first.manifest,
        clips: first.manifest.clips.map((c) =>
          c.clipId === 'number-011'
            ? { ...c, status: 'failed' as const, sha256: null, error: { status: 500 } }
            : c,
        ),
      },
    };
    expect(() => buildListeningSet({ inputs: [broken, ...rest], seed: 7 })).toThrow(
      /failed clip.*number-011/u,
    );
  });
});
