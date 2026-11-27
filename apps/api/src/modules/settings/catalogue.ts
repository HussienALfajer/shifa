// The setting catalogue (A-02 criterion 8, PLT-22): every setting the API knows, declared here in
// code (key, schema, default, the clinic scopes that may override it, lockable, sensitivity), like
// the permission, entitlement and flag catalogues. The database only holds values. Checked when the
// catalogue is built (a malformed or doubled key, an unknown scope, a default the schema refuses)
// and at start-up against the stored platform values (main.ts). Later specs add their keys here.
import { IdleMinutes, type SettingSource, type SettingValue } from '@shifa/contracts';
import { z } from 'zod';

/** Every scope a value can come from, nearest last (PLT-22). */
export const SETTING_SCOPES = [
  'platform',
  'plan',
  'specialty_pack',
  'organization',
  'branch',
  'practitioner',
  'user',
] as const satisfies readonly Exclude<SettingSource, 'default'>[];
export type SettingScope = (typeof SETTING_SCOPES)[number];

export interface SettingDefinition {
  readonly key: string;
  /** For developers (the screens label settings through i18n by key). */
  readonly description: string;
  /** What a value must satisfy, on every write and every read (its JSON Schema is derived). */
  readonly schema: z.ZodType<SettingValue>;
  /** The value when no scope holds a valid one. */
  readonly defaultValue: SettingValue;
  /** The scopes a value may be written at by the clinic (or by migrations for platform and plan). */
  readonly overridableBy: readonly SettingScope[];
  /** The super admin may set and lock it for a clinic («قفل بقيمة», criterion 9). */
  readonly lockable: boolean;
  /** `sensitive`: its values never reach the audit log. */
  readonly sensitivity: 'normal' | 'sensitive';
}

/** The clinic's idle sign-out (A-01a criterion 9, OD-77), the first key (criterion 10). */
export const IDLE_MINUTES_KEY = 'session.idle_minutes';

export const PRODUCTION_SETTINGS: readonly SettingDefinition[] = [
  {
    key: IDLE_MINUTES_KEY,
    description: 'automatic sign-out after this many idle minutes (15, 30 or 60)',
    schema: IdleMinutes,
    defaultValue: 30,
    overridableBy: ['organization'],
    lockable: true,
    sensitivity: 'normal',
  },
];

/** Injection token of the SettingCatalogue. */
export const SETTING_CATALOGUE = Symbol('SETTING_CATALOGUE');

const KEY = /^[a-z][a-z_]*(\.[a-z][a-z_]*)+$/;
/** A key goes into its audit row, whose values are at most 36 characters. */
const KEY_MAX = 36;

export class InvalidSettingError extends Error {
  override name = 'InvalidSettingError';
}

export class SettingCatalogue {
  readonly #definitions = new Map<string, SettingDefinition>();
  readonly #jsonSchemas = new Map<string, Record<string, unknown>>();

  constructor(definitions: readonly SettingDefinition[]) {
    for (const definition of definitions) {
      const { key } = definition;
      if (!KEY.test(key) || key.length > KEY_MAX) {
        throw new InvalidSettingError(`malformed setting key: ${key}`);
      }
      if (this.#definitions.has(key)) {
        throw new InvalidSettingError(`setting key listed twice: ${key}`);
      }
      const unknown = definition.overridableBy.filter(
        (s) => !(SETTING_SCOPES as readonly string[]).includes(s),
      );
      if (unknown.length > 0) {
        throw new InvalidSettingError(`setting ${key}: unknown scope ${unknown.join(', ')}`);
      }
      if (!definition.schema.safeParse(definition.defaultValue).success) {
        throw new InvalidSettingError(`setting ${key}: its default does not match its schema`);
      }
      this.#definitions.set(key, definition);
      this.#jsonSchemas.set(key, jsonSchemaOf(definition.schema));
    }
  }

  has(key: string): boolean {
    return this.#definitions.has(key);
  }

  /** The key's definition; throws for a key outside the catalogue. */
  get(key: string): SettingDefinition {
    const definition = this.#definitions.get(key);
    if (!definition) throw new InvalidSettingError(`unknown setting key: ${key}`);
    return definition;
  }

  /** In declaration order (the order the settings tab shows them in). */
  definitions(): SettingDefinition[] {
    return [...this.#definitions.values()];
  }

  /** The key's JSON Schema, derived from its zod schema (criterion 8). */
  jsonSchema(key: string): Record<string, unknown> {
    this.get(key);
    return this.#jsonSchemas.get(key) ?? {};
  }

  /** The allowed values when the schema is an enum (the lock dialog's Select); otherwise null. */
  choices(key: string): SettingValue[] | null {
    const schema = this.jsonSchema(key);
    const values = Array.isArray(schema['enum'])
      ? (schema['enum'] as unknown[])
      : 'const' in schema
        ? [schema['const']]
        : null;
    if (!values) return null;
    return values.filter(
      (v): v is SettingValue =>
        typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean',
    );
  }
}

/**
 * The schema's JSON Schema, with a named schema (`.meta({ id })`, which zod moves into `$defs`)
 * inlined at the top, so `enum` and `type` are read where a client expects them.
 */
function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const out = z.toJSONSchema(schema, { unrepresentable: 'any' }) as Record<string, unknown>;
  const ref = typeof out['$ref'] === 'string' ? /^#\/\$defs\/(.+)$/.exec(out['$ref']) : null;
  const defs = out['$defs'] as Record<string, Record<string, unknown>> | undefined;
  const named = ref?.[1] ? defs?.[ref[1]] : undefined;
  if (!named) return out;
  const rest = Object.fromEntries(
    Object.entries(out).filter(([k]) => k !== '$ref' && k !== '$defs'),
  );
  return { ...rest, ...named };
}

/** Stops the start when stored platform values name a key the catalogue does not declare. */
export function assertSettingKeysKnown(catalogue: SettingCatalogue, keys: readonly string[]): void {
  const unknown = keys.filter((k) => !catalogue.has(k));
  if (unknown.length > 0) {
    throw new InvalidSettingError(
      `stored setting keys not declared in code: ${unknown.join(', ')}`,
    );
  }
}
