// A-03-05 security review H1: a short custom pattern must not compile to a program that costs
// memory to keep or seconds to match. Repeat counts above the longest value (200) and compiled
// programs above the cap are refused; the worst accepted pattern matches a 200-character value
// quickly.
import { describe, expect, it } from 'vitest';
import { checkPatientFieldPattern, checkPatientFieldValue } from '../src/patient-fields.ts';

const NONE = { minLength: null, maxLength: null, min: null, max: null } as const;

describe('the cost of a custom pattern (security review H1)', () => {
  it('refuses a wide body repeated a thousand times, within the 100-character cap', () => {
    const wide = `(${'a?'.repeat(42)}){1000}`;
    expect(wide.length).toBeLessThanOrEqual(100);
    expect(checkPatientFieldPattern(wide)).toBe(false);
    expect(checkPatientFieldPattern(`(?s)(ab${'.?'.repeat(43)}){1000}`)).toBe(false);
  });

  it('refuses repeat counts above the longest value, and a program past the cap', () => {
    expect(checkPatientFieldPattern('a{201}')).toBe(false);
    expect(checkPatientFieldPattern('a{1,999}')).toBe(false);
    expect(checkPatientFieldPattern(`(${'[a-z]?'.repeat(12)}){150}`)).toBe(false);
  });

  it('keeps real shapes', () => {
    for (const expression of [
      '[A-Z]{2}-[0-9]{4}',
      '[\\p{Arabic} ]{1,200}',
      '\\d{1,200}',
      'x{3,}',
    ]) {
      expect(checkPatientFieldPattern(expression), expression).toBe(true);
    }
  });

  it('matches the worst accepted pattern against a 200-character value quickly', () => {
    const rules = {
      type: 'text' as const,
      required: false,
      validation: {
        ...NONE,
        pattern: { preset: 'custom' as const, expression: '[\\p{Arabic} ]{1,200}' },
      },
      options: [],
    };
    const started = performance.now();
    for (let i = 0; i < 20; i += 1) checkPatientFieldValue(rules, `${'ب'.repeat(199)}x`);
    expect(performance.now() - started).toBeLessThan(200);
  });
});
