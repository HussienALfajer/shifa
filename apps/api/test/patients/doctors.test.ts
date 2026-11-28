// A-03 criteria 10 and 20 (A-03-04): a chart lists its treating doctors, doctor members of the
// clinic. Contract rows `GET /patients/doctors` (names and `active`, `patients.manage`),
// `treatingDoctorIds` in `POST /patients` and `PATCH /patients/:id`, `treatingDoctors` in the
// summary.
// - A doctor who registers a chart is added; others pick one or more, or none.
// - Anyone with `patients.manage` changes the list; only doctor members of this clinic are
//   accepted (400 `doctor_not_member`), except one already on the chart.
// - A deactivated doctor stays on the chart marked inactive and is not offered.
// - `patient.doctors_changed` holds member ids only.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { activeMember, type Clinic, post, type TeamWorld, teamWorld } from '../team/support.ts';
import {
  archive,
  type ChartBody,
  chartInput,
  chartOf,
  codeOf,
  doctorsOf,
  edit,
  patientAudit,
  register,
  registered,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
type Member = Awaited<ReturnType<typeof activeMember>>;
let first: Member;
let second: Member;
let leaving: Member;
let reception: Member;
let assistant: Member;
let accountant: Member;
let theirDoctor: Member;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_06);
  clinic = await world.clinic();
  const elsewhere = await world.clinic();
  first = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
  second = await activeMember(world, clinic, [{ role: 'doctor', branchId: clinic.branchId }]);
  leaving = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
  reception = await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]);
  assistant = await activeMember(world, clinic, [{ role: 'assistant', branchId: null }]);
  accountant = await activeMember(world, clinic, [{ role: 'accountant', branchId: null }]);
  theirDoctor = await activeMember(world, elsewhere, [{ role: 'doctor', branchId: null }]);
});

afterAll(async () => {
  await world.app.app.close();
});

interface Doctor {
  memberId: string;
  name: string;
  active: boolean;
}

const idsOf = (chart: ChartBody) => chart.treatingDoctors.map((d) => d.memberId).sort();
const sorted = (...ids: string[]) => [...ids].sort();

describe('the doctors to pick (contract `GET /patients/doctors`)', () => {
  it('lists the clinic’s doctor members with names, to everyone who registers', async () => {
    const res = await doctorsOf(world, reception.cookie);
    expect(res.statusCode, res.body).toBe(200);
    const { doctors } = res.json<{ doctors: Doctor[] }>();
    expect(doctors.map((d) => d.memberId).sort()).toEqual(
      sorted(first.membershipId, second.membershipId, leaving.membershipId),
    );
    expect(doctors.every((d) => d.active && d.name === 'موظف تجريبي')).toBe(true);
    expect((await doctorsOf(world, assistant.cookie)).statusCode).toBe(200);
    expect((await doctorsOf(world, accountant.cookie)).statusCode).toBe(403);
  });
});

describe('on registration (criterion 10)', () => {
  it('adds the doctor who registers, with any picked', async () => {
    const own = await registered(world, first.cookie);
    expect(own.treatingDoctors).toEqual([
      { memberId: first.membershipId, name: 'موظف تجريبي', active: true },
    ]);
    const both = await registered(world, first.cookie, {
      treatingDoctorIds: [second.membershipId],
    });
    expect(idsOf(both)).toEqual(sorted(first.membershipId, second.membershipId));
  });

  it('others pick one or more, or none; a repeated id counts once', async () => {
    expect((await registered(world, reception.cookie)).treatingDoctors).toEqual([]);
    const picked = await registered(world, reception.cookie, {
      treatingDoctorIds: [first.membershipId, second.membershipId, first.membershipId],
    });
    expect(idsOf(picked)).toEqual(sorted(first.membershipId, second.membershipId));
    expect((await chartOf(world, reception.cookie, picked.id)).json<ChartBody>()).toEqual(picked);
  });

  it('refuses a member who is no doctor, an unknown id and another clinic’s doctor', async () => {
    for (const id of [reception.membershipId, randomUUID(), theirDoctor.membershipId]) {
      const res = await register(
        world,
        reception.cookie,
        chartInput(world.phone(), { treatingDoctorIds: [id] }),
      );
      expect(res.statusCode, res.body).toBe(400);
      expect(codeOf(res)).toBe('doctor_not_member');
    }
  });
});

describe('changing the list (criteria 10, 20)', () => {
  it('anyone with patients.manage replaces it; the audit names member ids only', async () => {
    const chart = await registered(world, reception.cookie, {
      treatingDoctorIds: [first.membershipId],
    });
    const res = await edit(world, assistant.cookie, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      treatingDoctorIds: [second.membershipId],
    });
    expect(res.statusCode, res.body).toBe(200);
    const changed = res.json<ChartBody>();
    expect(idsOf(changed)).toEqual([second.membershipId]);
    expect(changed.updatedAt > chart.updatedAt).toBe(true);
    const rows = (await patientAudit(clinic)).filter(
      (r) => r.event === 'patient.doctors_changed' && r.targetId === chart.id,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.data).toEqual({
      added: [second.membershipId],
      removed: [first.membershipId],
    });
    expect(JSON.stringify(rows[0]?.data)).not.toContain('موظف');
    // The same list again changes nothing and writes no row.
    const same = await edit(world, reception.cookie, chart.id, {
      expectedUpdatedAt: changed.updatedAt,
      treatingDoctorIds: [second.membershipId],
    });
    expect(same.json<ChartBody>().updatedAt).toBe(changed.updatedAt);
    const none = await edit(world, reception.cookie, chart.id, {
      expectedUpdatedAt: changed.updatedAt,
      treatingDoctorIds: [],
    });
    expect(none.json<ChartBody>().treatingDoctors).toEqual([]);
  });

  it('is refused on an archived chart and to the accountant', async () => {
    const chart = await registered(world, reception.cookie);
    const archived = (
      await archive(world, clinic.owner.cookie, chart.id, chart.updatedAt)
    ).json<ChartBody>();
    const res = await edit(world, reception.cookie, chart.id, {
      expectedUpdatedAt: archived.updatedAt,
      treatingDoctorIds: [first.membershipId],
    });
    expect(codeOf(res)).toBe('patient_archived');
    const theirs = await edit(world, accountant.cookie, chart.id, {
      expectedUpdatedAt: archived.updatedAt,
      treatingDoctorIds: [],
    });
    expect(theirs.statusCode).toBe(403);
  });
});

describe('a deactivated doctor (criterion 10, edge case)', () => {
  it('stays on charts marked inactive, is not offered, and is not added anew', async () => {
    const kept = await registered(world, reception.cookie, {
      treatingDoctorIds: [leaving.membershipId, first.membershipId],
    });
    const fresh = await registered(world, reception.cookie);
    const off = await post(
      world.app,
      `/team/members/${leaving.membershipId}/deactivate`,
      {},
      clinic.owner.cookie,
    );
    expect(off.statusCode, off.body).toBe(200);

    const read = (await chartOf(world, reception.cookie, kept.id)).json<ChartBody>();
    expect(read.treatingDoctors).toContainEqual({
      memberId: leaving.membershipId,
      name: 'موظف تجريبي',
      active: false,
    });
    const { doctors } = (await doctorsOf(world, reception.cookie)).json<{ doctors: Doctor[] }>();
    expect(doctors.find((d) => d.memberId === leaving.membershipId)).toEqual({
      memberId: leaving.membershipId,
      name: 'موظف تجريبي',
      active: false,
    });

    // Kept while on the list; refused as a new pick.
    const keep = await edit(world, reception.cookie, kept.id, {
      expectedUpdatedAt: read.updatedAt,
      treatingDoctorIds: [leaving.membershipId, second.membershipId],
    });
    expect(keep.statusCode, keep.body).toBe(200);
    expect(idsOf(keep.json<ChartBody>())).toEqual(
      sorted(leaving.membershipId, second.membershipId),
    );
    const add = await edit(world, reception.cookie, fresh.id, {
      expectedUpdatedAt: fresh.updatedAt,
      treatingDoctorIds: [leaving.membershipId],
    });
    expect(add.statusCode).toBe(400);
    expect(codeOf(add)).toBe('doctor_not_member');
  });
});
