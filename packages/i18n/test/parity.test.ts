// Locales agree on namespaces, keys and placeholders. Arabic is the only locale today; a
// fixture second locale exercises the check (Turkish arrives after Release 1, OD-16).
import { describe, expect, it } from 'vitest';
import { checkParity, loadSources, type Sources } from '../src/index.ts';

const ar = {
  common: {
    greeting: 'مرحبًا {name}',
    items:
      '{count, plural, zero {لا} one {واحد} two {اثنان} few {{count}} many {{count}} other {{count}}}',
  },
};

function withTr(tr: Sources[string]): Sources {
  return { ar, tr };
}

describe('locale parity', () => {
  it('the shipped source is consistent', () => {
    expect(checkParity(loadSources())).toEqual([]);
  });

  it('accepts a second locale with the same keys and placeholders', () => {
    const tr = {
      common: {
        greeting: 'Merhaba {name}',
        items: '{count, plural, one {bir} other {{count} tane}}',
      },
    };
    expect(checkParity(withTr(tr))).toEqual([]);
  });

  it('red: a key missing from the second locale is reported against that locale', () => {
    const problems = checkParity(withTr({ common: { greeting: 'Merhaba {name}' } }));
    expect(problems).toEqual([expect.objectContaining({ file: 'tr/common.json', key: 'items' })]);
  });

  it('red: an extra key in the second locale is reported', () => {
    const tr = { common: { ...ar.common, extra: 'fazla' } };
    const problems = checkParity(withTr(tr));
    expect(problems).toEqual([expect.objectContaining({ file: 'tr/common.json', key: 'extra' })]);
  });

  it('red: a missing namespace is reported', () => {
    const problems = checkParity({ ar, tr: {} });
    expect(problems.map((p) => p.file)).toContain('tr/common.json');
  });

  it('red: different placeholders are reported with both sets', () => {
    const tr = { common: { greeting: 'Merhaba {user}', items: ar.common.items } };
    const problems = checkParity(withTr(tr));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ file: 'tr/common.json', key: 'greeting' });
    expect(problems[0]?.message).toMatch(/name/);
    expect(problems[0]?.message).toMatch(/user/);
  });
});
