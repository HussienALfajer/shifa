// The per-tenant entitlement cache (A-02 criterion 2): what a clinic holds is loaded once per TTL
// (≤ 60 s) and resolved per call on the injected clock, so an override that expires while cached
// stops counting at its expiry. The instance that changes a clinic clears its entry at once;
// other API instances see the change when their entry ages out. TenantCache is the shape the flags
// (A-02-03) reuse.
import type { EntitlementValue } from '@shifa/contracts';
import type { RequestScope } from '../../access/index.ts';
import type { Clock } from '../../platform/clock.ts';
import type { EntitlementCatalogue } from './catalogue.ts';
import { type EntitlementSources, resolveAll, resolveKey } from './resolve.ts';

export const ENTITLEMENT_TTL_MS = 60_000;

/** One value per tenant, kept until `ttlMs` after it was loaded or until cleared. */
export class TenantCache<T> {
  readonly #entries = new Map<string, { at: number; value: Promise<T> }>();

  constructor(
    private readonly clock: Clock,
    private readonly ttlMs: number = ENTITLEMENT_TTL_MS,
  ) {
    if (ttlMs > ENTITLEMENT_TTL_MS) throw new RangeError('the cache window is at most 60 s');
  }

  get(tenantId: string, load: () => Promise<T>): Promise<T> {
    const now = this.clock.now().getTime();
    const entry = this.#entries.get(tenantId);
    if (entry && now - entry.at < this.ttlMs) return entry.value;
    const value = load();
    this.#entries.set(tenantId, { at: now, value });
    // A failed load is not kept: the next call tries again.
    value.catch(() => {
      if (this.#entries.get(tenantId)?.value === value) this.#entries.delete(tenantId);
    });
    return value;
  }

  invalidate(tenantId: string): void {
    this.#entries.delete(tenantId);
  }
}

/** What other code asks about a clinic's entitlements (A-02-03 gates routes with it). */
export interface EntitlementsPort {
  /** One key's value for the scope's clinic; throws for a key outside the catalogue. */
  value(scope: RequestScope, key: string): Promise<EntitlementValue>;
  /** Every catalogue key's value for the scope's clinic. */
  all(scope: RequestScope): Promise<Map<string, EntitlementValue>>;
  /** Clears the clinic's entry on this instance (after a change of plan, add-on or override). */
  invalidate(tenantId: string): void;
}

/** Injection token of the EntitlementsPort. */
export const ENTITLEMENTS = Symbol('ENTITLEMENTS');

export type SourcesLoader = (scope: RequestScope) => Promise<EntitlementSources>;

export class CachedEntitlements implements EntitlementsPort {
  readonly #cache: TenantCache<EntitlementSources>;

  constructor(
    private readonly catalogue: EntitlementCatalogue,
    private readonly load: SourcesLoader,
    private readonly clock: Clock,
    ttlMs: number = ENTITLEMENT_TTL_MS,
  ) {
    this.#cache = new TenantCache(clock, ttlMs);
  }

  async value(scope: RequestScope, key: string): Promise<EntitlementValue> {
    this.catalogue.kindOf(key);
    const sources = await this.#cache.get(scope.tenantId, () => this.load(scope));
    return resolveKey(this.catalogue, key, sources, this.clock.now());
  }

  async all(scope: RequestScope): Promise<Map<string, EntitlementValue>> {
    const sources = await this.#cache.get(scope.tenantId, () => this.load(scope));
    return resolveAll(this.catalogue, sources, this.clock.now());
  }

  invalidate(tenantId: string): void {
    this.#cache.invalidate(tenantId);
  }
}
