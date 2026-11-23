// A-01a criterion 9 (the owner's idle setting): `GET|PATCH /clinic/settings` for
// `clinic.settings.manage` only; 15, 30 or 60 minutes; the new limit applies on the next request.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import {
  activeMember,
  type Clinic,
  get,
  patch,
  type TeamWorld,
  teamWorld,
  tenantAuditRows,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_04);
  clinic = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

describe('clinic settings: automatic sign-out', () => {
  it('reads the default (30) and lets only the owner change it', async () => {
    const read = await get(world.app, '/clinic/settings', clinic.owner.cookie);
    expect(read.statusCode).toBe(200);
    expect(read.json()).toEqual({ idleMinutes: 30 });

    const doctor = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    expect((await get(world.app, '/clinic/settings', doctor.cookie)).statusCode).toBe(403);
    const refused = await patch(world.app, '/clinic/settings', { idleMinutes: 15 }, doctor.cookie);
    expect(refused.statusCode).toBe(403);
    expect((await get(world.app, '/clinic/settings', clinic.owner.cookie)).json()).toEqual({
      idleMinutes: 30,
    });
  });

  it('accepts only 15, 30 or 60', async () => {
    for (const idleMinutes of [0, 20, 61, 120]) {
      const res = await patch(world.app, '/clinic/settings', { idleMinutes }, clinic.owner.cookie);
      expect(res.statusCode, String(idleMinutes)).toBe(400);
    }
  });

  it('applies the new limit on the next request and records one audit row', async () => {
    const doctor = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    const res = await patch(
      world.app,
      '/clinic/settings',
      { idleMinutes: 15 },
      clinic.owner.cookie,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ idleMinutes: 15 });
    expect((await get(world.app, '/auth/session', doctor.cookie)).json()).toMatchObject({
      idleMinutes: 15,
    });
    // 16 minutes idle: past the new limit, within the old one.
    clock.advanceBy(16 * 60_000);
    expect((await get(world.app, '/auth/session', doctor.cookie)).statusCode).toBe(401);

    const rows = (await tenantAuditRows(clinic.clinicId)).filter(
      (r) => r.event === 'clinic.settings_changed',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ data: { idleMinutes: 15 } });
  });
});
