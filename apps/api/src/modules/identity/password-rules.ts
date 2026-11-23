// Password rules (A-01a criterion 8, NIST SP 800-63B style): at least 10 characters, at most 128
// (Better Auth's limit), not on the bundled common-password list, not containing the phone's
// digits; no composition rules. Used when a password is set (setup links, A-01-03; account page).
import commonPasswords from './common-passwords.json' with { type: 'json' };

export type PasswordProblem = 'too_short' | 'too_long' | 'common' | 'contains_phone';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/** Where the list comes from; the licence notice sits next to it (common-passwords.LICENSE.md). */
export const COMMON_PASSWORDS_SOURCE =
  'NCSC 100k most used passwords (OGL v3.0), via SecLists (MIT): 10+ characters, lower-cased';

const COMMON: ReadonlySet<string> = new Set(commonPasswords);

export function isCommonPassword(password: string): boolean {
  return COMMON.has(password.toLowerCase());
}

/** ASCII digits of `text`, Arabic-Indic digits converted. */
function digitsOf(text: string): string {
  return text
    .replace(/[٠-٩۰-۹]/g, (d) => {
      const code = d.codePointAt(0) ?? 0;
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/\D/g, '');
}

/** The national significant number of an E.164 phone (+963 or +90), else its digits. */
function nationalNumber(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.startsWith('963')) return digits.slice(3);
  if (digits.startsWith('90')) return digits.slice(2);
  return digits;
}

/** The first rule `password` breaks for the person with `phoneE164`, or null. */
export function checkPasswordRules(password: string, phoneE164: string): PasswordProblem | null {
  // Characters as people count them (an Arabic letter is one), not UTF-16 units.
  const length = Array.from(new Intl.Segmenter().segment(password)).length;
  if (length < PASSWORD_MIN_LENGTH) return 'too_short';
  if (length > PASSWORD_MAX_LENGTH) return 'too_long';
  if (isCommonPassword(password)) return 'common';
  const national = nationalNumber(phoneE164);
  if (national.length >= 7 && digitsOf(password).includes(national)) return 'contains_phone';
  return null;
}
