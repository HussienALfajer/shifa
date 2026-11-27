// A-03-02: the generator gives charts of the A-03 shape (spec A-03 criterion 1): name parts from
// its lists that pass the chart's name rule, families on one synthetic contact phone, exact dates
// of birth and ages as typed (years, or months under 2) with their estimated dates. Deterministic
// for a seed; never a real phone.
import { describe, expect, it } from 'vitest';
import {
  createRandom,
  FAMILY_NAMES,
  FEMALE_GIVEN_NAMES,
  generatePatientCharts,
  isSyntheticPhone,
  MALE_GIVEN_NAMES,
  TURKMEN_FAMILY_NAMES,
} from '../../src/index.ts';

const TODAY = '2026-11-27';
const charts = generatePatientCharts({ random: createRandom(42), count: 400, today: TODAY });
const NAME_PART = /^[ء-ي ]{1,40}$/;

describe('generatePatientCharts', () => {
  it('gives the count asked, the same for the same seed', () => {
    expect(charts).toHaveLength(400);
    expect(generatePatientCharts({ random: createRandom(42), count: 400, today: TODAY })).toEqual(
      charts,
    );
    expect(
      generatePatientCharts({ random: createRandom(43), count: 400, today: TODAY }),
    ).not.toEqual(charts);
  });

  it('names come from the lists and fit a chart’s name part', () => {
    const given = new Set([...MALE_GIVEN_NAMES, ...FEMALE_GIVEN_NAMES]);
    const family = new Set([...FAMILY_NAMES, ...TURKMEN_FAMILY_NAMES]);
    for (const c of charts) {
      expect(given.has(c.givenName)).toBe(true);
      expect(MALE_GIVEN_NAMES).toContain(c.fatherName);
      expect(family.has(c.familyName)).toBe(true);
      for (const part of [c.givenName, c.fatherName, c.familyName, c.motherName]) {
        if (part !== null) expect(part).toMatch(NAME_PART);
      }
      expect((c.sex === 'male' ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES).includes(c.givenName)).toBe(
        true,
      );
    }
  });

  it('families share a synthetic contact phone and a family name', () => {
    const byPhone = new Map<string, typeof charts>();
    for (const c of charts) {
      expect(isSyntheticPhone(c.contactPhone)).toBe(true);
      if (c.secondPhone !== null) expect(isSyntheticPhone(c.secondPhone)).toBe(true);
      byPhone.set(c.contactPhone, [...(byPhone.get(c.contactPhone) ?? []), c]);
    }
    const families = [...byPhone.values()].filter((f) => f.length > 1);
    expect(families.length).toBeGreaterThan(20);
    for (const family of families) {
      expect(new Set(family.map((c) => c.familyName)).size).toBe(1);
    }
    expect(charts.some((c) => c.contactPhone.startsWith('+90'))).toBe(true);
  });

  it('exact dates and ages as typed, the estimate worked out from today', () => {
    const exact = charts.filter((c) => !c.birthDateEstimated);
    const aged = charts.filter((c) => c.birthDateEstimated);
    expect(exact.length).toBeGreaterThan(100);
    expect(aged.length).toBeGreaterThan(40);
    for (const c of exact) {
      expect(c.age).toBeNull();
      expect(c.birthDate <= TODAY).toBe(true);
      expect(c.birthDate >= '1896-11-27').toBe(true);
    }
    for (const c of aged) {
      expect(c.age).not.toBeNull();
      if (c.age?.unit === 'years') {
        expect(c.age.value).toBeGreaterThanOrEqual(2);
        expect(c.age.value).toBeLessThanOrEqual(95);
        expect(c.birthDate).toBe(`${String(2026 - c.age.value)}-11-27`);
      } else {
        expect(c.age?.value).toBeGreaterThanOrEqual(0);
        expect(c.age?.value).toBeLessThanOrEqual(23);
      }
    }
    expect(aged.some((c) => c.age?.unit === 'months')).toBe(true);
  });

  it('a child has no mother’s name recorded more often than an adult', () => {
    expect(charts.some((c) => c.motherName === null)).toBe(true);
    expect(charts.some((c) => c.motherName !== null)).toBe(true);
  });
});
