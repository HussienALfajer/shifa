import type { Random } from './random.ts';

export type PhoneCountry = 'SY' | 'TR';

/** Syrian mobile in E.164: +963, then 9 digits starting with 9. */
export const SYRIAN_MOBILE_E164 = /^\+9639\d{8}$/;
/** Turkish mobile in E.164: +90, then 10 digits starting with 5. */
export const TURKISH_MOBILE_E164 = /^\+905\d{9}$/;

/**
 * Every synthetic subscriber number starts with this marker right after the operator prefix.
 * It only helps tests: it does not prove a number is unassigned, so messaging outside production
 * still sends only to an explicit allowlist (MSG-32, OD-23).
 */
export const SYNTHETIC_PHONE_MARKER = '00';

export interface MobileOperatorPrefix {
  readonly country: PhoneCountry;
  readonly operator: string;
  /** National digits after the country code: 2 for Syria (9X), 3 for Turkey (5XX). */
  readonly prefix: string;
  readonly source: string;
}

const SY_SOURCE =
  'Syrian national numbering plan (ITU-T E.164 notification); "Telephone numbers in Syria"';
const TR_SOURCE = 'BTK (Turkey) national numbering plan; "Telephone numbers in Turkey"';

const syria = (operator: string, prefixes: readonly string[]): MobileOperatorPrefix[] =>
  prefixes.map((prefix) => ({ country: 'SY', operator, prefix, source: SY_SOURCE }));
const turkey = (operator: string, prefixes: readonly string[]): MobileOperatorPrefix[] =>
  prefixes.map((prefix) => ({ country: 'TR', operator, prefix, source: TR_SOURCE }));

/** Real mobile operator prefixes, so generated numbers look like what patients type. */
export const MOBILE_OPERATOR_PREFIXES: readonly MobileOperatorPrefix[] = [
  ...syria('Syriatel', ['93', '98', '99']),
  ...syria('MTN Syria', ['94', '95', '96']),
  ...turkey('Turkcell', ['530', '531', '532', '533', '534', '535', '536', '537', '538', '539']),
  ...turkey('Vodafone Türkiye', [
    '540',
    '541',
    '542',
    '543',
    '544',
    '545',
    '546',
    '547',
    '548',
    '549',
  ]),
  ...turkey('Türk Telekom', ['501', '505', '506', '507', '551', '552', '553', '554', '555', '559']),
];

const COUNTRY_CODE: Readonly<Record<PhoneCountry, string>> = { SY: '963', TR: '90' };
const FORMAT: Readonly<Record<PhoneCountry, RegExp>> = {
  SY: SYRIAN_MOBILE_E164,
  TR: TURKISH_MOBILE_E164,
};
/** Subscriber digits after the operator prefix. */
const SUBSCRIBER_LENGTH = 7;
const RANDOM_DIGITS = SUBSCRIBER_LENGTH - SYNTHETIC_PHONE_MARKER.length;

const prefixesFor = (country: PhoneCountry): readonly MobileOperatorPrefix[] =>
  MOBILE_OPERATOR_PREFIXES.filter((entry) => entry.country === country);

/** A synthetic mobile number in E.164 on a real operator prefix, marked with `00`. */
export const generatePhone = (random: Random, country: PhoneCountry): string => {
  const { prefix } = random.pick(prefixesFor(country));
  const digits = String(random.int(0, 10 ** RANDOM_DIGITS - 1)).padStart(RANDOM_DIGITS, '0');
  return `+${COUNTRY_CODE[country]}${prefix}${SYNTHETIC_PHONE_MARKER}${digits}`;
};

/** True only for a well-formed mobile number on a listed prefix that carries the marker. */
export const isSyntheticPhone = (e164: string): boolean => {
  for (const country of ['SY', 'TR'] as const) {
    if (!FORMAT[country].test(e164)) continue;
    const national = e164.slice(COUNTRY_CODE[country].length + 1);
    return prefixesFor(country).some(
      ({ prefix }) =>
        national.startsWith(prefix) &&
        national.slice(prefix.length).startsWith(SYNTHETIC_PHONE_MARKER),
    );
  }
  return false;
};
