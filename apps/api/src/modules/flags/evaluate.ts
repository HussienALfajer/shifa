// Flag evaluation (A-02 criterion 7), a pure function: off for all is the kill switch and wins; on
// for all; selected → on only for the clinics listed; no row → the default in code. Rows for keys
// no longer in code are never looked up, so they are ignored.
import type { FlagMode } from '@shifa/db';
import type { FlagCatalogue } from './catalogue.ts';

/** What one clinic reads of the flag tables: every flag's mode, and the flags it is selected for. */
export interface TenantFlagRows {
  flags: readonly { key: string; mode: FlagMode }[];
  /** Keys of the flags this clinic is in the selection of. */
  selected: readonly string[];
}

/** The flag's value for the clinic; throws UnknownFlagError for a key outside the catalogue. */
export function evaluateFlag(catalogue: FlagCatalogue, key: string, rows: TenantFlagRows): boolean {
  const { defaultValue } = catalogue.get(key);
  const row = rows.flags.find((f) => f.key === key);
  if (!row) return defaultValue;
  if (row.mode === 'off') return false;
  if (row.mode === 'on') return true;
  return rows.selected.includes(key);
}

/** Every catalogue flag's value for the clinic, in catalogue order. */
export function evaluateAll(
  catalogue: FlagCatalogue,
  rows: TenantFlagRows,
): Record<string, boolean> {
  return Object.fromEntries(
    catalogue.definitions().map((d) => [d.key, evaluateFlag(catalogue, d.key, rows)]),
  );
}
