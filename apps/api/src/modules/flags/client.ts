// The flag client (A-02 criterion 7, OD-114): an OpenFeature-shaped interface
// (`getBooleanValue(key, defaultValue, context)`) over an in-house provider that reads the two flag
// tables in the clinic's context, cached per clinic by the entitlement rule (criterion 2: at most
// 60 s on other instances, cleared at once on the instance that changed a flag). The evaluation
// context is the scope the guard checked: the provider reads only through TenantDb. As in
// OpenFeature, `defaultValue` is what a failed read answers; a key outside the catalogue throws.
import type { RequestScope } from '../../access/index.ts';
import type { Clock } from '../../platform/clock.ts';
import { ENTITLEMENT_TTL_MS, TenantCache } from '../entitlements/index.ts';
import type { FlagCatalogue } from './catalogue.ts';
import { evaluateAll, evaluateFlag, type TenantFlagRows } from './evaluate.ts';

export interface FlagClient {
  getBooleanValue(key: string, defaultValue: boolean, context: RequestScope): Promise<boolean>;
  /** Every catalogue flag for the clinic (GET /clinic/capabilities). */
  all(context: RequestScope): Promise<Record<string, boolean>>;
  /** Clears every clinic's entry on this instance (after a flag change). */
  invalidateAll(): void;
}

/** Injection token of the FlagClient. */
export const FLAGS = Symbol('FLAGS');

export type FlagRowsLoader = (scope: RequestScope) => Promise<TenantFlagRows>;

export class CachedFlags implements FlagClient {
  readonly #cache: TenantCache<TenantFlagRows>;

  constructor(
    private readonly catalogue: FlagCatalogue,
    private readonly load: FlagRowsLoader,
    clock: Clock,
    ttlMs: number = ENTITLEMENT_TTL_MS,
  ) {
    this.#cache = new TenantCache(clock, ttlMs);
  }

  async getBooleanValue(
    key: string,
    defaultValue: boolean,
    context: RequestScope,
  ): Promise<boolean> {
    this.catalogue.get(key);
    let rows: TenantFlagRows;
    try {
      rows = await this.#rows(context);
    } catch {
      return defaultValue;
    }
    return evaluateFlag(this.catalogue, key, rows);
  }

  async all(context: RequestScope): Promise<Record<string, boolean>> {
    return evaluateAll(this.catalogue, await this.#rows(context));
  }

  invalidateAll(): void {
    this.#cache.clear();
  }

  #rows(scope: RequestScope): Promise<TenantFlagRows> {
    return this.#cache.get(scope.tenantId, () => this.load(scope));
  }
}
