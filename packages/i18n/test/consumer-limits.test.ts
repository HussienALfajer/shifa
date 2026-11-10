// Guards added after review: the source may only use what both consumers (i18next-icu on the web,
// Flutter gen-l10n in the patient app) render alike, and names that are valid identifiers.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generate } from '../scripts/generate.ts';
import {
  checkErrorCodes,
  checkIcu,
  checkParity,
  checkPlurals,
  loadSources,
  type Sources,
} from '../src/index.ts';

const SIX = 'zero {أ} one {ب} two {ج} few {د} many {ه} other {و}';

const one = (message: string): Sources => ({ ar: { common: { m: message } } });

describe('plural options', () => {
  it('accepts =0 =1 =2 beside the six categories', () => {
    expect(checkPlurals(one(`{count, plural, =0 {لا} =1 {واحد} =2 {اثنان} ${SIX}}`))).toEqual([]);
  });

  it.each(['some {ز}', '=3 {ثلاثة}'])('red: refuses the extra option %s', (extra) => {
    const problems = checkPlurals(one(`{count, plural, ${SIX} ${extra}}`));
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toMatch(/options not in ar/);
  });
});

describe('ICU features both consumers support', () => {
  it.each([
    ['an Arabic placeholder name', 'مرحبًا {اسم}'],
    ['a numeric placeholder name', 'مرحبًا {0}'],
    ['a number argument', 'العدد {n, number}'],
    ['a date argument', 'التاريخ {d, date}'],
    ['a time argument', 'الوقت {t, time}'],
    ['selectordinal', '{n, selectordinal, other {الأخير}}'],
    ['an ASCII apostrophe', "نص '{x}'"],
  ])('red: refuses %s', (_, message) => {
    expect(checkIcu(one(message))).toHaveLength(1);
  });

  it('accepts named arguments, plural and select', () => {
    const message = `{role, select, doctor {{count, plural, ${SIX}}} other {{name}}}`;
    expect(checkIcu(one(message))).toEqual([]);
  });
});

describe('own keys only', () => {
  it('red: a key named like an Object method is still missing from another locale', () => {
    const problems = checkParity({ ar: { common: { constructor: 'أ' } }, tr: { common: {} } });
    expect(problems).toEqual([expect.objectContaining({ key: 'constructor' })]);
  });

  it('red: an error code named like an Object method still needs a message', () => {
    const problems = checkErrorCodes({ ar: { errors: {} } }, ['toString']);
    expect(problems.map((p) => p.key)).toEqual(['toString']);
  });
});

describe('loadSources names', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  });

  function source(locale: string, file: string): string {
    dir = mkdtempSync(join(tmpdir(), 'i18n-load-'));
    mkdirSync(join(dir, locale));
    writeFileSync(join(dir, locale, file), '{"a": "أ"}');
    return dir;
  }

  it.each(['my-feature.json', 'Common.json'])('red: refuses the namespace file %s', (file) => {
    expect(() => loadSources(source('ar', file))).toThrow(/namespace/);
  });

  it('red: refuses a non-canonical locale folder', () => {
    expect(() => loadSources(source('ar_SY', 'common.json'))).toThrow(/locale/);
  });
});

describe('generated placeholder types', () => {
  it('a select argument is a String', () => {
    const text = generate(one('{role, select, doctor {طبيب} other {موظف}}'))['arb/app_ar.arb'];
    const doc = JSON.parse(text ?? '{}') as Record<string, unknown>;
    expect(doc['@commonM']).toMatchObject({ placeholders: { role: { type: 'String' } } });
  });
});
