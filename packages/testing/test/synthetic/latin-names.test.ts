// Latin spellings of generated names (slice 0.4-12, P-N1; owner decision 2026-11-23): a story or
// test that needs a name in Latin letters (an avatar in a mixed-direction line) takes one from the
// generator too. Each Latin spelling belongs to a name of the Arabic lists, so a Latin name is a
// generated person written in Latin, never a name typed in.
import { describe, expect, it } from 'vitest';
import {
  createRandom,
  FAMILY_NAMES,
  FEMALE_GIVEN_NAMES,
  generateLatinPersonName,
  LATIN_FAMILY_NAMES,
  LATIN_GIVEN_NAMES,
  MALE_GIVEN_NAMES,
  TURKMEN_FAMILY_NAMES,
} from '../../src/index.ts';

const GIVEN: readonly string[] = [...MALE_GIVEN_NAMES, ...FEMALE_GIVEN_NAMES];
const FAMILY: readonly string[] = [...FAMILY_NAMES, ...TURKMEN_FAMILY_NAMES];
/** Latin letters, single spaces or hyphens between parts, each part capitalised. */
const LATIN = /^[A-Z][a-z]+(?:[ -][A-Z][a-z]+)*$/;

describe('Latin name spellings', () => {
  it('spell only names of the Arabic lists', () => {
    for (const arabic of LATIN_GIVEN_NAMES.keys()) expect(GIVEN, arabic).toContain(arabic);
    for (const arabic of LATIN_FAMILY_NAMES.keys()) expect(FAMILY, arabic).toContain(arabic);
  });

  it('cover enough names for variety, each in Latin letters', () => {
    expect(LATIN_GIVEN_NAMES.size).toBeGreaterThanOrEqual(10);
    expect(LATIN_FAMILY_NAMES.size).toBeGreaterThanOrEqual(8);
    for (const latin of [...LATIN_GIVEN_NAMES.values(), ...LATIN_FAMILY_NAMES.values()]) {
      expect(latin).toMatch(LATIN);
    }
  });

  it('generate a person in both scripts, the same name', () => {
    const person = generateLatinPersonName(createRandom(5));
    const [given, ...family] = person.arabic.split(' ');
    expect(LATIN_GIVEN_NAMES.get(given ?? '')).toBe(person.latin.split(' ')[0]);
    expect(person.latin).toBe(
      `${LATIN_GIVEN_NAMES.get(given ?? '') ?? ''} ${LATIN_FAMILY_NAMES.get(family.join(' ')) ?? ''}`,
    );
    expect(person.latin).toMatch(LATIN);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    expect(generateLatinPersonName(createRandom(9))).toEqual(
      generateLatinPersonName(createRandom(9)),
    );
    const names = new Set(
      Array.from({ length: 20 }, (_, seed) => generateLatinPersonName(createRandom(seed)).latin),
    );
    expect(names.size).toBeGreaterThan(5);
  });
});
