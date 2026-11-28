// A-03 criterion 5 (A-03-03 checkpoint 3; ADR-0052): with 50,000 synthetic charts in each of two
// clinics, search answers within 150 ms at p95 under the application role behind PgBouncer (the
// 0.3-S2 pooling harness): by name, by word starts, by phone tail, by file number, and the
// duplicate check's two shapes (A-03-04: the full name's words; the contact phone). Each timed
// call is one `withTenant()` transaction through the pooler, as a request makes it. The plans use
// the token and phone-tail indexes under RLS (OD-42: no LEAKPROOF change).
// The charts are written in bulk as the superuser (names, keys and tokens computed by the same
// TypeScript functions the chart repository uses), then analysed.
import { performance } from 'node:perf_hooks';
import {
  type DuplicateCheckRequest,
  NAME_KEY_VERSION,
  nameTokens,
  normaliseName,
  patientDisplayName,
  searchKeyOfPatientFieldValue,
} from '@shifa/contracts';
import {
  createTestTenants,
  fixtureId,
  pooledTestDb,
  superuserDb,
  workerDatabaseName,
} from '@shifa/db/testing';
import { createRandom, generatePatientCharts } from '@shifa/testing';
import { type SQL, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { duplicateQuery, findCandidates } from '../../src/modules/patients/duplicates.ts';
import { nameQuery } from '../../src/modules/patients/name-search.ts';
import { findHits, parseSearch } from '../../src/modules/patients/search.service.ts';

const CHARTS = 50_000;
const BATCH = 2_500;
const RUNS = 200;
const P95_MS = 150;
const CLINICS = [fixtureId('bench clinic a'), fixtureId('bench clinic b')] as const;
const ACTOR = fixtureId('bench actor');
const HASH = 'b'.repeat(64);

type Chart = ReturnType<typeof generatePatientCharts>[number];
const charts = new Map<string, readonly Chart[]>();
const su = () => superuserDb(workerDatabaseName());

/** Writes `list` with file numbers 1…n, its keys and tokens. */
async function seed(tenantId: string, list: readonly Chart[]): Promise<void> {
  for (let start = 0; start < list.length; start += BATCH) {
    const rows = list.slice(start, start + BATCH).map((c, i) => ({
      id: fixtureId(`bench ${tenantId} ${String(start + i)}`),
      file: start + i + 1,
      given: c.givenName,
      father: c.fatherName,
      family: c.familyName,
      phone: c.contactPhone,
      second: c.secondPhone,
      sex: c.sex,
      birth: c.birthDate,
      key: normaliseName(patientDisplayName(c)),
    }));
    await su().execute(sql`
      insert into patient (tenant_id, id, file_number, given_name, father_name, family_name,
        contact_phone, second_phone, sex, birth_date, name_key, name_key_version, create_hash,
        created_by, updated_by)
      select ${tenantId}::uuid, r.id, r.file, r.given, r.father, r.family, r.phone, r.second,
        r.sex, r.birth::date, r.key, ${NAME_KEY_VERSION}, ${HASH}, ${ACTOR}::uuid, ${ACTOR}::uuid
      from json_to_recordset(${JSON.stringify(rows)}::json) as r(id uuid, file int, given text,
        father text, family text, phone text, second text, sex text, birth text, key text)`);
    const tokens = rows.flatMap((r) =>
      nameTokens([r.given, r.father, r.family]).map((t) => ({ p: r.id, ...t })),
    );
    await su().execute(sql`
      insert into patient_name_token (tenant_id, patient_id, part, word, token, whole, key_version)
      select ${tenantId}::uuid, t.p, t.part, t.word, t.token, t.whole, ${NAME_KEY_VERSION}
      from json_to_recordset(${JSON.stringify(tokens)}::json) as t(p uuid, part int, word int,
        token text, whole boolean)`);
    const values = rows.flatMap((r) =>
      FIELDS.map((field, n) => {
        const value = field.valueOf(r.file);
        return {
          p: r.id,
          f: fieldIdOf(tenantId, n),
          v: JSON.stringify(value),
          k: searchKeyOfPatientFieldValue(field, value),
        };
      }),
    );
    await su().execute(sql`
      insert into patient_field_value (tenant_id, patient_id, field_id, value, search_key,
        updated_by)
      select ${tenantId}::uuid, v.p, v.f, v.v::jsonb, v.k, ${ACTOR}::uuid
      from json_to_recordset(${JSON.stringify(values)}::json) as v(p uuid, f uuid, v text, k text)`);
  }
}

/**
 * A-03-06: five searchable fields (the most a clinic may have), every chart holding a value of
 * each; the owner views them all.
 */
const FIELDS = [
  { type: 'text', valueOf: (file: number) => `بطاقة ${String(file)}` },
  { type: 'long_text', valueOf: (file: number) => `ملاحظة إدارية ${String(file)}` },
  { type: 'number', valueOf: (file: number) => 100_000 + file },
  {
    type: 'date',
    valueOf: (file: number) =>
      `20${String(10 + (file % 15))}-0${String(1 + (file % 9))}-1${String(file % 10)}`,
  },
  { type: 'phone', valueOf: (file: number) => `+9639${String(file).padStart(8, '0')}` },
] as const;
const ROLES = ['owner'];
const fieldIdOf = (tenantId: string, n: number) =>
  fixtureId(`bench field ${tenantId} ${String(n)}`);

async function seedFields(tenantId: string): Promise<void> {
  const rules = JSON.stringify({
    validation: { minLength: null, maxLength: null, min: null, max: null, pattern: null },
    default: null,
  });
  for (const [n, field] of FIELDS.entries()) {
    await su().execute(sql`
      insert into patient_field (tenant_id, id, number, key, label, type, rules, section,
        position, view_roles, edit_roles, searchable, created_by, updated_by)
      values (${tenantId}::uuid, ${fieldIdOf(tenantId, n)}::uuid, ${n + 1}, ${`cf_${String(n + 1)}`},
        ${`حقل ${String(n + 1)}`}, ${field.type}, ${rules}::jsonb, 'إداري', ${n},
        array['owner']::text[], array['owner']::text[], true, ${ACTOR}::uuid, ${ACTOR}::uuid)`);
  }
}

beforeAll(async () => {
  await createTestTenants(...CLINICS);
  for (const [n, tenantId] of CLINICS.entries()) {
    const list = generatePatientCharts({
      random: createRandom(2026_12_06 + n),
      count: CHARTS,
      today: '2026-11-27',
    });
    charts.set(tenantId, list);
    await seedFields(tenantId);
    await seed(tenantId, list);
  }
  await su().execute(sql`analyze patient`);
  await su().execute(sql`analyze patient_name_token`);
  await su().execute(sql`analyze patient_field_value`);
}, 900_000);

const scopeOf = (tenantId: string) => ({ tenantId, userId: ACTOR });

/** p95 of RUNS searches in each clinic; each chart's own term must find something. */
async function measure(term: (chart: Chart, file: number) => string) {
  const db = pooledTestDb();
  const random = createRandom(2026_12_07);
  const times: number[] = [];
  let found = 0;
  let foreign = 0;
  for (const tenantId of CLINICS) {
    const list = charts.get(tenantId) ?? [];
    for (let i = 0; i < RUNS; i += 1) {
      const index = random.int(0, list.length - 1);
      const chart = list[index];
      if (!chart) continue;
      const query = parseSearch({ term: term(chart, index + 1) });
      const at = performance.now();
      const { hits } = await db.withTenant(scopeOf(tenantId), (tx) => findHits(tx, query, ROLES));
      times.push(performance.now() - at);
      if (hits.length > 0) found += 1;
      // RLS: every hit is a chart of the clinic searched.
      foreign += hits.filter((h) => h.row.tenantId !== tenantId).length;
    }
  }
  times.sort((a, b) => a - b);
  const at = (q: number) => Math.round((times[Math.ceil(times.length * q) - 1] ?? 0) * 10) / 10;
  return { p50: at(0.5), p95: at(0.95), found, foreign };
}

/** A typo inside the given name: its third letter replaced (the fallback must find the chart). */
const typo = (word: string) => {
  const letters = Array.from(word);
  if (letters.length >= 3) letters[2] = letters[2] === 'ر' ? 'ز' : 'ر';
  return letters.join('');
};

describe('search at 50,000 charts in each of two clinics, behind PgBouncer (criterion 5)', () => {
  it.each([
    ['name (given and family)', (c: Chart) => `${c.givenName} ${c.familyName}`],
    ['word starts', (c: Chart) => `${c.givenName.slice(0, 2)} ${c.familyName.slice(0, 3)}`],
    ['one common start «ال»', () => 'ال'],
    ['a given name and «ال»', (c: Chart) => `${c.givenName} ال`],
    ['the first two letters alone', (c: Chart) => c.givenName.slice(0, 2)],
    ['«ال» typed 33 times', () => Array.from({ length: 33 }, () => 'ال').join(' ')],
    ['a typo in the given name', (c: Chart) => `${typo(c.givenName)} ${c.familyName}`],
    ['full name (duplicate check)', (c: Chart) => patientDisplayName(c)],
    ['contact phone (duplicate check)', (c: Chart) => c.contactPhone],
    ['phone tail', (c: Chart) => c.contactPhone.slice(-7)],
    ['file number', (_c: Chart, file: number) => String(file)],
    ['a searchable text value (A-03-06)', (_c: Chart, file: number) => `بطاقه ${String(file)}`],
    ['a searchable number value (A-03-06)', (_c: Chart, file: number) => String(100_000 + file)],
    [
      'a searchable phone value (A-03-06)',
      (_c: Chart, file: number) => `09${String(file).padStart(8, '0')}`,
    ],
  ] as const)('%s: p95 within 150 ms', async (name, term) => {
    const result = await measure(term);
    process.stdout.write(
      `search bench: ${name}: p50 ${String(result.p50)} ms, p95 ${String(result.p95)} ms, ` +
        `found ${String(result.found)} of ${String(RUNS * CLINICS.length)}\n`,
    );
    // A typo sometimes lands on the first letters every candidate is read by: most, not all.
    const least = name.startsWith('a typo') ? RUNS * CLINICS.length * 0.9 : RUNS * CLINICS.length;
    expect(result.found).toBeGreaterThanOrEqual(least);
    expect(result.foreign).toBe(0);
    expect(result.p95).toBeLessThanOrEqual(P95_MS);
  });
});

/** p95 of RUNS duplicate checks (A-03-04) in each clinic; each chart's own fields find it. */
async function measureDuplicates(input: (chart: Chart) => DuplicateCheckRequest) {
  const db = pooledTestDb();
  const random = createRandom(2026_12_08);
  const times: number[] = [];
  let found = 0;
  let foreign = 0;
  for (const tenantId of CLINICS) {
    const list = charts.get(tenantId) ?? [];
    for (let i = 0; i < RUNS; i += 1) {
      const chart = list[random.int(0, list.length - 1)];
      if (!chart) continue;
      const query = duplicateQuery(input(chart), '2026-11-27');
      const at = performance.now();
      const hits = await db.withTenant(scopeOf(tenantId), (tx) => findCandidates(tx, query));
      times.push(performance.now() - at);
      if (hits.length > 0) found += 1;
      foreign += hits.filter((h) => h.row.tenantId !== tenantId).length;
    }
  }
  times.sort((a, b) => a - b);
  const at = (q: number) => Math.round((times[Math.ceil(times.length * q) - 1] ?? 0) * 10) / 10;
  return { p50: at(0.5), p95: at(0.95), found, foreign };
}

describe('the duplicate check at 50,000 charts in each of two clinics (criteria 5, 7)', () => {
  it.each([
    [
      'same phone, similar given name',
      (c: Chart) => ({ givenName: c.givenName, contactPhone: c.contactPhone }),
    ],
    [
      'similar full name, birth year within 2',
      (c: Chart) => ({
        givenName: c.givenName,
        fatherName: c.fatherName,
        familyName: c.familyName,
        birthDate: c.birthDate,
      }),
    ],
    [
      'every field at once (the form settled)',
      (c: Chart) => ({
        givenName: c.givenName,
        fatherName: c.fatherName,
        familyName: c.familyName,
        contactPhone: c.contactPhone,
        birthDate: c.birthDate,
      }),
    ],
  ] as const)('%s: p95 within 150 ms', async (name, input) => {
    const result = await measureDuplicates(input);
    process.stdout.write(
      `duplicate bench: ${name}: p50 ${String(result.p50)} ms, p95 ${String(result.p95)} ms, ` +
        `found ${String(result.found)} of ${String(RUNS * CLINICS.length)}\n`,
    );
    expect(result.found).toBe(RUNS * CLINICS.length);
    expect(result.foreign).toBe(0);
    expect(result.p95).toBeLessThanOrEqual(P95_MS);
  });
});

describe('the plans under RLS (criterion 5; OD-42)', () => {
  const plan = (query: SQL) =>
    pooledTestDb().withTenant(scopeOf(CLINICS[0]), async (tx) => {
      const { rows } = await tx.execute(sql`explain (format json) ${query}`);
      return JSON.stringify(rows);
    });

  it('looks names up on the token index, never by a sequential scan of the tokens', async () => {
    const [first] = charts.get(CLINICS[0]) ?? [];
    const key = normaliseName(`${first?.givenName ?? ''} ${first?.familyName ?? ''}`);
    const text = await plan(nameQuery(key.split(' '), key, ['active']));
    expect(text).toContain('patient_name_token_tenant_id_token_idx');
    expect(text).not.toMatch(
      /"Node Type":"Seq Scan","Parent Relationship":"[^"]*",[^}]*"Relation Name":"patient_name_token"/,
    );
  });

  it('looks a custom field value up on its search index (A-03-06)', async () => {
    const field = fieldIdOf(CLINICS[0], 0);
    const text = await plan(
      sql`select patient_id from patient_field_value where field_id = ${field}::uuid and search_key = ${'بطاقه 7'}`,
    );
    expect(text).toContain('patient_field_value_tenant_id_search_idx');
  });

  it('looks a phone tail up on its index', async () => {
    const text = await plan(sql`select id from patient where contact_phone_tail = ${'0012345'}`);
    expect(text).toContain('patient_tenant_id_contact_phone_tail_idx');
  });
});
