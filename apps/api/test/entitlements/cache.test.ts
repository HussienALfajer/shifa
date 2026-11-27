// A-02 criterion 2: entitlements are cached per tenant. A change is in force at once on the
// instance that made it (it clears its cache) and on every other instance within 60 s (TTL), on
// a fake clock.

import { FixedClock } from '@shifa/testing';
import { describe, expect, it } from 'vitest';
import type { RequestScope } from '../../src/access/index.ts';
import {
  CachedEntitlements,
  EntitlementCatalogue,
  type EntitlementSources,
  PRODUCTION_ENTITLEMENTS,
} from '../../src/modules/entitlements/index.ts';

const TENANT_A = '00000000-0000-4000-8000-00000000000a';
const TENANT_B = '00000000-0000-4000-8000-00000000000b';
const scope = (tenantId: string) =>
  ({ tenantId, branchId: null, userId: '00000000-0000-4000-8000-000000000001' }) as RequestScope;

/** One shared database behind two API instances. */
function world() {
  const clock = new FixedClock('2026-12-01T10:00:00.000Z');
  const catalogue = new EntitlementCatalogue(PRODUCTION_ENTITLEMENTS);
  const stored = new Map<string, EntitlementSources>();
  let loads = 0;
  const load = (s: RequestScope) => {
    loads += 1;
    return Promise.resolve(
      stored.get(s.tenantId) ?? {
        planValues: { 'limits.practitioners': 10 },
        addons: [],
        overrides: [],
      },
    );
  };
  const instance = () => new CachedEntitlements(catalogue, load, clock);
  const setOverride = (tenantId: string, value: number) =>
    stored.set(tenantId, {
      planValues: { 'limits.practitioners': 10 },
      addons: [],
      overrides: [{ key: 'limits.practitioners', value, expiresAt: null }],
    });
  return { clock, instance, setOverride, loads: () => loads };
}

describe('entitlement cache', () => {
  it('a change is seen at once on the instance that wrote, and within 60 s on another', async () => {
    const w = world();
    const a = w.instance();
    const b = w.instance();
    expect(await a.value(scope(TENANT_A), 'limits.practitioners')).toBe(10);
    expect(await b.value(scope(TENANT_A), 'limits.practitioners')).toBe(10);

    w.setOverride(TENANT_A, 15);
    a.invalidate(TENANT_A);
    expect(await a.value(scope(TENANT_A), 'limits.practitioners')).toBe(15);

    w.clock.advanceBy(59_999);
    expect(await b.value(scope(TENANT_A), 'limits.practitioners')).toBe(10);
    w.clock.advanceBy(1);
    expect(await b.value(scope(TENANT_A), 'limits.practitioners')).toBe(15);
  });

  it('caches per tenant: one tenant’s change and clearing leave the other cached', async () => {
    const w = world();
    const a = w.instance();
    await a.value(scope(TENANT_A), 'limits.practitioners');
    await a.value(scope(TENANT_B), 'limits.practitioners');
    expect(w.loads()).toBe(2);
    await a.value(scope(TENANT_B), 'limits.branches');
    expect(w.loads()).toBe(2);
    a.invalidate(TENANT_A);
    await a.value(scope(TENANT_B), 'limits.practitioners');
    await a.value(scope(TENANT_A), 'limits.practitioners');
    expect(w.loads()).toBe(3);
  });

  it('an override expiring while cached stops counting at its expiry', async () => {
    const w = world();
    const expiry = new Date('2026-12-01T10:00:30.000Z');
    const load = () =>
      Promise.resolve({
        planValues: { 'limits.practitioners': 10 },
        addons: [],
        overrides: [{ key: 'limits.practitioners', value: 15, expiresAt: expiry }],
      });
    const cached = new CachedEntitlements(
      new EntitlementCatalogue(PRODUCTION_ENTITLEMENTS),
      load,
      w.clock,
    );
    expect(await cached.value(scope(TENANT_A), 'limits.practitioners')).toBe(15);
    w.clock.set(expiry);
    expect(await cached.value(scope(TENANT_A), 'limits.practitioners')).toBe(10);
  });
});
