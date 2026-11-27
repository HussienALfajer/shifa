// A-03 criteria 4, 5, 13, 18, 21 (A-03-03): what search returns and in which order, and what it
// keeps out. Contract rows `POST /patients/search` (`archivedOn`, `many`, `rate`) and the merged
// number (fixture row, as A-03-08 will write it).
// - Archived charts only with `includeArchived`, which needs `patients.archive` (403 otherwise).
// - A merged chart's file number answers the chart it was merged into, with `mergedFileNumber`;
//   merged charts never appear by name or phone.
// - At most 20 results, `truncated` when more matched; an exact file or previous number first,
//   then phones, then names.
// - The name tokens follow every edit and are written for charts saved before them (backfill).
// - Search writes no audit row; 60 searches a minute per member, then 429 `rate_limited`.
import { patient, patientNameToken } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { activeMember, type Clinic, type TeamWorld, teamWorld } from '../team/support.ts';
import { archive, codeOf, edit, found, patientAudit, registered, search } from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let owner: string;
let reception: string;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_04);
  clinic = await world.clinic();
  owner = clinic.owner.cookie;
  reception = (
    await activeMember(world, clinic, [{ role: 'receptionist', branchId: clinic.branchId }])
  ).cookie;
});

afterAll(async () => {
  await world.app.app.close();
});

const db = () => superuserDb(workerDatabaseName());
const idsOf = (r: { results: { id: string }[] }) => r.results.map((h) => h.id);

describe('archived charts (criteria 4, 13)', () => {
  it('are left out unless the owner includes them', async () => {
    const chart = await registered(world, reception, { givenName: 'سوزان', familyName: 'العطار' });
    const archived = await archive(world, owner, chart.id, chart.updatedAt);
    expect(archived.statusCode).toBe(200);
    expect(idsOf(await found(world, owner, 'سوزان العطار'))).not.toContain(chart.id);
    const included = await found(world, owner, 'سوزان العطار', { includeArchived: true });
    expect(included.results[0]).toMatchObject({ id: chart.id, state: 'archived' });
    expect(included.results[0]?.archivedAt).toEqual(expect.any(String));
    const refused = await search(world, reception, { term: 'سوزان', includeArchived: true });
    expect([refused.statusCode, codeOf(refused)]).toEqual([403, 'forbidden']);
  });
});

describe('a merged chart (criterion 4; fixture row as A-03-08 writes it)', () => {
  it('its file number leads to the kept chart; it never appears by name or phone', async () => {
    const kept = await registered(world, reception, { givenName: 'نزار', familyName: 'الصباغ' });
    const other = await registered(world, reception, { givenName: 'نزار', familyName: 'الصباغ' });
    await db()
      .update(patient)
      .set({ state: 'merged', mergedIntoId: kept.id })
      .where(eq(patient.id, other.id));
    const byNumber = await found(world, reception, String(other.fileNumber));
    expect(byNumber.results[0]).toMatchObject({
      id: kept.id,
      fileNumber: kept.fileNumber,
      state: 'active',
      matchedBy: 'file_number',
      mergedFileNumber: other.fileNumber,
    });
    expect(idsOf(await found(world, reception, 'نزار الصباغ'))).toEqual([kept.id]);
    expect(idsOf(await found(world, reception, other.contactPhone))).not.toContain(other.id);
  });
});

describe('the 20 cap and the order (criteria 4, 21)', () => {
  it('answers the 20 best and says more matched', async () => {
    for (let i = 0; i < 21; i += 1) {
      await registered(world, reception, {
        givenName: 'وعد',
        fatherName: null,
        familyName: 'المصري',
      });
    }
    const res = await found(world, reception, 'وعد المصري');
    expect(res.results).toHaveLength(20);
    expect(res.truncated).toBe(true);
    // Equal names rank by file number, oldest first.
    const numbers = res.results.map((h) => h.fileNumber);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it('puts a whole-word match before a longer word that starts with it', async () => {
    const longer = await registered(world, reception, { givenName: 'هيامة', familyName: 'الكردي' });
    const whole = await registered(world, reception, { givenName: 'هيام', familyName: 'الكردي' });
    expect(idsOf(await found(world, reception, 'هيام الكردي'))).toEqual([whole.id, longer.id]);
  });

  it('puts an exact file number first, then a phone tail', async () => {
    const byNumber = await registered(world, reception);
    // Seven digits that are both this file number (leading zeros) and another chart's phone tail.
    const term = String(byNumber.fileNumber).padStart(7, '0');
    const phoneOwner = await registered(world, reception, { contactPhone: `+96393${term}` });
    const res = await found(world, reception, term);
    expect(res.results.map((h) => [h.id, h.matchedBy])).toEqual([
      [byNumber.id, 'file_number'],
      [phoneOwner.id, 'phone_tail'],
    ]);
  });
});

describe('name tokens (criterion 5)', () => {
  it('follow an edit of the name', async () => {
    const chart = await registered(world, reception, { givenName: 'غدير', familyName: 'النحاس' });
    const res = await edit(world, reception, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      familyName: 'الدروبي',
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(idsOf(await found(world, reception, 'غدير النحاس'))).toEqual([]);
    expect(idsOf(await found(world, reception, 'غدير الدروبي'))).toEqual([chart.id]);
  });

  it('are written for a chart saved before them (backfill, key version 0)', async () => {
    const chart = await registered(world, reception, {
      givenName: 'بشرى',
      fatherName: null,
      familyName: 'الزين',
    });
    await db().delete(patientNameToken).where(eq(patientNameToken.patientId, chart.id));
    await db()
      .update(patient)
      .set({ nameKey: null, nameKeyVersion: 0 })
      .where(eq(patient.id, chart.id));
    expect(idsOf(await found(world, reception, 'بشرى الزين'))).toEqual([chart.id]);
    const [row] = await db().select().from(patient).where(eq(patient.id, chart.id));
    expect(row?.nameKeyVersion).toBe(2);
    expect(row?.nameKey).toBe('بشري الزين');
  });
});

describe('abuse and audit (criteria 18; spec "Money, abuse and privacy")', () => {
  it('writes no audit row', async () => {
    const before = (await patientAudit(clinic)).length;
    await found(world, reception, 'ريم');
    await found(world, reception, '1');
    expect((await patientAudit(clinic)).length).toBe(before);
  });

  it('answers 429 `rate_limited` after 60 searches in a minute, per member', async () => {
    clock.advanceBy(61_000);
    const assistant = (
      await activeMember(world, clinic, [{ role: 'assistant', branchId: clinic.branchId }])
    ).cookie;
    for (let i = 0; i < 60; i += 1) {
      const res = await search(world, assistant, { term: 'ريم' });
      expect(res.statusCode).toBe(200);
    }
    const limited = await search(world, assistant, { term: 'ريم' });
    expect([limited.statusCode, codeOf(limited)]).toEqual([429, 'rate_limited']);
    // Another member is not held back; the same member searches again a minute later.
    expect((await search(world, reception, { term: 'ريم' })).statusCode).toBe(200);
    clock.advanceBy(61_000);
    expect((await search(world, assistant, { term: 'ريم' })).statusCode).toBe(200);
  });
});
