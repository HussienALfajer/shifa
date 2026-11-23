// Arabic folding for search (slice 0.4-12, criterion 5, OD-40): the one function Combobox,
// Select's typeahead and the command palette match through. The cases are copied from the OD-40
// shared vectors (spikes/s3-arabic-output/vectors/name-search-vectors.json; spikes are throwaway,
// so they are copied, not imported) for the rules that apply to a word-start match: NFC, tashkeel,
// tatweel, bidi controls, alef forms, hamza carriers, word-final teh marbuta and alef maksura,
// digits and ASCII case. Whitespace runs and compound-name joining build Phase A's stored key and
// stay out: here every character keeps its place, so a match can be marked in the original.
import { describe, expect, it } from 'vitest';
import { foldArabic } from './fold-arabic.ts';

const VECTORS: readonly (readonly [id: string, input: string, key: string])[] = [
  ['nfc-001', 'أحمد', 'احمد'],
  ['nfc-003', 'آمنة', 'امنه'],
  ['nfc-006', 'José', 'josé'],
  ['tashkeel-001', 'مُحَمَّد', 'محمد'],
  ['tashkeel-002', 'عَلِيّ', 'علي'],
  ['tashkeel-008', 'رَحْمٰن', 'رحمن'],
  ['tashkeel-009', 'ياسِرٌ', 'ياسر'],
  ['tashkeel-012', 'محمدۖ', 'محمد'],
  ['tashkeel-013', 'عمرۡ', 'عمر'],
  ['tatweel-001', 'محـمد', 'محمد'],
  ['tatweel-003', 'خـــالد', 'خالد'],
  ['bidi-001', '‏محمد', 'محمد'],
  ['bidi-003', '‫حسن‬', 'حسن'],
  ['bidi-004', '⁧خالد⁩', 'خالد'],
  ['alef-002', 'إبراهيم', 'ابراهيم'],
  ['alef-004', 'ٱلحلبي', 'الحلبي'],
  ['alef-008', 'الأحمد', 'الاحمد'],
  ['alef-012', 'احمد', 'احمد'],
  ['hamza-carrier-001', 'عائشة', 'عايشه'],
  ['hamza-carrier-002', 'مؤمن', 'مومن'],
  ['hamza-carrier-006', 'هانئ', 'هاني'],
  ['teh-marbuta-001', 'فاطمة', 'فاطمه'],
  ['teh-marbuta-008', 'فاطمة الحلبي', 'فاطمه الحلبي'],
  ['teh-marbuta-010', 'فاطمه', 'فاطمه'],
  ['teh-marbuta-011', 'فاطمةالحلبي', 'فاطمةالحلبي'],
  ['teh-marbuta-012', 'ة', 'ه'],
  ['teh-marbuta-013', 'فاطمة-علي', 'فاطمه-علي'],
  ['alef-maksura-001', 'مصطفى', 'مصطفي'],
  ['alef-maksura-010', 'مصطفى علي', 'مصطفي علي'],
  ['alef-maksura-011', 'مصطفىعلي', 'مصطفىعلي'],
  ['alef-maksura-012', 'ى', 'ي'],
  ['digits-002', '١٢٣', '123'],
  ['digits-003', '۴۵۶', '456'],
  ['digits-007', '١2۳', '123'],
  ['digits-008', '٠١٢٣٤٥٦٧٨٩', '0123456789'],
  ['latin-002', 'AHMAD ALI', 'ahmad ali'],
  ['latin-007', 'ÖZTÜRK', 'ÖztÜrk'],
];

describe('foldArabic', () => {
  it.each(VECTORS)('%s: %j → %j', (_id, input, key) => {
    expect(foldArabic(input)).toBe(key);
  });

  it('finds «أحمد» from «احمد» and «فاطمة» from «فاطمه»', () => {
    expect(foldArabic('احمد')).toBe(foldArabic('أحمد'));
    expect(foldArabic('فاطمه')).toBe(foldArabic('فاطمة'));
  });

  it('folds a name with harakat and tatweel to the bare name', () => {
    expect(foldArabic('فَاطِمَـــة')).toBe(foldArabic('فاطمه'));
  });

  it('folds ى and ة at the end of a word only', () => {
    expect(foldArabic('ليلى سلمى')).toBe('ليلي سلمي');
    expect(foldArabic('مصطفىعلي')).toContain('ى');
    expect(foldArabic('فاطمةالحلبي')).toContain('ة');
  });

  it('keeps every space where it was (no trimming, no joining)', () => {
    expect(foldArabic(' عبد  الله ')).toBe(' عبد  الله ');
  });

  it('is idempotent', () => {
    for (const [, input] of VECTORS) {
      const once = foldArabic(input);
      expect(foldArabic(once)).toBe(once);
    }
  });
});
