// Combobox and Arabic search (slice 0.4-12, criteria 5 and 6, OD-40): a name is found whatever its
// hamza, harakat or final letter form, and the number of results is announced after typing pauses,
// in Arabic in RTL («3 نتائج», «نتيجة واحدة», «نتيجتان», «لا نتائج») and in English in LTR.
import { describe, expect, it } from 'vitest';
import { patientsSharing, personWhere } from '../../test/fixtures.ts';
import { renderDir, typeArabic } from '../../test/support/index.ts';
import { Combobox, type ComboboxItem, matchesWordStart } from './combobox.tsx';

const poll = (fn: () => unknown, message: string, timeout = 2000) =>
  expect.poll(fn, { timeout, message });

const hamza = personWhere((given) => given.startsWith('أ'), { id: '2001' });
const marbuta = personWhere((given) => given.endsWith('ة'), { id: '2002', seed: 41 });
const firstWord = (name: string) => name.split(' ')[0] ?? '';
/** The same name with a fatha after its first letter, as a record may store it. */
const withHarakat = (name: string) => `${name.charAt(0)}َ${name.slice(1)}`;

describe('matchesWordStart folds Arabic (OD-40)', () => {
  it('a query without hamza finds the name with it', () => {
    const bare = firstWord(hamza.name).replace('أ', 'ا');
    expect(matchesWordStart(hamza.name, bare)).toBe(true);
  });

  it('a name stored with harakat is found without them', () => {
    expect(matchesWordStart(withHarakat(hamza.name), firstWord(hamza.name))).toBe(true);
  });

  it('«ه» at the end of a word finds «ة»', () => {
    const typed = firstWord(marbuta.name).replace(/ة$/u, 'ه');
    expect(matchesWordStart(marbuta.name, typed)).toBe(true);
  });

  it('still matches only at the start of a word', () => {
    expect(matchesWordStart(hamza.name, firstWord(hamza.name).slice(2))).toBe(false);
  });
});

const optionTexts = () =>
  [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent);

describe.each(['rtl', 'ltr'] as const)('Combobox search in %s', (dir) => {
  it('finds names whatever their hamza, harakat or final letter form', async () => {
    const stored = withHarakat(marbuta.name);
    const items: ComboboxItem[] = [
      { value: hamza.id, label: hamza.name },
      { value: marbuta.id, label: stored },
    ];
    const screen = await renderDir(<Combobox label="المريض" items={items} emptyMessage="لا" />, {
      dir,
    });
    const input = screen.getByRole('combobox').element() as HTMLInputElement;
    await typeArabic(input, firstWord(hamza.name).replace('أ', 'ا'));
    await poll(optionTexts, 'the hamza name').toEqual([hamza.name]);
    input.select();
    await typeArabic(input, firstWord(marbuta.name).replace(/ة$/u, 'ه'));
    await poll(optionTexts, 'the teh marbuta name, stored with harakat').toEqual([stored]);
    await screen.unmount();
  });
});

const { query, matching, others } = patientsSharing();

/** The polite live region's text, wherever UI SDK or the component puts it. */
const announced = () =>
  [...document.querySelectorAll('[aria-live="polite"], [role="status"]')]
    .map((el) => el.textContent.trim())
    .filter((text) => text !== '');

const CASES = {
  rtl: { none: 'لا نتائج', one: 'نتيجة واحدة', two: 'نتيجتان', three: '3 نتائج' },
  ltr: { none: 'No results', one: '1 result', two: '2 results', three: '3 results' },
} as const;

describe.each(['rtl', 'ltr'] as const)('Combobox announces its results in %s', (dir) => {
  const words = CASES[dir];

  it.each([
    ['three', 3],
    ['two', 2],
    ['one', 1],
    ['none', 0],
  ] as const)('%s', async (key, count) => {
    const items: ComboboxItem[] = [...matching.slice(0, count), ...others].map((p) => ({
      value: p.id,
      label: p.name,
    }));
    const screen = await renderDir(<Combobox label="المريض" items={items} emptyMessage="لا" />, {
      dir,
    });
    const input = screen.getByRole('combobox').element() as HTMLInputElement;
    await typeArabic(input, query);
    await poll(announced, `«${words[key]}»`).toContain(words[key]);
    // Never in the other language as well.
    const other = CASES[dir === 'rtl' ? 'ltr' : 'rtl'];
    expect(announced().some((text) => Object.values(other).includes(text as never))).toBe(false);
    await screen.unmount();
  });
});
