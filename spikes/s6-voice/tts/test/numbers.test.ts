// Criterion 3: one normaliser writes every chosen number as Arabic words, read after "الرقم".
import { describe, expect, it } from 'vitest';
import { CHOSEN_NUMBERS } from '../src/data.ts';
import { numberToArabicWords } from '../src/numbers.ts';

const TASHKEEL = /[ً-ٰٟ]/u;

describe('numberToArabicWords', () => {
  it('matches every entry of data/numbers.json (50 chosen numbers)', () => {
    expect(CHOSEN_NUMBERS).toHaveLength(50);
    expect(new Set(CHOSEN_NUMBERS.map((e) => e.n)).size).toBe(50);
    for (const { n, words } of CHOSEN_NUMBERS) {
      expect({ n, words: numberToArabicWords(n) }).toEqual({ n, words });
    }
  });

  it('covers the grammar cases named in the spec', () => {
    const chosen = new Set(CHOSEN_NUMBERS.map((e) => e.n));
    const required = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 19, 20, 21, 99, 100, 101, 102];
    for (const n of [...required, 110, 111, 200, 300, 999]) expect(chosen.has(n)).toBe(true);
  });

  it('refuses 0, 1000 and non-integers', () => {
    expect(() => numberToArabicWords(0)).toThrow(RangeError);
    expect(() => numberToArabicWords(1000)).toThrow(RangeError);
    expect(() => numberToArabicWords(-3)).toThrow(RangeError);
    expect(() => numberToArabicWords(2.5)).toThrow(RangeError);
  });

  it('writes no digits and no tashkeel for any number from 1 to 999', () => {
    for (let n = 1; n <= 999; n += 1) {
      const words = numberToArabicWords(n);
      expect(words).not.toMatch(/[0-9٠-٩]/u);
      expect(words).not.toMatch(TASHKEEL);
      expect(words.trim()).toBe(words);
      expect(words).not.toContain('  ');
    }
  });
});
