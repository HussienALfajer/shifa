// A-03 criterion 6 (A-03-03; ADR-0034, ADR-0052): the SQL port of the name-search key, kept as a
// drift check in tests only. It is never a migration: the key is written by the application
// (TypeScript), and this port only shows that the rules can be stated in PostgreSQL 18 and give
// every key of the shared vector file, so a later SQL use (a backfill, a report) starts from a
// proven expression. Steps and order as `packages/contracts/src/name-key.ts`:
//   1 NFC  2 marks, tatweel and format characters (Cf but ZWSP, ZWNJ, ZWJ, BOM) removed  3 alef
//   forms and hamza carriers folded  4 word-final ة → ه, ى → ي  5 Arabic-Indic and Persian digits
//   6 Latin capitals of the stable Latin blocks lower-cased (translate, no collation), İ → i
//   7 whitespace collapsed and trimmed  8 particles joined (two passes)  9 NFC again.
// The two character tables (format characters, Latin capitals) are listed from Unicode here, as
// a port would list them; the vector file's exhaustive cases (format-017, latin-019) hold them.
import { readFileSync } from 'node:fs';
import { type SQL, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { ownerDb } from '../test-harness/index.ts';

interface VectorCase {
  id: string;
  input: string;
  key: string;
}

const vectors = JSON.parse(
  readFileSync(
    new URL('../../contracts/vectors/name-search-vectors.json', import.meta.url),
    'utf8',
  ),
) as { cases: VectorCase[] };

const hex8 = (cp: number) => `\\U${cp.toString(16).padStart(8, '0')}`;

/** Every code point matching `test`, as an ARE bracket body of \U escapes. */
function codePoints(test: (ch: string) => boolean): number[] {
  const out: number[] = [];
  for (let cp = 0; cp <= 0x10ffff; cp += 1) {
    if (cp >= 0xd800 && cp <= 0xdfff) continue;
    if (test(String.fromCodePoint(cp))) out.push(cp);
  }
  return out;
}

const SPACES = new Set([0x200b, 0x200c, 0x200d, 0xfeff]);
const FORMAT = codePoints((ch) => /\p{Cf}/u.test(ch)).filter((cp) => !SPACES.has(cp));
const LATIN = codePoints((ch) =>
  /(?=[\u{0041}-\u{024F}\u{1E00}-\u{1EFF}\u{FF21}-\u{FF3A}])[\p{Lu}\p{Lt}]/u.test(ch),
);
const lower = (cp: number) => (cp === 0x130 ? 'i' : String.fromCodePoint(cp).toLowerCase());

/** The SQL port: one expression over `input`. */
function nameKeySql(input: SQL): SQL {
  const removed = `[\\x064B-\\x065F\\x0670\\x06D6-\\x06ED\\x0640${FORMAT.map(hex8).join('')}]`;
  const letters =
    '[\\x0620-\\x063F\\x0641-\\x064A\\x066E\\x066F\\x0671-\\x06D3\\x06D5\\x06EE\\x06EF\\x06FA-\\x06FC\\x06FF]';
  const upper = LATIN.map((cp) => String.fromCodePoint(cp)).join('');
  const lowered = LATIN.map(lower).join('');
  const spaces =
    '[\\t\\n\\v\\f\\r \\x0085\\x00A0\\x1680\\x2000-\\x200D\\x2028\\x2029\\x202F\\x205F\\x3000\\xFEFF]+';
  const particles = '(?<=^| )(عبد|ابو|ابي|ام|ابن|بن|بنت) ';
  return sql`normalize(
    regexp_replace(regexp_replace(
      btrim(regexp_replace(
        translate(
          translate(
            regexp_replace(regexp_replace(
              translate(
                regexp_replace(normalize(${input}, NFC), ${removed}, '', 'g'),
                'أإآٱؤئ', 'ااااوي'),
              ${`\\x0629(?!${letters})`}, 'ه', 'g'),
            ${`\\x0649(?!${letters})`}, 'ي', 'g'),
          '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'),
        ${upper}, ${lowered}),
      ${spaces}, ' ', 'g'), ' '),
    ${particles}, '\\1', 'g'), ${particles}, '\\1', 'g'),
  NFC)`;
}

let keys: Map<string, string>;

beforeAll(async () => {
  // One statement for every case: the inputs with their ids as one JSON parameter.
  const cases = JSON.stringify(vectors.cases.map((c) => ({ id: c.id, input: c.input })));
  const { rows } = await ownerDb().execute<{ id: string; key: string }>(
    sql`select v.id, ${nameKeySql(sql`v.input`)} as key
        from json_to_recordset(${cases}::json) as v(id text, input text)`,
  );
  keys = new Map(rows.map((r) => [r.id, r.key]));
});

describe('the SQL port of the name-search key (drift check)', () => {
  it('lists the format characters and Latin capitals it folds', () => {
    expect(FORMAT.length).toBeGreaterThan(150);
    expect(LATIN.length).toBeGreaterThan(350);
    // Every Latin capital lower-cases to one character, so translate() can map it.
    expect(LATIN.filter((cp) => Array.from(lower(cp)).length !== 1)).toEqual([]);
  });

  it.each(vectors.cases.map((c) => [c.id, c] as const))('%s', (id, c) => {
    expect(keys.get(id)).toBe(c.key);
  });
});
