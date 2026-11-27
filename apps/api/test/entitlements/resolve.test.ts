// A-02 criterion 2 (PLT-21): resolution per key, table-driven. Unexpired tenant override →
// highest replacing add-on → plan value plus incremental add-ons → deny. An override stops
// counting at the instant of its expiry. A key outside the catalogue is refused at the call.
import { describe, expect, it } from 'vitest';
import {
  EntitlementCatalogue,
  type EntitlementSources,
  resolveKey,
  UnknownEntitlementError,
} from '../../src/modules/entitlements/index.ts';

const catalogue = new EntitlementCatalogue([
  { key: 'limits.practitioners', kind: 'limit', description: 'doctors' },
  { key: 'limits.branches', kind: 'limit', description: 'branches' },
  { key: 'features.sms', kind: 'feature', description: 'test feature' },
]);

const NOW = new Date('2026-12-01T10:00:00.000Z');
const LATER = new Date('2026-12-01T10:00:00.001Z');

const none: EntitlementSources = { planValues: {}, addons: [], overrides: [] };

const rows: [label: string, key: string, sources: EntitlementSources, expected: unknown][] = [
  [
    'plan only',
    'limits.practitioners',
    { ...none, planValues: { 'limits.practitioners': 10 } },
    10,
  ],
  [
    'increment add-ons are summed onto the plan',
    'limits.practitioners',
    {
      ...none,
      planValues: { 'limits.practitioners': 10 },
      addons: [
        { key: 'limits.practitioners', mode: 'increment', value: 2 },
        { key: 'limits.practitioners', mode: 'increment', value: 3 },
        { key: 'limits.branches', mode: 'increment', value: 7 },
      ],
    },
    15,
  ],
  [
    'the highest replacing add-on wins over plan and increments',
    'limits.practitioners',
    {
      ...none,
      planValues: { 'limits.practitioners': 10 },
      addons: [
        { key: 'limits.practitioners', mode: 'replace', value: 12 },
        { key: 'limits.practitioners', mode: 'replace', value: 25 },
        { key: 'limits.practitioners', mode: 'increment', value: 100 },
      ],
    },
    25,
  ],
  [
    'an override beats every other source',
    'limits.practitioners',
    {
      planValues: { 'limits.practitioners': 10 },
      addons: [{ key: 'limits.practitioners', mode: 'replace', value: 25 }],
      overrides: [{ key: 'limits.practitioners', value: 3, expiresAt: null }],
    },
    3,
  ],
  [
    'an override that expires later still counts',
    'limits.practitioners',
    {
      ...none,
      planValues: { 'limits.practitioners': 10 },
      overrides: [{ key: 'limits.practitioners', value: 15, expiresAt: LATER }],
    },
    15,
  ],
  [
    'an override is ignored at the instant of its expiry',
    'limits.practitioners',
    {
      ...none,
      planValues: { 'limits.practitioners': 10 },
      overrides: [{ key: 'limits.practitioners', value: 15, expiresAt: NOW }],
    },
    10,
  ],
  ['a limit with no source is denied (0)', 'limits.branches', none, 0],
  ['a feature with no source is denied (off)', 'features.sms', none, false],
  [
    'a feature override turns it on',
    'features.sms',
    { ...none, overrides: [{ key: 'features.sms', value: true, expiresAt: null }] },
    true,
  ],
  [
    'a replacing add-on turns a feature on',
    'features.sms',
    {
      ...none,
      planValues: { 'features.sms': false },
      addons: [{ key: 'features.sms', mode: 'replace', value: true }],
    },
    true,
  ],
  [
    'an override of another key does not count',
    'limits.branches',
    {
      ...none,
      planValues: { 'limits.branches': 1 },
      overrides: [{ key: 'limits.practitioners', value: 99, expiresAt: null }],
    },
    1,
  ],
];

describe('entitlement resolution (PLT-21)', () => {
  for (const [label, key, sources, expected] of rows) {
    it(label, () => {
      expect(resolveKey(catalogue, key, sources, NOW)).toBe(expected);
    });
  }

  it('refuses a key outside the catalogue at the call', () => {
    expect(() => resolveKey(catalogue, 'limits.unknown', none, NOW)).toThrow(
      UnknownEntitlementError,
    );
  });

  it('refuses sources naming a key outside the catalogue', () => {
    const stray = { ...none, planValues: { 'limits.unknown': 5 } };
    expect(() => resolveKey(catalogue, 'limits.branches', stray, NOW)).toThrow(
      UnknownEntitlementError,
    );
  });
});
