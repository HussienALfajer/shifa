// A-03 criterion 6 (A-03-03 checkpoint 1; ADR-0034, ADR-0052, OD-145): the name-search key. The
// shared vector file is the contract: the TypeScript port gives `key` for every `input`, as the
// Dart port (shifa_name_key) and the SQL drift check do. The gaps the owner decided (OD-145) have
// their own cases: ALM and the word joiner removed like every other format character, Latin
// capitals of the whole Latin script lower-cased, and the ؤ, digit and NFC variants.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  keyWords,
  lookupToken,
  NAME_KEY_VERSION,
  NAME_TOKEN_MAX,
  nameTokens,
  normaliseName,
} from '../src/name-key.ts';

interface VectorCase {
  id: string;
  rule: string;
  input: string;
  key: string;
}
interface VectorFile {
  version: number;
  rules: { id: string }[];
  cases: VectorCase[];
}

const vectors = JSON.parse(
  readFileSync(new URL('../vectors/name-search-vectors.json', import.meta.url), 'utf8'),
) as VectorFile;

describe('the shared vectors', () => {
  it('are version 2, the key version tokens are stored with', () => {
    expect(vectors.version).toBe(2);
    expect(NAME_KEY_VERSION).toBe(vectors.version);
  });

  it('have unique ids, and every case names a listed rule', () => {
    const ids = vectors.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rules = new Set(vectors.rules.map((r) => r.id));
    expect(vectors.cases.filter((c) => !rules.has(c.rule)).map((c) => c.id)).toEqual([]);
  });

  it.each(vectors.cases.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    expect(normaliseName(c.input)).toBe(c.key);
  });
});

describe('the gaps decided in OD-145', () => {
  const byId = (id: string) => vectors.cases.find((c) => c.id === id);

  it('removes ALM U+061C and the word joiner U+2060, so a particle still joins', () => {
    expect(normaliseName('ريم\u{061C}')).toBe('ريم');
    expect(normaliseName('عبد\u{2060} الله')).toBe('عبدالله');
  });

  it('removes every format character but keeps ZWSP, ZWNJ, ZWJ and BOM as spaces', () => {
    expect(byId('format-017')?.key).toBe('اب');
    for (const space of ['\u{200B}', '\u{200C}', '\u{200D}', '\u{FEFF}']) {
      expect(normaliseName(`ريم${space}احمد`)).toBe('ريم احمد');
    }
  });

  it('lower-cases Latin capitals of the whole Latin script, without locale rules', () => {
    expect(normaliseName('ÖZTÜRK')).toBe('öztürk');
    expect(normaliseName('İsmail IŞIK')).toBe('ismail işik');
    expect(normaliseName('ΑΘΗΝΑ')).toBe('ΑΘΗΝΑ');
  });

  it('folds ؤ in its composed and decomposed forms', () => {
    expect(normaliseName('رؤوف')).toBe(normaliseName('ر\u{0648}\u{0654}وف'));
    expect(normaliseName('رؤوف')).toBe('رووف');
  });

  it('gives the same key for every digit system', () => {
    expect(normaliseName('٠٩٣٠ ۰۱۲ 345')).toBe('0930 012 345');
  });

  it('gives the same key for composed and decomposed input', () => {
    expect(normaliseName('ا\u{064E}\u{0654}حمد')).toBe(normaliseName('أحمد'));
    expect(normaliseName('Jose\u{0301}')).toBe('josé');
  });
});

describe('name tokens (ADR-0052)', () => {
  it('stores every prefix of two letters or more of each word, by part', () => {
    const tokens = nameTokens(['ريم', null, 'الحلبي']);
    expect(tokens.filter((t) => t.part === 0).map((t) => t.token)).toEqual(['ري', 'ريم']);
    expect(tokens.filter((t) => t.part === 2).map((t) => [t.token, t.whole])).toEqual([
      ['ال', false],
      ['الح', false],
      ['الحل', false],
      ['الحلب', false],
      ['الحلبي', true],
    ]);
  });

  it('keys each part, so variants share tokens and a part may hold several words', () => {
    expect(nameTokens(['أحمد'])).toEqual(nameTokens(['احمد']));
    const two = nameTokens(['عبد الله محمد']);
    expect(two.filter((t) => t.whole).map((t) => [t.word, t.token])).toEqual([
      [0, 'عبدالله'],
      [1, 'محمد'],
    ]);
  });

  it('keeps a one-letter word as itself and cuts long words at the stored length', () => {
    expect(nameTokens(['م'])).toEqual([{ part: 0, word: 0, token: 'م', whole: true }]);
    const long = 'ب'.repeat(30);
    const tokens = nameTokens([long]);
    expect(tokens.at(-1)).toMatchObject({ token: 'ب'.repeat(NAME_TOKEN_MAX), whole: false });
    expect(lookupToken(long)).toBe('ب'.repeat(NAME_TOKEN_MAX));
  });

  it('splits a key into its words', () => {
    expect(keyWords('')).toEqual([]);
    expect(keyWords(normaliseName('  ريم   أحمد '))).toEqual(['ريم', 'احمد']);
  });
});
