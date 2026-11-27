// A key's history for a clinic (A-02 criterion 20), from `tenant_override_event`: every set,
// change, removal and type change as written, plus an `expired` event wherever an override ran out
// before the next override change (or before now). An expiry is no write: it is derived here from
// the override's own expiry, so it shows at the instant it took effect.
import type { OverrideEvent } from '@shifa/contracts';
import type { OverrideState, tenantOverrideEvent } from '@shifa/db';
import { endOfDamascusDay } from './damascus.ts';

type EventRow = typeof tenantOverrideEvent.$inferSelect;

interface Timed {
  at: Date;
  kind: OverrideEvent['kind'];
  by: string | null;
  before: OverrideState | null;
  after: OverrideState | null;
  reason: string | null;
}

/** The events of one key, oldest first in `rows`, as the screen lists them: newest first. */
export function keyHistory(
  rows: readonly EventRow[],
  now: Date,
  names: ReadonlyMap<string, string>,
): OverrideEvent[] {
  const overrideChanges = rows.filter((r) => r.kind !== 'type_changed');
  const timeline: Timed[] = [];
  for (const row of rows) {
    timeline.push({
      at: row.at,
      kind: row.kind,
      by: row.by,
      before: row.before,
      after: row.after,
      reason: row.reason,
    });
    if ((row.kind !== 'set' && row.kind !== 'changed') || !row.after?.expiresAt) continue;
    const expiry = endOfDamascusDay(row.after.expiresAt);
    const next = overrideChanges[overrideChanges.indexOf(row) + 1];
    const ranOut = next ? next.at.getTime() >= expiry.getTime() : now.getTime() >= expiry.getTime();
    if (ranOut) {
      timeline.push({
        at: expiry,
        kind: 'expired',
        by: null,
        before: row.after,
        after: null,
        reason: null,
      });
    }
  }
  // Stable: an expiry at the same instant as the next change stays before it.
  const ordered = timeline
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.at.getTime() - b.event.at.getTime() || a.index - b.index)
    .map((x) => x.event)
    .reverse();
  return ordered.map((e) => ({
    kind: e.kind,
    at: e.at.toISOString(),
    byName: e.by ? (names.get(e.by) ?? null) : null,
    before: e.before,
    after: e.after,
    reason: e.reason,
  }));
}
