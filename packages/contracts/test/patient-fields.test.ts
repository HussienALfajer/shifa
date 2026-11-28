// A-03 criteria 14, 16 (validation part), 37, 39 (A-03-05): the definition of a custom field and the
// value validator the browser and the server share. Every type has its value shape and its rules
// (length or range, a text pattern); a text pattern is a preset or a custom expression, checked
// by a linear-time engine (no backtracking) under a length cap; the type is fixed after creation.
import { describe, expect, it } from 'vitest';
import {
  CreatePatientFieldRequest,
  checkPatientFieldPattern,
  checkPatientFieldValue,
  PATIENT_FIELD_RULES,
  type PatientFieldRules,
  PatientFieldType,
  UpdatePatientFieldRequest,
} from '../src/patient-fields.ts';

const NONE = {
  minLength: null,
  maxLength: null,
  min: null,
  max: null,
  pattern: null,
} as const;

function rules(over: Partial<PatientFieldRules> & Pick<PatientFieldRules, 'type'>) {
  return { required: false, validation: NONE, options: [], ...over } satisfies PatientFieldRules;
}

const A = '0b6f2f4e-5d7a-4c1e-9a3b-2f1e0d9c8b7a';
const B = '1b6f2f4e-5d7a-4c1e-9a3b-2f1e0d9c8b7b';
const OLD = '2b6f2f4e-5d7a-4c1e-9a3b-2f1e0d9c8b7c';
const CHOICES = [
  { id: A, archived: false },
  { id: B, archived: false },
  { id: OLD, archived: true },
];

describe('the eight types (criterion 14)', () => {
  it('are a closed list', () => {
    expect(PatientFieldType.options).toEqual([
      'text',
      'long_text',
      'number',
      'date',
      'single_choice',
      'multi_choice',
      'yes_no',
      'phone',
    ]);
  });

  it('accept their own value shape and refuse any other', () => {
    const cases: [PatientFieldRules['type'], unknown, unknown][] = [
      ['text', 'زرقاء', 12],
      ['long_text', 'سطر أول\nسطر ثان', true],
      ['number', 12.5, '12'],
      ['date', '2026-03-12', '2026-02-30'],
      ['yes_no', false, 'yes'],
      ['phone', '0930012345', '12'],
    ];
    for (const [type, good, bad] of cases) {
      expect(checkPatientFieldValue(rules({ type }), good), `${type} good`).toBeNull();
      expect(checkPatientFieldValue(rules({ type }), bad), `${type} bad`).not.toBeNull();
    }
  });

  it('take active choices only: one id, or several distinct ids', () => {
    const single = rules({ type: 'single_choice', options: CHOICES });
    expect(checkPatientFieldValue(single, A)).toBeNull();
    expect(checkPatientFieldValue(single, OLD)).toBe('invalid_value');
    expect(checkPatientFieldValue(single, [A])).toBe('invalid_type');
    const multi = rules({ type: 'multi_choice', options: CHOICES });
    expect(checkPatientFieldValue(multi, [A, B])).toBeNull();
    expect(checkPatientFieldValue(multi, [A, A])).toBe('invalid_value');
    expect(checkPatientFieldValue(multi, [OLD])).toBe('invalid_value');
    expect(checkPatientFieldValue(multi, A)).toBe('invalid_type');
  });

  it('read an empty value as none: refused only when the field is required', () => {
    for (const type of PatientFieldType.options) {
      const optional = rules({ type, options: CHOICES });
      expect(checkPatientFieldValue(optional, null), type).toBeNull();
      expect(checkPatientFieldValue({ ...optional, required: true }, null), type).toBe('too_small');
    }
    expect(checkPatientFieldValue(rules({ type: 'text', required: true }), '   ')).toBe(
      'too_small',
    );
    expect(checkPatientFieldValue(rules({ type: 'multi_choice', required: true }), [])).toBe(
      'too_small',
    );
  });
});

describe('rules by type (criteria 14, 39)', () => {
  it('bound a text by its length, and every text by the hard caps', () => {
    const text = rules({ type: 'text', validation: { ...NONE, minLength: 2, maxLength: 5 } });
    expect(checkPatientFieldValue(text, 'ab')).toBeNull();
    expect(checkPatientFieldValue(text, 'a')).toBe('too_small');
    expect(checkPatientFieldValue(text, 'abcdef')).toBe('too_big');
    const long = 'س'.repeat(PATIENT_FIELD_RULES.textMax + 1);
    expect(checkPatientFieldValue(rules({ type: 'text' }), long)).toBe('too_big');
    expect(checkPatientFieldValue(rules({ type: 'long_text' }), long)).toBeNull();
  });

  it('bound a number by its range', () => {
    const n = rules({ type: 'number', validation: { ...NONE, min: 0, max: 300 } });
    expect(checkPatientFieldValue(n, 0)).toBeNull();
    expect(checkPatientFieldValue(n, -1)).toBe('too_small');
    expect(checkPatientFieldValue(n, 300.5)).toBe('too_big');
    expect(checkPatientFieldValue(n, Number.NaN)).toBe('invalid_type');
  });

  it('shape a text by a preset: any text, digits only, letters only', () => {
    const digits = rules({
      type: 'text',
      validation: { ...NONE, pattern: { preset: 'digits', expression: null } },
    });
    expect(checkPatientFieldValue(digits, '0123')).toBeNull();
    expect(checkPatientFieldValue(digits, '١٢٣')).toBeNull();
    expect(checkPatientFieldValue(digits, '12a')).toBe('invalid_format');
    const letters = rules({
      type: 'text',
      validation: { ...NONE, pattern: { preset: 'letters', expression: null } },
    });
    expect(checkPatientFieldValue(letters, 'زمرة دم')).toBeNull();
    expect(checkPatientFieldValue(letters, 'Öztürk')).toBeNull();
    expect(checkPatientFieldValue(letters, 'A+')).toBe('invalid_format');
  });

  it('shape a text by a custom expression matched in full', () => {
    const custom = rules({
      type: 'text',
      validation: { ...NONE, pattern: { preset: 'custom', expression: '[A-Z]{2}-[0-9]{4}' } },
    });
    expect(checkPatientFieldValue(custom, 'AB-1234')).toBeNull();
    expect(checkPatientFieldValue(custom, 'xAB-1234')).toBe('invalid_format');
  });
});

describe('custom expressions (criterion 39, spec gap 18)', () => {
  it('accept a plain expression', () => {
    expect(checkPatientFieldPattern('[A-Z]{2}-[0-9]{4}')).toBe(true);
    expect(checkPatientFieldPattern('\\p{L}+')).toBe(true);
  });

  it('refuse what a linear-time engine cannot run: backreferences and lookaround', () => {
    expect(checkPatientFieldPattern('(a)\\1')).toBe(false);
    expect(checkPatientFieldPattern('(?=a)a')).toBe(false);
    expect(checkPatientFieldPattern('(?<=a)b')).toBe(false);
  });

  it('refuse an invalid expression and one past the length cap', () => {
    expect(checkPatientFieldPattern('[a-')).toBe(false);
    expect(checkPatientFieldPattern('')).toBe(false);
    expect(checkPatientFieldPattern('a'.repeat(PATIENT_FIELD_RULES.patternMax + 1))).toBe(false);
  });

  it('run an expression that backtracks catastrophically elsewhere in linear time', () => {
    const custom = rules({
      type: 'text',
      validation: { ...NONE, pattern: { preset: 'custom', expression: '(a+)+$' } },
    });
    const started = performance.now();
    expect(checkPatientFieldValue(custom, `${'a'.repeat(190)}b`)).toBe('invalid_format');
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe('requests (criterion 14)', () => {
  const create = {
    label: 'زمرة الدم',
    type: 'single_choice',
    section: 'معلومات إدارية',
    options: [{ label: 'A+' }, { label: 'O-' }],
    viewRoles: ['owner', 'receptionist'],
    editRoles: ['owner'],
  };

  it('take a definition with its options and roles', () => {
    expect(CreatePatientFieldRequest.safeParse(create).success).toBe(true);
  });

  it('cap a label at 60, a section at 40 and the options at 250', () => {
    expect(CreatePatientFieldRequest.safeParse({ ...create, label: 'ح'.repeat(61) }).success).toBe(
      false,
    );
    expect(
      CreatePatientFieldRequest.safeParse({ ...create, section: 'ق'.repeat(41) }).success,
    ).toBe(false);
    const many = Array.from({ length: 251 }, (_, i) => ({ label: `خيار ${String(i)}` }));
    expect(CreatePatientFieldRequest.safeParse({ ...create, options: many }).success).toBe(false);
  });

  it('refuse a role outside the clinic roles', () => {
    expect(
      CreatePatientFieldRequest.safeParse({ ...create, viewRoles: ['platform_admin'] }).success,
    ).toBe(false);
  });

  it('need `expectedUpdatedAt` on an edit; a type sent is the server’s 400 `type_fixed`', () => {
    expect(UpdatePatientFieldRequest.safeParse({ label: 'زمرة' }).success).toBe(false);
    const at = '2026-11-28T10:00:00.000Z';
    expect(UpdatePatientFieldRequest.safeParse({ expectedUpdatedAt: at }).success).toBe(true);
    expect(
      UpdatePatientFieldRequest.safeParse({ expectedUpdatedAt: at, type: 'text' }).success,
    ).toBe(true);
  });
});
