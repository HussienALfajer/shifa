// A-01a criterion 6: one normaliser for the API and the web apps. E.164 for Syria (+963) and
// Turkey (+90); Arabic-Indic digits, spaces, hyphens, a leading 0 or 00 accepted; anything else
// answers a reason, never a guess. Phones here are synthetic.
import { describe, expect, it } from 'vitest';
import { normalisePhone } from '../src/index.ts';

const ok = (e164: string) => ({ ok: true, e164 });
const invalid = (reason: string) => ({ ok: false, reason });

describe('normalisePhone', () => {
  it.each([
    ['+963940012345', '+963940012345'],
    ['0940012345', '+963940012345'],
    ['940012345', '+963940012345'],
    ['00963940012345', '+963940012345'],
    ['963940012345', '+963940012345'],
    ['0940 012 345', '+963940012345'],
    ['+963-940-012-345', '+963940012345'],
    ['  +963 940 012 345  ', '+963940012345'],
    ['٠٩٤٠٠١٢٣٤٥', '+963940012345'],
    ['۰۹۴۰۰۱۲۳۴۵', '+963940012345'],
    ['+٩٦٣ ٩٤٠ ٠١٢ ٣٤٥', '+963940012345'],
    ['021 2345678', '+963212345678'],
    ['+90 532 001 23 45', '+905320012345'],
    ['05320012345', '+905320012345'],
    ['5320012345', '+905320012345'],
    ['00905320012345', '+905320012345'],
    ['905320012345', '+905320012345'],
  ])('%s → %s', (input, e164) => {
    expect(normalisePhone(input)).toEqual(ok(e164));
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['abc', 'not_a_number'],
    ['0940+012345', 'not_a_number'],
    ['+963 940 012 345 ext', 'not_a_number'],
    ['+12025550100', 'unsupported_country'],
    ['+4915112345678', 'unsupported_country'],
    ['09441234', 'wrong_length'],
    ['+96394001234578', 'wrong_length'],
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
    const result = normalisePhone('0940012345');
    expect(result.ok && /^\+[1-9][0-9]{7,14}$/.test(result.e164)).toBe(true);
  });
});
