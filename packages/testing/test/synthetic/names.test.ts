import { describe, expect, it } from 'vitest';
import {
  createRandom,
  FAMILY_NAMES,
  FEMALE_GIVEN_NAMES,
  fullName,
  generatePersonName,
  MALE_GIVEN_NAMES,
  NAME_VARIANT_CLASSES,
  NAME_VARIANT_SAMPLES,
  type PersonName,
  TURKMEN_FAMILY_NAMES,
} from '../../src/index.ts';

// Arabic letters (hamza to yeh, without tatweel or diacritics) separated by single spaces.
const ARABIC_NAME = /^[ء-غف-ي]+( [ء-غف-ي]+)*$/;

const LISTS = {
  MALE_GIVEN_NAMES,
  FEMALE_GIVEN_NAMES,
  FAMILY_NAMES,
  TURKMEN_FAMILY_NAMES,
} as const;

describe('name lists', () => {
  it.each(Object.entries(LISTS))('%s has no duplicates and only Arabic letters', (_, list) => {
    expect(list.length).toBeGreaterThanOrEqual(20);
    expect(new Set(list).size).toBe(list.length);
    for (const name of list) {
      expect(name).toMatch(ARABIC_NAME);
    }
  });

  it('keeps male and female given names apart', () => {
    const female = new Set<string>(FEMALE_GIVEN_NAMES);
    expect(MALE_GIVEN_NAMES.filter((name) => female.has(name))).toEqual([]);
  });

  it('keeps Turkmen family names apart from the general family list', () => {
    const general = new Set<string>(FAMILY_NAMES);
    expect(TURKMEN_FAMILY_NAMES.filter((name) => general.has(name))).toEqual([]);
  });
});

const many = (
  seed: number,
  options: Parameters<typeof generatePersonName>[1],
  count = 500,
): PersonName[] => {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => generatePersonName(random, options));
};

describe('generatePersonName', () => {
  it('gives an adult every part, with father and grandfather from the male list', () => {
    for (const name of many(1, { sex: 'female', adult: true, region: 'aleppo' })) {
      expect(FEMALE_GIVEN_NAMES).toContain(name.given);
      expect(MALE_GIVEN_NAMES).toContain(name.father);
      expect(MALE_GIVEN_NAMES).toContain(name.grandfather);
      expect(FEMALE_GIVEN_NAMES).toContain(name.motherGiven);
      expect(FAMILY_NAMES).toContain(name.family);
    }
  });

  it('gives a child no grandfather and no mother name', () => {
    for (const name of many(2, { sex: 'male', adult: false, region: 'aleppo' })) {
      expect(MALE_GIVEN_NAMES).toContain(name.given);
      expect(MALE_GIVEN_NAMES).toContain(name.father);
      expect('grandfather' in name).toBe(false);
      expect('motherGiven' in name).toBe(false);
    }
  });

  it('matches the given name to the sex', () => {
    for (const name of many(3, { sex: 'male', adult: true, region: 'azaz' })) {
      expect(MALE_GIVEN_NAMES).toContain(name.given);
    }
    for (const name of many(3, { sex: 'female', adult: true, region: 'azaz' })) {
      expect(FEMALE_GIVEN_NAMES).toContain(name.given);
    }
  });

  it('draws Turkmen family names in Azaz and never in Aleppo', () => {
    const turkmen = new Set<string>(TURKMEN_FAMILY_NAMES);
    const azaz = many(4, { sex: 'male', adult: true, region: 'azaz' }, 1_000);
    const aleppo = many(4, { sex: 'male', adult: true, region: 'aleppo' }, 1_000);
    const azazTurkmen = azaz.filter((name) => turkmen.has(name.family)).length;
    expect(azazTurkmen).toBeGreaterThan(150);
    expect(azazTurkmen).toBeLessThan(1_000);
    expect(aleppo.filter((name) => turkmen.has(name.family))).toEqual([]);
  });

  it('is deterministic per seed', () => {
    const options = { sex: 'female', adult: true, region: 'azaz' } as const;
    expect(many(9, options, 50)).toEqual(many(9, options, 50));
    expect(many(9, options, 50)).not.toEqual(many(10, options, 50));
  });
});

describe('fullName', () => {
  it('joins given, father, grandfather and family in order', () => {
    expect(fullName({ given: 'أحمد', father: 'محمد', grandfather: 'علي', family: 'الحلبي' })).toBe(
      'أحمد محمد علي الحلبي',
    );
    expect(fullName({ given: 'ليلى', father: 'خالد', family: 'شيخو' })).toBe('ليلى خالد شيخو');
  });
});

describe('NAME_VARIANT_SAMPLES', () => {
  it('covers every variant class', () => {
    expect([...NAME_VARIANT_CLASSES].sort()).toEqual(
      ['alifMaqsura', 'article', 'compound', 'hamza', 'taMarbuta'].sort(),
    );
    expect(Object.keys(NAME_VARIANT_SAMPLES.variants).sort()).toEqual(
      [...NAME_VARIANT_CLASSES].sort(),
    );
  });

  it('gives two different spellings per class, both Arabic, the first from the lists', () => {
    const listed = new Set<string>([
      ...MALE_GIVEN_NAMES,
      ...FEMALE_GIVEN_NAMES,
      ...FAMILY_NAMES,
      ...TURKMEN_FAMILY_NAMES,
    ]);
    for (const sample of Object.values(NAME_VARIANT_SAMPLES.variants)) {
      const [listedSpelling, variant] = sample.spellings;
      expect(listedSpelling).not.toBe(variant);
      expect(listedSpelling).toMatch(ARABIC_NAME);
      expect(variant).toMatch(ARABIC_NAME);
      expect(listed.has(listedSpelling)).toBe(true);
    }
  });

  it('shows the defining difference of each class', () => {
    const { hamza, taMarbuta, alifMaqsura, compound, article } = NAME_VARIANT_SAMPLES.variants;
    expect(hamza.spellings[0].replace(/[أإآ]/g, 'ا')).toBe(hamza.spellings[1]);
    expect(taMarbuta.spellings[0].endsWith('ة')).toBe(true);
    expect(taMarbuta.spellings[1]).toBe(`${taMarbuta.spellings[0].slice(0, -1)}ه`);
    expect(alifMaqsura.spellings[0].endsWith('ى')).toBe(true);
    expect(alifMaqsura.spellings[1]).toBe(`${alifMaqsura.spellings[0].slice(0, -1)}ي`);
    expect(compound.spellings[0].startsWith('عبد ال')).toBe(true);
    expect(compound.spellings[1]).toBe(compound.spellings[0].replace(' ', ''));
    expect(article.spellings[0].startsWith('ال')).toBe(true);
    expect(article.spellings[1]).toBe(article.spellings[0].slice(2));
  });

  it('gives a duplicate pair with identical full names', () => {
    const [first, second] = NAME_VARIANT_SAMPLES.duplicatePair;
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(fullName(first)).toBe(fullName(second));
    expect(first.grandfather).toBeDefined();
  });
});
