import type { Random } from './random.ts';

/** Release 1 currencies (BIL-02). SYP is the new pound, redenominated 100:1 in January 2026. */
export const CURRENCIES = ['SYP', 'TRY', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Money is an integer amount of minor units (1/100) plus a currency, never a float (BIL-01). */
export interface Money {
  readonly amountMinor: bigint;
  readonly currency: Currency;
}

/** Smallest cash unit in minor units (BIL-04): SYP 10.00 (smallest new note), TRY 1.00, USD 1.00. */
export const CASH_UNIT_MINOR: Readonly<Record<Currency, bigint>> = {
  SYP: 1000n,
  TRY: 100n,
  USD: 100n,
};

/**
 * SYP amounts at or above 1,000,000.00 new pounds look like old-pound scale (×100) for a clinic
 * price (BIL-05); the generator never produces one, and 0.2-08b tests assert it.
 */
export const OLD_POUND_THRESHOLD_MINOR = 100_000_000n;

export interface PriceRangeMinor {
  readonly minMinor: bigint;
  readonly maxMinor: bigint;
}

/** Believable clinic service prices, inclusive, in minor units. */
export const DEFAULT_PRICE_RANGE_MINOR: Readonly<Record<Currency, PriceRangeMinor>> = {
  SYP: { minMinor: 50_000n, maxMinor: 6_000_000n },
  TRY: { minMinor: 10_000n, maxMinor: 2_000_000n },
  USD: { minMinor: 500n, maxMinor: 50_000n },
};

/** A price on whole cash units inside the range (bounds rounded inward), on new-pound scale. */
export const generatePrice = (
  random: Random,
  currency: Currency,
  range: PriceRangeMinor = DEFAULT_PRICE_RANGE_MINOR[currency],
): Money => {
  const unit = CASH_UNIT_MINOR[currency];
  if (range.maxMinor < range.minMinor) throw new RangeError('generatePrice: reversed range');
  if (currency === 'SYP' && range.maxMinor >= OLD_POUND_THRESHOLD_MINOR) {
    throw new RangeError('generatePrice: SYP range reaches old-pound scale (BIL-05)');
  }
  const lowest = range.minMinor <= 0n ? 1n : (range.minMinor + unit - 1n) / unit;
  const highest = range.maxMinor / unit;
  if (highest < lowest) {
    throw new RangeError('generatePrice: range holds no positive whole cash unit');
  }
  const span = highest - lowest;
  if (span >= 0x1_0000_0000n) throw new RangeError('generatePrice: range too wide');
  const units = lowest + BigInt(random.int(0, Number(span)));
  return { amountMinor: units * unit, currency };
};
