// A-03 criterion 5 (A-03-03 checkpoint 3; ADR-0052): with 50,000 synthetic charts in each of two
// clinics, search answers within 150 ms at p95 under the application role behind PgBouncer (the
// 0.3-S2 pooling harness): by name, by word starts, by phone tail, by file number, and the
// duplicate check's two shapes (A-03-04: the full name's words; the contact phone). Each timed
// call is one `withTenant()` transaction through the pooler, as a request makes it. The plans use
// the token and phone-tail indexes under RLS (OD-42: no LEAKPROOF change).
// The charts are written in bulk as the superuser (names, keys and tokens computed by the same
// TypeScript functions the chart repository uses), then analysed.
import { performance } from 'node:perf_hooks';
import { NAME_KEY_VERSION, nameTokens, normaliseName, patientDisplayName } from '@shifa/contracts';
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
import { nameQuery } from '../../src/modules/patients/search.ts';
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
    await seed(tenantId, list);
  }
  await su().execute(sql`analyze patient`);
  await su().execute(sql`analyze patient_name_token`);
}, 900_000);

const scopeOf = (tenantId: string) => ({ tenantId, userId: ACTOR });

/** p95 of RUNS searches in each clinic; each chart's own term must find something. */
async function measure(term: (chart: Chart, file: number) => string) {
  const db = pooledTestDb();
  const random = createRandom(2026_12_07);
  const times: number[] = [];
  let found = 0;
  for (const tenantId of CLINICS) {
    const list = charts.get(tenantId) ?? [];
    for (let i = 0; i < RUNS; i += 1) {
      const index = random.int(0, list.length - 1);
      const chart = list[index];
      if (!chart) continue;
      const query = parseSearch({ term: term(chart, index + 1) });
      const at = performance.now();
      const hits = await db.withTenant(scopeOf(tenantId), (tx) => findHits(tx, query));
      times.push(performance.now() - at);
      if (hits.length > 0) found += 1;
    }
  }
  times.sort((a, b) => a - b);
  const at = (q: number) => Math.round((times[Math.ceil(times.length * q) - 1] ?? 0) * 10) / 10;
  return { p50: at(0.5), p95: at(0.95), found };
}

describe('search at 50,000 charts in each of two clinics, behind PgBouncer (criterion 5)', () => {
  it.each([
    ['name (given and family)', (c: Chart) => `${c.givenName} ${c.familyName}`],
    ['word starts', (c: Chart) => `${c.givenName.slice(0, 2)} ${c.familyName.slice(0, 3)}`],
    ['full name (duplicate check)', (c: Chart) => patientDisplayName(c)],
    ['contact phone (duplicate check)', (c: Chart) => c.contactPhone],
    ['phone tail', (c: Chart) => c.contactPhone.slice(-7)],
    ['file number', (_c: Chart, file: number) => String(file)],
  ] as const)('%s: p95 within 150 ms', async (name, term) => {
    const result = await measure(term);
    process.stdout.write(
      `search bench: ${name}: p50 ${String(result.p50)} ms, p95 ${String(result.p95)} ms\n`,
    );
    expect(result.found).toBe(RUNS * CLINICS.length);
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

  it('looks a phone tail up on its index', async () => {
    const text = await plan(sql`select id from patient where contact_phone_tail = ${'0012345'}`);
    expect(text).toContain('patient_tenant_id_contact_phone_tail_idx');
  });
});
