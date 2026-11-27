/**
 * Clinic charts of the A-03 shape (spec A-03 criterion 1; slice A-03-02): name parts from the
 * lists, families on one synthetic contact phone with a shared family name, exact dates of birth
 * or ages as reception types them (years, or months under 2) with the estimated date the API
 * stores for them. Pure: `today` is a Damascus day passed in, all randomness from `random`.
 */
import {
  FAMILY_NAMES,
  FEMALE_GIVEN_NAMES,
  MALE_GIVEN_NAMES,
  TURKMEN_FAMILY_NAMES,
} from './names/lists.ts';
import type { Sex } from './names/person-name.ts';
import { type PhoneCountry, PhoneRegistry } from './phones.ts';
import type { Random } from './random.ts';

export interface SyntheticChartAge {
  readonly value: number;
  readonly unit: 'years' | 'months';
}

export interface SyntheticPatientChart {
  readonly givenName: string;
  readonly fatherName: string;
  readonly familyName: string;
  readonly motherName: string | null;
  readonly sex: Sex;
  /** E.164; shared by the charts of one family. */
  readonly contactPhone: string;
  readonly secondPhone: string | null;
  /** `YYYY-MM-DD`; worked out from `age` when estimated. */
  readonly birthDate: string;
  readonly birthDateEstimated: boolean;
  /** The age as typed, when the date is estimated; null for an exact date. */
  readonly age: SyntheticChartAge | null;
}

export interface PatientChartOptions {
  readonly random: Random;
  readonly count: number;
  /** The Damascus day the charts are registered on, `YYYY-MM-DD`. */
  readonly today: string;
}

const FAMILY_SIZES: readonly (readonly [number, number])[] = [
  [1, 0.45],
  [2, 0.15],
  [3, 0.2],
  [4, 0.2],
];
const TURKISH_SHARE = 0.15;
const TURKMEN_SHARE = 0.35;
const ESTIMATED_SHARE = 0.3;

const parts = (day: string): [number, number, number] => {
  const [y = 1970, m = 1, d = 1] = day.split('-').map(Number);
  return [y, m, d];
};
const iso = (y: number, m: number, d: number): string =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const daysIn = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** `day` minus whole months; a day the earlier month lacks falls on its last day. */
export const monthsBefore = (day: string, months: number): string => {
  const [y, m, d] = parts(day);
  const index = y * 12 + (m - 1) - months;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return iso(year, month, Math.min(d, daysIn(year, month)));
};

const daysBefore = (day: string, days: number): string => {
  const [y, m, d] = parts(day);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
};

interface Birth {
  readonly birthDate: string;
  readonly birthDateEstimated: boolean;
  readonly age: SyntheticChartAge | null;
}

const birthOf = (random: Random, years: number, today: string): Birth => {
  if (random.fork('estimated').chance(ESTIMATED_SHARE)) {
    const age: SyntheticChartAge =
      years < 2
        ? { value: random.fork('months').int(0, 23), unit: 'months' }
        : { value: years, unit: 'years' };
    const months = age.unit === 'years' ? age.value * 12 : age.value;
    return { birthDate: monthsBefore(today, months), birthDateEstimated: true, age };
  }
  const extra = random.fork('day').int(0, 364);
  return {
    birthDate: daysBefore(monthsBefore(today, years * 12), extra),
    birthDateEstimated: false,
    age: null,
  };
};

/** `count` charts in families of one to four on a shared contact phone. */
export const generatePatientCharts = ({
  random,
  count,
  today,
}: PatientChartOptions): SyntheticPatientChart[] => {
  const phones = new PhoneRegistry();
  const charts: SyntheticPatientChart[] = [];
  for (let f = 0; charts.length < count; f += 1) {
    const family = random.fork(String(f));
    const country: PhoneCountry = family.fork('country').chance(TURKISH_SHARE) ? 'TR' : 'SY';
    const contactPhone = phones.next(family.fork('phone'), country);
    const turkmen = country === 'TR' && family.fork('turkmen').chance(TURKMEN_SHARE);
    const familyName = family.fork('family').pick(turkmen ? TURKMEN_FAMILY_NAMES : FAMILY_NAMES);
    const size = family.fork('size').weighted(FAMILY_SIZES);
    let holderGiven = '';
    let holderSex: Sex = 'male';
    for (let m = 0; m < size && charts.length < count; m += 1) {
      const member = family.fork(String(m));
      const holder = m === 0;
      const sex: Sex = member.fork('sex').chance(0.5) ? 'male' : 'female';
      const givenName = member
        .fork('given')
        .pick(sex === 'male' ? MALE_GIVEN_NAMES : FEMALE_GIVEN_NAMES);
      const fatherName =
        !holder && holderSex === 'male'
          ? holderGiven
          : member.fork('father').pick(MALE_GIVEN_NAMES);
      const years = holder ? member.fork('age').int(20, 95) : member.fork('age').int(0, 17);
      const motherName = member.fork('mother').chance(holder ? 0.7 : 0.4)
        ? member.fork('mother-name').pick(FEMALE_GIVEN_NAMES)
        : null;
      const secondPhone =
        holder && member.fork('second').chance(0.2)
          ? phones.next(member.fork('second-phone'), 'SY')
          : null;
      if (holder) {
        holderGiven = givenName;
        holderSex = sex;
      }
      charts.push({
        givenName,
        fatherName,
        familyName,
        motherName,
        sex,
        contactPhone,
        secondPhone,
        ...birthOf(member.fork('birth'), years, today),
      });
    }
  }
  return charts;
};
