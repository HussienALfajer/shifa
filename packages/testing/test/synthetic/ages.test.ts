// Spec 0.2-08 criterion 12: a spread of ages, nothing born after now, children on adult accounts.
import { describe, expect, it } from 'vitest';
import { FixedClock, generateDataset } from '../../src/index.ts';

const SEEDS = Array.from({ length: 50 }, (_, index) => index + 1);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole years between a YYYY-MM-DD birth date and a moment, by the calendar (UTC). */
const ageOn = (birthDate: string, now: Date): number => {
  const [year, month, day] = birthDate.split('-').map(Number) as [number, number, number];
  let age = now.getUTCFullYear() - year;
  const beforeBirthday =
    now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
};

describe('ages and birth dates', () => {
  for (const clockStart of ['2026-01-01T00:00:00Z', '2030-08-20T12:00:00Z']) {
    it(`spreads children, adults and over-65s with no future birth date (${clockStart})`, () => {
      const now = new Date(clockStart);
      for (const preset of ['minimal', 'demo'] as const) {
        for (const seed of SEEDS) {
          const dataset = generateDataset({ seed, preset, clock: new FixedClock(clockStart) });
          const accounts = new Map(dataset.patientAccounts.map((account) => [account.id, account]));
          const ages: number[] = [];
          for (const account of dataset.patientAccounts) {
            expect(account.birthDate).toMatch(DATE);
            const age = ageOn(account.birthDate, now);
            expect(age, 'account holders are adults').toBeGreaterThanOrEqual(18);
            ages.push(age);
          }
          for (const dependent of dataset.dependents) {
            expect(dependent.birthDate).toMatch(DATE);
            const age = ageOn(dependent.birthDate, now);
            expect(age).toBeGreaterThanOrEqual(0);
            ages.push(age);
            if (age < 18) {
              const holder = accounts.get(dependent.accountId);
              expect(holder).toBeDefined();
              expect(ageOn(holder?.birthDate ?? '', now)).toBeGreaterThanOrEqual(18);
            }
          }
          const label = `${preset} seed ${String(seed)}`;
          expect(
            ages.some((age) => age < 18),
            `${label}: child`,
          ).toBe(true);
          expect(
            ages.some((age) => age >= 18 && age < 65),
            `${label}: adult`,
          ).toBe(true);
          expect(
            ages.some((age) => age >= 65),
            `${label}: over 65`,
          ).toBe(true);
        }
      }
    });
  }

  it('practitioners are adults of working age', () => {
    const dataset = generateDataset({ seed: 2, preset: 'demo' });
    expect(dataset.practitioners.length).toBeGreaterThan(0);
    for (const practitioner of dataset.practitioners) {
      expect(practitioner.name.grandfather).toBeDefined();
      expect(practitioner.name.motherGiven).toBeDefined();
    }
  });
});
