// A-03 criteria 1 and 3 (A-03-02): the shared rules of a chart's identity, the same in the browser
// and on the server. Each name part is 1–40 Arabic or Latin letters, spaces, hyphens or
// apostrophes; the display name is given, father, family. The birth is a date or an age (years,
// or months under 2), never both and never neither. The chart id is a UUID the client chooses.
import { describe, expect, it } from 'vitest';
import {
  CreatePatientRequest,
  isPatientNamePart,
  PatientAge,
  patientDisplayName,
  UpdatePatientRequest,
} from '../src/patients.ts';

const ID = '0b6f2f4e-5d7a-4c1e-9a3b-2f1e0d9c8b7a';
const base = {
  id: ID,
  givenName: 'ريم',
  contactPhone: '0930012345',
  sex: 'female',
  birthDate: '1990-03-12',
};

/** `body` without `key` (a field left out of a request). */
function omit(body: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).filter(([k]) => k !== key));
}

function issuesOf(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return (result.error?.issues ?? []).map((i) => i.path.join('.'));
}

describe('name parts (criterion 1)', () => {
  it('accepts Arabic and Latin letters with spaces, hyphens and apostrophes', () => {
    for (const part of [
      'ريم',
      'عبد الرحمن',
      'أحمد',
      'آل-حلبي',
      'ٱلحلبي',
      'رِيم',
      'Reem',
      "O'Neil",
      'Özdemir',
      'Yılmaz',
      'Jean-Luc',
      'ab’cd',
    ]) {
      expect(isPatientNamePart(part), part).toBe(true);
    }
  });

  it('refuses digits, punctuation, other scripts, empty and only separators', () => {
    for (const part of [
      '',
      '   ',
      '-',
      "''",
      'ريم1',
      'ريم٣',
      'ريم،',
      'ريم؟',
      'Reem!',
      'Рим',
      '李',
      'ريم😀',
      'a​b',
      'a‮b',
      'ريم\tأحمد',
    ]) {
      expect(isPatientNamePart(part), JSON.stringify(part)).toBe(false);
    }
  });

  it('caps a part at 40 characters', () => {
    const ok = CreatePatientRequest.safeParse({ ...base, givenName: 'ا'.repeat(40) });
    const long = CreatePatientRequest.safeParse({ ...base, givenName: 'ا'.repeat(41) });
    expect(ok.success).toBe(true);
    expect(issuesOf(long)).toEqual(['givenName']);
  });

  it('requires the given name; father, family and mother are optional', () => {
    const without = omit(base, 'givenName');
    expect(issuesOf(CreatePatientRequest.safeParse(without))).toEqual(['givenName']);
    const full = CreatePatientRequest.safeParse({
      ...base,
      fatherName: 'أحمد',
      familyName: 'الحلبي',
      motherName: 'فاطمة',
    });
    expect(full.success).toBe(true);
    const cleared = CreatePatientRequest.safeParse({ ...base, fatherName: null });
    expect(cleared.success).toBe(true);
    const bad = CreatePatientRequest.safeParse({ ...base, motherName: 'فاطمة2' });
    expect(issuesOf(bad)).toEqual(['motherName']);
  });

  it('the display name is given, father, family; trimmed, single-spaced, empty parts left out', () => {
    expect(patientDisplayName({ givenName: 'ريم', fatherName: 'أحمد', familyName: 'الحلبي' })).toBe(
      'ريم أحمد الحلبي',
    );
    expect(patientDisplayName({ givenName: ' ريم ', fatherName: null, familyName: 'الحلبي' })).toBe(
      'ريم الحلبي',
    );
    expect(
      patientDisplayName({ givenName: 'عبد  الرحمن', fatherName: null, familyName: null }),
    ).toBe('عبد الرحمن');
  });
});

describe('sex, phones and the client id (criteria 1, 3)', () => {
  it('sex is male or female', () => {
    expect(CreatePatientRequest.safeParse({ ...base, sex: 'male' }).success).toBe(true);
    expect(issuesOf(CreatePatientRequest.safeParse({ ...base, sex: 'other' }))).toEqual(['sex']);
  });

  it('the id is a UUID chosen by the client', () => {
    expect(issuesOf(CreatePatientRequest.safeParse({ ...base, id: 'chart-1' }))).toEqual(['id']);
  });

  it('the contact phone is required; the second phone may be null', () => {
    const without = omit(base, 'contactPhone');
    expect(issuesOf(CreatePatientRequest.safeParse(without))).toEqual(['contactPhone']);
    expect(CreatePatientRequest.safeParse({ ...base, secondPhone: null }).success).toBe(true);
  });

  it('the previous file number is 1–40 characters, not only spaces', () => {
    expect(CreatePatientRequest.safeParse({ ...base, previousFileNumber: 'A-17' }).success).toBe(
      true,
    );
    expect(issuesOf(CreatePatientRequest.safeParse({ ...base, previousFileNumber: '  ' }))).toEqual(
      ['previousFileNumber'],
    );
    expect(
      issuesOf(CreatePatientRequest.safeParse({ ...base, previousFileNumber: '1'.repeat(41) })),
    ).toEqual(['previousFileNumber']);
  });
});

describe('date of birth or age (criterion 1)', () => {
  it('takes a date or an age, never both, never neither', () => {
    const noBirth = omit(base, 'birthDate');
    expect(CreatePatientRequest.safeParse(base).success).toBe(true);
    expect(
      CreatePatientRequest.safeParse({ ...noBirth, age: { value: 30, unit: 'years' } }).success,
    ).toBe(true);
    expect(issuesOf(CreatePatientRequest.safeParse(noBirth))).toEqual(['birthDate']);
    expect(
      issuesOf(CreatePatientRequest.safeParse({ ...base, age: { value: 30, unit: 'years' } })),
    ).toEqual(['birthDate']);
  });

  it('an age is 2–130 years, or 0–23 months', () => {
    for (const age of [
      { value: 2, unit: 'years' },
      { value: 130, unit: 'years' },
      { value: 0, unit: 'months' },
      { value: 23, unit: 'months' },
    ]) {
      expect(PatientAge.safeParse(age).success, JSON.stringify(age)).toBe(true);
    }
    for (const age of [
      { value: 1, unit: 'years' },
      { value: 131, unit: 'years' },
      { value: 24, unit: 'months' },
      { value: -1, unit: 'months' },
      { value: 2.5, unit: 'years' },
      { value: 3, unit: 'weeks' },
    ]) {
      expect(PatientAge.safeParse(age).success, JSON.stringify(age)).toBe(false);
    }
  });

  it('the date is an ISO date', () => {
    expect(issuesOf(CreatePatientRequest.safeParse({ ...base, birthDate: '12/03/1990' }))).toEqual([
      'birthDate',
    ]);
  });
});

describe('the edit (criteria 12, 28)', () => {
  const at = '2026-11-27T10:00:00.000Z';

  it('needs expectedUpdatedAt; every other field is optional', () => {
    expect(UpdatePatientRequest.safeParse({ expectedUpdatedAt: at }).success).toBe(true);
    expect(issuesOf(UpdatePatientRequest.safeParse({ givenName: 'ريم' }))).toEqual([
      'expectedUpdatedAt',
    ]);
  });

  it('takes a date or an age, not both; the given name cannot be cleared', () => {
    expect(
      issuesOf(
        UpdatePatientRequest.safeParse({
          expectedUpdatedAt: at,
          birthDate: '1990-01-01',
          age: { value: 3, unit: 'years' },
        }),
      ),
    ).toEqual(['birthDate']);
    expect(
      issuesOf(UpdatePatientRequest.safeParse({ expectedUpdatedAt: at, givenName: null })),
    ).toEqual(['givenName']);
    expect(
      UpdatePatientRequest.safeParse({ expectedUpdatedAt: at, familyName: null }).success,
    ).toBe(true);
  });

  it('the id cannot change', () => {
    const parsed = UpdatePatientRequest.safeParse({ expectedUpdatedAt: at, id: ID });
    expect(parsed.success && 'id' in parsed.data).toBe(false);
  });
});
