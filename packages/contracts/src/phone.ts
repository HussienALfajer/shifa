// Phone numbers as people type them, normalised to E.164 (A-01a criterion 6). Shared by the API
// and the web apps so a number that passes in the browser passes on the server. Syria (+963) and
// Turkey (+90) only, the two networks in use in Aleppo and Azaz (scope-release-1).

export type PhoneInvalidReason = 'empty' | 'not_a_number' | 'unsupported_country' | 'wrong_length';

export type PhoneResult = { ok: true; e164: string } | { ok: false; reason: PhoneInvalidReason };

/** Arabic-Indic (U+0660–0669) and Extended Arabic-Indic (U+06F0–06F9) digits → ASCII. */
function asciiDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.codePointAt(0) ?? 0;
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/** Separators people type inside a number: spaces of any kind, hyphens, dots, parentheses. */
const SEPARATORS = /[\s\u00A0\u200E\u200F\u202A-\u202E().-]/g;

/** Significant-number lengths after the country code. */
const SYRIA = { code: '963', min: 8, max: 9 } as const;
const TURKEY = { code: '90', min: 10, max: 10 } as const;

function withCountry(country: typeof SYRIA | typeof TURKEY, national: string): PhoneResult {
  if (national.length < country.min || national.length > country.max || national.startsWith('0')) {
    return { ok: false, reason: 'wrong_length' };
  }
  return { ok: true, e164: `+${country.code}${national}` };
}

/** International digits (after + or 00): the country code decides. */
function international(digits: string): PhoneResult {
  if (digits.startsWith(SYRIA.code)) return withCountry(SYRIA, digits.slice(SYRIA.code.length));
  if (digits.startsWith(TURKEY.code)) return withCountry(TURKEY, digits.slice(TURKEY.code.length));
  return { ok: false, reason: 'unsupported_country' };
}

/**
 * Without a country code the length decides: a leading 0 then 8–9 digits is Syrian, then 10
 * digits Turkish; 963… or 90… of a full international length is taken as international; a bare
 * 9-digit number starting with 9 is a Syrian mobile, a bare 10-digit one starting with 5 Turkish.
 */
function national(digits: string): PhoneResult {
  if (digits.startsWith('0')) {
    const rest = digits.slice(1);
    if (rest.length === TURKEY.max) return withCountry(TURKEY, rest);
    return withCountry(SYRIA, rest);
  }
  if (digits.startsWith(SYRIA.code) && digits.length >= 11) return international(digits);
  if (digits.startsWith(TURKEY.code) && digits.length === 12) return international(digits);
  if (digits.length === 9 && digits.startsWith('9')) return withCountry(SYRIA, digits);
  if (digits.length === 10 && digits.startsWith('5')) return withCountry(TURKEY, digits);
  return { ok: false, reason: 'wrong_length' };
}

/** E.164 for a typed phone, or why it is not one. Never echoes the input. */
export function normalisePhone(input: string): PhoneResult {
  const compact = asciiDigits(input).replace(SEPARATORS, '');
  if (compact === '') return { ok: false, reason: 'empty' };
  if (!/^\+?\d+$/.test(compact)) return { ok: false, reason: 'not_a_number' };
  if (compact.startsWith('+')) return international(compact.slice(1));
  if (compact.startsWith('00')) return international(compact.slice(2));
  return national(compact);
}
