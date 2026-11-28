// The writes of a field's choices and of the fields' order (spec A-03 criteria 14, 37, 38; slice
// A-03-05). A choice is never deleted: it is renamed, moved or archived (and restored) in place;
// new ones are written with the ids the draft gave them. The order moves active fields within
// their own section only; archived ones follow them in their earlier order.
import type { PatientFieldOrderRequest, ValidationIssue } from '@shifa/contracts';
import { patientField, patientFieldOption, type Tx } from '@shifa/db';
import { eq } from 'drizzle-orm';
import { RequestValidationError } from '../../../platform/contract/index.ts';
import type { DraftOption } from './field-draft.ts';
import { type FieldRow, folded, type LoadedField, type OptionRow } from './field-store.ts';

/** Writes `next` (by position) over `current`; `ids[i]` is the id of `next[i]`. */
export async function writeOptions(
  tx: Tx,
  tenantId: string,
  fieldId: string,
  current: readonly OptionRow[],
  next: readonly DraftOption[],
  ids: readonly string[],
  at: Date,
): Promise<void> {
  const byId = new Map(current.map((o) => [o.id, o]));
  const fresh: (typeof patientFieldOption.$inferInsert)[] = [];
  for (const [position, option] of next.entries()) {
    const id = ids[position];
    if (id === undefined) throw new Error('an option without an id');
    const was = byId.get(id);
    if (!was) {
      fresh.push({
        id,
        tenantId,
        fieldId,
        label: option.label,
        position,
        archivedAt: option.archived ? at : null,
        createdAt: at,
      });
      continue;
    }
    const archivedAt = option.archived ? (was.archivedAt ?? at) : null;
    const same =
      was.label === option.label &&
      was.position === position &&
      (was.archivedAt?.getTime() ?? null) === (archivedAt?.getTime() ?? null);
    if (!same) {
      await tx
        .update(patientFieldOption)
        .set({ label: option.label, position, archivedAt })
        .where(eq(patientFieldOption.id, id));
    }
  }
  if (fresh.length > 0) await tx.insert(patientFieldOption).values(fresh);
}

const invalid = (issue: ValidationIssue): never => {
  throw new RequestValidationError([issue]);
};

/**
 * Sets the positions the request names: each section's keys from 0, then its archived fields.
 * 400 on `body.sections` when an active field is missing or named twice, a key is not an active
 * field, or a key sits under another section's title. Returns the rows that moved.
 */
export async function writeOrder(
  tx: Tx,
  live: readonly LoadedField[],
  sections: PatientFieldOrderRequest['sections'],
  userId: string,
  at: Date,
): Promise<FieldRow[]> {
  const active = new Map(
    live.filter(({ row }) => row.state === 'active').map(({ row }) => [row.key, row]),
  );
  const named = sections.flatMap((s) => s.keys);
  const titles = sections.map((s) => folded(s.title));
  if (
    new Set(named).size !== named.length ||
    new Set(titles).size !== titles.length ||
    named.length !== active.size ||
    named.some((key) => !active.has(key))
  ) {
    invalid({ path: 'body.sections', code: 'custom' });
  }
  const positions = new Map<string, number>();
  for (const section of sections) {
    const title = folded(section.title);
    for (const [position, key] of section.keys.entries()) {
      const row = active.get(key);
      if (!row || folded(row.section) !== title) invalid({ path: 'body.sections', code: 'custom' });
      positions.set(key, position);
    }
    const archived = live.filter(
      ({ row }) => row.state === 'archived' && folded(row.section) === title,
    );
    for (const [i, { row }] of archived.entries()) positions.set(row.key, section.keys.length + i);
  }
  const moved: FieldRow[] = [];
  for (const { row } of live) {
    const position = positions.get(row.key);
    if (position === undefined || position === row.position) continue;
    await tx
      .update(patientField)
      .set({ position, updatedBy: userId, updatedAt: at })
      .where(eq(patientField.id, row.id));
    moved.push(row);
  }
  return moved;
}
