// Every ErrorCode has an Arabic message under `errors`, and no `errors.*` key lacks a code.
import { ErrorCode } from '@shifa/contracts';
import { describe, expect, it } from 'vitest';
import { checkErrorCodes, loadSources } from '../src/index.ts';

describe('error-code messages', () => {
  it('the shipped source has exactly one message per ErrorCode', () => {
    expect(checkErrorCodes(loadSources(), ErrorCode.options)).toEqual([]);
  });

  it('red: a code without a message is reported', () => {
    const problems = checkErrorCodes({ ar: { errors: { not_found: 'غير موجود' } } }, [
      'not_found',
      'forbidden',
    ]);
    expect(problems).toEqual([
      expect.objectContaining({ file: 'ar/errors.json', key: 'forbidden' }),
    ]);
  });

  it('red: an orphan errors key is reported', () => {
    const problems = checkErrorCodes(
      { ar: { errors: { not_found: 'غير موجود', gone_away: 'ذهب' } } },
      ['not_found'],
    );
    expect(problems).toEqual([
      expect.objectContaining({ file: 'ar/errors.json', key: 'gone_away' }),
    ]);
  });

  it('red: a missing errors namespace reports every code', () => {
    const problems = checkErrorCodes({ ar: { common: {} } }, ['a', 'b']);
    expect(problems.map((p) => p.key)).toEqual(['a', 'b']);
  });
});
