// Spec 0.2-08 criterion 2: same seed and preset give the same data on every machine.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalJson, FixedClock, generateDataset } from '../../src/index.ts';
import { GOLDEN_MINIMAL_SEED_1_SHA256 } from './dataset-golden.ts';

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

describe('dataset determinism', () => {
  it('gives deep-equal output for two calls with the same seed and preset', () => {
    for (const preset of ['minimal', 'demo'] as const) {
      expect(generateDataset({ seed: 7, preset })).toEqual(generateDataset({ seed: 7, preset }));
    }
    const load = { tenants: 3, patientsPerTenant: 40 };
    expect(generateDataset({ seed: 7, preset: 'load', load })).toEqual(
      generateDataset({ seed: 7, preset: 'load', load }),
    );
  });

  it('pins the canonical JSON of minimal seed 1 (golden SHA-256)', () => {
    const json = canonicalJson(generateDataset({ seed: 1, preset: 'minimal' }));
    expect(sha256(json)).toBe(GOLDEN_MINIMAL_SEED_1_SHA256);
  });

  it('gives different output for different seeds', () => {
    const one = canonicalJson(generateDataset({ seed: 1, preset: 'minimal' }));
    const two = canonicalJson(generateDataset({ seed: 2, preset: 'minimal' }));
    expect(one).not.toBe(two);
  });

  it('accepts seed 0, negative and very large safe-integer seeds', () => {
    for (const seed of [0, -1, -987_654_321, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]) {
      const dataset = generateDataset({ seed, preset: 'minimal' });
      expect(dataset.seed).toBe(seed);
      expect(dataset.tenants.length).toBe(2);
    }
  });

  it('takes dates from the clock, never the system time', () => {
    const fallback = generateDataset({ seed: 3, preset: 'minimal' });
    expect(fallback.generatedAt).toBe('2026-01-01T00:00:00.000Z');

    const clock = new FixedClock('2031-06-15T08:30:00Z');
    const later = generateDataset({ seed: 3, preset: 'minimal', clock });
    expect(later.generatedAt).toBe('2031-06-15T08:30:00.000Z');

    const birthDates = [
      ...later.patientAccounts.map((account) => account.birthDate),
      ...later.dependents.map((dependent) => dependent.birthDate),
    ];
    const fallbackDates = [
      ...fallback.patientAccounts.map((account) => account.birthDate),
      ...fallback.dependents.map((dependent) => dependent.birthDate),
    ];
    expect(birthDates).not.toEqual(fallbackDates);
    for (const date of birthDates) expect(date <= '2031-06-15').toBe(true);
    // Same draws, later clock: every birth date moves by exactly the days the clock moved.
    const day = 86_400_000;
    const shift = (Date.UTC(2031, 5, 15) - Date.UTC(2026, 0, 1)) / day;
    birthDates.forEach((date, index) => {
      const before = Date.parse(`${fallbackDates[index] ?? ''}T00:00:00Z`);
      expect((Date.parse(`${date}T00:00:00Z`) - before) / day).toBe(shift);
    });
  });
});

describe('canonicalJson', () => {
  it('sorts keys, writes bigint as "<n>n" and leaves out undefined properties', () => {
    expect(canonicalJson({ b: 1, a: { d: 2n, c: undefined, e: [3, 'x'] } })).toBe(
      '{"a":{"d":"2n","e":[3,"x"]},"b":1}',
    );
  });

  it('gives the same text for objects whose keys were added in a different order', () => {
    expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
  });
});
