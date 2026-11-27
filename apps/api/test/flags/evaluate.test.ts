// A-02 criterion 7 (OD-114): a flag is declared in code with its default; the super admin sets it
// off for all (the kill switch, which wins), on for all or on for selected clinics. A row for a
// flag no longer in code is ignored; a flag without a row takes its code default.
import { describe, expect, it } from 'vitest';
import {
  evaluateFlag,
  FlagCatalogue,
  type FlagDefinition,
  type TenantFlagRows,
  UnknownFlagError,
} from '../../src/modules/flags/index.ts';

const FLAGS: readonly FlagDefinition[] = [
  { key: 'test.on_by_default', description: 'on unless switched', defaultValue: true },
  { key: 'test.off_by_default', description: 'off unless switched', defaultValue: false },
];
const catalogue = new FlagCatalogue(FLAGS);

const rows = (
  flags: TenantFlagRows['flags'],
  selected: readonly string[] = [],
): TenantFlagRows => ({ flags, selected });

describe('flag evaluation (criterion 7)', () => {
  it.each([
    ['no row → code default on', 'test.on_by_default', rows([]), true],
    ['no row → code default off', 'test.off_by_default', rows([]), false],
    ['on for all', 'test.off_by_default', rows([{ key: 'test.off_by_default', mode: 'on' }]), true],
    [
      'off for all (kill switch)',
      'test.on_by_default',
      rows([{ key: 'test.on_by_default', mode: 'off' }]),
      false,
    ],
    [
      'kill switch wins over the clinic being selected',
      'test.on_by_default',
      rows([{ key: 'test.on_by_default', mode: 'off' }], ['test.on_by_default']),
      false,
    ],
    [
      'selected, this clinic in',
      'test.off_by_default',
      rows([{ key: 'test.off_by_default', mode: 'selected' }], ['test.off_by_default']),
      true,
    ],
    [
      'selected, this clinic out',
      'test.on_by_default',
      rows([{ key: 'test.on_by_default', mode: 'selected' }]),
      false,
    ],
    [
      'a selection is ignored while on for all',
      'test.off_by_default',
      rows([{ key: 'test.off_by_default', mode: 'on' }], []),
      true,
    ],
  ] as const)('%s', (_name, key, state, expected) => {
    expect(evaluateFlag(catalogue, key, state)).toBe(expected);
  });

  it('a row for a flag no longer in code is ignored', () => {
    const state = rows([{ key: 'test.removed', mode: 'on' }], ['test.removed']);
    expect(evaluateFlag(catalogue, 'test.off_by_default', state)).toBe(false);
    expect(evaluateFlag(catalogue, 'test.on_by_default', state)).toBe(true);
  });

  it('a key outside the catalogue throws', () => {
    expect(() => evaluateFlag(catalogue, 'test.unknown', rows([]))).toThrow(UnknownFlagError);
  });

  it('the catalogue refuses a malformed or repeated key', () => {
    expect(
      () => new FlagCatalogue([{ key: 'Bad', description: 'x', defaultValue: false }]),
    ).toThrow(UnknownFlagError);
    expect(() => new FlagCatalogue([...FLAGS, FLAGS[0] as FlagDefinition])).toThrow(
      UnknownFlagError,
    );
  });
});
