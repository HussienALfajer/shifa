// A-02 criterion 10 (contract row «الإعدادات» idle setting: `settings`, `idleDefault`,
// `idleLocked`): the idle sign-out is the cascade's first key, `session.idle_minutes`. Values the
// backfill wrote (15/30/60) keep working; the owner's change applies on the next request and is
// one clinic.settings_changed row with key, scope, before and after; `GET|PATCH /clinic/settings`
// say where the value comes from and whether it is locked; under the super admin's lock the owner
// is refused 409 `setting_locked` and nothing is written; unlocking gives the owner it back.
import { ClinicSettings, ErrorEnvelope } from '@shifa/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { del, put } from '../entitlements/support.ts';
import { testClock } from '../identity/support.ts';
import {
  activeMember,
  type Clinic,
  get,
  patch,
  type TeamWorld,
  teamWorld,
  tenantAuditRows,
} from '../team/support.ts';
import {
  clearPlatformValues,
  setOrganizationValue,
  setPlatformValue,
  storedValues,
} from './support.ts';

const IDLE = 'session.idle_minutes';
const MINUTE = 60_000;
const clock = testClock();
let world: TeamWorld;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_29);
});

afterAll(async () => {
  await world.app.app.close();
});

const settingsOf = async (cookie: string) => {
  const res = await get(world.app, '/clinic/settings', cookie);
  expect(res.statusCode, res.body).toBe(200);
  return ClinicSettings.parse(res.json());
};
const lockAs = (clinicId: string, value: unknown) =>
  put(
    world.app,
    `/platform/clinics/${clinicId}/settings/${IDLE}/lock`,
    { value },
    world.admin.cookie,
  );
const unlockAs = (clinicId: string) =>
  del(world.app, `/platform/clinics/${clinicId}/settings/${IDLE}/lock`, world.admin.cookie);

describe('the owner’s setting through the cascade', () => {
  let clinic: Clinic;

  beforeAll(async () => {
    clinic = await world.clinic();
  });

  it('a new clinic inherits the default (30)', async () => {
    expect(await settingsOf(clinic.owner.cookie)).toEqual({
      idleMinutes: 30,
      source: 'default',
      locked: false,
    });
  });

  it('a platform value applies to a clinic without its own', async () => {
    await setPlatformValue(IDLE, 60);
    expect(await settingsOf(clinic.owner.cookie)).toMatchObject({
      idleMinutes: 60,
      source: 'platform',
    });
    await clearPlatformValues();
  });

  it('the owner’s change applies on the next request; one audit row with before and after', async () => {
    const doctor = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    const res = await patch(
      world.app,
      '/clinic/settings',
      { idleMinutes: 15 },
      clinic.owner.cookie,
    );
    expect(res.statusCode, res.body).toBe(200);
    expect(ClinicSettings.parse(res.json())).toEqual({
      idleMinutes: 15,
      source: 'organization',
      locked: false,
    });
    expect((await get(world.app, '/auth/session', doctor.cookie)).json()).toMatchObject({
      idleMinutes: 15,
    });
    const rows = (await tenantAuditRows(clinic.clinicId)).filter(
      (r) => r.event === 'clinic.settings_changed',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      data: { idleMinutes: 15, key: IDLE, scope: 'organization', before: 30, after: 15 },
    });
    const stored = (await storedValues(clinic.clinicId)).filter((r) => r.key === IDLE);
    expect(stored).toEqual([
      expect.objectContaining({ scope: 'organization', value: 15, locked: false }),
    ]);
  });

  it('a super admin’s lock refuses the owner with 409 setting_locked; nothing is written', async () => {
    const member = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    expect((await lockAs(clinic.clinicId, 60)).statusCode).toBe(200);
    expect(await settingsOf(clinic.owner.cookie)).toEqual({
      idleMinutes: 60,
      source: 'organization',
      locked: true,
    });
    const refused = await patch(
      world.app,
      '/clinic/settings',
      { idleMinutes: 30 },
      clinic.owner.cookie,
    );
    expect(refused.statusCode).toBe(409);
    expect(ErrorEnvelope.parse(refused.json()).error.code).toBe('setting_locked');
    expect(
      (await tenantAuditRows(clinic.clinicId)).filter((r) => r.event === 'clinic.settings_changed'),
    ).toHaveLength(1);
    expect((await storedValues(clinic.clinicId)).filter((r) => r.key === IDLE)).toEqual([
      expect.objectContaining({ value: 60, locked: true }),
    ]);
    // Sessions follow the locked value.
    expect((await get(world.app, '/auth/session', member.cookie)).json()).toMatchObject({
      idleMinutes: 60,
    });
  });

  it('after the unlock the owner sets it again', async () => {
    expect((await unlockAs(clinic.clinicId)).statusCode).toBe(200);
    expect(await settingsOf(clinic.owner.cookie)).toEqual({
      idleMinutes: 30,
      source: 'default',
      locked: false,
    });
    const res = await patch(
      world.app,
      '/clinic/settings',
      { idleMinutes: 60 },
      clinic.owner.cookie,
    );
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ idleMinutes: 60, source: 'organization', locked: false });
  });
});

// Last: the clock moves past the super admin's own idle limit here.
describe('values from before the cascade (backfill)', () => {
  it('keeps 15, 30 and 60 for the clinics that held them, and sessions end by them', async () => {
    const members: { minutes: 15 | 30 | 60; cookie: string }[] = [];
    for (const minutes of [15, 30, 60] as const) {
      const clinic = await world.clinic();
      await setOrganizationValue(clinic.clinicId, IDLE, minutes);
      expect(await settingsOf(clinic.owner.cookie)).toEqual({
        idleMinutes: minutes,
        source: 'organization',
        locked: false,
      });
      const doctor = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
      expect((await get(world.app, '/auth/session', doctor.cookie)).json()).toMatchObject({
        idleMinutes: minutes,
      });
      members.push({ minutes, cookie: doctor.cookie });
    }
    const status = async (minutes: number) => {
      const member = members.find((m) => m.minutes === minutes);
      return (await get(world.app, '/auth/session', member?.cookie ?? '')).statusCode;
    };
    clock.advanceBy(14 * MINUTE);
    expect([await status(15), await status(30), await status(60)]).toEqual([200, 200, 200]);
    clock.advanceBy(16 * MINUTE);
    expect([await status(15), await status(30), await status(60)]).toEqual([401, 200, 200]);
    clock.advanceBy(31 * MINUTE);
    expect([await status(30), await status(60)]).toEqual([401, 200]);
    clock.advanceBy(61 * MINUTE);
    expect(await status(60)).toBe(401);
  });
});
