// A-03 criteria 4, 21, 24 (A-03-03): one search box finds a clinic's active charts by name
// however it was spelled, by phone, by file number and by previous file number. Contract row
// `POST /patients/search` (results, `matchedBy`, `matchedParts`, term lengths, `none`).
// - Name: the shared vectors' typed variants find the chart (`name_variant`), any part order
//   (`name_order`), a word's start («ري» finds «ريم»), each typed word must match; the parts that
//   matched are named by index (0 given, 1 father, 2 family).
// - Phone: any accepted spelling of the contact or second phone (`phone`), or its last 7 or more
//   digits (`phone_tail`), Arabic-Indic digits included.
// - File number from the first digit (`file_number`); previous number exactly, trimmed
//   (`previous_file_number`).
// - A name needs 2 letters and a phone tail 7 digits: 400 `validation_failed` on `body.term`.
import { PatientSearchResults } from '@shifa/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { activeMember, type Clinic, type TeamWorld, teamWorld } from '../team/support.ts';
import { type ChartBody, codeOf, found, registered, search } from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let reception: string;
let reem: ChartBody;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_03);
  clinic = await world.clinic();
  reception = (
    await activeMember(world, clinic, [{ role: 'receptionist', branchId: clinic.branchId }])
  ).cookie;
  reem = await registered(world, reception, {
    givenName: 'ريم',
    fatherName: 'أحمد',
    familyName: 'الحلبي',
    previousFileNumber: 'HL-2207',
  });
});

afterAll(async () => {
  await world.app.app.close();
});

const idsOf = (r: { results: { id: string }[] }) => r.results.map((h) => h.id);

describe('by name (criteria 4, 24)', () => {
  it('finds the chart from a variant spelling and names the matched parts', async () => {
    const res = await search(world, reception, { term: 'ريم احمد' });
    expect(res.statusCode, res.body).toBe(200);
    const body = PatientSearchResults.parse(res.json());
    expect(body.truncated).toBe(false);
    expect(body.results[0]).toMatchObject({
      id: reem.id,
      displayName: 'ريم أحمد الحلبي',
      fileNumber: reem.fileNumber,
      sex: reem.sex,
      birthDate: reem.birthDate,
      birthDateEstimated: false,
      contactPhone: reem.contactPhone,
      state: 'active',
      archivedAt: null,
      matchedBy: 'name_variant',
      matchedParts: [0, 1],
      mergedFileNumber: null,
    });
  });

  it('says `name` when typed as stored, and finds a word from its start', async () => {
    const exact = await found(world, reception, 'ريم أحمد');
    expect(exact.results[0]).toMatchObject({
      id: reem.id,
      matchedBy: 'name',
      matchedParts: [0, 1],
    });
    const start = await found(world, reception, 'ري الحل');
    expect(start.results[0]).toMatchObject({ id: reem.id, matchedParts: [0, 2] });
  });

  it('finds the parts in any order (`name_order`)', async () => {
    const res = await found(world, reception, 'الحلبي ريم');
    expect(res.results[0]).toMatchObject({
      id: reem.id,
      matchedBy: 'name_order',
      matchedParts: [0, 2],
    });
  });

  it('needs every typed word to match', async () => {
    expect(idsOf(await found(world, reception, 'ريم الشامي'))).toEqual([]);
  });

  it.each([
    ['full-name-001', 'فاطِمة', 'عبد الله', 'الحلبي', 'فاطمه عبدالله الحلبي'],
    ['full-name-003', 'أحمد', 'مصطفى', 'الأسعد', 'احمد مصطفي الاسعد'],
    ['full-name-005', 'ليلى', 'عبد الرحمن', 'قره أوغلو', 'ليلي عبدالرحمن قره اوغلو'],
    ['full-name-006', 'عائشة', 'إبراهيم', 'يلماز', 'عايشه ابراهيم يلماز'],
  ])('finds %s from the vectors’ typed form', async (_id, given, father, family, typed) => {
    const chart = await registered(world, reception, {
      givenName: given,
      fatherName: father,
      familyName: family,
    });
    const res = await found(world, reception, typed);
    expect(res.results[0]).toMatchObject({ id: chart.id, matchedBy: 'name_variant' });
  });

  it('folds non-ASCII Latin capitals (OD-145)', async () => {
    const chart = await registered(world, reception, { givenName: 'Ayşe', familyName: 'ÖZTÜRK' });
    expect(idsOf(await found(world, reception, 'öz'))).toContain(chart.id);
  });

  it('answers an empty list for a name nobody has', async () => {
    expect(await found(world, reception, 'زبرجد')).toEqual({ results: [], truncated: false });
  });
});

describe('by phone (criterion 4)', () => {
  it('finds the contact phone in any accepted spelling', async () => {
    const national = `0${reem.contactPhone.slice(4)}`;
    for (const typed of [
      reem.contactPhone,
      national,
      national.replace(/(\d{4})(\d{3})/, '$1 $2 '),
    ]) {
      const res = await found(world, reception, typed);
      expect(res.results[0], typed).toMatchObject({
        id: reem.id,
        matchedBy: 'phone',
        matchedParts: [],
      });
    }
  });

  it('finds the last 7 or more digits, Arabic-Indic digits too', async () => {
    const tail = reem.contactPhone.slice(-7);
    const res = await found(world, reception, tail);
    expect(res.results.map((h) => [h.id, h.matchedBy])).toContainEqual([reem.id, 'phone_tail']);
    const arabic = tail.replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
    expect(idsOf(await found(world, reception, arabic))).toContain(reem.id);
    const longer = reem.contactPhone.slice(-9);
    expect(idsOf(await found(world, reception, longer))).toContain(reem.id);
  });

  it('finds the second phone', async () => {
    const second = world.phone();
    const chart = await registered(world, reception, { secondPhone: second });
    const res = await found(world, reception, second);
    expect(res.results[0]).toMatchObject({ id: chart.id, matchedBy: 'phone' });
  });
});

describe('by file number and previous number (criterion 4)', () => {
  it('finds the file number from the first digit', async () => {
    const res = await found(world, reception, String(reem.fileNumber));
    expect(res.results[0]).toMatchObject({ id: reem.id, matchedBy: 'file_number' });
  });

  it('finds the previous number exactly, trimmed', async () => {
    const res = await found(world, reception, '  HL-2207 ');
    expect(res.results[0]).toMatchObject({ id: reem.id, matchedBy: 'previous_file_number' });
    expect(idsOf(await found(world, reception, 'HL-220'))).not.toContain(reem.id);
  });
});

describe('term lengths (criterion 21)', () => {
  it.each([['ر'], ['ر م'], ['--'], ['   ']])('refuses %j with 400 on body.term', async (term) => {
    const res = await search(world, reception, { term });
    expect([res.statusCode, codeOf(res)]).toEqual([400, 'validation_failed']);
    expect(res.json<{ error: { details: { path: string }[] } }>().error.details[0]?.path).toBe(
      'body.term',
    );
  });

  it('refuses a term over 100 characters', async () => {
    const res = await search(world, reception, { term: 'ر'.repeat(101) });
    expect(res.statusCode).toBe(400);
  });

  it('takes 1 to 6 digits as a file number only, 7 or more also as a phone tail', async () => {
    const res = await search(world, reception, { term: '1' });
    expect(res.statusCode).toBe(200);
    const short = await found(world, reception, reem.contactPhone.slice(-6));
    expect(short.results.filter((h) => h.matchedBy === 'phone_tail')).toEqual([]);
  });
});
