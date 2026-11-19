// Criterion 11 (0.3-S5c, OD-23, ADR-0026): the committed fixtures from the owner's manual day hold
// no personal data. Three checks on every string and number in every fixture: no digit run of 8
// or more that is not a synthetic number (spaces, dashes and Arabic-Indic digits included; the
// scrubber's own check), no Arabic text (message bodies), no WhatsApp QR payload (`2@…,…,…`).
// Runs on the committed files, so a fixture added by hand is checked too.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURES_DIR } from '../src/env-local.ts';
import { checkFixtures } from '../src/scrub.ts';

const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));

/** Every string value (and key) in a parsed fixture, with its path. */
function strings(value: unknown, path = ''): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${String(i)}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [
      { path: `${path}.${k}(key)`, text: k },
      ...strings(v, `${path}.${k}`),
    ]);
  }
  return [];
}

const ARABIC = /\p{Script=Arabic}/u;
/** WhatsApp pairing QR content: a ref, then base64 keys separated by commas. */
const QR = /\d@[A-Za-z0-9+/=_-]{16,},[A-Za-z0-9+/=]{20,},[A-Za-z0-9+/=]{20,}/;

describe('committed fixtures are clean', () => {
  it('there are fixtures from the manual day', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('no digit run of 8 or more except synthetic numbers', () => {
    // The check never prints the digits it found, only the file and the field.
    expect(checkFixtures(FIXTURES_DIR)).toEqual([]);
  });

  it('no Arabic text and no QR payload in any fixture', () => {
    const found: string[] = [];
    for (const file of files) {
      const fixture: unknown = JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8'));
      for (const { path, text } of strings(fixture)) {
        if (ARABIC.test(text)) found.push(`${file} ${path}: Arabic text`);
        if (QR.test(text)) found.push(`${file} ${path}: QR payload`);
      }
    }
    expect(found).toEqual([]);
  });

  it('the checks catch what they look for', () => {
    expect(ARABIC.test('text-1 مرحبا')).toBe(true);
    expect(
      QR.test('2@AbCdEfGhIjKlMnOpQr12,AAAAAAAAAAAAAAAAAAAAAAAA=,BBBBBBBBBBBBBBBBBBBBBBBB='),
    ).toBe(true);
    expect(ARABIC.test('text-12')).toBe(false);
  });
});
