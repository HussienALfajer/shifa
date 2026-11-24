// Slice A-01-06: the web runtime of the translation source. One i18next instance with ICU, Arabic
// by default and right to left, every namespace loaded, Arabic plural forms, tags left as text,
// and every key the web shell uses present in `common`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createI18n, SHELL_KEYS } from '../src/runtime.ts';

const source = (namespace: string) =>
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, '..', 'src', 'locales', 'ar', `${namespace}.json`),
      'utf8',
    ),
  ) as Record<string, string>;
const common = source('common');
const errors = source('errors');

describe('createI18n', () => {
  const i18n = createI18n();

  it('is Arabic, right to left, ready without waiting', () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.language).toBe('ar');
    expect(i18n.dir()).toBe('rtl');
  });

  it('loads common and errors', () => {
    expect(i18n.t('appName')).toBe('شفاء');
    expect(i18n.t('session_expired', { ns: 'errors' })).toBe(errors['session_expired']);
  });

  it('leaves tags as text', () => {
    i18n.addResource('ar', 'common', 'probeTag', 'نص <b>عريض</b>');
    expect(i18n.t('probeTag')).toBe('نص <b>عريض</b>');
  });

  it('formats Arabic plural forms through ICU', () => {
    expect(i18n.t('resultsCount', { count: 0 })).toBe('لا توجد نتائج');
    expect(i18n.t('resultsCount', { count: 1 })).toBe('نتيجة واحدة');
    expect(i18n.t('resultsCount', { count: 2 })).toBe('نتيجتان');
    expect(i18n.t('resultsCount', { count: 3 })).toBe('3 نتائج');
    expect(i18n.t('resultsCount', { count: 11 })).toBe('11 نتيجةً');
    expect(i18n.t('resultsCount', { count: 100 })).toBe('100 نتيجة');
  });

  it('formats with Western digits', () => {
    expect(i18n.t('resultsCount', { count: 1234 })).toMatch(/^[\d,]+ /);
    expect(i18n.t('resultsCount', { count: 1234 })).not.toMatch(/[٠-٩]/);
  });

  it('has every shell key in common', () => {
    expect(SHELL_KEYS.length).toBeGreaterThan(10);
    for (const key of SHELL_KEYS) expect(common[key], key).toBeTypeOf('string');
  });

  it('gives each call its own instance', () => {
    expect(createI18n()).not.toBe(i18n);
  });
});
