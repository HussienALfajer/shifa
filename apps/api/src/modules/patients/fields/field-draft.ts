// A field definition as it will be saved (spec A-03 criteria 14, 15, 37, 39; slice A-03-05): the
// create's body, or the field as stored with an edit's body over it, checked as a whole. Every
// misfit is a 400 `validation_failed` on its body path (never the value): rules that do not fit
// the type, a default its rules refuse, choices (2 to 250 active, unique after folding, never
// deleted), edit roles outside the view roles, a sensitive field that is searchable.
import {
  type CreatePatientFieldRequest,
  checkPatientFieldValue,
  PATIENT_FIELD_RULES,
  type PatientFieldType,
  patientFieldRuleProblems,
  storedPatientFieldValue,
  type UpdatePatientFieldRequest,
  type ValidationIssue,
} from '@shifa/contracts';
import type { StoredFieldRules } from '@shifa/db';
import { RequestValidationError } from '../../../platform/contract/index.ts';
import { folded, type LoadedField } from './field-store.ts';

export interface DraftOption {
  /** Absent for a new choice. */
  id?: string;
  label: string;
  archived: boolean;
}

export interface FieldDraft {
  label: string;
  labelEn: string | null;
  section: string;
  required: boolean;
  rules: StoredFieldRules;
  options: DraftOption[];
  viewRoles: string[];
  editRoles: string[];
  sensitive: boolean;
  searchable: boolean;
  print: boolean;
}

type DefaultInput = CreatePatientFieldRequest['default'];

const CHOICE_TYPES: readonly PatientFieldType[] = ['single_choice', 'multi_choice'];

/** The validation sent, each rule left out as none. */
function validationOf(
  input: CreatePatientFieldRequest['validation'],
): StoredFieldRules['validation'] {
  return {
    minLength: input?.minLength ?? null,
    maxLength: input?.maxLength ?? null,
    min: input?.min ?? null,
    max: input?.max ?? null,
    pattern: input?.pattern ?? null,
  };
}

/** A stored choice default without the choices no longer active (an edit archived them). */
function keptDefault(
  value: StoredFieldRules['default'],
  options: readonly DraftOption[],
): StoredFieldRules['default'] {
  const active = new Set(options.filter((o) => !o.archived).map((o) => o.id));
  if (Array.isArray(value)) return value.filter((id) => active.has(id));
  return typeof value === 'string' && !active.has(value) ? null : value;
}
const unique = (values: readonly string[]) => [...new Set(values)];

/** The draft of a new field from the create's body. */
export function createDraft(input: CreatePatientFieldRequest): {
  draft: FieldDraft;
  defaultInput: DefaultInput;
} {
  return {
    draft: {
      label: input.label.trim(),
      labelEn: input.labelEn?.trim() ?? null,
      section: input.section.trim(),
      required: input.required ?? false,
      rules: { validation: validationOf(input.validation), default: null },
      options: (input.options ?? []).map((o) => ({
        label: o.label.trim(),
        archived: o.archived ?? false,
      })),
      viewRoles: unique(input.viewRoles),
      editRoles: unique(input.editRoles ?? []),
      sensitive: input.sensitive ?? false,
      searchable: input.searchable ?? false,
      print: input.print ?? false,
    },
    defaultInput: input.default ?? null,
  };
}

/** The stored field with the edit's body over it; options sent replace the list as a whole. */
export function editDraft(
  current: LoadedField,
  input: UpdatePatientFieldRequest,
): { draft: FieldDraft; defaultInput: DefaultInput; issues: ValidationIssue[] } {
  const { row } = current;
  const issues: ValidationIssue[] = [];
  let options: DraftOption[] = current.options.map((o) => ({
    id: o.id,
    label: o.label,
    archived: o.archivedAt !== null,
  }));
  if (input.options !== undefined) {
    const byId = new Map(current.options.map((o) => [o.id, o]));
    const sent = input.options.flatMap((o) => (o.id === undefined ? [] : [o.id]));
    const unknown = sent.some((id) => !byId.has(id)) || new Set(sent).size !== sent.length;
    // A choice is never deleted: every existing one must be sent (renamed, moved or archived).
    if (unknown || current.options.some((o) => !sent.includes(o.id))) {
      issues.push({ path: 'body.options', code: unknown ? 'invalid_value' : 'custom' });
    }
    options = input.options.map((o) => {
      const was = o.id === undefined ? undefined : byId.get(o.id);
      return {
        ...(o.id === undefined ? {} : { id: o.id }),
        label: o.label.trim(),
        archived: o.archived ?? (was ? was.archivedAt !== null : false),
      };
    });
  }
  const validation =
    input.validation === undefined ? row.rules.validation : validationOf(input.validation);
  return {
    draft: {
      label: input.label?.trim() ?? row.label,
      labelEn: input.labelEn === undefined ? row.labelEn : (input.labelEn?.trim() ?? null),
      section: input.section?.trim() ?? row.section,
      required: input.required ?? row.required,
      rules: { validation, default: row.rules.default },
      options,
      viewRoles: input.viewRoles === undefined ? row.viewRoles : unique(input.viewRoles),
      editRoles: input.editRoles === undefined ? row.editRoles : unique(input.editRoles),
      sensitive: input.sensitive ?? row.sensitive,
      searchable: input.searchable ?? row.searchable,
      print: input.print ?? row.print,
    },
    defaultInput:
      input.default !== undefined
        ? input.default
        : CHOICE_TYPES.includes(row.type)
          ? keptDefault(row.rules.default, options)
          : row.rules.default,
    issues,
  };
}

/** The issues of a choice list (criteria 14, 37). */
function optionIssues(type: PatientFieldType, options: readonly DraftOption[]): ValidationIssue[] {
  if (!CHOICE_TYPES.includes(type)) {
    return options.length > 0 ? [{ path: 'body.options', code: 'custom' }] : [];
  }
  if (options.some((o) => o.label.length === 0))
    return [{ path: 'body.options', code: 'too_small' }];
  const active = options.filter((o) => !o.archived);
  if (active.length < PATIENT_FIELD_RULES.optionsMin) {
    return [{ path: 'body.options', code: 'too_small' }];
  }
  if (options.length > PATIENT_FIELD_RULES.optionsMax) {
    return [{ path: 'body.options', code: 'too_big' }];
  }
  const labels = active.map((o) => folded(o.label));
  return new Set(labels).size === labels.length ? [] : [{ path: 'body.options', code: 'custom' }];
}

/**
 * A choice's default named by label (folded) or by option id; `ids` are the draft's option ids
 * by position (new ones get theirs when written: `pending` stands for them until then).
 */
function choiceDefault(
  value: unknown,
  options: readonly DraftOption[],
  ids: readonly string[],
): unknown {
  const pick = (one: unknown) => {
    if (typeof one !== 'string') return one;
    const at = options.findIndex(
      (o, i) => !o.archived && (ids[i] === one || folded(o.label) === folded(one)),
    );
    return at === -1 ? `unknown:${one}` : ids[at];
  };
  return Array.isArray(value) ? value.map(pick) : pick(value);
}

/**
 * Checks the draft for its type and returns it with its default as stored. `ids`: the option ids
 * by position as they will be written. Throws 400 with every issue found.
 */
export function checkedDraft(
  type: PatientFieldType,
  draft: FieldDraft,
  defaultInput: DefaultInput,
  ids: readonly string[],
  earlier: readonly ValidationIssue[] = [],
): FieldDraft {
  const issues: ValidationIssue[] = [...earlier];
  if (draft.label.length === 0) issues.push({ path: 'body.label', code: 'too_small' });
  if (draft.labelEn !== null && draft.labelEn.length === 0) {
    issues.push({ path: 'body.labelEn', code: 'too_small' });
  }
  if (draft.section.length === 0) issues.push({ path: 'body.section', code: 'too_small' });
  if (draft.viewRoles.length === 0) issues.push({ path: 'body.viewRoles', code: 'too_small' });
  if (draft.editRoles.some((r) => !draft.viewRoles.includes(r))) {
    issues.push({ path: 'body.editRoles', code: 'custom' });
  }
  // Criterion 15: a sensitive field is never searchable.
  if (draft.sensitive && draft.searchable) issues.push({ path: 'body.searchable', code: 'custom' });
  const ruleProblems = patientFieldRuleProblems(type, draft.rules.validation);
  for (const p of ruleProblems) issues.push({ path: `body.${p.path}`, code: p.code });
  issues.push(...optionIssues(type, draft.options));

  let stored: unknown = null;
  if (ruleProblems.length === 0 && defaultInput !== null && defaultInput !== undefined) {
    const value = CHOICE_TYPES.includes(type)
      ? choiceDefault(defaultInput, draft.options, ids)
      : defaultInput;
    const rules = {
      type,
      required: false,
      validation: draft.rules.validation,
      options: draft.options.map((o, i) => ({ id: ids[i] ?? '', archived: o.archived })),
    };
    const problem = checkPatientFieldValue(rules, value);
    if (problem) issues.push({ path: 'body.default', code: problem });
    else stored = storedPatientFieldValue(rules, value);
  }
  if (issues.length > 0) throw new RequestValidationError(issues);
  return { ...draft, rules: { ...draft.rules, default: stored as StoredFieldRules['default'] } };
}

/** The keys an edit changed, in the contract's order (audit `patient_field.edited`). */
export function changedKeys(before: FieldDraft, after: FieldDraft): string[] {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const keys: [string, unknown, unknown][] = [
    ['label', before.label, after.label],
    ['labelEn', before.labelEn, after.labelEn],
    ['section', folded(before.section), folded(after.section)],
    ['required', before.required, after.required],
    ['validation', before.rules.validation, after.rules.validation],
    ['default', before.rules.default, after.rules.default],
    ['options', before.options, after.options],
    ['viewRoles', before.viewRoles, after.viewRoles],
    ['editRoles', before.editRoles, after.editRoles],
    ['sensitive', before.sensitive, after.sensitive],
    ['searchable', before.searchable, after.searchable],
    ['print', before.print, after.print],
  ];
  return keys.filter(([, a, b]) => !same(a, b)).map(([key]) => key);
}

/** The stored field as a draft (for `changedKeys`). */
export function storedDraft(field: LoadedField): FieldDraft {
  const { row } = field;
  return {
    label: row.label,
    labelEn: row.labelEn,
    section: row.section,
    required: row.required,
    rules: row.rules,
    options: field.options.map((o) => ({
      id: o.id,
      label: o.label,
      archived: o.archivedAt !== null,
    })),
    viewRoles: row.viewRoles,
    editRoles: row.editRoles,
    sensitive: row.sensitive,
    searchable: row.searchable,
    print: row.print,
  };
}
