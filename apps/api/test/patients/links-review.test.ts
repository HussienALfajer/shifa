// A-03-04 review fixes (reviewer B1–B3, N2–N4, N7; security review M1):
// - one holder per phone, also after a restore and under concurrent registrations;
// - a birth correction alone is not re-checked for duplicates (contract row "Edit"); an edit
//   saved over acknowledged candidates is audited like a registration;
// - at most 20 treating doctors a save, and doctor changes audited 20 ids a row at most;
// - a doctor whose only doctor role is in an archived branch is inactive; a never-accepted
//   invitation is not a choice;
// - the phone rule finds a duplicate among many charts on one phone;
// - the duplicate check and the family preview share a per-member budget (429).
import { branch, roleAssignment } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DOCTOR_IDS_PER_ROW, doctorRows } from '../../src/modules/patients/doctors.ts';
import { FORM_CHECK_LIMIT } from '../../src/modules/patients/links.service.ts';
import { testClock } from '../identity/support.ts';
import {
  activeMember,
  addBranch,
  addMember,
  type Clinic,
  post,
  type TeamWorld,
  teamWorld,
} from '../team/support.ts';
import {
  archive,
  type ChartBody,
  candidates,
  chartInput,
  codeOf,
  doctorsOf,
  duplicates,
  edit,
  familyOf,
  patientAudit,
  register,
  registered,
  restore,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let reception: string;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_09, { clinicType: 'multi_branch' });
  clinic = await world.clinic();
  reception = (await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]))
    .cookie;
});

afterAll(async () => {
  await world.app.app.close();
});

const holdersOn = async (phone: string) => {
  const res = await familyOf(world, reception, { phone });
  const body = res.json<{
    holder: { id: string } | null;
    members: { relation: string | null }[];
  }>();
  return [body.holder, ...body.members.filter((m) => m.relation === 'holder')].filter(Boolean);
};

describe('one holder per phone (reviewer B2)', () => {
  it('a holder restored to a phone that has a new holder loses the mark', async () => {
    const phone = world.phone();
    const first = await registered(world, reception, { contactPhone: phone });
    const gone = (
      await archive(world, clinic.owner.cookie, first.id, first.updatedAt)
    ).json<ChartBody>();
    const second = await registered(world, reception, { contactPhone: phone });
    expect(second.relation).toBe('holder');
    const res = await restore(world, clinic.owner.cookie, first.id, gone.updatedAt);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<ChartBody>().relation).toBeNull();
    expect(await holdersOn(phone)).toHaveLength(1);
    const rows = (await patientAudit(clinic)).filter(
      (r) => r.event === 'patient.restored' && r.targetId === first.id,
    );
    expect(rows[0]?.data).toEqual({ relation: true });
  });

  it('concurrent registrations on a new phone make exactly one holder', async () => {
    const phone = world.phone();
    const saves = await Promise.all(
      Array.from({ length: 5 }, () => register(world, reception, chartInput(phone))),
    );
    for (const res of saves) expect(res.statusCode, res.body).toBe(201);
    const relations = saves.map((r) => r.json<ChartBody>().relation);
    expect(relations.filter((r) => r === 'holder')).toHaveLength(1);
    expect(await holdersOn(phone)).toHaveLength(1);
  });
});

describe('duplicates on edit (reviewer B3, N4)', () => {
  it('a birth correction alone is not re-checked', async () => {
    const fields = { givenName: 'باسل', fatherName: 'نبيل', familyName: 'الدهان' };
    await registered(world, reception, { ...fields, birthDate: '1984-04-04' });
    const mine = await registered(world, reception, { ...fields, birthDate: '1960-01-01' });
    const res = await edit(world, reception, mine.id, {
      expectedUpdatedAt: mine.updatedAt,
      birthDate: '1985-01-01',
    });
    expect(res.statusCode, res.body).toBe(200);
  });

  it('an edit saved over acknowledged candidates is audited with their ids', async () => {
    const phone = world.phone();
    const kept = await registered(world, reception, { givenName: 'لمى', contactPhone: phone });
    const mine = await registered(world, reception, { givenName: 'رنا' });
    const res = await edit(world, reception, mine.id, {
      expectedUpdatedAt: mine.updatedAt,
      givenName: 'لمى',
      contactPhone: phone,
      acknowledgedCandidateIds: [kept.id],
    });
    expect(res.statusCode, res.body).toBe(200);
    const rows = (await patientAudit(clinic)).filter(
      (r) => r.event === 'patient.duplicate_registered' && r.targetId === mine.id,
    );
    expect(rows.map((r) => r.data)).toEqual([{ candidateIds: [kept.id] }]);
  });

  it('the phone rule finds a duplicate among more than 50 charts on one phone (N2)', async () => {
    const phone = world.phone();
    for (let i = 0; i < 52; i += 1) await registered(world, reception, { contactPhone: phone });
    const late = await registered(world, reception, { givenName: 'ميسون', contactPhone: phone });
    const found = await candidates(world, reception, { givenName: 'ميسون', contactPhone: phone });
    expect(found.map((c) => c.card?.id)).toContain(late.id);
  });
});

describe('treating doctors (reviewer B1, N3, N7)', () => {
  it('refuses more than 20 doctors in a save', async () => {
    const ids = Array.from(
      { length: 21 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    const res = await register(
      world,
      reception,
      chartInput(world.phone(), { treatingDoctorIds: ids }),
    );
    expect(res.statusCode).toBe(400);
    expect(codeOf(res)).toBe('validation_failed');
  });

  it('splits a large change into audit rows of at most 20 ids', () => {
    const ids = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}-${String(i)}`);
    const rows = doctorRows({ added: ids(20, 'a'), removed: ids(20, 'r') });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.added.length + row.removed.length).toBeLessThanOrEqual(DOCTOR_IDS_PER_ROW);
    }
    expect(rows.flatMap((r) => r.added)).toEqual(ids(20, 'a'));
    expect(rows.flatMap((r) => r.removed)).toEqual(ids(20, 'r'));
    expect(doctorRows({ added: [], removed: [] })).toEqual([]);
  });

  it('a doctor of an archived branch only is inactive; an invitation is no choice', async () => {
    const elsewhere = await addBranch(clinic.clinicId);
    const there = await activeMember(world, clinic, [{ role: 'doctor', branchId: elsewhere }]);
    const invited = await addMember(world.app, clinic.owner.cookie, {
      phone: world.phone(),
      roles: [{ role: 'doctor', branchId: null }],
    });
    await post(
      world.app,
      `/team/members/${invited.membershipId}/deactivate`,
      {},
      clinic.owner.cookie,
    );
    const su = superuserDb(workerDatabaseName());
    await su.update(branch).set({ archivedAt: new Date() }).where(eq(branch.id, elsewhere));
    const { doctors } = (await doctorsOf(world, reception)).json<{
      doctors: { memberId: string; active: boolean }[];
    }>();
    expect(doctors.find((d) => d.memberId === there.membershipId)).toBeUndefined();
    expect(doctors.find((d) => d.memberId === invited.membershipId)).toBeUndefined();
    const res = await register(
      world,
      reception,
      chartInput(world.phone(), { treatingDoctorIds: [there.membershipId] }),
    );
    expect(codeOf(res)).toBe('doctor_not_member');
    const roles = await su
      .select()
      .from(roleAssignment)
      .where(eq(roleAssignment.membershipId, there.membershipId));
    expect(roles).toHaveLength(1);
  });
});

describe('a budget for the form’s lookups (security review M1)', () => {
  it('answers 429 past the budget, shared by the duplicate check and the family preview', async () => {
    const member = await activeMember(world, clinic, [{ role: 'assistant', branchId: null }]);
    for (let i = 0; i < FORM_CHECK_LIMIT.max / 2; i += 1) {
      expect((await duplicates(world, member.cookie, { givenName: 'هبة' })).statusCode).toBe(200);
      const fam = await familyOf(world, member.cookie, { phone: '+963930000001' });
      expect(fam.statusCode).toBe(200);
    }
    const over = await duplicates(world, member.cookie, { givenName: 'هبة' });
    expect(over.statusCode).toBe(429);
    expect(codeOf(over)).toBe('rate_limited');
    expect((await familyOf(world, member.cookie, { phone: '+963930000001' })).statusCode).toBe(429);
    // Another member keeps their own budget.
    expect((await duplicates(world, reception, { givenName: 'هبة' })).statusCode).toBe(200);
  });
});
