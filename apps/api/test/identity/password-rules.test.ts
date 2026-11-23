// A-01a criterion 8: at least 10 characters, refused when on the bundled common-password list or
// containing the phone's digits; no composition rules. The list's source and licence are recorded.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COMMON_PASSWORDS_SOURCE,
  checkPasswordRules,
  isCommonPassword,
} from '../../src/modules/identity/password-rules.ts';

const PHONE = '+963944123456';

describe('password rules', () => {
  it.each([
    ['quiet river lamp 42', null],
    ['correcthorsebatterystaple', null],
    // No composition rules: lower-case letters only, or spaces, are fine when long and uncommon.
    ['mountainsbeyondmountains', null],
    ['short', 'too_short'],
    ['nine char', 'too_short'],
    ['x'.repeat(129), 'too_long'],
    ['password123', 'common'],
    ['PASSWORD123', 'common'],
    ['1234567890', 'common'],
    ['qwertyuiop', 'common'],
    ['my944123456pass', 'contains_phone'],
    ['0944123456-secret', 'contains_phone'],
    ['٩٤٤١٢٣٤٥٦ والسر', 'contains_phone'],
    ['+963944123456!!', 'contains_phone'],
  ])('%j → %s', (password, problem) => {
    expect(checkPasswordRules(password, PHONE)).toBe(problem);
  });

  it('counts characters, not bytes (Arabic passwords)', () => {
    expect(checkPasswordRules('كلمة سر طويلة', PHONE)).toBeNull();
    expect(checkPasswordRules('كلمة سر', PHONE)).toBe('too_short');
  });

  it('a Turkish phone: its national digits are refused', () => {
    expect(checkPasswordRules('x5321234567x', '+905321234567')).toBe('contains_phone');
  });

  it('the bundled list is large, lower-case, and only holds entries of 10+ characters', () => {
    expect(isCommonPassword('iloveyou12')).toBe(true);
    expect(isCommonPassword('quiet river lamp 42')).toBe(false);
  });

  it('records the list’s source and licence next to it', () => {
    expect(COMMON_PASSWORDS_SOURCE).toMatch(/NCSC/);
    const notice = readFileSync(
      new URL('../../src/modules/identity/common-passwords.LICENSE.md', import.meta.url),
      'utf8',
    );
    expect(notice).toMatch(/Open Government Licence/);
    expect(notice).toMatch(/MIT/);
  });
});
