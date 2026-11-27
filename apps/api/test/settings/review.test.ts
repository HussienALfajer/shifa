// A-02-04 review fixes. Security review N4: a stored lock whose value no longer validates still
// holds: the owner's change answers 409 `setting_locked` (not a 500 from the database's policy),
// and the clinic and admin reads report it locked. N3: an upper-case clinic id in the path takes
// the same advisory lock and finds the same clinic.
import { ClinicSettings, ErrorEnvelope, SettingView } from '@shifa/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  heldLock,
  resolveWithLocks,
  type SettingDefinition,
  writeRefusal,
} from '../../src/modules/settings/index.ts';
import { del, put } from '../entitlements/support.ts';
import { testClock } from '../identity/support.ts';
import { type Clinic, get, patch, type TeamWorld, teamWorld } from '../team/support.ts';
import { setOrganizationValue, storedValues } from './support.ts';

const IDLE = 'session.idle_minutes';
const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_30);
  clinic = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

const EVERYWHERE: SettingDefinition = {
  key: 'test.review',
  description: 'test-only',
  schema: z.int().min(0).max(10),
  defaultValue: 0,
  overridableBy: ['organization', 'user'],
  lockable: true,
  sensitivity: 'normal',
};

describe('a lock whose value went invalid (N4)', () => {
  it('still refuses writes at and below it, and reads as locked', () => {
    const values = [{ scope: 'organization' as const, value: 'no longer a number', locked: true }];
    expect(writeRefusal(EVERYWHERE, values, 'organization', 3)).toBe('locked');
    expect(writeRefusal(EVERYWHERE, values, 'user', 3)).toBe('locked');
    expect(heldLock(EVERYWHERE, values)).toBe('organization');
    expect(resolveWithLocks(EVERYWHERE, values)).toEqual({
      value: 0,
      source: 'default',
      locked: true,
      lockedBy: 'organization',
    });
  });

  it('the owner gets 409 setting_locked and the reads say locked', async () => {
    await setOrganizationValue(clinic.clinicId, IDLE, 45, true);
    const read = await get(world.app, '/clinic/settings', clinic.owner.cookie);
    expect(ClinicSettings.parse(read.json())).toEqual({
      idleMinutes: 30,
      source: 'default',
      locked: true,
    });
    const res = await patch(
      world.app,
      '/clinic/settings',
      { idleMinutes: 15 },
      clinic.owner.cookie,
    );
    expect(res.statusCode, res.body).toBe(409);
    expect(ErrorEnvelope.parse(res.json()).error.code).toBe('setting_locked');
    const admin = await get(
      world.app,
      `/platform/clinics/${clinic.clinicId}/settings`,
      world.admin.cookie,
    );
    expect(admin.json()).toMatchObject({
      settings: [{ key: IDLE, locked: true, lockedBy: 'organization' }],
    });
    // The super admin can still unlock it.
    const unlocked = await del(
      world.app,
      `/platform/clinics/${clinic.clinicId}/settings/${IDLE}/lock`,
      world.admin.cookie,
    );
    expect(unlocked.statusCode, unlocked.body).toBe(200);
    expect(SettingView.parse(unlocked.json())).toMatchObject({ locked: false, value: 30 });
  });
});

describe('an upper-case clinic id (N3)', () => {
  it('locks the same clinic', async () => {
    const res = await put(
      world.app,
      `/platform/clinics/${clinic.clinicId.toUpperCase()}/settings/${IDLE}/lock`,
      { value: 60 },
      world.admin.cookie,
    );
    expect(res.statusCode, res.body).toBe(200);
    expect((await storedValues(clinic.clinicId)).filter((r) => r.key === IDLE)).toEqual([
      expect.objectContaining({ value: 60, locked: true }),
    ]);
  });
});
