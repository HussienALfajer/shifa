// A-02 criteria 8 and 10: setting definitions live in code (key, JSON Schema from zod, default,
// overridable scopes, lockable, sensitivity), checked at start-up: a malformed or doubled key, an
// unknown scope, a default the schema refuses, and a stored platform key the code does not declare
// stop the start. The first key is the idle sign-out, `session.idle_minutes`.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  assertSettingKeysKnown,
  IDLE_MINUTES_KEY,
  InvalidSettingError,
  PRODUCTION_SETTINGS,
  SettingCatalogue,
  type SettingDefinition,
} from '../../src/modules/settings/index.ts';

const base: SettingDefinition = {
  key: 'test.base',
  description: 'test-only',
  schema: z.int().min(1),
  defaultValue: 1,
  overridableBy: ['organization'],
  lockable: false,
  sensitivity: 'normal',
};

describe('setting catalogue', () => {
  it('declares session.idle_minutes (organization; 15, 30, 60; default 30; lockable)', () => {
    expect(IDLE_MINUTES_KEY).toBe('session.idle_minutes');
    const catalogue = new SettingCatalogue(PRODUCTION_SETTINGS);
    expect(catalogue.definitions().map((d) => d.key)).toEqual(['session.idle_minutes']);
    const idle = catalogue.get('session.idle_minutes');
    expect(idle).toMatchObject({
      defaultValue: 30,
      overridableBy: ['organization'],
      lockable: true,
      sensitivity: 'normal',
    });
    expect(catalogue.choices('session.idle_minutes')).toEqual([15, 30, 60]);
    expect(catalogue.jsonSchema('session.idle_minutes')).toMatchObject({ enum: [15, 30, 60] });
  });

  it('has no choices for a key that is not an enum', () => {
    expect(new SettingCatalogue([base]).choices('test.base')).toBeNull();
  });

  it('refuses a malformed or doubled key, an unknown scope and an invalid default', () => {
    expect(() => new SettingCatalogue([{ ...base, key: 'Bad' }])).toThrow(InvalidSettingError);
    expect(() => new SettingCatalogue([{ ...base, key: `test.${'a'.repeat(40)}` }])).toThrow(
      InvalidSettingError,
    );
    expect(() => new SettingCatalogue([base, base])).toThrow(InvalidSettingError);
    expect(
      () => new SettingCatalogue([{ ...base, overridableBy: ['clinic' as 'organization'] }]),
    ).toThrow(InvalidSettingError);
    expect(() => new SettingCatalogue([{ ...base, defaultValue: 0 }])).toThrow(InvalidSettingError);
  });

  it('stops the start when a stored platform value names a key not declared in code', () => {
    const catalogue = new SettingCatalogue(PRODUCTION_SETTINGS);
    expect(() => {
      assertSettingKeysKnown(catalogue, ['session.idle_minutes']);
    }).not.toThrow();
    expect(() => {
      assertSettingKeysKnown(catalogue, ['session.removed']);
    }).toThrow(/session\.removed/);
  });

  it('answers whether a key is known and refuses an unknown one', () => {
    const catalogue = new SettingCatalogue(PRODUCTION_SETTINGS);
    expect(catalogue.has('session.idle_minutes')).toBe(true);
    expect(catalogue.has('session.unknown')).toBe(false);
    expect(() => catalogue.get('session.unknown')).toThrow(InvalidSettingError);
  });
});
