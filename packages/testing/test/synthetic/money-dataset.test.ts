// Spec 0.2-08 criterion 11: currencies by city and price lists on whole cash units.
import { describe, expect, it } from 'vitest';
import {
  CASH_UNIT_MINOR,
  generateDataset,
  OLD_POUND_THRESHOLD_MINOR,
  type SyntheticDataset,
} from '../../src/index.ts';

const SEEDS = Array.from({ length: 20 }, (_, index) => index + 1);

const datasets = (): SyntheticDataset[] =>
  SEEDS.flatMap((seed) => [
    generateDataset({ seed, preset: 'minimal' }),
    generateDataset({ seed, preset: 'demo' }),
  ]);

describe('money in the dataset', () => {
  it('every tenant has base currency USD', () => {
    for (const dataset of datasets()) {
      for (const tenant of dataset.tenants) expect(tenant.baseCurrency).toBe('USD');
    }
  });

  it('branches enable their city currencies: Aleppo SYP + USD, Azaz TRY + USD (some also SYP)', () => {
    let azazWithSyp = 0;
    let azazWithoutSyp = 0;
    for (const dataset of datasets()) {
      for (const branch of dataset.branches) {
        if (branch.city === 'aleppo') {
          expect([...branch.enabledCurrencies]).toEqual(['SYP', 'USD']);
        } else {
          const currencies = [...branch.enabledCurrencies];
          expect([
            ['TRY', 'USD'],
            ['SYP', 'TRY', 'USD'],
          ]).toContainEqual(currencies);
          if (currencies.includes('SYP')) azazWithSyp += 1;
          else azazWithoutSyp += 1;
        }
      }
    }
    expect(azazWithSyp).toBeGreaterThan(0);
    expect(azazWithoutSyp).toBeGreaterThan(0);
  });

  it('price lists use bigint amounts on whole cash units in enabled currencies, new-pound scale', () => {
    for (const dataset of datasets()) {
      for (const branch of dataset.branches) {
        expect(branch.priceList.length).toBeGreaterThan(0);
        const codes = new Set<string>();
        for (const { code, price } of branch.priceList) {
          expect(typeof price.amountMinor).toBe('bigint');
          expect(branch.enabledCurrencies).toContain(price.currency);
          expect(price.amountMinor > 0n).toBe(true);
          expect(price.amountMinor % CASH_UNIT_MINOR[price.currency]).toBe(0n);
          if (price.currency === 'SYP') {
            expect(price.amountMinor < OLD_POUND_THRESHOLD_MINOR).toBe(true);
          }
          const key = `${code}|${price.currency}`;
          expect(codes.has(key)).toBe(false);
          codes.add(key);
        }
        for (const currency of branch.enabledCurrencies) {
          expect(branch.priceList.some((entry) => entry.price.currency === currency)).toBe(true);
        }
      }
    }
  });
});
