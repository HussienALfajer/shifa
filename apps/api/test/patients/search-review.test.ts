// A-03-03 review findings. Reviewer 1: a previous number with other punctuation («123/2019») or
// in Arabic-Indic digits is found. Reviewer 2 and security M1: one common start («ال») and a word
// typed many times answer from a capped candidate list, with `truncated`. Reviewer 3 (owner,
// 2026-11-27): a typo inside a word is found by trigram similarity (`name_variant`). Reviewer 4:
// each result carries its name parts, so the screen can mark `matchedParts`. Security L4: another
// clinic's chart with the same name, phone, file number and previous number is never answered.
// Also: a typed start that folds to a particle («آم») still finds «آمنة».
import { PatientSearchResults } from '@shifa/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { activeMember, type Clinic, type TeamWorld, teamWorld } from '../team/support.ts';
import { type ChartBody, found, registered, search } from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let other: Clinic;
let reception: string;
let aamina: ChartBody;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_08);
  clinic = await world.clinic();
  other = await world.clinic();
  reception = (
    await activeMember(world, clinic, [{ role: 'receptionist', branchId: clinic.branchId }])
  ).cookie;
  aamina = await registered(world, reception, {
    givenName: 'آمنة',
    fatherName: 'أحمد',
    familyName: 'الحلبي',
    previousFileNumber: '123/2019',
  });
});

afterAll(async () => {
  await world.app.app.close();
});

const idsOf = (r: { results: { id: string }[] }) => r.results.map((h) => h.id);

describe('previous numbers (reviewer 1)', () => {
  it('finds a number with a slash, and in Arabic-Indic digits', async () => {
    expect((await found(world, reception, '123/2019')).results[0]).toMatchObject({
      id: aamina.id,
      matchedBy: 'previous_file_number',
    });
    expect(idsOf(await found(world, reception, '١٢٣/٢٠١٩'))).toContain(aamina.id);
  });
});

describe('common starts (reviewer 2, security M1)', () => {
  it('answers «ال» alone and a word typed many times', async () => {
    const one = await search(world, reception, { term: 'ال' });
    expect(one.statusCode).toBe(200);
    expect(PatientSearchResults.parse(one.json()).results.length).toBeGreaterThan(0);
    const many = await found(world, reception, Array.from({ length: 33 }, () => 'ال').join(' '));
    expect(idsOf(many)).toContain(aamina.id);
  });
});

describe('typos (reviewer 3; owner, 2026-11-27)', () => {
  it('finds a chart with a letter wrong inside a word, as a name variant', async () => {
    const res = await found(world, reception, 'آمنة احمر الحلبي');
    expect(res.results[0]).toMatchObject({ id: aamina.id, matchedBy: 'name_variant' });
  });

  it('finds nothing for a name far from every chart', async () => {
    expect(idsOf(await found(world, reception, 'زبرجد قصطنطين'))).toEqual([]);
  });
});

describe('a start that folds to a particle', () => {
  it('«آم الح» finds «آمنة الحلبي»', async () => {
    expect(idsOf(await found(world, reception, 'آم الح'))).toContain(aamina.id);
  });
});

describe('name parts on each result (reviewer 4)', () => {
  it('sends given, father and family names beside the display name', async () => {
    const res = await found(world, reception, 'آمنة الحلبي');
    expect(res.results[0]).toMatchObject({
      displayName: 'آمنة أحمد الحلبي',
      givenName: 'آمنة',
      fatherName: 'أحمد',
      familyName: 'الحلبي',
      matchedParts: [0, 2],
    });
  });
});

describe('another clinic (security L4)', () => {
  it('never answers its chart, whatever matches', async () => {
    const twin = await registered(world, other.owner.cookie, {
      givenName: 'آمنة',
      fatherName: 'أحمد',
      familyName: 'الحلبي',
      contactPhone: aamina.contactPhone,
      previousFileNumber: '123/2019',
    });
    for (const term of [
      'آمنة الحلبي',
      'آمنة احمر الحلبي',
      aamina.contactPhone,
      aamina.contactPhone.slice(-7),
      '123/2019',
      String(twin.fileNumber),
    ]) {
      expect(idsOf(await found(world, reception, term)), term).not.toContain(twin.id);
      expect(idsOf(await found(world, other.owner.cookie, term)), term).not.toContain(aamina.id);
    }
  });
});
