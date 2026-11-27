// The flag catalogue (A-02 criterion 7, OD-114, PLT-25): every engineering flag the API knows, with
// its default. Declared here in code, like the permission and entitlement catalogues; the super
// admin only switches them. A gate naming a key outside it stops the start (access-check.ts), and
// an evaluation naming one throws. Release 1 declares none yet; tests add their own.

export interface FlagDefinition {
  readonly key: string;
  /** For developers (the screens label flags through i18n). */
  readonly description: string;
  /** Its value while the super admin has not changed it. */
  readonly defaultValue: boolean;
}

export const PRODUCTION_FLAGS: readonly FlagDefinition[] = [];

/** Injection token of the FlagCatalogue. */
export const FLAG_CATALOGUE = Symbol('FLAG_CATALOGUE');

const KEY = /^[a-z][a-z_]*(\.[a-z][a-z_]*)+$/;
/** A flag's key goes into its audit row, whose values are at most 36 characters. */
export const FLAG_KEY_MAX = 36;

export class UnknownFlagError extends Error {
  override name = 'UnknownFlagError';
}

export class FlagCatalogue {
  readonly #definitions = new Map<string, FlagDefinition>();

  constructor(definitions: readonly FlagDefinition[]) {
    for (const definition of definitions) {
      if (!KEY.test(definition.key) || definition.key.length > FLAG_KEY_MAX) {
        throw new UnknownFlagError(`malformed flag key: ${definition.key}`);
      }
      if (this.#definitions.has(definition.key)) {
        throw new UnknownFlagError(`flag key listed twice: ${definition.key}`);
      }
      this.#definitions.set(definition.key, definition);
    }
  }

  has(key: string): boolean {
    return this.#definitions.has(key);
  }

  /** The flag's definition; throws for a key outside the catalogue. */
  get(key: string): FlagDefinition {
    const definition = this.#definitions.get(key);
    if (!definition) throw new UnknownFlagError(`unknown flag key: ${key}`);
    return definition;
  }

  /** In declaration order (the order the flags list shows them in). */
  definitions(): FlagDefinition[] {
    return [...this.#definitions.values()];
  }
}
