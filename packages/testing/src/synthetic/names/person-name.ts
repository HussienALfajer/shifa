import type { Random } from '../random.ts';
import {
  FAMILY_NAMES,
  FEMALE_GIVEN_NAMES,
  MALE_GIVEN_NAMES,
  TURKMEN_FAMILY_NAMES,
} from './lists.ts';

export type Sex = 'male' | 'female';
export type Region = 'aleppo' | 'azaz';

/** A Syrian name: given, father, grandfather (adults), family; mother's given name on adults. */
export interface PersonName {
  readonly given: string;
  readonly father: string;
  readonly grandfather?: string;
  readonly family: string;
  readonly motherGiven?: string;
}

export interface PersonNameOptions {
  readonly sex: Sex;
  readonly adult: boolean;
  readonly region: Region;
}

/** Share of Azaz family names drawn from the Turkmen list. */
export const AZAZ_TURKMEN_SHARE = 0.35;

export const generatePersonName = (random: Random, options: PersonNameOptions): PersonName => {
  const given = random.pick(options.sex === 'male' ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES);
  const father = random.pick(MALE_GIVEN_NAMES);
  const turkmen = options.region === 'azaz' && random.chance(AZAZ_TURKMEN_SHARE);
  const family = random.pick(turkmen ? TURKMEN_FAMILY_NAMES : FAMILY_NAMES);
  if (!options.adult) return { given, father, family };
  const grandfather = random.pick(MALE_GIVEN_NAMES);
  const motherGiven = random.pick(FEMALE_GIVEN_NAMES);
  return { given, father, grandfather, family, motherGiven };
};

/** Display order: given, father, grandfather, family (the mother's name is not part of it). */
export const fullName = (name: PersonName): string =>
  [name.given, name.father, name.grandfather, name.family]
    .filter((part): part is string => part !== undefined)
    .join(' ');

export const NAME_VARIANT_CLASSES = [
  'hamza',
  'taMarbuta',
  'alifMaqsura',
  'compound',
  'article',
] as const;

export type NameVariantClass = (typeof NAME_VARIANT_CLASSES)[number];

export interface NameVariantSample {
  readonly variantClass: NameVariantClass;
  readonly part: 'given' | 'family';
  readonly sex?: Sex;
  /** The listed spelling first, then the variant people also type. */
  readonly spellings: readonly [string, string];
}

const DUPLICATE_NAME: PersonName = {
  given: 'محمد',
  father: 'أحمد',
  grandfather: 'علي',
  family: 'الحلبي',
  motherGiven: 'فاطمة',
};

/**
 * Fixed samples that 0.2-08b places into datasets, so every preset holds one name per variant
 * class and two patients with identical full names.
 */
export const NAME_VARIANT_SAMPLES: {
  readonly variants: Readonly<Record<NameVariantClass, NameVariantSample>>;
  readonly duplicatePair: readonly [PersonName, PersonName];
} = {
  variants: {
    hamza: { variantClass: 'hamza', part: 'given', sex: 'male', spellings: ['أحمد', 'احمد'] },
    taMarbuta: {
      variantClass: 'taMarbuta',
      part: 'given',
      sex: 'female',
      spellings: ['فاطمة', 'فاطمه'],
    },
    alifMaqsura: {
      variantClass: 'alifMaqsura',
      part: 'given',
      sex: 'male',
      spellings: ['مصطفى', 'مصطفي'],
    },
    compound: {
      variantClass: 'compound',
      part: 'given',
      sex: 'male',
      spellings: ['عبد الرحمن', 'عبدالرحمن'],
    },
    article: { variantClass: 'article', part: 'family', spellings: ['الحلبي', 'حلبي'] },
  },
  duplicatePair: [{ ...DUPLICATE_NAME }, { ...DUPLICATE_NAME }],
};
