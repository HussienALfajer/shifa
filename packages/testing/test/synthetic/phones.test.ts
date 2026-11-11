import { describe, expect, it } from 'vitest';
import {
  createRandom,
  generatePhone,
  isSyntheticPhone,
  MOBILE_OPERATOR_PREFIXES,
  SYNTHETIC_PHONE_MARKER,
  SYRIAN_MOBILE_E164,
  TURKISH_MOBILE_E164,
} from '../../src/index.ts';

const SEEDS = Array.from({ length: 50 }, (_, index) => index + 1);

const prefixesOf = (country: 'SY' | 'TR'): string[] =>
  MOBILE_OPERATOR_PREFIXES.filter((entry) => entry.country === country).map(
    (entry) => entry.prefix,
  );

describe('operator prefix table', () => {
  it('lists Syrian and Turkish mobile prefixes, each with an operator and a source', () => {
    expect(prefixesOf('SY').length).toBeGreaterThanOrEqual(4);
    expect(prefixesOf('TR').length).toBeGreaterThanOrEqual(10);
    for (const entry of MOBILE_OPERATOR_PREFIXES) {
      expect(entry.operator.length).toBeGreaterThan(0);
      expect(entry.source.length).toBeGreaterThan(0);
      expect(entry.prefix).toMatch(entry.country === 'SY' ? /^9\d$/ : /^5\d\d$/);
    }
    const all = MOBILE_OPERATOR_PREFIXES.map((entry) => `${entry.country}${entry.prefix}`);
    expect(new Set(all).size).toBe(all.length);
  });

  it('uses the 00 marker', () => {
    expect(SYNTHETIC_PHONE_MARKER).toBe('00');
  });
});

describe('generatePhone', () => {
  it.each(SEEDS)('seed %i: 1 000 Syrian numbers are well formed and marked', (seed) => {
    const random = createRandom(seed);
    const prefixes = prefixesOf('SY');
    for (let index = 0; index < 1_000; index += 1) {
      const phone = generatePhone(random, 'SY');
      expect(phone).toMatch(SYRIAN_MOBILE_E164);
      expect(prefixes).toContain(phone.slice(4, 6));
      expect(phone.slice(6, 8)).toBe(SYNTHETIC_PHONE_MARKER);
      expect(isSyntheticPhone(phone)).toBe(true);
    }
  });

  it.each(SEEDS)('seed %i: 1 000 Turkish numbers are well formed and marked', (seed) => {
    const random = createRandom(seed);
    const prefixes = prefixesOf('TR');
    for (let index = 0; index < 1_000; index += 1) {
      const phone = generatePhone(random, 'TR');
      expect(phone).toMatch(TURKISH_MOBILE_E164);
      expect(prefixes).toContain(phone.slice(3, 6));
      expect(phone.slice(6, 8)).toBe(SYNTHETIC_PHONE_MARKER);
      expect(isSyntheticPhone(phone)).toBe(true);
    }
  });

  it('spreads over several operators and subscriber numbers', () => {
    const random = createRandom(1);
    const phones = Array.from({ length: 2_000 }, () => generatePhone(random, 'SY'));
    expect(new Set(phones.map((phone) => phone.slice(4, 6))).size).toBeGreaterThanOrEqual(4);
    expect(new Set(phones).size).toBeGreaterThan(1_800);
  });

  it('is deterministic per seed', () => {
    const a = createRandom(12);
    const b = createRandom(12);
    expect([generatePhone(a, 'SY'), generatePhone(a, 'TR')]).toEqual([
      generatePhone(b, 'SY'),
      generatePhone(b, 'TR'),
    ]);
  });
});

describe('isSyntheticPhone', () => {
  it.each([
    ['Syrian prefix without the marker', '+963931234567'],
    ['Turkish prefix without the marker', '+905321234567'],
    ['marker in the wrong place', '+963930120034'],
    ['Aleppo landline', '+963212345678'],
    ['Istanbul landline', '+902120012345'],
    ['unlisted Syrian prefix', '+963900012345'],
    ['unlisted Turkish prefix', '+905000012345'],
    ['national format', '0930012345'],
    ['too short', '+96393001234'],
    ['too long', '+9639300123456'],
    ['spaces', '+963 93 001 2345'],
    ['empty', ''],
    ['other country', '+4915100123456'],
  ])('is false for %s', (_, phone) => {
    expect(isSyntheticPhone(phone)).toBe(false);
  });
});
