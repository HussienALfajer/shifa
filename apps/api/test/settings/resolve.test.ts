// A-02 criteria 8 and 9 with a test catalogue: nearest scope wins across every scope (platform →
// plan → specialty pack → organization → branch → practitioner → user); a lock stops every scope
// below it; a stored value that no longer validates is skipped and the next scope used; each
// answer names its source (the default included); a write is refused outside `overridable_by`, under
// a lock, or when its value fails the key's schema.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  resolveSetting,
  type ScopedValue,
  SETTING_SCOPES,
  type SettingDefinition,
  type SettingScope,
  writeRefusal,
} from '../../src/modules/settings/index.ts';

const EVERYWHERE: SettingDefinition = {
  key: 'test.everywhere',
  description: 'test-only setting, overridable at every clinic scope',
  schema: z.int().min(0).max(1000),
  defaultValue: 0,
  overridableBy: ['organization', 'branch', 'practitioner', 'user'],
  lockable: true,
  sensitivity: 'normal',
};

const ORGANIZATION_ONLY: SettingDefinition = {
  ...EVERYWHERE,
  key: 'test.organization_only',
  overridableBy: ['organization'],
};

const v = (scope: SettingScope, value: unknown, locked = false): ScopedValue => ({
  scope,
  value,
  locked,
});

describe('precedence (criterion 8)', () => {
  it('lists the scopes nearest last', () => {
    expect(SETTING_SCOPES).toEqual([
      'platform',
      'plan',
      'specialty_pack',
      'organization',
      'branch',
      'practitioner',
      'user',
    ]);
  });

  // Each row: the scopes that hold a value (each holds its index + 1), the winner.
  const table: [SettingScope[], SettingScope | 'default'][] = [
    [[], 'default'],
    [['platform'], 'platform'],
    [['platform', 'plan'], 'plan'],
    [['platform', 'plan', 'specialty_pack'], 'specialty_pack'],
    [['platform', 'plan', 'organization'], 'organization'],
    [['plan', 'organization', 'branch'], 'branch'],
    [['organization', 'branch', 'practitioner'], 'practitioner'],
    [['platform', 'organization', 'branch', 'practitioner', 'user'], 'user'],
    [['user'], 'user'],
    [['platform', 'user'], 'user'],
  ];
  for (const [scopes, winner] of table) {
    it(`${scopes.join(' + ') || 'nothing stored'} → ${winner}`, () => {
      const values = scopes.map((s) => v(s, SETTING_SCOPES.indexOf(s) + 1));
      const resolved = resolveSetting(EVERYWHERE, values);
      expect(resolved).toEqual({
        value: winner === 'default' ? 0 : SETTING_SCOPES.indexOf(winner) + 1,
        source: winner,
        locked: false,
        lockedBy: null,
      });
    });
  }

  it('does not depend on the order the values arrive in', () => {
    const values = [v('user', 7), v('platform', 1), v('organization', 4)];
    expect(resolveSetting(EVERYWHERE, values).source).toBe('user');
    expect(resolveSetting(EVERYWHERE, [...values].reverse()).source).toBe('user');
  });

  it('ignores a clinic value at a scope the key is not overridable at', () => {
    const resolved = resolveSetting(ORGANIZATION_ONLY, [
      v('plan', 2),
      v('organization', 4),
      v('branch', 5),
      v('user', 7),
    ]);
    expect(resolved).toMatchObject({ value: 4, source: 'organization' });
  });
});

describe('locks (criterion 9)', () => {
  it('a lock at the organization stops branch, practitioner and user', () => {
    const resolved = resolveSetting(EVERYWHERE, [
      v('platform', 1),
      v('organization', 4, true),
      v('branch', 5),
      v('practitioner', 6),
      v('user', 7),
    ]);
    expect(resolved).toEqual({
      value: 4,
      source: 'organization',
      locked: true,
      lockedBy: 'organization',
    });
  });

  it('a lock at the platform stops every clinic scope', () => {
    const resolved = resolveSetting(EVERYWHERE, [
      v('platform', 1, true),
      v('plan', 2),
      v('organization', 4, true),
      v('user', 7),
    ]);
    expect(resolved).toEqual({ value: 1, source: 'platform', locked: true, lockedBy: 'platform' });
  });

  it('a super admin’s lock at the organization holds even for a key not overridable there', () => {
    const resolved = resolveSetting({ ...EVERYWHERE, overridableBy: ['user'] }, [
      v('organization', 4, true),
      v('user', 7),
    ]);
    expect(resolved).toMatchObject({ value: 4, source: 'organization', locked: true });
  });
});

describe('invalid stored values (criterion 8)', () => {
  it('skips a value that no longer validates and uses the next scope', () => {
    const resolved = resolveSetting(EVERYWHERE, [
      v('platform', 1),
      v('organization', 'not a number'),
      v('user', 5000),
    ]);
    expect(resolved).toMatchObject({ value: 1, source: 'platform' });
  });

  it('skips an invalid locked value with its lock', () => {
    const resolved = resolveSetting(EVERYWHERE, [v('organization', -1, true), v('branch', 5)]);
    expect(resolved).toEqual({ value: 5, source: 'branch', locked: false, lockedBy: null });
  });

  it('falls back to the default when nothing valid is stored', () => {
    expect(resolveSetting(EVERYWHERE, [v('plan', true)])).toMatchObject({
      value: 0,
      source: 'default',
    });
  });
});

describe('writes (criterion 8)', () => {
  it('accepts a valid value at an overridable scope without a lock', () => {
    expect(writeRefusal(EVERYWHERE, [v('platform', 1), v('organization', 4)], 'branch', 9)).toBe(
      null,
    );
    expect(writeRefusal(EVERYWHERE, [v('user', 3)], 'user', 9)).toBe(null);
  });

  it('refuses a scope outside overridable_by', () => {
    expect(writeRefusal(ORGANIZATION_ONLY, [], 'branch', 9)).toBe('scope');
    expect(writeRefusal(ORGANIZATION_ONLY, [], 'user', 9)).toBe('scope');
    expect(writeRefusal(ORGANIZATION_ONLY, [], 'platform', 9)).toBe('scope');
  });

  it('refuses a write under a lock at its scope or above', () => {
    expect(writeRefusal(EVERYWHERE, [v('organization', 4, true)], 'user', 9)).toBe('locked');
    expect(writeRefusal(EVERYWHERE, [v('organization', 4, true)], 'organization', 9)).toBe(
      'locked',
    );
    expect(writeRefusal(EVERYWHERE, [v('plan', 2, true)], 'organization', 9)).toBe('locked');
    // A lock below the scope written does not refuse it.
    expect(writeRefusal(EVERYWHERE, [v('branch', 5, true)], 'organization', 9)).toBe(null);
  });

  it('refuses a value the schema does not accept', () => {
    expect(writeRefusal(EVERYWHERE, [], 'organization', 'x')).toBe('invalid');
    expect(writeRefusal(EVERYWHERE, [], 'organization', 1001)).toBe('invalid');
  });
});
