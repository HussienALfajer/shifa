// A plural covers every CLDR category of its locale: Arabic needs zero one two few many other.
import { describe, expect, it } from 'vitest';
import { checkPlurals, loadSources } from '../src/index.ts';

const ALL_SIX =
  '{count, plural, zero {لا شيء} one {واحد} two {اثنان} few {{count} قليلة} many {{count} كثيرة} other {{count} شيء}}';

describe('Arabic plural categories', () => {
  it('the shipped source covers every category', () => {
    expect(checkPlurals(loadSources())).toEqual([]);
  });

  it('accepts a plural with all six categories', () => {
    expect(checkPlurals({ ar: { common: { n: ALL_SIX } } })).toEqual([]);
  });

  it('red: a plural missing `two` and `few` names both categories', () => {
    const problems = checkPlurals({
      ar: {
        common: {
          n: '{count, plural, zero {لا شيء} one {واحد} many {{count} كثيرة} other {{count} شيء}}',
        },
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ file: 'ar/common.json', key: 'n' });
    expect(problems[0]?.message).toMatch(/two/);
    expect(problems[0]?.message).toMatch(/few/);
  });

  it('red: an exact `=0` does not stand in for `zero`', () => {
    const problems = checkPlurals({
      ar: {
        common: {
          n: '{count, plural, =0 {لا شيء} one {واحد} two {اثنان} few {قليلة} many {كثيرة} other {شيء}}',
        },
      },
    });
    expect(problems[0]?.message).toMatch(/zero/);
  });

  it('red: a plural nested inside a select is checked too', () => {
    const problems = checkPlurals({
      ar: {
        common: { n: '{g, select, female {{count, plural, other {شيء}}} other {شيء}}' },
      },
    });
    expect(problems).toHaveLength(1);
  });

  it('uses the categories of each locale (Turkish: one other)', () => {
    const tr = { common: { n: '{count, plural, one {bir} other {{count} tane}}' } };
    expect(checkPlurals({ tr })).toEqual([]);
  });
});
