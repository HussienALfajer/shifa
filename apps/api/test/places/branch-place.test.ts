// A-02 criteria 10, 15, 18 and 24 (A-02-06; clinic web rows of `A02cBranchPlace`: the dialog's
// city and area, save, cards). A branch gets an optional city and area, the area in its city; an
// archived place is not offered and cannot be chosen anew (409 `place_archived`), but stays on the
// branch that holds it, marked archived. The super admin's list counts branches, clinics and
// doctors on each place across clinics. One tenant row `branch.place_changed` per change (ids
// only). The idle setting is still read from the cascade after tenant.idle_minutes went.
import { Branch, BranchList, CityList, ClinicPlaces, ErrorEnvelope } from '@shifa/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { put } from '../entitlements/support.ts';
import { testClock } from '../identity/support.ts';
import {
  activeMember,
  type Clinic,
  errorCode,
  get,
  patch,
  post,
  type TeamWorld,
  teamWorld,
  tenantAuditRows,
} from '../team/support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let other: Clinic;
let aleppo: string;
let azaz: string;
let shahba: string;
let jamiliyeh: string;
let hamdaniyeh: string;

const admin = () => world.admin.cookie;
async function adminPost(url: string, body?: unknown): Promise<{ id: string }> {
  const res = await post(world.app, url, body, admin());
  expect(res.statusCode, res.body).toBeLessThan(300);
  return res.json<{ id: string }>();
}

beforeAll(async () => {
  world = await teamWorld(clock, 2027_01_02, { clinicType: 'multi_branch' });
  clinic = await world.clinic();
  other = await world.clinic();
  aleppo = (await adminPost('/platform/cities', { name: 'حلب' })).id;
  azaz = (await adminPost('/platform/cities', { name: 'أعزاز' })).id;
  shahba = (await adminPost(`/platform/cities/${aleppo}/areas`, { name: 'الشهباء' })).id;
  jamiliyeh = (await adminPost(`/platform/cities/${aleppo}/areas`, { name: 'الجميلية' })).id;
  hamdaniyeh = (await adminPost(`/platform/cities/${aleppo}/areas`, { name: 'الحمدانية' })).id;
});

afterAll(async () => {
  await world.app.app.close();
});

const owner = (c: Clinic = clinic) => c.owner.cookie;
const places = async (c: Clinic = clinic) => {
  const res = await get(world.app, '/clinic/places', owner(c));
  expect(res.statusCode, res.body).toBe(200);
  return ClinicPlaces.parse(res.json()).cities;
};
const issues = (res: { json(): unknown }) => ErrorEnvelope.parse(res.json()).error.details;

describe('GET /clinic/places (rows `empty`, `city`, `areaTyping`)', () => {
  it('offers the live cities with their live areas, by name', async () => {
    const cities = await places();
    expect(cities).toEqual([
      { id: azaz, name: 'أعزاز', archived: false, areas: [] },
      {
        id: aleppo,
        name: 'حلب',
        archived: false,
        areas: [
          { id: jamiliyeh, name: 'الجميلية', archived: false },
          { id: hamdaniyeh, name: 'الحمدانية', archived: false },
          { id: shahba, name: 'الشهباء', archived: false },
        ],
      },
    ]);
  });

  it('is for the owner only (branches.manage)', async () => {
    const doctor = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    expect((await get(world.app, '/clinic/places', doctor.cookie)).statusCode).toBe(403);
  });
});

let branchId: string;

describe('POST and PATCH /branches with a place (row `save`)', () => {
  it('creates a branch in a city and area: the answer names both', async () => {
    const res = await post(
      world.app,
      '/branches',
      { name: 'فرع الشهباء', cityId: aleppo, areaId: shahba },
      owner(),
    );
    expect(res.statusCode, res.body).toBe(201);
    const created = Branch.parse(res.json());
    branchId = created.id;
    expect(created.city).toEqual({ id: aleppo, name: 'حلب', archived: false });
    expect(created.area).toEqual({ id: shahba, name: 'الشهباء', archived: false });
  });

  it('a branch with no place answers null for both («لم تُحدَّد المدينة»)', async () => {
    const res = await post(world.app, '/branches', { name: 'فرع بلا مدينة' }, owner());
    expect(Branch.parse(res.json())).toMatchObject({ city: null, area: null });
  });

  it('refuses an area of another city, or an area without a city (400 area_not_in_city)', async () => {
    const wrong = await post(
      world.app,
      '/branches',
      { name: 'فرع', cityId: azaz, areaId: shahba },
      owner(),
    );
    expect(wrong.statusCode).toBe(400);
    expect(issues(wrong)).toEqual([{ path: 'body.areaId', code: 'area_not_in_city' }]);
    const alone = await patch(world.app, `/branches/${branchId}`, { cityId: null }, owner());
    expect(alone.statusCode).toBe(400);
    expect(issues(alone)).toEqual([{ path: 'body.areaId', code: 'area_not_in_city' }]);
  });

  it('refuses an unknown city or area (400)', async () => {
    const unknown = '00000000-0000-4000-8000-000000000002';
    const city = await post(world.app, '/branches', { name: 'فرع', cityId: unknown }, owner());
    expect(issues(city)).toEqual([{ path: 'body.cityId', code: 'invalid_value' }]);
    const area = await patch(world.app, `/branches/${branchId}`, { areaId: unknown }, owner());
    expect(issues(area)).toEqual([{ path: 'body.areaId', code: 'invalid_value' }]);
  });

  it('moves a branch to another area, and clears its place with nulls', async () => {
    const moved = await patch(world.app, `/branches/${branchId}`, { areaId: jamiliyeh }, owner());
    expect(moved.statusCode, moved.body).toBe(200);
    expect(Branch.parse(moved.json()).area?.id).toBe(jamiliyeh);
    const cleared = await patch(
      world.app,
      `/branches/${branchId}`,
      { cityId: null, areaId: null },
      owner(),
    );
    expect(Branch.parse(cleared.json())).toMatchObject({ city: null, area: null });
    const back = await patch(
      world.app,
      `/branches/${branchId}`,
      { cityId: aleppo, areaId: shahba },
      owner(),
    );
    expect(Branch.parse(back.json()).area?.id).toBe(shahba);
  });

  it('audits each change of place once, ids only', async () => {
    const rows = (await tenantAuditRows(clinic.clinicId)).filter(
      (r) => r.event === 'branch.place_changed',
    );
    expect(rows.map((r) => r.data)).toEqual([
      { cityId: aleppo, areaId: shahba },
      { cityId: aleppo, areaId: jamiliyeh },
      { cityId: null, areaId: null },
      { cityId: aleppo, areaId: shahba },
    ]);
    for (const row of rows) expect(row.targetId).toBe(branchId);
    // A rename alone writes no place row.
    await patch(world.app, `/branches/${branchId}`, { name: 'فرع الشهباء الكبير' }, owner());
    const after = (await tenantAuditRows(clinic.clinicId)).filter(
      (r) => r.event === 'branch.place_changed',
    );
    expect(after).toHaveLength(4);
  });
});

describe('archived places (rows `archivedValue`, `cards`)', () => {
  it('an archived area stays on the branch that holds it, marked archived', async () => {
    await adminPost(`/platform/areas/${shahba}/archive`);
    const list = BranchList.parse((await get(world.app, '/branches', owner())).json());
    const held = list.active.find((b) => b.id === branchId);
    expect(held?.area).toEqual({ id: shahba, name: 'الشهباء', archived: true });
    // Kept on a save that leaves it or names it again.
    const kept = await patch(
      world.app,
      `/branches/${branchId}`,
      { cityId: aleppo, areaId: shahba, address: 'شارع الشهباء' },
      owner(),
    );
    expect(kept.statusCode, kept.body).toBe(200);
  });

  it('is offered only to the clinic whose branch holds it, marked archived', async () => {
    const mine = (await places()).find((c) => c.id === aleppo);
    expect(mine?.areas.find((a) => a.id === shahba)).toEqual({
      id: shahba,
      name: 'الشهباء',
      archived: true,
    });
    const theirs = (await places(other)).find((c) => c.id === aleppo);
    expect(theirs?.areas.map((a) => a.id)).not.toContain(shahba);
  });

  it('cannot be chosen anew for any branch (409 place_archived, `place: area`)', async () => {
    const res = await post(
      world.app,
      '/branches',
      { name: 'فرع جديد', cityId: aleppo, areaId: shahba },
      owner(),
    );
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('place_archived');
    expect(ErrorEnvelope.parse(res.json()).error.place).toBe('area');
    const theirs = await post(
      world.app,
      '/branches',
      { name: 'فرع', cityId: aleppo, areaId: shahba },
      owner(other),
    );
    expect(errorCode(theirs)).toBe('place_archived');
  });

  it('an archived city the same way (`place: city`); restored, it is offered again', async () => {
    await adminPost(`/platform/cities/${azaz}/archive`);
    const res = await post(world.app, '/branches', { name: 'فرع أعزاز', cityId: azaz }, owner());
    expect(ErrorEnvelope.parse(res.json()).error).toMatchObject({
      code: 'place_archived',
      place: 'city',
    });
    expect((await places()).map((c) => c.id)).not.toContain(azaz);
    await adminPost(`/platform/cities/${azaz}/restore`);
    expect((await places()).map((c) => c.id)).toContain(azaz);
    const created = await post(
      world.app,
      '/branches',
      { name: 'فرع أعزاز', cityId: azaz },
      owner(),
    );
    expect(created.statusCode, created.body).toBe(201);
  });
});

describe('counts on the super admin’s list (criterion 24)', () => {
  it('counts non-archived branches, their clinics and doctors, numbers only', async () => {
    await activeMember(world, clinic, [{ role: 'doctor', branchId }]);
    await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    const theirs = await post(
      world.app,
      '/branches',
      { name: 'فرع الحمدانية', cityId: aleppo, areaId: hamdaniyeh },
      owner(other),
    );
    expect(theirs.statusCode, theirs.body).toBe(201);
    const res = await get(world.app, '/platform/cities?includeArchived=true', admin());
    const cities = CityList.parse(res.json()).cities;
    const city = cities.find((c) => c.id === aleppo);
    // Two clinics hold Aleppo: this one's branch and the other's.
    expect(city).toMatchObject({ branchCount: 2, clinicCount: 2 });
    // This clinic: the branch doctor and two clinic-wide doctors (one from the access test above);
    // the other clinic has none.
    expect(city?.doctorCount).toBe(3);
    expect(city?.areas.find((a) => a.id === shahba)).toMatchObject({
      archivedAt: expect.any(String) as unknown,
      branchCount: 1,
      clinicCount: 1,
      doctorCount: 3,
    });
    expect(city?.areas.find((a) => a.id === hamdaniyeh)).toMatchObject({
      branchCount: 1,
      clinicCount: 1,
      doctorCount: 0,
    });
    expect(JSON.stringify(city)).not.toContain('فرع');
  });
});

describe('the idle setting after the column drop (criterion 10)', () => {
  it('is still read and written through the cascade, and locked by the super admin', async () => {
    const set = await patch(world.app, '/clinic/settings', { idleMinutes: 60 }, owner());
    expect(set.json()).toEqual({ idleMinutes: 60, source: 'organization', locked: false });
    const lock = await put(
      world.app,
      `/platform/clinics/${clinic.clinicId}/settings/session.idle_minutes/lock`,
      { value: 15 },
      admin(),
    );
    expect(lock.statusCode, lock.body).toBe(200);
    const read = await get(world.app, '/clinic/settings', owner());
    expect(read.json()).toEqual({ idleMinutes: 15, source: 'organization', locked: true });
  });
});
