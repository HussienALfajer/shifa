// A-02 criteria 2 and 7: flags follow the entitlement cache rule. A change is in force at once on
// the instance that made it (it clears its cache) and on every other instance within 60 s, on a
// fake clock. The client is OpenFeature-shaped: getBooleanValue(key, default, context).
import { FixedClock } from '@shifa/testing';
import { describe, expect, it } from 'vitest';
import type { RequestScope } from '../../src/access/index.ts';
import {
  CachedFlags,
  FlagCatalogue,
  type TenantFlagRows,
  UnknownFlagError,
} from '../../src/modules/flags/index.ts';

const TENANT_A = '00000000-0000-4000-8000-00000000000a';
const TENANT_B = '00000000-0000-4000-8000-00000000000b';
const scope = (tenantId: string) =>
  ({ tenantId, branchId: null, userId: '00000000-0000-4000-8000-000000000001' }) as RequestScope;
const KEY = 'test.new_queue';

function world() {
  const clock = new FixedClock('2026-12-01T10:00:00.000Z');
  const catalogue = new FlagCatalogue([{ key: KEY, description: 'test', defaultValue: false }]);
  let stored: { mode: 'off' | 'on' | 'selected'; tenants: string[] } | null = null;
  let loads = 0;
  let failing = false;
  const load = (s: RequestScope): Promise<TenantFlagRows> => {
    loads += 1;
    if (failing) return Promise.reject(new Error('database down'));
    return Promise.resolve({
      flags: stored ? [{ key: KEY, mode: stored.mode }] : [],
      selected: stored?.tenants.includes(s.tenantId) ? [KEY] : [],
    });
  };
  const instance = () => new CachedFlags(catalogue, load, clock);
  return {
    clock,
    instance,
    set: (mode: 'off' | 'on' | 'selected', tenants: string[] = []) => {
      stored = { mode, tenants };
    },
    fail: () => {
      failing = true;
    },
    loads: () => loads,
  };
}

describe('flag cache (criteria 2, 7)', () => {
  it('a change is seen at once on the instance that wrote, and within 60 s on another', async () => {
    const w = world();
    const a = w.instance();
    const b = w.instance();
    expect(await a.getBooleanValue(KEY, true, scope(TENANT_A))).toBe(false);
    expect(await b.getBooleanValue(KEY, true, scope(TENANT_A))).toBe(false);

    w.set('selected', [TENANT_A]);
    a.invalidateAll();
    expect(await a.getBooleanValue(KEY, false, scope(TENANT_A))).toBe(true);
    expect(await a.getBooleanValue(KEY, false, scope(TENANT_B))).toBe(false);

    w.clock.advanceBy(59_999);
    expect(await b.getBooleanValue(KEY, false, scope(TENANT_A))).toBe(false);
    w.clock.advanceBy(1);
    expect(await b.getBooleanValue(KEY, false, scope(TENANT_A))).toBe(true);
  });

  it('loads once per tenant per window', async () => {
    const w = world();
    const a = w.instance();
    await a.getBooleanValue(KEY, false, scope(TENANT_A));
    await a.all(scope(TENANT_A));
    await a.getBooleanValue(KEY, false, scope(TENANT_B));
    expect(w.loads()).toBe(2);
  });

  it('every flag of the catalogue, evaluated for the clinic', async () => {
    const w = world();
    w.set('on');
    expect(await w.instance().all(scope(TENANT_A))).toEqual({ [KEY]: true });
  });

  it('a failed load answers the caller’s default and is not kept', async () => {
    const w = world();
    const a = w.instance();
    w.fail();
    expect(await a.getBooleanValue(KEY, false, scope(TENANT_A))).toBe(false);
    expect(await a.getBooleanValue(KEY, true, scope(TENANT_A))).toBe(true);
    expect(w.loads()).toBe(2);
  });

  it('a key outside the catalogue throws, whatever the default', async () => {
    const a = world().instance();
    await expect(a.getBooleanValue('test.unknown', true, scope(TENANT_A))).rejects.toThrow(
      UnknownFlagError,
    );
  });
});
