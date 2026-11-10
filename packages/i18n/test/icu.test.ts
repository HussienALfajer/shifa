// Every message is valid ICU MessageFormat, and a broken one is reported by file and key.
import { describe, expect, it } from 'vitest';
import { checkIcu, loadSources } from '../src/index.ts';

describe('ICU syntax', () => {
  it('the shipped source parses', () => {
    expect(checkIcu(loadSources())).toEqual([]);
  });

  it('red: an unclosed argument is reported with its file and key', () => {
    const problems = checkIcu({ ar: { common: { ok: 'حسنًا', broken: 'مرحبًا {name' } } });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ file: 'ar/common.json', key: 'broken' });
  });

  it('red: a plural without `other` is reported', () => {
    const problems = checkIcu({ ar: { common: { n: '{count, plural, one {واحد}}' } } });
    expect(problems.map((p) => p.key)).toEqual(['n']);
  });

  it('red: `#` inside a plural is refused (Flutter gen-l10n needs the named argument)', () => {
    const problems = checkIcu({
      ar: { common: { n: '{count, plural, other {# عنصر}}' } },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toMatch(/#/);
  });
});
