// Entitlement resolution (PLT-21, A-02 criterion 2), a pure function: unexpired tenant override →
// highest replacing add-on → plan value plus incremental add-ons → deny. An override counts until
// the instant of its expiry, not at it.
import type { EntitlementValue } from '@shifa/contracts';
import type { EntitlementCatalogue } from './catalogue.ts';

export interface AddonSource {
  key: string;
  mode: 'replace' | 'increment';
  value: EntitlementValue;
}

export interface OverrideSource {
  key: string;
  value: EntitlementValue;
  /** First instant it no longer counts; null: no expiry. */
  expiresAt: Date | null;
}

/** What one clinic holds: its plan's values, its add-ons and its overrides. */
export interface EntitlementSources {
  planValues: Readonly<Record<string, EntitlementValue>>;
  addons: readonly AddonSource[];
  overrides: readonly OverrideSource[];
}

export function overrideActive(override: { expiresAt: Date | null }, now: Date): boolean {
  return override.expiresAt === null || now.getTime() < override.expiresAt.getTime();
}

/** Highest of several values: the larger number, or on over off. */
function highest(values: readonly EntitlementValue[]): EntitlementValue {
  return values.reduce((a, b) => (Number(b) > Number(a) ? b : a));
}

/**
 * Plans and add-ons are checked at start-up, so a key outside the catalogue there is a fault. An
 * override of a key later removed from the catalogue is ignored instead (it is never looked up):
 * one stale row must not stop a clinic (review N2).
 */
function assertSourcesKnown(catalogue: EntitlementCatalogue, sources: EntitlementSources): void {
  const keys = [...Object.keys(sources.planValues), ...sources.addons.map((a) => a.key)];
  // kindOf() throws UnknownEntitlementError for a key outside the catalogue.
  for (const key of keys) catalogue.kindOf(key);
}

/** The value `key` resolves to; throws UnknownEntitlementError for a key outside the catalogue. */
export function resolveKey(
  catalogue: EntitlementCatalogue,
  key: string,
  sources: EntitlementSources,
  now: Date,
): EntitlementValue {
  const kind = catalogue.kindOf(key);
  assertSourcesKnown(catalogue, sources);
  const override = sources.overrides.find((o) => o.key === key && overrideActive(o, now));
  if (override) return override.value;
  const addons = sources.addons.filter((a) => a.key === key);
  const replacing = addons.filter((a) => a.mode === 'replace').map((a) => a.value);
  if (replacing.length > 0) return highest(replacing);
  const plan = sources.planValues[key];
  const increments = addons.filter((a) => a.mode === 'increment').map((a) => a.value);
  if (kind === 'feature') {
    return plan === true || increments.some((v) => v === true);
  }
  const base = typeof plan === 'number' ? plan : 0;
  return increments.reduce<number>((sum, v) => sum + (typeof v === 'number' ? v : 0), base);
}

/** Every catalogue key's value, in catalogue order. */
export function resolveAll(
  catalogue: EntitlementCatalogue,
  sources: EntitlementSources,
  now: Date,
): Map<string, EntitlementValue> {
  return new Map(
    catalogue.definitions().map((d) => [d.key, resolveKey(catalogue, d.key, sources, now)]),
  );
}
