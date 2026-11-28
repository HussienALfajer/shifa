// The rules of a custom field (spec A-03 criteria 14, 16, 39; slice A-03-05; ADR-0008), shared by
// the browser and the server: which validation fits which type, the value shape of each type, and
// the check of a custom text pattern. A custom pattern runs on RE2 (re2js: linear time, no
// backreferences or lookaround), so no expression an owner types can backtrack catastrophically;
// it is capped at 100 characters and matched against the whole value.
import { RE2JS } from 're2js';
import type { ValidationIssueCode } from './errors.ts';
import { normalisePhone } from './phone.ts';

export const PATIENT_FIELD_TYPES = [
  'text',
  'long_text',
  'number',
  'date',
  'single_choice',
  'multi_choice',
  'yes_no',
  'phone',
] as const;
export type PatientFieldTypeKey = (typeof PATIENT_FIELD_TYPES)[number];

export const PATIENT_FIELD_PATTERN_PRESETS = ['any', 'digits', 'letters', 'custom'] as const;
export type PatientFieldPatternPresetKey = (typeof PATIENT_FIELD_PATTERN_PRESETS)[number];

/** The fixed limits of a definition (ADR-0008; `limits.custom_fields` is the plan's). */
export const PATIENT_FIELD_RULES = {
  labelMax: 60,
  sectionMax: 40,
  /** A text value's hard cap, and a long text's. */
  textMax: 200,
  longTextMax: 2000,
  optionsMin: 2,
  optionsMax: 250,
  searchableMax: 5,
  patternMax: 100,
  /** A number's magnitude. */
  numberMax: 1_000_000_000_000,
  /** Days an archived field can be restored, and still counts; then it is purged. */
  purgeDays: 30,
} as const;

export interface PatientFieldPatternRule {
  preset: PatientFieldPatternPresetKey;
  expression: string | null;
}

export interface PatientFieldValidationRules {
  minLength: number | null;
  maxLength: number | null;
  min: number | null;
  max: number | null;
  pattern: PatientFieldPatternRule | null;
}

/** What a value is checked against: the definition's type, rules and choices. */
export interface PatientFieldRules {
  type: PatientFieldTypeKey;
  required: boolean;
  validation: PatientFieldValidationRules;
  /** Choices by id; an archived one is not accepted in a new value. */
  options: readonly { id: string; archived: boolean }[];
}

/** One misfit of a definition's rules: `path` under the request body, e.g. `validation.min`. */
export interface PatientFieldRuleProblem {
  path: string;
  code: ValidationIssueCode;
}

const ALLOWED: Readonly<
  Record<PatientFieldTypeKey, readonly (keyof PatientFieldValidationRules)[]>
> = {
  text: ['minLength', 'maxLength', 'pattern'],
  long_text: ['minLength', 'maxLength'],
  number: ['min', 'max'],
  date: [],
  single_choice: [],
  multi_choice: [],
  yes_no: [],
  phone: [],
};

const DIGITS = /^[0-9٠-٩۰-۹]+$/u;
const LETTERS = /^[\p{L}\p{M}' -]+$/u;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * What a pattern may cost (A-03-05 security review H1): RE2 runs in linear time, but a short
 * expression can still compile to a huge program (`(a?…){1000}`), which costs memory to keep and
 * seconds to match. Repeat counts above the longest value are refused before compiling, and the
 * compiled program is capped; real shapes are far below (`[A-Z]{2}-[0-9]{4}` is 9,
 * `[\p{Arabic} ]{1,200}` 401).
 */
const MAX_REPEAT = PATIENT_FIELD_RULES.textMax;
const MAX_PROGRAM = 1000;
const REPEAT = /\{\s*(\d+)\s*(?:,\s*(\d*)\s*)?\}/g;
const CACHE_MAX = 50;

/** Accepted patterns only, at most 50. */
const compiled = new Map<string, RE2JS>();

function repeatsFit(expression: string): boolean {
  for (const [, low, high] of expression.matchAll(REPEAT)) {
    if (Number(low) > MAX_REPEAT || (high !== undefined && Number(high) > MAX_REPEAT)) return false;
  }
  return true;
}

/** The expression compiled by RE2 when it is an acceptable pattern; else null. */
function compile(expression: string): RE2JS | null {
  const cached = compiled.get(expression);
  if (cached) return cached;
  if (expression.length === 0 || expression.length > PATIENT_FIELD_RULES.patternMax) return null;
  if (!repeatsFit(expression)) return null;
  let pattern: RE2JS;
  try {
    pattern = RE2JS.compile(expression);
  } catch {
    return null;
  }
  if (pattern.programSize() > MAX_PROGRAM) return null;
  if (compiled.size >= CACHE_MAX) compiled.clear();
  compiled.set(expression, pattern);
  return pattern;
}

/**
 * True for a custom pattern RE2 runs, of 1 to 100 characters, with repeats of at most 200 and a
 * small compiled program (criterion 39, spec gap 18; security review H1).
 */
export function checkPatientFieldPattern(expression: string): boolean {
  return compile(expression) !== null;
}

const capOf = (type: PatientFieldTypeKey) =>
  type === 'long_text' ? PATIENT_FIELD_RULES.longTextMax : PATIENT_FIELD_RULES.textMax;

/** Where a definition's validation does not fit its type, or is out of order (criterion 14). */
export function patientFieldRuleProblems(
  type: PatientFieldTypeKey,
  validation: PatientFieldValidationRules,
): PatientFieldRuleProblem[] {
  const problems: PatientFieldRuleProblem[] = [];
  const at = (key: keyof PatientFieldValidationRules, code: ValidationIssueCode) =>
    problems.push({ path: `validation.${key}`, code });
  for (const key of Object.keys(validation) as (keyof PatientFieldValidationRules)[]) {
    if (validation[key] !== null && !ALLOWED[type].includes(key)) at(key, 'custom');
  }
  if (problems.length > 0) return problems;
  const { minLength, maxLength, min, max, pattern } = validation;
  if (minLength !== null && minLength > capOf(type)) at('minLength', 'too_big');
  if (maxLength !== null && maxLength > capOf(type)) at('maxLength', 'too_big');
  if (maxLength !== null && maxLength < 1) at('maxLength', 'too_small');
  if (minLength !== null && maxLength !== null && minLength > maxLength) at('minLength', 'custom');
  if (min !== null && max !== null && min > max) at('min', 'custom');
  for (const key of ['min', 'max'] as const) {
    const n = validation[key];
    if (n !== null && Math.abs(n) > PATIENT_FIELD_RULES.numberMax) at(key, 'too_big');
  }
  if (pattern !== null) {
    const custom = pattern.preset === 'custom';
    const expression = pattern.expression;
    if (custom ? expression === null || !checkPatientFieldPattern(expression) : expression !== null)
      at('pattern', 'invalid_format');
  }
  return problems;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  return Array.isArray(value) && value.length === 0;
}

function validDate(text: string): boolean {
  const parts = DATE.exec(text);
  if (!parts) return false;
  const [y, m, d] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d;
}

function textProblem(rules: PatientFieldRules, text: string): ValidationIssueCode | null {
  const value = text.trim();
  const length = Array.from(value).length;
  const { minLength, maxLength, pattern } = rules.validation;
  if (length > capOf(rules.type)) return 'too_big';
  if (minLength !== null && length < minLength) return 'too_small';
  if (maxLength !== null && length > maxLength) return 'too_big';
  if (rules.type !== 'text' || pattern === null) return null;
  switch (pattern.preset) {
    case 'any':
      return null;
    case 'digits':
      return DIGITS.test(value) ? null : 'invalid_format';
    case 'letters':
      return LETTERS.test(value) ? null : 'invalid_format';
    case 'custom': {
      const re = pattern.expression === null ? null : compile(pattern.expression);
      return re?.matches(value) === true ? null : 'invalid_format';
    }
  }
}

function numberProblem(rules: PatientFieldRules, value: number): ValidationIssueCode | null {
  const { min, max } = rules.validation;
  if (Math.abs(value) > PATIENT_FIELD_RULES.numberMax) return 'too_big';
  if (min !== null && value < min) return 'too_small';
  if (max !== null && value > max) return 'too_big';
  return null;
}

function choiceProblem(
  rules: PatientFieldRules,
  ids: readonly unknown[],
): ValidationIssueCode | null {
  if (!ids.every((id) => typeof id === 'string')) return 'invalid_type';
  if (new Set(ids).size !== ids.length) return 'invalid_value';
  const active = new Set(rules.options.filter((o) => !o.archived).map((o) => o.id));
  return ids.every((id) => active.has(id)) ? null : 'invalid_value';
}

/**
 * The problem with `value` for a field of these rules, or null when it fits (criterion 16). An
 * empty value (null, blank text, no choice) is refused only when the field is required.
 */
export function checkPatientFieldValue(
  rules: PatientFieldRules,
  value: unknown,
): ValidationIssueCode | null {
  if (isEmpty(value)) return rules.required ? 'too_small' : null;
  switch (rules.type) {
    case 'text':
    case 'long_text':
      return typeof value === 'string' ? textProblem(rules, value) : 'invalid_type';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? numberProblem(rules, value)
        : 'invalid_type';
    case 'date':
      if (typeof value !== 'string') return 'invalid_type';
      return validDate(value) ? null : 'invalid_format';
    case 'single_choice':
      return typeof value === 'string' ? choiceProblem(rules, [value]) : 'invalid_type';
    case 'multi_choice':
      return Array.isArray(value) ? choiceProblem(rules, value) : 'invalid_type';
    case 'yes_no':
      return typeof value === 'boolean' ? null : 'invalid_type';
    case 'phone':
      if (typeof value !== 'string') return 'invalid_type';
      return normalisePhone(value).ok ? null : 'invalid_format';
  }
}

/** A value that fits, as stored: text trimmed, a phone in E.164, empty as null. */
export function storedPatientFieldValue(rules: PatientFieldRules, value: unknown): unknown {
  if (isEmpty(value)) return null;
  if (typeof value === 'string' && rules.type === 'phone') {
    const phone = normalisePhone(value);
    return phone.ok ? phone.e164 : value;
  }
  return typeof value === 'string' ? value.trim() : value;
}
