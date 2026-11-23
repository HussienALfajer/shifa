// Typed-date errors and the confirmation line (slice 0.4-13 criterion 16, OD-72): every text in
// Arabic and English, leap years, 30-day months, min and max, `maxMessage`, a two-digit year
// never guessed; the weekday line with the Levantine month, and the age when asked.
import { describe, expect, it } from 'vitest';
import { dateError } from './date-errors.ts';
import { ageText, dateLine } from './date-text.ts';

const F = (day: number | null, month: number | null, year: number | null) => ({
  day,
  month,
  year,
});

describe('dateError', () => {
  it('has nothing to say about an empty or valid date', () => {
    expect(dateError({ fields: F(null, null, null), dir: 'rtl' })).toBeNull();
    expect(dateError({ fields: F(14, 3, 1987), dir: 'rtl' })).toBeNull();
    expect(dateError({ fields: F(29, 2, 1988), dir: 'rtl' })).toBeNull();
  });

  it('names the missing part', () => {
    expect(dateError({ fields: F(14, 3, null), dir: 'rtl' })).toBe('أكمل التاريخ: السنة ناقصة');
    expect(dateError({ fields: F(14, null, 1987), dir: 'rtl' })).toBe('أكمل التاريخ: الشهر ناقص');
    expect(dateError({ fields: F(null, 3, 1987), dir: 'rtl' })).toBe('أكمل التاريخ: اليوم ناقص');
    expect(dateError({ fields: F(null, null, 1987), dir: 'rtl' })).toBe('أكمل التاريخ: اليوم ناقص');
    expect(dateError({ fields: F(14, 3, null), dir: 'ltr' })).toBe(
      'Complete the date: the year is missing',
    );
    expect(dateError({ fields: F(14, null, 1987), dir: 'ltr' })).toBe(
      'Complete the date: the month is missing',
    );
    expect(dateError({ fields: F(null, 3, 1987), dir: 'ltr' })).toBe(
      'Complete the date: the day is missing',
    );
  });

  it('asks for four digits and never guesses the century', () => {
    expect(dateError({ fields: F(14, 3, 87), dir: 'rtl' })).toBe('اكتب السنة بأربعة أرقام: 1987');
    expect(dateError({ fields: F(14, 3, 987), dir: 'rtl' })).toBe('اكتب السنة بأربعة أرقام: 1987');
    expect(dateError({ fields: F(14, 3, 87), dir: 'ltr' })).toBe(
      'Write the year with four digits: 1987',
    );
  });

  it('names the days of the month for an impossible date', () => {
    expect(dateError({ fields: F(31, 2, 1987), dir: 'rtl' })).toBe('شباط 1987 فيه 28 يوماً');
    expect(dateError({ fields: F(30, 2, 1988), dir: 'rtl' })).toBe('شباط 1988 فيه 29 يوماً');
    expect(dateError({ fields: F(31, 4, 2026), dir: 'rtl' })).toBe('نيسان 2026 فيه 30 يوماً');
    expect(dateError({ fields: F(31, 2, 1987), dir: 'ltr' })).toBe('February 1987 has 28 days');
  });

  it('keeps the date within min and max', () => {
    const min = '2026-11-23';
    const max = '2026-12-31';
    expect(dateError({ fields: F(12, 11, 2026), min, dir: 'rtl' })).toBe(
      'اختر تاريخاً من 23/11/2026 فصاعداً',
    );
    expect(dateError({ fields: F(23, 11, 2026), min, dir: 'rtl' })).toBeNull();
    expect(dateError({ fields: F(2, 1, 2027), max, dir: 'rtl' })).toBe(
      'اختر تاريخاً حتى 31/12/2026',
    );
    expect(dateError({ fields: F(12, 11, 2026), min, dir: 'ltr' })).toBe(
      'Choose a date from 23/11/2026 onwards',
    );
    expect(dateError({ fields: F(2, 1, 2027), max, dir: 'ltr' })).toBe(
      'Choose a date up to 31/12/2026',
    );
  });

  it('uses maxMessage when given', () => {
    expect(
      dateError({
        fields: F(2, 1, 2027),
        max: '2026-11-23',
        maxMessage: 'تاريخ الميلاد لا يكون بعد اليوم',
        dir: 'rtl',
      }),
    ).toBe('تاريخ الميلاد لا يكون بعد اليوم');
  });
});

describe('dateLine and ageText', () => {
  it('writes the weekday, the day, the Levantine month and the year', () => {
    expect(dateLine('1987-03-14', 'rtl')).toBe('السبت 14 آذار 1987');
    expect(dateLine('2026-11-23', 'rtl')).toBe('الاثنين 23 تشرين الثاني 2026');
    expect(dateLine('1987-03-14', 'ltr')).toBe('Saturday 14 March 1987');
  });

  it('counts whole years, in Arabic and English', () => {
    const today = '2026-11-23';
    expect(ageText('1987-03-14', today, 'rtl')).toBe('39 سنة');
    expect(ageText('1987-11-24', today, 'rtl')).toBe('38 سنة');
    expect(ageText('2020-01-01', today, 'rtl')).toBe('6 سنوات');
    expect(ageText('2024-11-23', today, 'rtl')).toBe('سنتان');
    expect(ageText('2025-11-23', today, 'rtl')).toBe('سنة واحدة');
    expect(ageText('2026-05-01', today, 'rtl')).toBe('أقل من سنة');
    expect(ageText('1987-03-14', today, 'ltr')).toBe('39 years');
    expect(ageText('2025-11-23', today, 'ltr')).toBe('1 year');
    expect(ageText('2026-05-01', today, 'ltr')).toBe('under 1 year');
  });

  it('has no age for a date after today', () => {
    expect(ageText('2027-01-01', '2026-11-23', 'rtl')).toBeNull();
  });
});
