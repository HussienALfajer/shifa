/** Birth dates and phone countries for synthetic people. */
import type { PhoneCountry, PhoneRegistry } from '../phones.ts';
import { PhoneSpaceExhaustedError } from '../phones.ts';
import type { Random } from '../random.ts';
import type { City } from './model.ts';

const DAY_MS = 86_400_000;
const DAYS_PER_YEAR = 365.25;

/**
 * Age ranges in whole years. Each keeps a year of margin from the 18 and 65 bucket edges, so
 * a calendar age check never lands a person in the wrong bucket.
 */
export const AGE_RANGES = {
  child: [0, 16],
  adult: [19, 63],
  /** At least 35, so a parent is always 18 or more years older than a child (0–16). */
  parent: [35, 55],
  senior: [66, 90],
} as const satisfies Record<string, readonly [number, number]>;

export type AgeRange = keyof typeof AGE_RANGES;

/** Share of childless account holders who are over 65 (the rest are adults). */
const SENIOR_SHARE = 0.2;

export const holderAgeRange = (random: Random, hasChildren: boolean): AgeRange => {
  if (hasChildren) return 'parent';
  return random.chance(SENIOR_SHARE) ? 'senior' : 'adult';
};

/**
 * A YYYY-MM-DD birth date a whole number of days before the clock's now, so the same draws
 * under a later clock move every date by the same number of days. Never after now.
 */
export const birthDate = (random: Random, nowMs: number, range: AgeRange): string => {
  const [minYears, maxYears] = AGE_RANGES[range];
  const minDays = Math.ceil(minYears * DAYS_PER_YEAR);
  const maxDays = Math.floor((maxYears + 1) * DAYS_PER_YEAR) - 1;
  const days = random.int(minDays, maxDays);
  return new Date(nowMs - days * DAY_MS).toISOString().slice(0, 10);
};

/** Share of Aleppo account phones on a Syrian number; the rest are Turkish. */
const ALEPPO_SYRIAN_SHARE = 0.9;

/**
 * Aleppo accounts are mostly +963; Azaz accounts alternate +963 and +90, so every Azaz tenant
 * with two accounts holds both.
 */
export const accountPhoneCountry = (
  random: Random,
  city: City,
  accountIndex: number,
): PhoneCountry => {
  if (city === 'azaz') return accountIndex % 2 === 0 ? 'SY' : 'TR';
  return random.chance(ALEPPO_SYRIAN_SHARE) ? 'SY' : 'TR';
};

/**
 * A unique phone in the preferred country; when that country's synthetic space is full (only
 * in very large `load` datasets) the other country's space is used instead. Both spaces
 * together hold more numbers than the `load` patient cap, so this never runs out.
 */
export const uniquePhone = (
  registry: PhoneRegistry,
  random: Random,
  preferred: PhoneCountry,
): string => {
  try {
    return registry.next(random, preferred);
  } catch (error) {
    if (!(error instanceof PhoneSpaceExhaustedError)) throw error;
    return registry.next(random, preferred === 'SY' ? 'TR' : 'SY');
  }
};
