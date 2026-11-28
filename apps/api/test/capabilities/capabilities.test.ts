// A-02 criteria 5 and 6 (contract rows `A02cLimits`, `addAtLimit`, `settings`/`subFull`): every
// member of the active clinic reads what it may use from GET /clinic/capabilities (features on or
// off, limits with use, evaluated flags); the owner alone reads GET /clinic/subscription (plan,
// status, end date, limits with use, enabled features). The guard checks every gated route itself:
// a probe gated on a feature or a flag answers 403 `feature_unavailable` while it is off.
import { Capabilities, ErrorEnvelope, Subscription } from '@shifa/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GatedProbeController, TEST_ENTITLEMENTS, TEST_FLAGS } from '../access/gated-probe.ts';
import { put } from '../entitlements/support.ts';
import { testClock } from '../identity/support.ts';
import {
  activeMember,
  addMember,
  type Clinic,
  errorCode,
  get,
  type TeamWorld,
  teamWorld,
} from '../team/support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let other: Clinic;
let doctor: { cookie: string };
const REASON = 'تجربة الميزات والحدود في العيادة';

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_22, {
    controllers: [GatedProbeController],
    entitlements: TEST_ENTITLEMENTS,
    flags: TEST_FLAGS,
  });
  clinic = await world.clinic();
  other = await world.clinic();
  doctor = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
});

afterAll(async () => {
  await world.app.app.close();
});

const capabilities = (cookie: string) => get(world.app, '/clinic/capabilities', cookie);
const subscription = (cookie: string) => get(world.app, '/clinic/subscription', cookie);

async function override(c: Clinic, key: string, value: number | boolean) {
  const res = await put(
    world.app,
    `/platform/clinics/${c.clinicId}/overrides/${key}`,
    { value, reason: REASON },
    world.admin.cookie,
  );
  expect(res.statusCode, res.body).toBe(200);
}

describe('GET /clinic/capabilities (criterion 5)', () => {
  it('every member reads the features, the limits with use and the flags', async () => {
    for (const cookie of [clinic.owner.cookie, doctor.cookie]) {
      const res = await capabilities(cookie);
      expect(res.statusCode, res.body).toBe(200);
      expect(Capabilities.parse(res.json())).toEqual({
        entitlements: { 'test.feature': false, 'test.other_feature': false },
        limits: [
          { key: 'limits.practitioners', limit: 10, used: 1 },
          { key: 'limits.branches', limit: 1, used: 1 },
          { key: 'limits.custom_fields', limit: 20, used: 0 },
        ],
        flags: { 'test.flag_on': true, 'test.flag_off': false },
      });
    }
  });

  it('shows a change of the super admin at once, and use as it grows', async () => {
    await override(clinic, 'limits.practitioners', 2);
    await override(clinic, 'test.feature', true);
    const added = await addMember(world.app, clinic.owner.cookie, {
      phone: world.phone(),
      roles: [{ role: 'doctor', branchId: null }],
    });
    expect(added.res.statusCode).toBe(201);
    const body = Capabilities.parse((await capabilities(doctor.cookie)).json());
    expect(body.entitlements['test.feature']).toBe(true);
    expect(body.limits[0]).toEqual({ key: 'limits.practitioners', limit: 2, used: 2 });
    // Another clinic is untouched.
    const theirs = Capabilities.parse((await capabilities(other.owner.cookie)).json());
    expect(theirs.entitlements['test.feature']).toBe(false);
    expect(theirs.limits[0]).toEqual({ key: 'limits.practitioners', limit: 10, used: 0 });
  });

  it('anonymous: 401', async () => {
    expect(
      (await world.app.app.inject({ method: 'GET', url: '/clinic/capabilities' })).statusCode,
    ).toBe(401);
  });
});

describe('GET /clinic/subscription (criterion 6)', () => {
  it('the owner reads plan, status, end date, limits with use and enabled features', async () => {
    const res = await subscription(other.owner.cookie);
    expect(res.statusCode, res.body).toBe(200);
    expect(Subscription.parse(res.json())).toEqual({
      plan: 'multi_doctor',
      status: 'trial',
      subscriptionEnd: '2027-06-30',
      limits: [
        { key: 'limits.practitioners', limit: 10, used: 0 },
        { key: 'limits.branches', limit: 1, used: 1 },
        { key: 'limits.custom_fields', limit: 20, used: 0 },
      ],
      features: [],
    });
    await override(other, 'test.feature', true);
    const after = Subscription.parse((await subscription(other.owner.cookie)).json());
    expect(after.features).toEqual(['test.feature']);
  });

  it('any other member: 403 forbidden', async () => {
    const res = await subscription(doctor.cookie);
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('forbidden');
  });
});

describe('gated routes (criterion 5)', () => {
  it('a feature gate answers 403 feature_unavailable while off and 200 once on', async () => {
    const third = await world.clinic();
    const off = await get(world.app, '/__probe/entitled', third.owner.cookie);
    expect(off.statusCode).toBe(403);
    expect(ErrorEnvelope.parse(off.json()).error.code).toBe('feature_unavailable');
    await override(third, 'test.feature', true);
    expect((await get(world.app, '/__probe/entitled', third.owner.cookie)).statusCode).toBe(200);
  });

  it('a flag gate follows the flag for the clinic', async () => {
    expect((await get(world.app, '/__probe/flagged', clinic.owner.cookie)).statusCode).toBe(200);
    const off = await get(world.app, '/__probe/unflagged', clinic.owner.cookie);
    expect(off.statusCode).toBe(403);
    expect(errorCode(off)).toBe('feature_unavailable');
    const res = await put(
      world.app,
      '/platform/flags/test.flag_off',
      { mode: 'selected', clinicIds: [clinic.clinicId], reason: REASON },
      world.admin.cookie,
    );
    expect(res.statusCode, res.body).toBe(200);
    expect((await get(world.app, '/__probe/unflagged', clinic.owner.cookie)).statusCode).toBe(200);
    expect((await get(world.app, '/__probe/unflagged', other.owner.cookie)).statusCode).toBe(403);
    const flags = Capabilities.parse((await capabilities(doctor.cookie)).json()).flags;
    expect(flags['test.flag_off']).toBe(true);
  });

  it('the permission is checked before the gate', async () => {
    const receptionist = await activeMember(world, clinic, [
      { role: 'receptionist', branchId: null },
    ]);
    const res = await get(world.app, '/__probe/flagged', receptionist.cookie);
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('forbidden');
  });
});
