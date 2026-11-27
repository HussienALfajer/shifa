// Security review of A-02-03 (N1): a flag's key goes into its flag.changed audit row, whose values
// are at most 36 characters, so the catalogue refuses a longer key at start-up (a flag that could
// never be switched, not even off, would otherwise reach production).
import { describe, expect, it } from 'vitest';
import { FlagCatalogue, UnknownFlagError } from '../../src/modules/flags/index.ts';

const flag = (key: string) => ({ key, description: 'test', defaultValue: false });

describe('flag key length', () => {
  it('accepts a key of 36 characters', () => {
    const key = `test.${'a'.repeat(31)}`;
    expect(key).toHaveLength(36);
    expect(new FlagCatalogue([flag(key)]).has(key)).toBe(true);
  });

  it('refuses a key of 37 characters', () => {
    expect(() => new FlagCatalogue([flag(`test.${'a'.repeat(32)}`)])).toThrow(UnknownFlagError);
  });
});
