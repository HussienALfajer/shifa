// No empty strings anywhere, and every Arabic value contains an Arabic letter unless its key is
// on the allow-list (brand names and the like).
import { describe, expect, it } from 'vitest';
import { checkValues, loadSources } from '../src/index.ts';

describe('message values', () => {
  it('the shipped source has no empty or Latin-only Arabic values', () => {
    expect(checkValues(loadSources())).toEqual([]);
  });

  it('red: an empty string is reported in any locale', () => {
    const problems = checkValues({ ar: { common: { a: 'نعم' } }, tr: { common: { a: '' } } });
    expect(problems).toEqual([expect.objectContaining({ file: 'tr/common.json', key: 'a' })]);
  });

  it('red: a whitespace-only value is reported', () => {
    expect(checkValues({ ar: { common: { a: '  ' } } })).toHaveLength(1);
  });

  it('red: a Latin-only Arabic value is reported', () => {
    const problems = checkValues({ ar: { common: { save: 'Save', ok: 'حفظ' } } });
    expect(problems).toEqual([expect.objectContaining({ file: 'ar/common.json', key: 'save' })]);
  });

  it('red: a value made only of a placeholder has no Arabic letter', () => {
    expect(checkValues({ ar: { common: { only: '{name}' } } })).toHaveLength(1);
  });

  it('accepts an allow-listed Latin value', () => {
    const sources = { ar: { common: { brand: 'Shifa' } } };
    expect(checkValues(sources, ['common.brand'])).toEqual([]);
  });

  it('Latin text is fine outside Arabic', () => {
    expect(checkValues({ tr: { common: { save: 'Kaydet' } } })).toEqual([]);
  });
});
