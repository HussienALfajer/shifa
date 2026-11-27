// The entitlement catalogue (A-02 criteria 2, 3; PLT-29): every key the API knows, with its kind.
// Injected at start-up (ENTITLEMENT_CATALOGUE) like the permission catalogue: a key the plans or
// add-ons hold that it does not list stops the start (main.ts), and a call naming one throws.
// A-02 registers the three limits and no feature; later specs add their keys here.
import type { EntitlementKind } from '@shifa/contracts';

export interface EntitlementDefinition {
  readonly key: string;
  readonly kind: EntitlementKind;
  /** For developers (the screens label keys through i18n). */
  readonly description: string;
}

export const PRODUCTION_ENTITLEMENTS = [
  {
    key: 'limits.practitioners',
    kind: 'limit',
    description: 'Members holding a doctor role who are not deactivated (pending included)',
  },
  { key: 'limits.branches', kind: 'limit', description: 'Branches that are not archived' },
  {
    key: 'limits.custom_fields',
    kind: 'limit',
    description: 'Custom fields (counted and enforced from A-03)',
  },
] as const satisfies readonly EntitlementDefinition[];

/** Injection token of the EntitlementCatalogue. */
export const ENTITLEMENT_CATALOGUE = Symbol('ENTITLEMENT_CATALOGUE');

const KEY = /^[a-z][a-z_]*(\.[a-z][a-z_]*)+$/;

export class UnknownEntitlementError extends Error {
  override name = 'UnknownEntitlementError';
}

export class EntitlementCatalogue {
  readonly #kinds = new Map<string, EntitlementKind>();
  readonly #definitions: readonly EntitlementDefinition[];

  constructor(definitions: readonly EntitlementDefinition[]) {
    for (const { key, kind } of definitions) {
      if (!KEY.test(key)) throw new UnknownEntitlementError(`malformed entitlement key: ${key}`);
      if (this.#kinds.has(key)) {
        throw new UnknownEntitlementError(`entitlement key listed twice: ${key}`);
      }
      this.#kinds.set(key, kind);
    }
    this.#definitions = [...definitions];
  }

  has(key: string): boolean {
    return this.#kinds.has(key);
  }

  /** The key's kind; throws for a key outside the catalogue. */
  kindOf(key: string): EntitlementKind {
    const kind = this.#kinds.get(key);
    if (!kind) throw new UnknownEntitlementError(`unknown entitlement key: ${key}`);
    return kind;
  }

  /** In catalogue order (the order the screens list them in). */
  definitions(): readonly EntitlementDefinition[] {
    return this.#definitions;
  }
}

/** Throws when plans or add-ons hold a key the catalogue does not list (start-up check). */
export function assertEntitlementKeysKnown(
  catalogue: EntitlementCatalogue,
  keysInUse: readonly string[],
): void {
  const unknown = keysInUse.filter((key) => !catalogue.has(key));
  if (unknown.length > 0) {
    throw new UnknownEntitlementError(
      `plans or add-ons hold keys outside the catalogue: ${unknown.join(', ')}`,
    );
  }
}
