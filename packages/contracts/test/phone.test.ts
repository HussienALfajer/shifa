// A-01a criterion 6: one normaliser for the API and the web apps. E.164 for Syria (+963) and
// Turkey (+90); Arabic-Indic digits, spaces, hyphens, a leading 0 or 00 accepted; anything else
// answers a reason, never a guess. Phones here are synthetic.
import { describe, expect, it } from 'vitest';
import { normalisePhone } from '../src/index.ts';

const ok = (e164: string) => ({ ok: true, e164 });
const invalid = (reason: string) => ({ ok: false, reason });

describe('normalisePhone', () => {
  it.each([
    ['+963944123456', '+963944123456'],
    ['0944123456', '+963944123456'],
    ['944123456', '+963944123456'],
    ['00963944123456', '+963944123456'],
    ['963944123456', '+963944123456'],
    ['0944 123 456', '+963944123456'],
    ['+963-944-123-456', '+963944123456'],
    ['  +963 944 123 456  ', '+963944123456'],
    ['٠٩٤٤١٢٣٤٥٦', '+963944123456'],
    ['۰۹۴۴۱۲۳۴۵۶', '+963944123456'],
    ['+٩٦٣ ٩٤٤ ١٢٣ ٤٥٦', '+963944123456'],
    ['021 2345678', '+963212345678'],
    ['+90 532 123 45 67', '+905321234567'],
    ['05321234567', '+905321234567'],
    ['5321234567', '+905321234567'],
    ['00905321234567', '+905321234567'],
    ['905321234567', '+905321234567'],
  ])('%s → %s', (input, e164) => {
    expect(normalisePhone(input)).toEqual(ok(e164));
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['abc', 'not_a_number'],
    ['0944+123456', 'not_a_number'],
    ['+963 944 123 456 ext', 'not_a_number'],
    ['+12025550100', 'unsupported_country'],
    ['+4915112345678', 'unsupported_country'],
    ['09441234', 'wrong_length'],
    ['+96394412345678', 'wrong_length'],
    ['+90532123456', 'wrong_length'],
    ['0', 'wrong_length'],
  ])('%j is refused: %s', (input, reason) => {
    expect(normalisePhone(input)).toEqual(invalid(reason));
  });

  it('never echoes the input in a refusal', () => {
    const result = normalisePhone('+1 202 555 0100');
    expect(JSON.stringify(result)).not.toContain('202');
  });

  it('returns results that the database E.164 check accepts', () => {
    const result = normalisePhone('0944123456');
    expect(result.ok && /^\+[1-9][0-9]{7,14}$/.test(result.e164)).toBe(true);
  });
});
