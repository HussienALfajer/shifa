// Resolution of one setting (A-02 criteria 8, 9; PLT-22 to PLT-24): nearest scope wins, from the
// platform down to the user; a stored value the key's schema no longer accepts is skipped (with its
// lock) and the next scope used; a valid locked value stops every scope below it. A clinic value
// counts only at a scope the key is overridable at, except the super admin's lock at the
// organization, which holds whatever the key's scopes. Pure: the callers load the values.
import type { SettingSource, SettingValue } from '@shifa/contracts';
import { SETTING_SCOPES, type SettingDefinition, type SettingScope } from './catalogue.ts';

/** One stored value that applies to the context being resolved (one per scope at most). */
export interface ScopedValue {
  readonly scope: SettingScope;
  readonly value: unknown;
  readonly locked: boolean;
}

export interface Resolution {
  value: SettingValue;
  source: SettingSource;
  locked: boolean;
  /** The scope of the lock that holds the value; null when none. */
  lockedBy: SettingScope | null;
}

/** Written by migrations only: every value there counts. */
const PLATFORM_SCOPES: readonly SettingScope[] = ['platform', 'plan', 'specialty_pack'];

function counts(definition: SettingDefinition, value: ScopedValue): boolean {
  if (PLATFORM_SCOPES.includes(value.scope)) return true;
  if (value.locked && value.scope === 'organization') return true;
  return definition.overridableBy.includes(value.scope);
}

/** The effective value, the scope it came from and the lock that holds it, if any. */
export function resolveSetting(
  definition: SettingDefinition,
  values: readonly ScopedValue[],
): Resolution {
  let resolution: Resolution = {
    value: definition.defaultValue,
    source: 'default',
    locked: false,
    lockedBy: null,
  };
  for (const scope of SETTING_SCOPES) {
    const stored = values.find((v) => v.scope === scope);
    if (!stored || !counts(definition, stored)) continue;
    const parsed = definition.schema.safeParse(stored.value);
    if (!parsed.success) continue;
    resolution = {
      value: parsed.data,
      source: scope,
      locked: stored.locked,
      lockedBy: stored.locked ? scope : null,
    };
    if (stored.locked) break;
  }
  return resolution;
}

/** Why a write is refused: a scope outside `overridable_by`, a lock, or a value the schema refuses. */
export type WriteRefusal = 'scope' | 'locked' | 'invalid';

/** Null when `value` may be written at `scope` given the values that apply (criterion 8). */
export function writeRefusal(
  definition: SettingDefinition,
  values: readonly ScopedValue[],
  scope: SettingScope,
  value: unknown,
): WriteRefusal | null {
  if (!definition.overridableBy.includes(scope)) return 'scope';
  const depth = SETTING_SCOPES.indexOf(scope);
  const atOrAbove = values.filter((v) => SETTING_SCOPES.indexOf(v.scope) <= depth);
  if (resolveSetting(definition, atOrAbove).locked) return 'locked';
  if (!definition.schema.safeParse(value).success) return 'invalid';
  return null;
}
