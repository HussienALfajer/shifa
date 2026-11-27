// A-03-02 review findings. (1) A merged chart (written as A-03-08 will) cannot be edited or
// archived (409 `patient_merged`) nor restored (409 `patient_not_archived`), and its summary leads
// to the kept chart (`mergedInto`). (2) Every answer of the six contract rows parses with its
// contract schema. (3) The registering branch: the session's, else the clinic's only active one,
// else none. (4) Several saves of one id at once give one chart and take one file number.
import { ErrorEnvelope, PatientChart, PatientCount } from '@shifa/contracts';
import { patient } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import {
  activeMember,
  addBranch,
  type Clinic,
  type TeamWorld,
  teamWorld,
} from '../team/support.ts';
import {
  archive,
  type ChartBody,
  chartInput,
  chartOf,
  codeOf,
  countOf,
  edit,
  register,
  registered,
  restore,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_01, { clinicType: 'multi_branch' });
  clinic = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

describe('a merged chart (finding 1)', () => {
  it('is read-only and leads to the chart it was merged into', async () => {
    const kept = await registered(world, clinic.owner.cookie);
    const other = await registered(world, clinic.owner.cookie);
    await superuserDb(workerDatabaseName())
      .update(patient)
      .set({ state: 'merged', mergedIntoId: kept.id })
      .where(eq(patient.id, other.id));
    const read = await chartOf(world, clinic.owner.cookie, other.id);
    expect(PatientChart.parse(read.json())).toMatchObject({
      state: 'merged',
      mergedInto: { id: kept.id, fileNumber: kept.fileNumber },
    });
    const at = other.updatedAt;
    const edited = await edit(world, clinic.owner.cookie, other.id, {
      expectedUpdatedAt: at,
      motherName: 'هند',
    });
    expect([edited.statusCode, codeOf(edited)]).toEqual([409, 'patient_merged']);
    const archived = await archive(world, clinic.owner.cookie, other.id, at);
    expect([archived.statusCode, codeOf(archived)]).toEqual([409, 'patient_merged']);
    const restored = await restore(world, clinic.owner.cookie, other.id, at);
    expect([restored.statusCode, codeOf(restored)]).toEqual([409, 'patient_not_archived']);
    // A merged chart counts as neither active nor archived.
    const fresh = await world.clinic();
    const a = await registered(world, fresh.owner.cookie);
    const b = await registered(world, fresh.owner.cookie);
    await superuserDb(workerDatabaseName())
      .update(patient)
      .set({ state: 'merged', mergedIntoId: a.id })
      .where(eq(patient.id, b.id));
    expect(PatientCount.parse((await countOf(world, fresh.owner.cookie)).json())).toEqual({
      active: 1,
      archived: 0,
    });
  });
});

describe('answers parse with the contract (finding 2)', () => {
  it('create, replay, read, edit, stale, archive, restore and count', async () => {
    const input = chartInput(world.phone(), { motherName: 'سعاد', secondPhone: world.phone() });
    const created = await register(world, clinic.owner.cookie, input);
    const chart = PatientChart.parse(created.json());
    expect(PatientChart.parse((await register(world, clinic.owner.cookie, input)).json())).toEqual(
      chart,
    );
    PatientChart.parse((await chartOf(world, clinic.owner.cookie, chart.id)).json());
    clock.advanceBy(1000);
    const edited = PatientChart.parse(
      (
        await edit(world, clinic.owner.cookie, chart.id, {
          expectedUpdatedAt: chart.updatedAt,
          familyName: 'الشامي',
        })
      ).json(),
    );
    const stale = await edit(world, clinic.owner.cookie, chart.id, {
      expectedUpdatedAt: chart.updatedAt,
      familyName: 'العلي',
    });
    expect(ErrorEnvelope.parse(stale.json()).error.stale?.updatedAt).toBe(edited.updatedAt);
    const archived = PatientChart.parse(
      (await archive(world, clinic.owner.cookie, chart.id, edited.updatedAt)).json(),
    );
    expect(archived.archivedAt).not.toBeNull();
    PatientChart.parse(
      (await restore(world, clinic.owner.cookie, chart.id, archived.updatedAt)).json(),
    );
    PatientCount.parse((await countOf(world, clinic.owner.cookie)).json());
    const taken = await register(
      world,
      clinic.owner.cookie,
      chartInput(world.phone(), { birthDate: '2026-02-30' }),
    );
    expect(ErrorEnvelope.parse(taken.json()).error.details).toEqual([
      { path: 'body.birthDate', code: 'custom' },
    ]);
  });
});

describe('the registering branch (finding 3)', () => {
  it('a branch-scoped member registers in their branch', async () => {
    const second = await addBranch(clinic.clinicId, 'فرع الشهباء');
    const member = await activeMember(world, clinic, [{ role: 'receptionist', branchId: second }]);
    const chart = await registered(world, member.cookie);
    expect(chart.registeredBranch).toEqual({ id: second, name: 'فرع الشهباء' });
  });

  it('a clinic-wide member: the only active branch, or none when there are several', async () => {
    const single = await world.clinic();
    const doctor = await activeMember(world, single, [{ role: 'doctor', branchId: null }]);
    expect((await registered(world, doctor.cookie)).registeredBranch?.id).toBe(single.branchId);
    const several = await world.clinic();
    // The second branch exists before the doctor signs in: the session then holds no branch.
    await addBranch(several.clinicId, 'فرع العزيزية');
    const doctorThere = await activeMember(world, several, [{ role: 'doctor', branchId: null }]);
    expect((await registered(world, doctorThere.cookie)).registeredBranch).toBeNull();
  });
});

describe('another clinic (security review L4)', () => {
  it('cannot archive, restore or count another clinic’s chart', async () => {
    const theirs = await world.clinic();
    const chart = await registered(world, theirs.owner.cookie);
    const archived = await archive(world, clinic.owner.cookie, chart.id, chart.updatedAt);
    expect(archived.statusCode).toBe(404);
    const done = (
      await archive(world, theirs.owner.cookie, chart.id, chart.updatedAt)
    ).json<ChartBody>();
    expect((await restore(world, clinic.owner.cookie, chart.id, done.updatedAt)).statusCode).toBe(
      404,
    );
    expect(PatientCount.parse((await countOf(world, theirs.owner.cookie)).json())).toEqual({
      active: 0,
      archived: 1,
    });
  });
});

describe('the previous file number (security review L1)', () => {
  it('refuses control, format and invisible characters on its path', async () => {
    for (const previousFileNumber of ['A\u0000', '‮17-K', 'K​17', 'K⁠17']) {
      const res = await register(
        world,
        clinic.owner.cookie,
        chartInput(world.phone(), { previousFileNumber }),
      );
      expect(res.statusCode, JSON.stringify(previousFileNumber)).toBe(400);
      expect(ErrorEnvelope.parse(res.json()).error.details).toEqual([
        { path: 'body.previousFileNumber', code: 'custom' },
      ]);
    }
  });
});

describe('one id saved several times at once (finding 4)', () => {
  it('gives one chart and takes one file number', async () => {
    const fresh = await world.clinic();
    const input = chartInput(world.phone());
    const results = await Promise.all(
      Array.from({ length: 6 }, () => register(world, fresh.owner.cookie, input)),
    );
    expect(results.map((r) => r.statusCode)).toEqual(Array(6).fill(201));
    const numbers = new Set(results.map((r) => r.json<ChartBody>().fileNumber));
    expect([...numbers]).toEqual([1]);
    expect((await registered(world, fresh.owner.cookie)).fileNumber).toBe(2);
  });
});
