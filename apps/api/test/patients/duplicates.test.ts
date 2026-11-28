// A-03 criteria 7, 20 and 27 (A-03-04): while registering, the form asks for duplicate candidates;
// the create re-checks on the server. Contract rows `POST /patients/duplicates` (visible shape,
// archived candidates) and `POST /patients` (409 `possible_duplicate` with the candidates,
// `acknowledgedCandidateIds`).
// - Rule 1: the same contact phone with a similar given name (the normalised key, so «أحمد» and
//   «احمد» are one name); twins with different given names are no duplicate.
// - Rule 2: a similar full name (every typed word a whole word of the chart's name, any order;
//   at least two words) with a birth year within 2 years (a date of birth or an age).
// - At most 5, archived ones marked by their state, merged ones never; `excludeId` leaves out the
//   chart being edited; another clinic's charts never.
// - The check writes no audit row; registering anyway writes `patient.duplicate_registered` with
//   the candidate ids only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { activeMember, type Clinic, type TeamWorld, teamWorld } from '../team/support.ts';
import {
  archive,
  type ChartBody,
  candidates,
  candidatesOf,
  chartInput,
  chartOf,
  codeOf,
  duplicates,
  edit,
  patientAudit,
  register,
  registered,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let other: Clinic;
let reception: string;
let accountant: string;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_04);
  clinic = await world.clinic();
  other = await world.clinic();
  reception = (await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]))
    .cookie;
  accountant = (await activeMember(world, clinic, [{ role: 'accountant', branchId: null }])).cookie;
});

afterAll(async () => {
  await world.app.app.close();
});

/** A chart with this name, phone and date of birth, registered as reception. */
function chart(
  givenName: string,
  fatherName: string | null,
  familyName: string | null,
  contactPhone: string,
  birthDate: string,
): Promise<ChartBody> {
  return registered(world, reception, {
    givenName,
    fatherName,
    familyName,
    contactPhone,
    birthDate,
  });
}

const idsOf = (list: { card: { id: string } | null }[]) => list.map((c) => c.card?.id);

describe('rule 1: the same phone with a similar given name (criterion 7)', () => {
  it('finds a chart on the phone with the same given name, any spelling', async () => {
    const phone = world.phone();
    const kept = await chart('أحمد', 'سمير', 'الخطيب', phone, '1985-04-02');
    const found = await candidates(world, reception, {
      givenName: 'احمد',
      contactPhone: `0${phone.slice(4)}`,
    });
    expect(found).toEqual([
      {
        visible: true,
        fileNumber: kept.fileNumber,
        reason: 'same_phone_similar_name',
        card: {
          id: kept.id,
          displayName: kept.displayName,
          fileNumber: kept.fileNumber,
          sex: kept.sex,
          birthDate: kept.birthDate,
          birthDateEstimated: false,
          contactPhone: phone,
          state: 'active',
        },
      },
    ]);
  });

  it('twins: a different given name on the phone is no duplicate, the same name warns', async () => {
    const phone = world.phone();
    const hussein = await chart('حسين', 'علي', 'الشامي', phone, '2015-06-01');
    expect(
      await candidates(world, reception, {
        givenName: 'حسن',
        fatherName: 'علي',
        familyName: 'الشامي',
        contactPhone: phone,
        birthDate: '2015-06-01',
      }),
    ).toEqual([]);
    expect(
      idsOf(
        await candidates(world, reception, {
          givenName: 'حسين',
          contactPhone: phone,
          birthDate: '2015-06-01',
        }),
      ),
    ).toEqual([hussein.id]);
  });

  it('a phone alone or a given name alone finds nothing', async () => {
    const phone = world.phone();
    await chart('ليلى', null, 'العلي', phone, '1999-01-01');
    expect(await candidates(world, reception, { contactPhone: phone })).toEqual([]);
    expect(await candidates(world, reception, { givenName: 'ليلى' })).toEqual([]);
  });
});

describe('rule 2: a similar full name with a birth year within 2 years (criterion 7)', () => {
  it('finds the name on another phone within 2 years, in any order, by date or age', async () => {
    const kept = await chart('رامي', 'فؤاد', 'القصاب', world.phone(), '1990-05-01');
    const near = await candidates(world, reception, {
      givenName: 'رامي',
      fatherName: 'فؤاد',
      familyName: 'القصاب',
      contactPhone: world.phone(),
      birthDate: '1992-12-31',
    });
    expect(near).toMatchObject([
      { visible: true, reason: 'similar_name_near_birth_year', card: { id: kept.id } },
    ]);
    const reordered = await candidates(world, reception, {
      givenName: 'القصاب',
      fatherName: 'رامي',
      birthDate: '1988-01-01',
    });
    expect(idsOf(reordered)).toEqual([kept.id]);
    const byAge = await candidates(world, reception, {
      givenName: 'رامي',
      familyName: 'القصاب',
      age: { value: 36, unit: 'years' },
    });
    expect(idsOf(byAge)).toEqual([kept.id]);
  });

  it('near misses: 3 years apart, another family name, or one word only', async () => {
    await chart('وسيم', 'نادر', 'الدباغ', world.phone(), '1980-07-07');
    const ask = (extra: Record<string, unknown>) =>
      candidates(world, reception, { givenName: 'وسيم', ...extra });
    expect(await ask({ familyName: 'الدباغ', birthDate: '1983-01-01' })).toEqual([]);
    expect(await ask({ familyName: 'الدباغ', birthDate: '1977-12-31' })).toEqual([]);
    expect(await ask({ familyName: 'الحداد', birthDate: '1980-07-07' })).toEqual([]);
    expect(await ask({ birthDate: '1980-07-07' })).toEqual([]);
  });

  it('a birth year is needed for this rule', async () => {
    await chart('جود', 'سامر', 'الأيوبي', world.phone(), '2001-02-02');
    expect(
      await candidates(world, reception, {
        givenName: 'جود',
        fatherName: 'سامر',
        familyName: 'الأيوبي',
      }),
    ).toEqual([]);
  });
});

describe('the answer (criteria 7, 27)', () => {
  it('marks archived candidates by their state and keeps them', async () => {
    const phone = world.phone();
    const old = await chart('نور', 'زياد', 'الحمصي', phone, '1970-03-03');
    const res = await archive(world, clinic.owner.cookie, old.id, old.updatedAt);
    expect(res.statusCode, res.body).toBe(200);
    const found = await candidates(world, reception, { givenName: 'نور', contactPhone: phone });
    expect(found).toMatchObject([{ visible: true, card: { id: old.id, state: 'archived' } }]);
  });

  it('answers at most 5, and leaves out the chart being edited', async () => {
    const phone = world.phone();
    const charts: ChartBody[] = [];
    for (let i = 0; i < 6; i += 1) {
      charts.push(await chart('سلمى', null, null, phone, `200${String(i)}-01-01`));
    }
    const found = await candidates(world, reception, { givenName: 'سلمى', contactPhone: phone });
    expect(found).toHaveLength(5);
    const first = charts[0];
    if (!first) throw new Error('no chart');
    const without = await candidates(world, reception, {
      givenName: 'سلمى',
      contactPhone: phone,
      excludeId: first.id,
    });
    expect(idsOf(without)).not.toContain(first.id);
  });

  it('never names another clinic’s chart', async () => {
    const phone = world.phone();
    await registered(world, other.owner.cookie, {
      givenName: 'كنان',
      fatherName: 'بشير',
      familyName: 'الصواف',
      contactPhone: phone,
      birthDate: '1995-09-09',
    });
    expect(
      await candidates(world, reception, {
        givenName: 'كنان',
        fatherName: 'بشير',
        familyName: 'الصواف',
        contactPhone: phone,
        birthDate: '1995-09-09',
      }),
    ).toEqual([]);
  });

  it('writes no audit row, and is refused to the accountant', async () => {
    const before = (await patientAudit(clinic)).length;
    await candidates(world, reception, { givenName: 'نور', contactPhone: world.phone() });
    expect((await patientAudit(clinic)).length).toBe(before);
    expect((await duplicates(world, accountant, { givenName: 'نور' })).statusCode).toBe(403);
  });

  it('refuses a malformed check', async () => {
    const res = await duplicates(world, reception, { givenName: 'نور', excludeId: 'x' });
    expect(res.statusCode).toBe(400);
    expect(codeOf(res)).toBe('validation_failed');
  });
});

describe('the create re-checks (criteria 7, 20, 27)', () => {
  it('answers 409 `possible_duplicate` with the candidates and saves nothing', async () => {
    const phone = world.phone();
    const kept = await chart('مريم', 'عادل', 'السقا', phone, '1993-08-08');
    const input = chartInput(phone, { givenName: 'مريم', fatherName: null, familyName: null });
    const res = await register(world, reception, input);
    expect(res.statusCode, res.body).toBe(409);
    expect(codeOf(res)).toBe('possible_duplicate');
    expect(idsOf(candidatesOf(res))).toEqual([kept.id]);
    expect((await chartOf(world, reception, input.id)).statusCode).toBe(404);
    const partial = await register(world, reception, {
      ...input,
      acknowledgedCandidateIds: [input.id],
    });
    expect(partial.statusCode).toBe(409);
  });

  it('registers anyway with the ids acknowledged, audited with the ids only', async () => {
    const phone = world.phone();
    const kept = await chart('هالة', 'منير', 'الزين', phone, '1966-02-02');
    const input = chartInput(phone, {
      givenName: 'هالة',
      fatherName: null,
      familyName: null,
      acknowledgedCandidateIds: [kept.id],
    });
    const res = await register(world, reception, input);
    expect(res.statusCode, res.body).toBe(201);
    const rows = (await patientAudit(clinic)).filter(
      (r) => r.event === 'patient.duplicate_registered' && r.targetId === input.id,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.data).toEqual({ candidateIds: [kept.id] });
    expect(JSON.stringify(rows[0]?.data)).not.toContain(phone.slice(4));
    // A replay of the same body is the stored chart, with no second audit row.
    expect((await register(world, reception, input)).statusCode).toBe(201);
    const after = (await patientAudit(clinic)).filter(
      (r) => r.event === 'patient.duplicate_registered' && r.targetId === input.id,
    );
    expect(after).toHaveLength(1);
  });

  it('an archived candidate does not block: acknowledged, it is registered (criterion 27)', async () => {
    const phone = world.phone();
    const old = await chart('غادة', 'جميل', 'الرفاعي', phone, '1960-10-10');
    await archive(world, clinic.owner.cookie, old.id, old.updatedAt);
    const input = chartInput(phone, { givenName: 'غادة', fatherName: null, familyName: null });
    const refused = await register(world, reception, input);
    expect(refused.statusCode).toBe(409);
    expect(candidatesOf(refused)).toMatchObject([{ card: { id: old.id, state: 'archived' } }]);
    const res = await register(world, reception, { ...input, acknowledgedCandidateIds: [old.id] });
    expect(res.statusCode, res.body).toBe(201);
  });

  it('an edit that makes a name or phone a duplicate is re-checked the same way', async () => {
    const phone = world.phone();
    const kept = await chart('عمر', 'ياسر', 'المصري', phone, '1977-11-11');
    const mine = await chart('زيد', null, null, world.phone(), '2010-01-01');
    const res = await edit(world, reception, mine.id, {
      expectedUpdatedAt: mine.updatedAt,
      givenName: 'عمر',
      contactPhone: phone,
    });
    expect(res.statusCode, res.body).toBe(409);
    expect(codeOf(res)).toBe('possible_duplicate');
    const ok = await edit(world, reception, mine.id, {
      expectedUpdatedAt: mine.updatedAt,
      givenName: 'عمر',
      contactPhone: phone,
      acknowledgedCandidateIds: [kept.id],
    });
    expect(ok.statusCode, ok.body).toBe(200);
    // An edit of another field is not re-checked.
    const later = ok.json<ChartBody>();
    const motherOnly = await edit(world, reception, mine.id, {
      expectedUpdatedAt: later.updatedAt,
      motherName: 'سعاد',
    });
    expect(motherOnly.statusCode, motherOnly.body).toBe(200);
  });
});
