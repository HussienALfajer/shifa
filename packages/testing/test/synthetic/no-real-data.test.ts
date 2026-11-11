// Spec 0.2-08 criterion 14: synthetic phones only, no float money, clinic names from patterns.
import { describe, expect, it } from 'vitest';
import {
  FAMILY_NAMES,
  FEMALE_GIVEN_NAMES,
  generateDataset,
  isSyntheticPhone,
  MALE_GIVEN_NAMES,
  type SyntheticDataset,
  TURKMEN_FAMILY_NAMES,
} from '../../src/index.ts';

const SEEDS = Array.from({ length: 50 }, (_, index) => index + 1);

const alternatives = (names: readonly string[]): string =>
  names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const GIVEN = alternatives([...MALE_GIVEN_NAMES, ...FEMALE_GIVEN_NAMES]);
const FAMILY = alternatives([...FAMILY_NAMES, ...TURKMEN_FAMILY_NAMES]);

/** The only shapes a clinic (tenant or organization) name may take. */
const CLINIC_NAME_PATTERNS: readonly RegExp[] = [
  new RegExp(`^مركز (${FAMILY}) لطب الأسنان$`),
  new RegExp(`^عيادة د\\. (${GIVEN}) (${FAMILY})$`),
  new RegExp(`^مجمع (${FAMILY}) الطبي$`),
  new RegExp(`^مركز (${FAMILY}) الطبي التخصصي$`),
];

const datasets = function* (): Generator<SyntheticDataset> {
  for (const seed of SEEDS) {
    yield generateDataset({ seed, preset: 'minimal' });
    yield generateDataset({ seed, preset: 'demo' });
  }
  yield generateDataset({ seed: 1, preset: 'load', load: { tenants: 12, patientsPerTenant: 50 } });
};

/** Collects every number and every `amountMinor` value with its path. */
const scan = (value: unknown, path: string, numbers: string[], amounts: unknown[]): void => {
  if (typeof value === 'number') numbers.push(path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      scan(item, `${path}[${String(index)}]`, numbers, amounts);
    });
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'amountMinor') amounts.push(item);
      scan(item, `${path}.${key}`, numbers, amounts);
    }
  }
};

describe('no real data in generated datasets', () => {
  it('every phone is synthetic', () => {
    for (const dataset of datasets()) {
      const phones = [
        ...dataset.patientAccounts.map((account) => account.phone),
        ...dataset.practitioners.map((practitioner) => practitioner.phone),
      ];
      expect(phones.length).toBeGreaterThan(0);
      expect(phones.filter((phone) => !isSyntheticPhone(phone))).toEqual([]);
    }
  });

  it('every money amount is a bigint and no other field is a number except the seed', () => {
    for (const dataset of datasets()) {
      const numbers: string[] = [];
      const amounts: unknown[] = [];
      scan(dataset, '$', numbers, amounts);
      expect(numbers).toEqual(['$.seed']);
      expect(amounts.length).toBeGreaterThan(0);
      expect(amounts.filter((amount) => typeof amount !== 'bigint')).toEqual([]);
    }
  });

  it('every clinic name comes from a pattern over the name lists', () => {
    for (const dataset of datasets()) {
      const names = [
        ...dataset.tenants.map((tenant) => tenant.name),
        ...dataset.organizations.map((organization) => organization.name),
      ];
      for (const name of names) {
        expect(
          CLINIC_NAME_PATTERNS.some((pattern) => pattern.test(name)),
          name,
        ).toBe(true);
      }
    }
  });

  it('the scan catches a float amount', () => {
    const numbers: string[] = [];
    const amounts: unknown[] = [];
    scan({ seed: 1, price: { amountMinor: 12.5, currency: 'USD' } }, '$', numbers, amounts);
    expect(numbers).toEqual(['$.seed', '$.price.amountMinor']);
    expect(amounts).toEqual([12.5]);
  });
});
