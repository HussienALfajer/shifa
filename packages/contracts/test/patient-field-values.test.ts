// A-03 criteria 4, 16 (A-03-06): a chart's custom field values in the contracts the browser and
// the server share. The search key of a value (OD-146 point 3): text and long text folded with
// foldArabic and spaces as one, a number canonical, a date ISO, a phone E.164 (any accepted
// format finds the same key, OD-146 point 4); choices and yes/no have none. A key longer than a
// search term can be is none (it could never be typed). The request's `fields` record: keys
// `cf_…`, at most 20, values of the stored shapes.
import { describe, expect, it } from 'vitest';
import {
  CreatePatientRequest,
  PatientChartField,
  searchKeyOfPatientFieldValue,
  UpdatePatientRequest,
} from '../src/index.ts';

const key = (type: Parameters<typeof searchKeyOfPatientFieldValue>[0]['type'], value: unknown) =>
  searchKeyOfPatientFieldValue({ type }, value);

describe('the search key of a value (criterion 4)', () => {
  it('folds text and long text, spaces as one', () => {
    expect(key('text', '  بطاقة   تأمين  ')).toBe('بطاقه تامين');
    expect(key('text', 'بطاقة تأمين')).toBe(key('text', 'بطاقه تامين'));
    expect(key('long_text', 'AB-12')).toBe('ab-12');
  });

  it('keys a number canonically, from a number or its digits', () => {
    expect(key('number', 42)).toBe('42');
    expect(key('number', '042')).toBe('42');
    expect(key('number', '٤٢')).toBe('42');
    expect(key('number', 4.5)).toBe('4.5');
    expect(key('number', 'abc')).toBeNull();
  });

  it('keys a date as ISO only when it is a real date', () => {
    expect(key('date', '2020-01-05')).toBe('2020-01-05');
    expect(key('date', '2020-02-30')).toBeNull();
    expect(key('date', '05/01/2020')).toBeNull();
  });

  it('keys a phone as E.164 in any accepted format (OD-146 point 4)', () => {
    const e164 = key('phone', '+963 930 012 345');
    expect(e164).toBe('+963930012345');
    expect(key('phone', '0930012345')).toBe(e164);
    expect(key('phone', '930012345')).toBe(key('phone', '0930012345'));
    expect(key('phone', '12345')).toBeNull();
  });

  it('gives choices and yes/no no key (OD-146 point 3)', () => {
    expect(key('single_choice', '0b6f2f4e-5d7a-4c1e-9a3b-2f1e0d9c8b7a')).toBeNull();
    expect(key('multi_choice', ['0b6f2f4e-5d7a-4c1e-9a3b-2f1e0d9c8b7a'])).toBeNull();
    expect(key('yes_no', true)).toBeNull();
  });

  it('gives an empty value or one longer than a search term no key', () => {
    expect(key('text', '   ')).toBeNull();
    expect(key('text', null)).toBeNull();
    expect(key('long_text', 'ا'.repeat(101))).toBeNull();
    expect(key('long_text', 'ا'.repeat(100))).toBe('ا'.repeat(100));
  });
});

const chart = {
  id: '0b6f2f4e-5d7a-4c1e-9a3b-2f1e0d9c8b7a',
  givenName: 'ريم',
  contactPhone: '0930012345',
  sex: 'female',
  birthDate: '1990-03-12',
};

describe('`fields` in a registration and an edit (contract rows "Save new", "Edit")', () => {
  it('takes every stored shape and null, by field key', () => {
    const parsed = CreatePatientRequest.parse({
      ...chart,
      fields: { cf_1: 'نص', cf_2: 4, cf_3: true, cf_4: ['0b6f2f4e-5d7a-4c1e-9a3b-2f1e0d9c8b7a'] },
    });
    expect(Object.keys(parsed.fields ?? {})).toEqual(['cf_1', 'cf_2', 'cf_3', 'cf_4']);
    const edit = UpdatePatientRequest.parse({
      expectedUpdatedAt: '2026-11-28T10:00:00.000Z',
      fields: { cf_1: null },
    });
    expect(edit.fields).toEqual({ cf_1: null });
  });

  it('refuses a key that is not a field key, and more than 20 entries', () => {
    expect(CreatePatientRequest.safeParse({ ...chart, fields: { name: 'x' } }).success).toBe(false);
    const many = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`cf_${String(i)}`, 1]));
    expect(CreatePatientRequest.safeParse({ ...chart, fields: many }).success).toBe(false);
    const twenty = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`cf_${String(i)}`, 1]));
    expect(CreatePatientRequest.safeParse({ ...chart, fields: twenty }).success).toBe(true);
  });

  it('refuses a value of no stored shape', () => {
    expect(CreatePatientRequest.safeParse({ ...chart, fields: { cf_1: { a: 1 } } }).success).toBe(
      false,
    );
    expect(CreatePatientRequest.safeParse({ ...chart, fields: { cf_1: [1, 2] } }).success).toBe(
      false,
    );
  });
});

describe('a field on the summary (contract row "Summary")', () => {
  it('carries key, label, section, order, type, value, sensitive and the choices it shows', () => {
    const field = PatientChartField.parse({
      key: 'cf_1',
      label: 'نوع الدفع',
      section: 'معلومات إدارية',
      order: 0,
      type: 'single_choice',
      value: '0b6f2f4e-5d7a-4c1e-9a3b-2f1e0d9c8b7a',
      sensitive: false,
      options: [{ id: '0b6f2f4e-5d7a-4c1e-9a3b-2f1e0d9c8b7a', label: 'نقدي', archived: true }],
    });
    expect(field.options[0]?.archived).toBe(true);
    expect(PatientChartField.safeParse({ ...field, value: null }).success).toBe(true);
  });
});
