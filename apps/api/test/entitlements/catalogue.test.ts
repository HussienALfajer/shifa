// A-02 criteria 2, 3: the entitlement catalogue is injected at start-up like the permission
// catalogue. Malformed or doubled keys, and keys the plans or add-ons hold that the catalogue does
// not list, stop the start; A-02 registers the three limits and no feature.
import { describe, expect, it } from 'vitest';
import {
  assertEntitlementKeysKnown,
  EntitlementCatalogue,
  PRODUCTION_ENTITLEMENTS,
  UnknownEntitlementError,
} from '../../src/modules/entitlements/index.ts';

describe('entitlement catalogue', () => {
  it('holds the three limits of A-02 and no feature', () => {
    expect(PRODUCTION_ENTITLEMENTS.map((d) => [d.key, d.kind])).toEqual([
      ['limits.practitioners', 'limit'],
      ['limits.branches', 'limit'],
      ['limits.custom_fields', 'limit'],
    ]);
  });

  it('refuses a malformed or doubled key', () => {
    expect(
      () => new EntitlementCatalogue([{ key: 'Limits', kind: 'limit', description: 'x' }]),
    ).toThrow(UnknownEntitlementError);
    expect(
      () =>
        new EntitlementCatalogue([
          { key: 'limits.a', kind: 'limit', description: 'x' },
          { key: 'limits.a', kind: 'feature', description: 'y' },
        ]),
    ).toThrow(UnknownEntitlementError);
  });

  it('stops the start when plans or add-ons hold a key it does not list', () => {
    const catalogue = new EntitlementCatalogue(PRODUCTION_ENTITLEMENTS);
    expect(() => {
      assertEntitlementKeysKnown(catalogue, ['limits.branches', 'limits.practitioners']);
    }).not.toThrow();
    expect(() => {
      assertEntitlementKeysKnown(catalogue, ['limits.branches', 'features.removed']);
    }).toThrow(/features\.removed/);
  });

  it('answers a key’s kind and refuses an unknown one', () => {
    const catalogue = new EntitlementCatalogue(PRODUCTION_ENTITLEMENTS);
    expect(catalogue.kindOf('limits.branches')).toBe('limit');
    expect(catalogue.has('limits.unknown')).toBe(false);
    expect(() => catalogue.kindOf('limits.unknown')).toThrow(UnknownEntitlementError);
  });
});
