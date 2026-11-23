// The month and year panel's ranges (slice 0.4-13 criterion 14, spec edge case): which years the
// list holds for each combination of `min` and `max`, and which months are outside them.
import { describe, expect, it } from 'vitest';
import { isMonthDisabled, yearRange } from './month-year.ts';

const TODAY_YEAR = 2026;

describe('yearRange', () => {
  it('runs from min to max when both are given', () => {
    expect(yearRange({ min: '2020-05-01', max: '2027-01-31', todayYear: TODAY_YEAR })).toEqual({
      first: 2020,
      last: 2027,
    });
  });

  it('runs from min to ten years after today with only min', () => {
    expect(yearRange({ min: '2026-11-23', todayYear: TODAY_YEAR })).toEqual({
      first: 2026,
      last: 2036,
    });
  });

  it('runs from 120 years before max to max with only max', () => {
    expect(yearRange({ max: '2026-11-23', todayYear: TODAY_YEAR })).toEqual({
      first: 1906,
      last: 2026,
    });
  });

  it('runs from 1900 to ten years after today with neither', () => {
    expect(yearRange({ todayYear: TODAY_YEAR })).toEqual({ first: 1900, last: 2036 });
  });
});

describe('isMonthDisabled', () => {
  const bounds = { min: '2026-03-15', max: '2027-02-10' };

  it('disables months wholly before min or after max', () => {
    expect(isMonthDisabled(2026, 2, bounds)).toBe(true);
    expect(isMonthDisabled(2026, 3, bounds)).toBe(false);
    expect(isMonthDisabled(2027, 2, bounds)).toBe(false);
    expect(isMonthDisabled(2027, 3, bounds)).toBe(true);
    expect(isMonthDisabled(2025, 12, bounds)).toBe(true);
  });

  it('disables nothing without bounds', () => {
    expect(isMonthDisabled(1987, 3, {})).toBe(false);
  });
});
