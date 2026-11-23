// Pasted dates (slice 0.4-13 criterion 15): the four formats the spec names, a space as a
// separator, eight digits, Arabic-Indic digits; a two-digit year is kept as typed, never guessed
// (criterion 16); anything else is refused.
import { describe, expect, it } from 'vitest';
import { parseDateText } from './parse-date.ts';

const MARCH_14 = { day: 14, month: 3, year: 1987 };

describe('parseDateText', () => {
  it.each([
    '14/03/1987',
    '14-3-1987',
    '14.3.1987',
    '14 3 1987',
    '1987-03-14',
    '14031987',
    ' 14/03/1987 ',
    '١٤/٠٣/١٩٨٧',
    '۱۴-۳-۱۹۸۷',
  ])('reads %s as 14 March 1987', (text) => {
    expect(parseDateText(text)).toEqual(MARCH_14);
  });

  it('keeps a two-digit year as typed', () => {
    expect(parseDateText('14/03/87')).toEqual({ day: 14, month: 3, year: 87 });
  });

  it('keeps an impossible day for the error to name', () => {
    expect(parseDateText('31/02/1987')).toEqual({ day: 31, month: 2, year: 1987 });
  });

  it.each([
    '',
    'tomorrow',
    '14/03',
    '32/01/1987',
    '14/13/1987',
    '0/3/1987',
    '14/03/19876',
    '1987-3',
    '14//1987',
  ])('refuses %j', (text) => {
    expect(parseDateText(text)).toBeNull();
  });
});
