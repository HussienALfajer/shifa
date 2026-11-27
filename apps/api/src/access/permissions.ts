// The permission catalogue (PLT-46, A-01b criteria 6, 7; OD-78): every key the API knows, with
// a sensitive flag. Only sensitive keys can be switched per member. The catalogue is injected at
// start-up (PERMISSION_CATALOGUE); routes and role grants naming any other key stop the start.
// Each later spec adds its keys here. Tests extend it with their own keys (test/access/probe.ts).

export interface PermissionDefinition {
  readonly key: string;
  /** Switchable per member (on or off against the role default). */
  readonly sensitive: boolean;
}

export const PRODUCTION_PERMISSIONS = [
  { key: 'members.view', sensitive: false },
  { key: 'members.manage', sensitive: false },
  { key: 'branches.manage', sensitive: false },
  { key: 'clinic.settings.manage', sensitive: false },
  { key: 'clinical.notes.view', sensitive: true },
  // A-02-03: what the active clinic may use (GET /clinic/capabilities), every member
  { key: 'clinic.capabilities.view', sensitive: false },
  // A-02-05 (PLT-46): reserved for support write elevation; granted to nobody in Release 1, and
  // not sensitive, so no member toggle can switch it on.
  { key: 'support.elevate', sensitive: false },
  // A-03-02 (spec A-03 Permissions): charts. View: every clinic role (a support session reads);
  // manage: register, edit, family, treating doctors; archive, merge, field definitions and the
  // read log: the owner. The routes of the last four come with later A-03 slices.
  { key: 'patients.view', sensitive: false },
  { key: 'patients.manage', sensitive: false },
  { key: 'patients.archive', sensitive: false },
  { key: 'patients.merge', sensitive: false },
  { key: 'patients.fields.manage', sensitive: false },
  { key: 'patients.read_log.view', sensitive: false },
] as const satisfies readonly PermissionDefinition[];

export type PermissionKey = (typeof PRODUCTION_PERMISSIONS)[number]['key'];

/** Injection token of the PermissionCatalogue the guard and the start-up check use. */
export const PERMISSION_CATALOGUE = Symbol('PERMISSION_CATALOGUE');

const KEY = /^[a-z][a-z_]*(\.[a-z][a-z_]*)+$/;

export class UnknownPermissionError extends Error {
  override name = 'UnknownPermissionError';
}

export class PermissionCatalogue {
  readonly #sensitive = new Map<string, boolean>();

  constructor(definitions: readonly PermissionDefinition[]) {
    for (const { key, sensitive } of definitions) {
      if (!KEY.test(key)) throw new UnknownPermissionError(`malformed permission key: ${key}`);
      if (this.#sensitive.has(key)) {
        throw new UnknownPermissionError(`permission key listed twice: ${key}`);
      }
      this.#sensitive.set(key, sensitive);
    }
  }

  has(key: string): key is PermissionKey {
    return this.#sensitive.has(key);
  }

  /** True only for a known key marked sensitive. */
  isSensitive(key: string): boolean {
    return this.#sensitive.get(key) === true;
  }

  keys(): string[] {
    return [...this.#sensitive.keys()];
  }

  sensitiveKeys(): PermissionKey[] {
    return this.keys().filter((key) => this.isSensitive(key)) as PermissionKey[];
  }
}

/** Throws UnknownPermissionError when a role grants a key the catalogue does not list. */
export function assertGrantsKnown(
  catalogue: PermissionCatalogue,
  grants: Readonly<Record<string, readonly string[]>>,
): void {
  const unknown = Object.entries(grants).flatMap(([role, keys]) =>
    keys.filter((key) => !catalogue.has(key)).map((key) => `${role}: ${key}`),
  );
  if (unknown.length > 0) {
    throw new UnknownPermissionError(`grants name unknown keys:\n  ${unknown.join('\n  ')}`);
  }
}
