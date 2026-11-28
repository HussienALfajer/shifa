// Reading and shaping the clinic's custom field definitions (spec A-03 criteria 14–17, 38; slice
// A-03-05). A field archived 30 days ago or more counts as purged even before the purge has run
// (a support session reads without writing), so every read applies the cutoff of the API's clock.
// Sections keep their creation order (the oldest field of each), fields their place within it.
import type {
  PatientFieldDefinition,
  PatientFieldRules,
  PatientFormField,
  SessionRole,
} from '@shifa/contracts';
import { foldArabic } from '@shifa/contracts';
import {
  auditEvent,
  patientField,
  patientFieldOption,
  patientFieldValue,
  type Tx,
} from '@shifa/db';
import { and, asc, eq, inArray, lte, ne, sql } from 'drizzle-orm';
import { CUSTOM_FIELD_PURGE_DAYS, customFieldCutoff } from '../../entitlements/index.ts';
import { type ChartCounts, chartCounts } from './field-counts.ts';

export type FieldRow = typeof patientField.$inferSelect;
export type OptionRow = typeof patientFieldOption.$inferSelect;

export interface LoadedField {
  row: FieldRow;
  /** By position. */
  options: OptionRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A label, choice or section as compared: trimmed, spaces as one, folded (criterion 37). */
export const folded = (text: string) => foldArabic(text.trim().replace(/\s+/gu, ' '));

/** Not purged and not past the cutoff: the fields the clinic still has. */
export function isLive(row: FieldRow, now: Date): boolean {
  if (row.state === 'active') return true;
  return (
    row.state === 'archived' && row.archivedAt !== null && row.archivedAt > customFieldCutoff(now)
  );
}

/** The clinic's live fields with their choices, by section in creation order, then position. */
export async function loadFields(tx: Tx, now: Date): Promise<LoadedField[]> {
  const rows = (
    await tx.select().from(patientField).where(ne(patientField.state, 'purged'))
  ).filter((row) => isLive(row, now));
  const ids = rows.map((r) => r.id);
  const options =
    ids.length === 0
      ? []
      : await tx
          .select()
          .from(patientFieldOption)
          .where(inArray(patientFieldOption.fieldId, ids))
          .orderBy(asc(patientFieldOption.position), asc(patientFieldOption.createdAt));
  const firstOf = new Map<string, number>();
  for (const row of rows) {
    const at = row.createdAt.getTime();
    const key = folded(row.section);
    firstOf.set(key, Math.min(firstOf.get(key) ?? at, at));
  }
  rows.sort(
    (a, b) =>
      (firstOf.get(folded(a.section)) ?? 0) - (firstOf.get(folded(b.section)) ?? 0) ||
      a.position - b.position ||
      a.number - b.number,
  );
  return rows.map((row) => ({ row, options: options.filter((o) => o.fieldId === row.id) }));
}

/** One live field by key, locked for update; null when absent or purged. */
export async function lockedField(tx: Tx, key: string, now: Date): Promise<LoadedField | null> {
  const [row] = await tx.select().from(patientField).where(eq(patientField.key, key)).for('update');
  if (!row || !isLive(row, now)) return null;
  const options = await tx
    .select()
    .from(patientFieldOption)
    .where(eq(patientFieldOption.fieldId, row.id))
    .orderBy(asc(patientFieldOption.position), asc(patientFieldOption.createdAt));
  return { row, options };
}

/** The value rules of a field, for the shared validator. */
export function rulesOf(field: LoadedField): PatientFieldRules {
  return {
    type: field.row.type,
    required: field.row.required,
    validation: field.row.rules.validation,
    options: field.options.map((o) => ({ id: o.id, archived: o.archivedAt !== null })),
  };
}

/** The place of each field within its section, from 0, in the listed order. */
export function ordersOf(fields: readonly LoadedField[]): Map<string, number> {
  const next = new Map<string, number>();
  const orders = new Map<string, number>();
  for (const { row } of fields) {
    const section = folded(row.section);
    const at = next.get(section) ?? 0;
    orders.set(row.id, at);
    next.set(section, at + 1);
  }
  return orders;
}

const iso = (at: Date | null) => (at === null ? null : at.toISOString());

/** The owner's view of each field (contract row "List"), with its chart counts (A-03-06). */
export function definitionViews(
  fields: readonly LoadedField[],
  counts: ChartCounts,
): PatientFieldDefinition[] {
  const orders = ordersOf(fields);
  return fields.map(({ row, options }) => ({
    key: row.key,
    label: row.label,
    labelEn: row.labelEn,
    type: row.type,
    required: row.required,
    validation: row.rules.validation,
    default: row.rules.default,
    options: options.map((o, order) => ({
      id: o.id,
      label: o.label,
      archived: o.archivedAt !== null,
      order,
      chartCount: counts.options.get(o.id) ?? 0,
    })),
    viewRoles: row.viewRoles as SessionRole[],
    editRoles: row.editRoles as SessionRole[],
    section: row.section,
    order: orders.get(row.id) ?? 0,
    sensitive: row.sensitive,
    searchable: row.searchable,
    print: row.print,
    chartCount: counts.fields.get(row.id) ?? 0,
    state: row.state === 'active' ? 'active' : 'archived',
    archivedAt: iso(row.archivedAt),
    purgeAt: iso(
      row.archivedAt === null
        ? null
        : new Date(row.archivedAt.getTime() + CUSTOM_FIELD_PURGE_DAYS * DAY_MS),
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/** One field's owner's view, its order counted among the clinic's live fields. */
export async function definitionOf(
  tx: Tx,
  key: string,
  now: Date,
): Promise<PatientFieldDefinition> {
  const fields = await loadFields(tx, now);
  const id = fields.find(({ row }) => row.key === key)?.row.id;
  const counts = await chartCounts(tx, id);
  const view =
    id === undefined ? undefined : definitionViews(fields, counts).find((f) => f.key === key);
  if (!view) throw new Error('the field written is not live');
  return view;
}

/**
 * The member's view (contract row `GET /patients/fields`): active fields one of `roles` may view,
 * `editable` when one may edit; active choices only; no roles, search or print flags.
 */
export function formViews(
  fields: readonly LoadedField[],
  roles: readonly string[],
): PatientFormField[] {
  const visible = fields.filter(
    ({ row }) => row.state === 'active' && row.viewRoles.some((r) => roles.includes(r)),
  );
  const orders = ordersOf(visible);
  return visible.map(({ row, options }) => ({
    key: row.key,
    label: row.label,
    type: row.type,
    required: row.required,
    validation: row.rules.validation,
    default: row.rules.default,
    options: options
      .filter((o) => o.archivedAt === null)
      .map((o) => ({ id: o.id, label: o.label })),
    section: row.section,
    order: orders.get(row.id) ?? 0,
    editable: row.editRoles.some((r) => roles.includes(r)),
    sensitive: row.sensitive,
  }));
}

/** The newest save among live fields: the order route's `expectedUpdatedAt`. */
export function listStamp(fields: readonly LoadedField[]): FieldRow | null {
  let newest: FieldRow | null = null;
  for (const { row } of fields) {
    if (!newest || row.updatedAt > newest.updatedAt) newest = row;
  }
  return newest;
}

/**
 * Criterion 17: fields archived 30 days ago or more become tombstones (`purged`): they stop
 * counting and their keys stay taken. One `patient_field.purged` row each, with no actor (the
 * clock decided). Their values on charts are deleted in the same transaction (A-03-06). Chart
 * writes and field writes call it first. Never in a read-only (support) scope.
 */
export async function purgeExpired(tx: Tx, tenantId: string, now: Date, requestId: string) {
  const purged = await tx
    .update(patientField)
    .set({
      state: 'purged',
      purgedAt: now,
      updatedAt: sql`greatest(${patientField.updatedAt}, ${now.toISOString()}::timestamptz)`,
    })
    .where(
      and(eq(patientField.state, 'archived'), lte(patientField.archivedAt, customFieldCutoff(now))),
    )
    .returning({ id: patientField.id, key: patientField.key });
  if (purged.length === 0) return;
  await tx.delete(patientFieldValue).where(
    inArray(
      patientFieldValue.fieldId,
      purged.map((field) => field.id),
    ),
  );
  await tx.insert(auditEvent).values(
    purged.map((field) => ({
      tenantId,
      actorId: null,
      targetId: field.id,
      event: 'patient_field.purged' as const,
      requestId,
      data: { key: field.key },
    })),
  );
}
