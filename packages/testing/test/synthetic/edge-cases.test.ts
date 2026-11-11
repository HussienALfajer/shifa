// Spec 0.2-08 criteria 7, 8 and 9: the hard cases later slices need are in every dataset.
import { describe, expect, it } from 'vitest';
import {
  FEMALE_GIVEN_NAMES,
  fullName,
  generateDataset,
  MALE_GIVEN_NAMES,
  NAME_VARIANT_CLASSES,
  NAME_VARIANT_SAMPLES,
  type PersonName,
  type Sex,
  SYRIAN_MOBILE_E164,
  type SyntheticDataset,
  TURKISH_MOBILE_E164,
  TURKMEN_FAMILY_NAMES,
} from '../../src/index.ts';

const SEEDS = Array.from({ length: 50 }, (_, index) => index + 1);
const PRESETS = ['minimal', 'demo'] as const;

interface Person {
  readonly name: PersonName;
  readonly sex: Sex;
  readonly tenantId: string;
  readonly organizationId: string;
}

/** Every patient (one per chart) with its name and where the chart lives. */
const patients = (dataset: SyntheticDataset): Person[] => {
  const accounts = new Map(dataset.patientAccounts.map((account) => [account.id, account]));
  const dependents = new Map(dataset.dependents.map((dependent) => [dependent.id, dependent]));
  return dataset.charts.map((chart) => {
    const person =
      chart.dependentId === undefined
        ? accounts.get(chart.accountId)
        : dependents.get(chart.dependentId);
    if (person === undefined) throw new Error(`chart ${chart.id} has no person`);
    return {
      name: person.name,
      sex: person.sex,
      tenantId: chart.tenantId,
      organizationId: chart.organizationId,
    };
  });
};

const variantGiven = (sex: Sex): Set<string> =>
  new Set(
    Object.values(NAME_VARIANT_SAMPLES.variants)
      .filter((sample) => sample.part === 'given' && sample.sex === sex)
      .map((sample) => sample.spellings[1]),
  );

const allowedGiven = (sex: Sex): Set<string> =>
  new Set<string>([
    ...(sex === 'male' ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES),
    ...variantGiven(sex),
    ...(sex === 'male' ? ['ابراهيم'] : []),
  ]);

describe('name edge cases', () => {
  it('has a duplicate full-name pair inside one organization', () => {
    for (const preset of PRESETS) {
      for (const seed of SEEDS) {
        const counts = new Map<string, number>();
        for (const person of patients(generateDataset({ seed, preset }))) {
          const key = `${person.organizationId}|${fullName(person.name)}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        expect(
          Math.max(...counts.values()),
          `${preset} seed ${String(seed)}`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('has both spellings of every variant class, including أ and إ hamza forms', () => {
    for (const preset of PRESETS) {
      for (const seed of SEEDS) {
        const people = patients(generateDataset({ seed, preset }));
        const parts = new Set(people.flatMap((person) => [person.name.given, person.name.family]));
        for (const variantClass of NAME_VARIANT_CLASSES) {
          const [listed, variant] = NAME_VARIANT_SAMPLES.variants[variantClass].spellings;
          expect(parts.has(listed), `${preset} ${String(seed)} ${listed}`).toBe(true);
          expect(parts.has(variant), `${preset} ${String(seed)} ${variant}`).toBe(true);
        }
        expect(parts.has('إبراهيم')).toBe(true);
        expect(parts.has('ابراهيم')).toBe(true);
      }
    }
  });

  it('gives every person a given name that matches their sex (listed or a placed variant)', () => {
    for (const preset of PRESETS) {
      const dataset = generateDataset({ seed: 5, preset });
      const people = [
        ...patients(dataset),
        ...dataset.practitioners.map((practitioner) => ({
          name: practitioner.name,
          sex: practitioner.sex,
        })),
      ];
      for (const person of people) {
        expect(allowedGiven(person.sex).has(person.name.given), person.name.given).toBe(true);
      }
    }
  });

  it('places Turkmen family names in Azaz tenants', () => {
    for (const preset of PRESETS) {
      for (const seed of SEEDS) {
        const dataset = generateDataset({ seed, preset });
        const azaz = new Set(
          dataset.tenants.filter((tenant) => tenant.city === 'azaz').map((tenant) => tenant.id),
        );
        const turkmen = new Set<string>(TURKMEN_FAMILY_NAMES);
        const found = patients(dataset).some(
          (person) => azaz.has(person.tenantId) && turkmen.has(person.name.family),
        );
        expect(found, `${preset} seed ${String(seed)}`).toBe(true);
      }
    }
  });

  it('has an account with two or more dependents on one phone', () => {
    for (const preset of PRESETS) {
      for (const seed of SEEDS) {
        const dataset = generateDataset({ seed, preset });
        const perAccount = new Map<string, number>();
        for (const dependent of dataset.dependents) {
          perAccount.set(dependent.accountId, (perAccount.get(dependent.accountId) ?? 0) + 1);
        }
        expect(Math.max(0, ...perAccount.values())).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('phone mix', () => {
  /** Account phones grouped by the city of the tenant holding the account's first chart. */
  const phonesByCity = (dataset: SyntheticDataset): Record<'aleppo' | 'azaz', string[]> => {
    const cityOf = new Map(dataset.tenants.map((tenant) => [tenant.id, tenant.city]));
    const home = new Map<string, 'aleppo' | 'azaz'>();
    for (const chart of dataset.charts) {
      const city = cityOf.get(chart.tenantId);
      if (city !== undefined && !home.has(chart.accountId)) home.set(chart.accountId, city);
    }
    const result: Record<'aleppo' | 'azaz', string[]> = { aleppo: [], azaz: [] };
    for (const account of dataset.patientAccounts) {
      const city = home.get(account.id);
      if (city !== undefined) result[city].push(account.phone);
    }
    return result;
  };

  it('Aleppo accounts are mostly +963 and Azaz accounts have both +963 and +90', () => {
    let aleppoTotal = 0;
    let aleppoSyrian = 0;
    for (const preset of PRESETS) {
      for (const seed of SEEDS) {
        const { aleppo, azaz } = phonesByCity(generateDataset({ seed, preset }));
        aleppoTotal += aleppo.length;
        aleppoSyrian += aleppo.filter((phone) => SYRIAN_MOBILE_E164.test(phone)).length;
        expect(azaz.some((phone) => SYRIAN_MOBILE_E164.test(phone))).toBe(true);
        expect(azaz.some((phone) => TURKISH_MOBILE_E164.test(phone))).toBe(true);
      }
    }
    expect(aleppoSyrian / aleppoTotal).toBeGreaterThan(0.8);
  });

  it('never repeats an account phone inside a dataset', () => {
    for (const preset of PRESETS) {
      const dataset = generateDataset({ seed: 11, preset });
      const phones = dataset.patientAccounts.map((account) => account.phone);
      expect(new Set(phones).size).toBe(phones.length);
    }
  });
});
