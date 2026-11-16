// Criterion 9: spelling variants find the intended synthetic patient in the top 5 inside
// withTenant() as shifa_app, on both key strategies; tenants never see each other's patients.
// Writes per-rule hit rates and false matches (counts only, no names) to .verify/s3/.
import { testDb } from '@shifa/db/testing';
import { createRandom } from '@shifa/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { normaliseName } from '../src/normalise.ts';
import { writeReport } from '../src/report.ts';
import { SEARCH_TABLES, type SearchHit, searchPatients } from '../src/search.ts';
import type { SeedPatient } from '../src/seed.ts';
import { PROBE_VARIANTS, RULE_VARIANTS, type Variant } from '../src/variants.ts';
import { seedLoad } from './db.ts';

const SAMPLE_PER_RULE = 25;
const USER_ID = '00000000-0000-4000-8000-000000000001';

let patients: SeedPatient[] = [];
let keyCount = new Map<string, number>();

beforeAll(async () => {
  patients = await seedLoad();
  keyCount = new Map();
  for (const p of patients) {
    const k = `${p.tenantId}|${normaliseName(p.displayName)}`;
    keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
  }
}, 300_000);

interface Outcome {
  table: string;
  variant: string;
  tried: number;
  hits: number;
  /** Intended patient missed because ≥ 5 patients of the tenant share its key. */
  ambiguous: number;
  /** Other patients ranked above the intended one (sum over all tries). */
  rankedAbove: number;
}

async function run(table: (typeof SEARCH_TABLES)[number], variant: Variant): Promise<Outcome> {
  const random = createRandom(9_009).fork(variant.id);
  const outcome: Outcome = {
    table,
    variant: variant.id,
    tried: 0,
    hits: 0,
    ambiguous: 0,
    rankedAbove: 0,
  };
  const shuffled = random.fork('sample').shuffle(patients);
  for (const patient of shuffled) {
    if (outcome.tried >= SAMPLE_PER_RULE) break;
    const typed = variant.apply(patient.displayName, random.fork(patient.id));
    if (typed === undefined) continue;
    outcome.tried += 1;
    const hits: SearchHit[] = await testDb().withTenant(
      { tenantId: patient.tenantId, userId: USER_ID },
      (tx) => searchPatients(tx, table, normaliseName(typed)),
    );
    const rank = hits.findIndex((h) => h.id === patient.id);
    if (rank >= 0) {
      outcome.hits += 1;
      outcome.rankedAbove += rank;
    } else if (
      (keyCount.get(`${patient.tenantId}|${normaliseName(patient.displayName)}`) ?? 0) >= 5
    ) {
      outcome.ambiguous += 1;
    } else {
      outcome.rankedAbove += hits.length;
    }
  }
  return outcome;
}

const outcomes: Outcome[] = [];

describe.each(SEARCH_TABLES)('search on s3.%s', (table) => {
  it.each(RULE_VARIANTS.map((v) => [v.id, v] as const))(
    'finds the intended patient in the top 5 for rule variant %s',
    async (_id, variant) => {
      const outcome = await run(table, variant);
      outcomes.push(outcome);
      expect(outcome.tried).toBeGreaterThanOrEqual(5);
      expect(outcome.hits + outcome.ambiguous).toBe(outcome.tried);
    },
    120_000,
  );

  it('records variants outside the rules (report only)', async () => {
    for (const variant of PROBE_VARIANTS) outcomes.push(await run(table, variant));
  }, 300_000);

  it("never returns another tenant's patient", async () => {
    const [a, b] = [patients[0], patients.find((p) => p.tenantId !== patients[0]?.tenantId)];
    if (a === undefined || b === undefined) throw new Error('seed needs two tenants');
    const hits = await testDb().withTenant({ tenantId: a.tenantId, userId: USER_ID }, (tx) =>
      searchPatients(tx, table, normaliseName(b.displayName)),
    );
    expect(hits.every((h) => h.tenantId === a.tenantId)).toBe(true);
    expect(hits.map((h) => h.id)).not.toContain(b.id);
  });
});

describe('report', () => {
  it('writes .verify/s3/search-quality.json without names or search terms', async () => {
    const path = await writeReport('search-quality.json', {
      sample_per_rule: SAMPLE_PER_RULE,
      patients: patients.length,
      outcomes,
    });
    expect(path).toMatch(/search-quality\.json$/);
    expect(JSON.stringify(outcomes)).not.toMatch(/[؀-ۿ]/);
  });
});
