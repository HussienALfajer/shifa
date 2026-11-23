// The typed date's model (slice 0.4-13 criterion 15, OD-72): digits fill a segment and say when
// it is full; nothing is clamped (31 stays 31 in February, for the error to name); Up and Down
// step and wrap; the ISO value exists only for a real date with a four-digit year.
import { describe, expect, it } from 'vitest';
import {
  EMPTY_ENTRY,
  type Entry,
  entryFromIso,
  removeDigit,
  segmentText,
  stepEntry,
  toIso,
  typeDigit,
} from './date-fields.ts';

const TODAY = { day: 23, month: 11, year: 2026 };

function typeAll(entry: Entry, unit: 'day' | 'month' | 'year', digits: string) {
  let current = entry;
  let done = false;
  for (const digit of digits) ({ entry: current, done } = typeDigit(current, unit, digit));
  return { entry: current, done };
}

describe('typeDigit', () => {
  it('fills the day with two digits and says it is done', () => {
    const one = typeDigit(EMPTY_ENTRY, 'day', '1');
    expect(one.done).toBe(false);
    expect(segmentText(one.entry, 'day')).toBe('1');
    const two = typeDigit(one.entry, 'day', '4');
    expect(two.done).toBe(true);
    expect(two.entry.fields.day).toBe(14);
    expect(segmentText(two.entry, 'day')).toBe('14');
  });

  it('a digit that cannot start a two-digit value is done at once: 4 → 04, 2 → 02', () => {
    const day = typeDigit(EMPTY_ENTRY, 'day', '4');
    expect(day.done).toBe(true);
    expect(segmentText(day.entry, 'day')).toBe('04');
    const month = typeDigit(EMPTY_ENTRY, 'month', '2');
    expect(month.done).toBe(true);
    expect(segmentText(month.entry, 'month')).toBe('02');
  });

  it('takes four digits for the year', () => {
    const three = typeAll(EMPTY_ENTRY, 'year', '198');
    expect(three.done).toBe(false);
    expect(segmentText(three.entry, 'year')).toBe('198');
    const four = typeDigit(three.entry, 'year', '7');
    expect(four.done).toBe(true);
    expect(four.entry.fields.year).toBe(1987);
  });

  it('never clamps the day to its month', () => {
    let { entry } = typeAll(EMPTY_ENTRY, 'day', '31');
    ({ entry } = typeAll(entry, 'month', '02'));
    ({ entry } = typeAll(entry, 'year', '1987'));
    expect(entry.fields).toEqual({ day: 31, month: 2, year: 1987 });
    expect(toIso(entry.fields)).toBeNull();
  });

  it('starts again from the digit when the number would be too big', () => {
    const { entry } = typeAll(EMPTY_ENTRY, 'month', '1');
    const next = typeDigit(entry, 'month', '5');
    expect(segmentText(next.entry, 'month')).toBe('05');
    expect(next.done).toBe(true);
  });
});

describe('removeDigit', () => {
  it('removes the last typed digit, then empties, then says to move back', () => {
    const { entry } = typeAll(EMPTY_ENTRY, 'year', '198');
    const two = removeDigit(entry, 'year');
    expect(segmentText(two.entry, 'year')).toBe('19');
    const filled = entryFromIso('1987-03-14');
    const emptied = removeDigit(filled, 'month');
    expect(emptied.entry.fields.month).toBeNull();
    expect(emptied.back).toBe(false);
    expect(removeDigit(emptied.entry, 'month').back).toBe(true);
  });
});

describe('stepEntry', () => {
  it('steps and wraps each unit', () => {
    const december = entryFromIso('1987-12-14');
    expect(stepEntry(december, 'month', 1, TODAY).fields.month).toBe(1);
    expect(stepEntry(entryFromIso('1987-01-14'), 'month', -1, TODAY).fields.month).toBe(12);
    expect(stepEntry(entryFromIso('1987-02-28'), 'day', 1, TODAY).fields.day).toBe(1);
    expect(stepEntry(entryFromIso('1988-02-28'), 'day', 1, TODAY).fields.day).toBe(29);
    expect(stepEntry(december, 'year', -5, TODAY).fields.year).toBe(1982);
  });

  it('an empty segment starts at today', () => {
    expect(stepEntry(EMPTY_ENTRY, 'year', 1, TODAY).fields.year).toBe(2026);
    expect(stepEntry(EMPTY_ENTRY, 'month', -1, TODAY).fields.month).toBe(11);
    expect(stepEntry(EMPTY_ENTRY, 'day', 1, TODAY).fields.day).toBe(23);
  });

  it('does not move the day when the month changes', () => {
    expect(stepEntry(entryFromIso('1987-01-31'), 'month', 1, TODAY).fields).toEqual({
      day: 31,
      month: 2,
      year: 1987,
    });
  });
});

describe('toIso and entryFromIso', () => {
  it('round-trips a date', () => {
    expect(toIso(entryFromIso('1987-03-14').fields)).toBe('1987-03-14');
  });

  it('is null until complete, for an impossible date and for a year under four digits', () => {
    expect(toIso({ day: 14, month: 3, year: null })).toBeNull();
    expect(toIso({ day: 29, month: 2, year: 1987 })).toBeNull();
    expect(toIso({ day: 29, month: 2, year: 1988 })).toBe('1988-02-29');
    expect(toIso({ day: 14, month: 3, year: 87 })).toBeNull();
  });

  it('reads null or a malformed value as empty', () => {
    expect(entryFromIso(null)).toEqual(EMPTY_ENTRY);
    expect(entryFromIso('14/03/1987')).toEqual(EMPTY_ENTRY);
  });
});
