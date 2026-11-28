// A chart's custom field values (spec A-03 criteria 4, 16, 17; slice A-03-06; OD-146): written in
// the chart's create and edit transaction, read by the summary only (`chartFieldsOf`, through
// `chartView`), and searched by their key. Roles are the member's in the scope the guard checked
// (`rolesInScope`): a field is written only by its edit roles (403 `field_not_editable` otherwise)
// and shown only to its view roles. Values and labels never reach an error, a log or audit data:
// errors name the field key (`body.fields.<key>`), audit rows the keys written.
// - Required is enforced only for members who may edit the field (OD-146 point 1); on an edit,
//   only clearing a stored value of a required field is refused (point 2).
// - A choice the chart holds stays valid after its option is archived; a new pick of an archived
//   option is refused (criterion 17).
// - The search key is stored for every type that has one; search filters on the field being
//   active, searchable and viewable when it runs.
import {
  checkPatientFieldValue,
  type PatientChartField,
  type PatientFieldRules,
  type PatientFieldValues,
  searchKeyOfPatientFieldValue,
  storedPatientFieldValue,
  type ValidationIssue,
} from '@shifa/contracts';
import { patient, patientField, patientFieldValue, type Tx } from '@shifa/db';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { RequestValidationError } from '../../../platform/contract/index.ts';
import { ApiError } from '../../../platform/errors.ts';
import { type LoadedField, ordersOf, rulesOf } from './field-store.ts';

type ValueRow = typeof patientFieldValue.$inferSelect;
type StoredValue = ValueRow['value'];
type ChartRow = typeof patient.$inferSelect;

/** Who writes and when: the scope's clinic and user. */
export interface ValueWriter {
  tenantId: string;
  userId: string;
  at: Date;
}

const holds = (roles: readonly string[], allowed: readonly string[]) =>
  allowed.some((role) => roles.includes(role));

const pathOf = (key: string) => `body.fields.${key}`;

/** The chart's stored values, by field id. */
async function valuesOf(tx: Tx, chartId: string): Promise<Map<string, ValueRow>> {
  const rows = await tx
    .select()
    .from(patientFieldValue)
    .where(eq(patientFieldValue.patientId, chartId));
  return new Map(rows.map((row) => [row.fieldId, row]));
}

/** The option ids a stored value holds. */
function heldIds(value: StoredValue | undefined): Set<string> {
  if (Array.isArray(value)) return new Set(value);
  return new Set(typeof value === 'string' ? [value] : []);
}

/** The field's rules, a held archived choice counted as active (criterion 17). */
function rulesHolding(field: LoadedField, held: StoredValue | undefined): PatientFieldRules {
  const ids = heldIds(held);
  return {
    ...rulesOf(field),
    options: field.options.map((o) => ({
      id: o.id,
      archived: o.archivedAt !== null && !ids.has(o.id),
    })),
  };
}

/** The field's default when it still fits (a default choice archived since is none). */
function defaultOf(field: LoadedField): unknown {
  const value = field.row.rules.default;
  if (value === null) return null;
  return checkPatientFieldValue({ ...rulesOf(field), required: false }, value) === null
    ? value
    : null;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The checked values a save will write: the stored values that change and the keys written.
 * Taken before anything else is checked or written, so a misfit field answers first.
 */
export interface FieldValuePlan {
  cleared: readonly LoadedField[];
  changed: readonly { field: LoadedField; value: StoredValue }[];
  /** The keys written, in field order. */
  keys: string[];
}

/**
 * Checks `input` for the chart (criteria 16, 17): every key must be an active field (400 at its
 * path otherwise) the member's roles may edit (403 `field_not_editable`). On a registration
 * (`chartId` null: no stored values yet), defaults fill the editable fields not sent and required
 * ones are enforced; on an edit, only the keys sent change. Writes nothing.
 */
export async function planFieldValues(
  tx: Tx,
  roles: readonly string[],
  chartId: string | null,
  fields: readonly LoadedField[],
  input: PatientFieldValues | undefined,
): Promise<FieldValuePlan> {
  const mode = chartId === null ? 'create' : 'edit';
  const sent = input ?? {};
  const active = new Map(
    fields.filter(({ row }) => row.state === 'active').map((field) => [field.row.key, field]),
  );
  const unknown = Object.keys(sent).filter((key) => !active.has(key));
  if (unknown.length > 0) {
    throw new RequestValidationError(
      unknown.map((key) => ({ path: pathOf(key), code: 'invalid_key' })),
    );
  }
  const refused = Object.keys(sent).filter(
    (key) => !holds(roles, active.get(key)?.row.editRoles ?? []),
  );
  if (refused.length > 0) throw ApiError.fieldNotEditable(refused);
  if (chartId !== null && Object.keys(sent).length === 0) {
    return { cleared: [], changed: [], keys: [] };
  }

  const current = chartId === null ? new Map<string, ValueRow>() : await valuesOf(tx, chartId);
  const issues: ValidationIssue[] = [];
  const next: { field: LoadedField; value: StoredValue | null }[] = [];
  for (const field of active.values()) {
    const { key, editRoles } = field.row;
    const editable = holds(roles, editRoles);
    const was = current.get(field.row.id)?.value;
    let value: unknown;
    if (Object.hasOwn(sent, key)) value = sent[key];
    else if (mode === 'create' && editable) value = defaultOf(field);
    else continue;
    const rules = rulesHolding(field, was);
    const required = rules.required && editable && (mode === 'create' || was !== undefined);
    const problem = checkPatientFieldValue({ ...rules, required }, value);
    if (problem) issues.push({ path: pathOf(key), code: problem });
    else next.push({ field, value: storedPatientFieldValue(rules, value) as StoredValue | null });
  }
  if (issues.length > 0) throw new RequestValidationError(issues);

  const cleared = next
    .filter(({ field, value }) => value === null && current.has(field.row.id))
    .map(({ field }) => field);
  const changed = next.flatMap(({ field, value }) =>
    value !== null && !same(current.get(field.row.id)?.value, value) ? [{ field, value }] : [],
  );
  const written = new Set([...cleared, ...changed.map(({ field }) => field)].map((f) => f.row.key));
  return { cleared, changed, keys: [...active.keys()].filter((key) => written.has(key)) };
}

/** Writes a plan on the chart (after the chart row exists); returns the keys written. */
export async function writeFieldValues(
  tx: Tx,
  writer: ValueWriter,
  chartId: string,
  { cleared, changed, keys }: FieldValuePlan,
): Promise<string[]> {
  if (cleared.length > 0) {
    await tx.delete(patientFieldValue).where(
      and(
        eq(patientFieldValue.patientId, chartId),
        inArray(
          patientFieldValue.fieldId,
          cleared.map((field) => field.row.id),
        ),
      ),
    );
  }
  if (changed.length > 0) {
    await tx
      .insert(patientFieldValue)
      .values(
        changed.map(({ field, value }) => ({
          tenantId: writer.tenantId,
          patientId: chartId,
          fieldId: field.row.id,
          value,
          searchKey: searchKeyOfPatientFieldValue(field.row, value),
          updatedBy: writer.userId,
          updatedAt: writer.at,
        })),
      )
      .onConflictDoUpdate({
        target: [
          patientFieldValue.tenantId,
          patientFieldValue.patientId,
          patientFieldValue.fieldId,
        ],
        set: {
          value: sql`excluded.value`,
          searchKey: sql`excluded.search_key`,
          updatedBy: sql`excluded.updated_by`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
  return keys;
}

/**
 * The summary's fields (contract row "Summary"): the active fields `roles` may view, by section
 * and order, each with the chart's value or null. A choice field lists its active choices and the
 * archived ones the chart holds. The only reader of values outside search.
 */
export async function chartFieldsOf(
  tx: Tx,
  chartId: string,
  fields: readonly LoadedField[],
  roles: readonly string[],
): Promise<PatientChartField[]> {
  const visible = fields.filter(({ row }) => row.state === 'active' && holds(roles, row.viewRoles));
  if (visible.length === 0) return [];
  const values = await valuesOf(tx, chartId);
  const orders = ordersOf(visible);
  return visible.map((field) => {
    const { row } = field;
    const value = values.get(row.id)?.value ?? null;
    const held = heldIds(value ?? undefined);
    return {
      key: row.key,
      label: row.label,
      section: row.section,
      order: orders.get(row.id) ?? 0,
      type: row.type,
      value,
      sensitive: row.sensitive,
      options: field.options
        .filter((o) => o.archivedAt === null || held.has(o.id))
        .map((o) => ({ id: o.id, label: o.label, archived: o.archivedAt !== null })),
    };
  });
}

/**
 * The search path of custom fields (criterion 4): the term's key for each active searchable field
 * `roles` may view, matched by equality on `(tenant_id, field_id, search_key)`; at most `limit`
 * charts in the states searched, by file number.
 */
export async function byFieldValue(
  tx: Tx,
  term: string,
  roles: readonly string[],
  states: readonly ChartRow['state'][],
  limit: number,
): Promise<ChartRow[]> {
  const searchable = await tx
    .select({ id: patientField.id, type: patientField.type, viewRoles: patientField.viewRoles })
    .from(patientField)
    .where(and(eq(patientField.state, 'active'), eq(patientField.searchable, true)));
  const pairs = searchable.flatMap((field) => {
    const key = holds(roles, field.viewRoles) ? searchKeyOfPatientFieldValue(field, term) : null;
    return key === null ? [] : [{ id: field.id, key }];
  });
  if (pairs.length === 0) return [];
  const rows = await tx
    .selectDistinct({ chart: patient })
    .from(patientFieldValue)
    .innerJoin(
      patient,
      and(
        eq(patient.tenantId, patientFieldValue.tenantId),
        eq(patient.id, patientFieldValue.patientId),
      ),
    )
    .where(
      and(
        or(
          ...pairs.map(({ id, key }) =>
            and(eq(patientFieldValue.fieldId, id), eq(patientFieldValue.searchKey, key)),
          ),
        ),
        inArray(patient.state, [...states]),
      ),
    )
    .orderBy(asc(patient.fileNumber))
    .limit(limit);
  return rows.map((r) => r.chart);
}
