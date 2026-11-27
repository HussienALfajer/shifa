// A-03 criteria 12, 13, 20, 22, 28 and 32 (A-03-02): a chart is read, edited with the
// registration's checks and `expectedUpdatedAt` (409 `stale` naming who saved and when), archived
// and restored by the owner, never deleted. Contract rows `GET /patients/count`,
// `GET /patients/:id` (identity part, created and updated by), `PATCH /patients/:id`,
// `POST /patients/:id/archive` and `/restore`. Audit: `patient.edited` with the changed field keys
// only, `patient.archived`, `patient.restored`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { del } from '../entitlements/support.ts';
import { testClock } from '../identity/support.ts';
import { activeMember, type Clinic, type TeamWorld, teamWorld } from '../team/support.ts';
import {
  archive,
  type ChartBody,
  chartOf,
  codeOf,
  countOf,
  edit,
  patientAudit,
  registered,
  restore,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let other: Clinic;
let reception: { cookie: string; userId: string };
let doctor: { cookie: string; userId: string };
let accountant: { cookie: string; userId: string };

beforeAll(async () => {
  world = await teamWorld(clock, 2026_11_29);
  clinic = await world.clinic();
  other = await world.clinic();
  reception = await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]);
  doctor = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
  accountant = await activeMember(world, clinic, [{ role: 'accountant', branchId: null }]);
});

afterAll(async () => {
  await world.app.app.close();
});

describe('the summary (criteria 12, 32)', () => {
  it('another clinic’s chart and an unknown id are not found (404)', async () => {
    const theirs = await registered(world, other.owner.cookie);
    for (const id of [theirs.id, '7d1f7f0e-0000-4000-8000-000000000001']) {
      const res = await chartOf(world, reception.cookie, id);
      expect(res.statusCode).toBe(404);
      expect(codeOf(res)).toBe('not_found');
    }
  });

  it('an accountant reads a chart (patients.view)', async () => {
    const chart = await registered(world, reception.cookie);
    expect((await chartOf(world, accountant.cookie, chart.id)).statusCode).toBe(200);
  });
});

describe('edit (criteria 12, 28)', () => {
  it('changes the fields given, names who edited, and audits the changed keys only', async () => {
    const chart = await registered(world, reception.cookie, { familyName: 'الحلبي' });
    clock.advanceBy(1000);
    const second = world.phone();
    const res = await edit(world, doctor.cookie, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      familyName: 'الشامي',
      fatherName: chart.fatherName,
      secondPhone: `0${second.slice(4)}`,
    });
    expect(res.statusCode, res.body).toBe(200);
    const edited = res.json<ChartBody>();
    expect(edited).toMatchObject({
      familyName: 'الشامي',
      secondPhone: second,
      fileNumber: chart.fileNumber,
      createdAt: chart.createdAt,
      updatedByName: 'موظف تجريبي',
    });
    expect(Date.parse(edited.updatedAt)).toBeGreaterThan(Date.parse(chart.updatedAt));
    const rows = (await patientAudit(clinic)).filter(
      (r) => r.targetId === chart.id && r.event === 'patient.edited',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actorId).toBe(doctor.userId);
    expect(rows[0]?.data).toEqual({ familyName: true, secondPhone: true });
  });

  it('nothing changed: the chart as it is, no audit row, updatedAt kept', async () => {
    const chart = await registered(world, reception.cookie);
    const res = await edit(world, reception.cookie, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      givenName: chart.givenName,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<ChartBody>().updatedAt).toBe(chart.updatedAt);
    const rows = (await patientAudit(clinic)).filter(
      (r) => r.targetId === chart.id && r.event === 'patient.edited',
    );
    expect(rows).toEqual([]);
  });

  it('an exact date clears the estimate; an age sets it again', async () => {
    const chart = await registered(world, reception.cookie);
    const aged = await edit(world, reception.cookie, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      age: { value: 40, unit: 'years' },
    });
    expect(aged.json<ChartBody>().birthDateEstimated).toBe(true);
    const exact = await edit(world, reception.cookie, chart.id, {
      expectedUpdatedAt: aged.json<ChartBody>().updatedAt,
      birthDate: '1985-06-01',
    });
    expect(exact.json()).toMatchObject({ birthDate: '1985-06-01', birthDateEstimated: false });
    const rows = (await patientAudit(clinic)).filter(
      (r) => r.targetId === chart.id && r.event === 'patient.edited',
    );
    expect(rows.map((r) => r.data)).toEqual([{ birthDate: true }, { birthDate: true }]);
  });

  it('runs the registration’s checks: phone format, name rules, the previous number', async () => {
    const taken = await registered(world, reception.cookie, { previousFileNumber: 'E-1' });
    const chart = await registered(world, reception.cookie);
    const at = chart.updatedAt;
    const phone = await edit(world, reception.cookie, chart.id, {
      expectedUpdatedAt: at,
      contactPhone: '0912',
    });
    expect(phone.json()).toMatchObject({ error: { details: [{ path: 'body.contactPhone' }] } });
    const name = await edit(world, reception.cookie, chart.id, {
      expectedUpdatedAt: at,
      givenName: 'ريم7',
    });
    expect(name.json()).toMatchObject({ error: { details: [{ path: 'body.givenName' }] } });
    const prev = await edit(world, reception.cookie, chart.id, {
      expectedUpdatedAt: at,
      previousFileNumber: ` ${String(taken.previousFileNumber)} `,
    });
    expect(prev.statusCode).toBe(409);
    expect(codeOf(prev)).toBe('previous_file_number_taken');
    // Its own number again is no clash; null clears it.
    const own = await edit(world, reception.cookie, taken.id, {
      expectedUpdatedAt: taken.updatedAt,
      previousFileNumber: null,
    });
    expect(own.json()).toMatchObject({ previousFileNumber: null });
  });

  it('a save after someone else’s answers 409 stale naming who saved and when', async () => {
    const chart = await registered(world, reception.cookie);
    clock.advanceBy(1000);
    const first = await edit(world, doctor.cookie, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      motherName: 'خديجة',
    });
    expect(first.statusCode).toBe(200);
    const late = await edit(world, reception.cookie, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      motherName: 'زينب',
    });
    expect(late.statusCode).toBe(409);
    expect(late.json()).toMatchObject({
      error: {
        code: 'stale',
        stale: {
          updatedAt: first.json<ChartBody>().updatedAt,
          updatedByName: 'موظف تجريبي',
        },
      },
    });
    expect((await chartOf(world, reception.cookie, chart.id)).json()).toMatchObject({
      motherName: 'خديجة',
    });
  });

  it('an accountant may not edit (403); another clinic’s chart is not found', async () => {
    const chart = await registered(world, reception.cookie);
    const body = { expectedUpdatedAt: chart.updatedAt, motherName: 'هند' };
    expect((await edit(world, accountant.cookie, chart.id, body)).statusCode).toBe(403);
    expect((await edit(world, other.owner.cookie, chart.id, body)).statusCode).toBe(404);
  });
});

describe('archive and restore (criteria 13, 28)', () => {
  it('the owner archives: state, who and when; the chart cannot be edited; never deleted', async () => {
    const chart = await registered(world, reception.cookie);
    clock.advanceBy(1000);
    const res = await archive(world, clinic.owner.cookie, chart.id, chart.updatedAt);
    expect(res.statusCode, res.body).toBe(200);
    const archived = res.json<ChartBody>();
    expect(archived).toMatchObject({ state: 'archived', fileNumber: chart.fileNumber });
    expect(archived.archivedAt).toBe(archived.updatedAt);
    expect(typeof archived.archivedByName).toBe('string');
    const blocked = await edit(world, reception.cookie, chart.id, {
      expectedUpdatedAt: archived.updatedAt,
      motherName: 'هند',
    });
    expect(blocked.statusCode).toBe(409);
    expect(codeOf(blocked)).toBe('patient_archived');
    const again = await archive(world, clinic.owner.cookie, chart.id, archived.updatedAt);
    expect(codeOf(again)).toBe('patient_archived');
    // No route deletes a chart.
    expect((await del(world.app, `/patients/${chart.id}`, clinic.owner.cookie)).statusCode).toBe(
      404,
    );
    expect((await chartOf(world, reception.cookie, chart.id)).json()).toMatchObject({
      state: 'archived',
    });
  });

  it('the owner restores it; restoring an active chart answers 409 patient_not_archived', async () => {
    const chart = await registered(world, reception.cookie);
    const archived = (
      await archive(world, clinic.owner.cookie, chart.id, chart.updatedAt)
    ).json<ChartBody>();
    clock.advanceBy(1000);
    const res = await restore(world, clinic.owner.cookie, chart.id, archived.updatedAt);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ state: 'active', archivedAt: null, archivedByName: null });
    const twice = await restore(
      world,
      clinic.owner.cookie,
      chart.id,
      res.json<ChartBody>().updatedAt,
    );
    expect(twice.statusCode).toBe(409);
    expect(codeOf(twice)).toBe('patient_not_archived');
    const events = (await patientAudit(clinic))
      .filter((r) => r.targetId === chart.id)
      .map((r) => [r.event, r.data]);
    expect(events).toEqual([
      ['patient.created', {}],
      ['patient.archived', {}],
      ['patient.restored', {}],
    ]);
  });

  it('archive and restore check expectedUpdatedAt (409 stale)', async () => {
    const chart = await registered(world, reception.cookie);
    clock.advanceBy(1000);
    const edited = await edit(world, reception.cookie, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      motherName: 'هند',
    });
    const stale = await archive(world, clinic.owner.cookie, chart.id, chart.updatedAt);
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({
      error: { code: 'stale', stale: { updatedAt: edited.json<ChartBody>().updatedAt } },
    });
    const archived = await archive(
      world,
      clinic.owner.cookie,
      chart.id,
      edited.json<ChartBody>().updatedAt,
    );
    expect(archived.statusCode).toBe(200);
    expect(codeOf(await restore(world, clinic.owner.cookie, chart.id, chart.updatedAt))).toBe(
      'stale',
    );
  });

  it('only the owner archives or restores (403 for every other role)', async () => {
    const chart = await registered(world, reception.cookie);
    for (const member of [reception, doctor, accountant]) {
      expect((await archive(world, member.cookie, chart.id, chart.updatedAt)).statusCode).toBe(403);
      expect((await restore(world, member.cookie, chart.id, chart.updatedAt)).statusCode).toBe(403);
    }
  });
});

describe('count (criterion 22)', () => {
  it('a clinic without charts: both 0', async () => {
    const fresh = await world.clinic();
    const res = await countOf(world, fresh.owner.cookie);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ active: 0, archived: 0 });
  });

  it('active and archived for the owner; archived 0 for everyone else', async () => {
    const fresh = await world.clinic();
    const a = await registered(world, fresh.owner.cookie);
    await registered(world, fresh.owner.cookie);
    await archive(world, fresh.owner.cookie, a.id, a.updatedAt);
    expect((await countOf(world, fresh.owner.cookie)).json()).toEqual({ active: 1, archived: 1 });
    const member = await activeMember(world, fresh, [{ role: 'accountant', branchId: null }]);
    expect((await countOf(world, member.cookie)).json()).toEqual({ active: 1, archived: 0 });
  });
});
