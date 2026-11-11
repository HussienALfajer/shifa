import { describe, expect, it } from 'vitest';
import {
  CASH_UNIT_MINOR,
  CURRENCIES,
  createRandom,
  DEFAULT_PRICE_RANGE_MINOR,
  generatePrice,
  OLD_POUND_THRESHOLD_MINOR,
} from '../../src/index.ts';

describe('cash units (BIL-04)', () => {
  it('uses SYP 10.00, TRY 1.00 and USD 1.00 in minor units', () => {
    expect([...CURRENCIES]).toEqual(['SYP', 'TRY', 'USD']);
    expect(CASH_UNIT_MINOR).toEqual({ SYP: 1000n, TRY: 100n, USD: 100n });
  });
});

describe('generatePrice', () => {
  it.each(CURRENCIES)(
    '%s: bigint amounts on whole cash units inside the default range',
    (currency) => {
      const random = createRandom(1);
      const range = DEFAULT_PRICE_RANGE_MINOR[currency];
      for (let index = 0; index < 2_000; index += 1) {
        const price = generatePrice(random, currency);
        expect(price.currency).toBe(currency);
        expect(typeof price.amountMinor).toBe('bigint');
        expect(price.amountMinor % CASH_UNIT_MINOR[currency]).toBe(0n);
        expect(price.amountMinor >= range.minMinor).toBe(true);
        expect(price.amountMinor <= range.maxMinor).toBe(true);
        expect(price.amountMinor > 0n).toBe(true);
      }
    },
  );

  it('keeps every default SYP price on new-pound scale (BIL-05)', () => {
    const random = createRandom(2);
    expect(DEFAULT_PRICE_RANGE_MINOR.SYP.maxMinor < OLD_POUND_THRESHOLD_MINOR).toBe(true);
    for (let index = 0; index < 2_000; index += 1) {
      expect(generatePrice(random, 'SYP').amountMinor < OLD_POUND_THRESHOLD_MINOR).toBe(true);
    }
  });

  it('rounds a custom range inward to cash units', () => {
    const random = createRandom(3);
    for (let index = 0; index < 500; index += 1) {
      const { amountMinor } = generatePrice(random, 'SYP', { minMinor: 1_500n, maxMinor: 3_500n });
      expect([2_000n, 3_000n]).toContain(amountMinor);
    }
  });

  it('refuses ranges that are reversed, hold no cash unit, or reach old-pound scale', () => {
    const random = createRandom(4);
    expect(() => generatePrice(random, 'USD', { minMinor: 500n, maxMinor: 100n })).toThrow(
      RangeError,
    );
    expect(() => generatePrice(random, 'SYP', { minMinor: 1_100n, maxMinor: 1_900n })).toThrow(
      RangeError,
    );
    expect(() => generatePrice(random, 'USD', { minMinor: 0n, maxMinor: 50n })).toThrow(RangeError);
    expect(() =>
      generatePrice(random, 'SYP', { minMinor: 1_000n, maxMinor: OLD_POUND_THRESHOLD_MINOR }),
    ).toThrow(RangeError);
  });

  it('is deterministic per seed', () => {
    const a = createRandom(5);
    const b = createRandom(5);
    expect([generatePrice(a, 'TRY'), generatePrice(a, 'USD')]).toEqual([
      generatePrice(b, 'TRY'),
      generatePrice(b, 'USD'),
    ]);
  });
});
