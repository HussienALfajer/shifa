// A-03 criterion 1 (A-03-02): an age becomes an estimated date of birth on the Damascus day of the
// injected clock (years, or months under 2); an exact date is kept as typed and is not estimated.
// A date in the future or more than 130 years back is refused on body.birthDate.
import { describe, expect, it } from 'vitest';
import { birthOf, damascusToday } from '../../src/modules/patients/birth.ts';
import { RequestValidationError } from '../../src/platform/contract/index.ts';

describe('the Damascus day', () => {
  it('is the calendar day in Asia/Damascus, whatever the server zone', () => {
    // 22:30 UTC is already the next day in Damascus (UTC+3).
    expect(damascusToday({ now: () => new Date('2026-11-27T22:30:00Z') })).toBe('2026-11-28');
    expect(damascusToday({ now: () => new Date('2026-11-27T20:59:00Z') })).toBe('2026-11-27');
  });
});

describe('age to an estimated date of birth', () => {
  const today = '2026-11-27';

  it('years go back from today, flagged as estimated', () => {
    expect(birthOf({ age: { value: 30, unit: 'years' } }, today)).toEqual({
      birthDate: '1996-11-27',
      estimated: true,
    });
  });

  it('months go back from today, across a year', () => {
    expect(birthOf({ age: { value: 14, unit: 'months' } }, today)).toEqual({
      birthDate: '2025-09-27',
      estimated: true,
    });
    expect(birthOf({ age: { value: 0, unit: 'months' } }, today)).toEqual({
      birthDate: today,
      estimated: true,
    });
  });

  it('a day the earlier month lacks falls on its last day', () => {
    expect(birthOf({ age: { value: 1, unit: 'months' } }, '2026-03-31')).toEqual({
      birthDate: '2026-02-28',
      estimated: true,
    });
    expect(birthOf({ age: { value: 3, unit: 'years' } }, '2028-02-29')).toEqual({
      birthDate: '2025-02-28',
      estimated: true,
    });
  });

  it('an exact date is kept and not estimated', () => {
    expect(birthOf({ birthDate: '1990-03-12' }, today)).toEqual({
      birthDate: '1990-03-12',
      estimated: false,
    });
    expect(birthOf({ birthDate: today }, today)).toEqual({ birthDate: today, estimated: false });
  });

  it('refuses a date after today or more than 130 years back (body.birthDate)', () => {
    for (const birthDate of ['2026-11-28', '1896-11-26']) {
      try {
        birthOf({ birthDate }, today);
        expect.unreachable(birthDate);
      } catch (err) {
        expect(err).toBeInstanceOf(RequestValidationError);
        expect((err as RequestValidationError).issues).toEqual([
          { path: 'body.birthDate', code: 'invalid_value' },
        ]);
      }
    }
    expect(birthOf({ birthDate: '1896-11-27' }, today).estimated).toBe(false);
  });

  it('nothing given: undefined (an edit that leaves the birth alone)', () => {
    expect(birthOf({}, today)).toBeUndefined();
  });
});
