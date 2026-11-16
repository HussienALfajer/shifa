// Criteria 7–8: the TypeScript normaliser gives every vector key and is idempotent.
import { createRandom } from '@shifa/testing';
import { describe, expect, it } from 'vitest';
import { normaliseName } from '../src/normalise.ts';
import { loadVectors } from './vectors.ts';

const vectors = loadVectors();

describe('normaliseName (TypeScript) against the shared vectors', () => {
  it.each(vectors.cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    expect(normaliseName(c.input)).toBe(c.key);
  });
});

/** Alphabet for the property test: Arabic letters, marks, digits, Latin, spaces and controls. */
const ALPHABET = [
  ...Array.from('ابتثجحخدذرزسشصضطظعغفقكلمنهويءأإآٱؤئةىکی'),
  ...Array.from('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹0123456789'),
  ...Array.from('abcXYZKÖé-'),
  'ً',
  'َ',
  'ِ',
  'ّ',
  'ْ',
  'ٓ',
  'ٔ',
  'ٕ',
  'ٰ',
  'ۖ',
  'ـ',
  '́',
  '̈',
  ' ',
  ' ',
  ' ',
  ' ',
  '‌',
  '‍',
  '‎',
  '‏',
  ' ',
  '\t',
  'K',
  // Particles and short words as whole tokens, so joins and their edge cases come up often.
  'عبد ',
  'أبو ',
  'ابي ',
  'أم ',
  'ابن ',
  'بن ',
  'بنت ',
  'ت ',
];

describe('idempotence: n(n(x)) === n(x)', () => {
  it('holds for every vector key and input', () => {
    for (const c of vectors.cases) {
      expect(normaliseName(c.key), c.id).toBe(c.key);
      const once = normaliseName(c.input);
      expect(normaliseName(once), c.id).toBe(once);
    }
  });

  it('holds for 5,000 seeded random strings', () => {
    const random = createRandom(30_003);
    for (let index = 0; index < 5000; index += 1) {
      const r = random.fork(String(index));
      const length = r.int(0, 24);
      let input = '';
      for (let k = 0; k < length; k += 1) input += r.pick(ALPHABET);
      const once = normaliseName(input);
      expect(normaliseName(once), JSON.stringify(input)).toBe(once);
    }
  });
});

describe('edge cases', () => {
  it.each(['', ' ', '  ', 'َِ', 'ــ'])('gives an empty key for %j', (input) => {
    expect(normaliseName(input)).toBe('');
  });

  it('lower-cases Latin and leaves a trailing particle alone', () => {
    expect(normaliseName('Mohammad ALI')).toBe('mohammad ali');
    expect(normaliseName('محمد عبد')).toBe('محمد عبد');
  });

  it('never changes its input (the display name stays as typed)', () => {
    const display = 'فاطِمة عبد الله';
    const copy = display.slice();
    normaliseName(display);
    expect(display).toBe(copy);
  });
});
