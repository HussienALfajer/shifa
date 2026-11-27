// A-02 criteria 15, 18 and 24 (A-02-06; contract rows of `A02Cities`: list, add, rename, archive,
// restore). The super admin adds, renames, archives and restores cities and areas with Arabic
// names; a folded name already used among the cities, or among one city's areas (archived ones
// included), answers 409 `place_name_taken`; nothing is ever deleted (no route). The list leaves
// archived places out unless asked, and carries on each place the counts of branches, clinics and
// doctors, numbers only. One platform audit row per change, ids only, never a name.
import { Area, City, CityList, ErrorEnvelope, placeKey } from '@shifa/contracts';
import { auditEvent } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { errorCode, get, patch, post, type TeamWorld, teamWorld } from '../team/support.ts';

const clock = testClock();
let world: TeamWorld;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_31, { clinicType: 'multi_branch' });
});

afterAll(async () => {
  await world.app.app.close();
});

const admin = () => world.admin.cookie;
const list = async (includeArchived?: boolean) => {
  const query = includeArchived === undefined ? '' : `?includeArchived=${String(includeArchived)}`;
  const res = await get(world.app, `/platform/cities${query}`, admin());
  expect(res.statusCode, res.body).toBe(200);
  return CityList.parse(res.json()).cities;
};
async function addCity(name: string): Promise<City> {
  const res = await post(world.app, '/platform/cities', { name }, admin());
  expect(res.statusCode, res.body).toBe(201);
  return City.parse(res.json());
}
async function addArea(cityId: string, name: string): Promise<Area> {
  const res = await post(world.app, `/platform/cities/${cityId}/areas`, { name }, admin());
  expect(res.statusCode, res.body).toBe(201);
  return Area.parse(res.json());
}
const issues = (res: { json(): unknown }) => ErrorEnvelope.parse(res.json()).error.details;
const placeAudit = () =>
  superuserDb(workerDatabaseName())
    .select()
    .from(auditEvent)
    .where(
      inArray(auditEvent.event, [
        'city.created',
        'city.renamed',
        'city.archived',
        'city.restored',
        'area.created',
        'area.renamed',
        'area.archived',
        'area.restored',
      ]),
    )
    .orderBy(auditEvent.at);

let aleppo: City;
let shahba: Area;

describe('GET /platform/cities (row `list`, `empty`)', () => {
  it('answers `cities: []` before any place exists', async () => {
    expect(await list()).toEqual([]);
  });
});

describe('add (row `add`, criterion 15)', () => {
  it('adds a city and its areas, trimmed, with zero counts', async () => {
    aleppo = await addCity('  حلب ');
    expect(aleppo).toEqual({
      id: aleppo.id,
      name: 'حلب',
      archivedAt: null,
      branchCount: 0,
      clinicCount: 0,
      doctorCount: 0,
      areas: [],
    });
    shahba = await addArea(aleppo.id, 'الشهباء');
    expect(shahba).toEqual({
      id: shahba.id,
      cityId: aleppo.id,
      name: 'الشهباء',
      archivedAt: null,
      branchCount: 0,
      clinicCount: 0,
      doctorCount: 0,
    });
    await addArea(aleppo.id, 'الجميلية');
    const cities = await list();
    expect(cities.map((c) => c.name)).toEqual(['حلب']);
    expect(cities[0]?.areas.map((a) => a.name)).toEqual(['الجميلية', 'الشهباء']);
  });

  it('refuses an empty or over-long name (400 body.name)', async () => {
    for (const name of ['', '   ', 'م'.repeat(101)]) {
      const res = await post(world.app, '/platform/cities', { name }, admin());
      expect(res.statusCode, name).toBe(400);
      expect(issues(res)?.[0]?.path).toBe('body.name');
    }
  });

  it('refuses a folded name already taken (409 place_name_taken), not across cities', async () => {
    // «الجميليه» folds like «الجميلية»; «حَلَب» like «حلب».
    const dupArea = await post(
      world.app,
      `/platform/cities/${aleppo.id}/areas`,
      { name: 'الجميليه' },
      admin(),
    );
    expect(dupArea.statusCode).toBe(409);
    expect(errorCode(dupArea)).toBe('place_name_taken');
    const dupCity = await post(world.app, '/platform/cities', { name: 'حَلَب' }, admin());
    expect(errorCode(dupCity)).toBe('place_name_taken');
    // The same area name in another city is allowed.
    const azaz = await addCity('أعزاز');
    await addArea(azaz.id, 'الشهباء');
  });

  it('answers 404 for the areas of an unknown city', async () => {
    const res = await post(
      world.app,
      '/platform/cities/00000000-0000-4000-8000-000000000000/areas',
      { name: 'منطقة' },
      admin(),
    );
    expect(res.statusCode).toBe(404);
  });
});

describe('rename (row `rename`)', () => {
  it('renames a city and an area', async () => {
    const city = await addCity('منبج');
    const renamed = await patch(
      world.app,
      `/platform/cities/${city.id}`,
      { name: 'منبج الكبرى' },
      admin(),
    );
    expect(renamed.statusCode, renamed.body).toBe(200);
    expect(City.parse(renamed.json()).name).toBe('منبج الكبرى');
    const area = await patch(
      world.app,
      `/platform/areas/${shahba.id}`,
      { name: 'الشهباء الجديدة' },
      admin(),
    );
    expect(area.statusCode, area.body).toBe(200);
    expect(Area.parse(area.json())).toMatchObject({ id: shahba.id, name: 'الشهباء الجديدة' });
  });

  it('keeps its own name in another spelling; refuses another place’s (409)', async () => {
    const same = await patch(world.app, `/platform/cities/${aleppo.id}`, { name: 'حَلَب' }, admin());
    expect(same.statusCode, same.body).toBe(200);
    const taken = await patch(
      world.app,
      `/platform/cities/${aleppo.id}`,
      { name: 'اعزاز' },
      admin(),
    );
    expect(errorCode(taken)).toBe('place_name_taken');
  });

  it('answers 404 for an unknown place', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(
      (await patch(world.app, `/platform/cities/${id}`, { name: 'س' }, admin())).statusCode,
    ).toBe(404);
    expect(
      (await patch(world.app, `/platform/areas/${id}`, { name: 'س' }, admin())).statusCode,
    ).toBe(404);
  });
});

describe('archive and restore (rows `archiveAsk`, `restored`, `archived`)', () => {
  it('archives an area: left out of the list unless asked, kept with includeArchived', async () => {
    const res = await post(world.app, `/platform/areas/${shahba.id}/archive`, undefined, admin());
    expect(res.statusCode, res.body).toBe(200);
    expect(Area.parse(res.json()).archivedAt).toBe(clock.now().toISOString());
    const live = (await list()).find((c) => c.id === aleppo.id);
    expect(live?.areas.map((a) => a.id)).not.toContain(shahba.id);
    const all = (await list(true)).find((c) => c.id === aleppo.id);
    expect(all?.areas.find((a) => a.id === shahba.id)?.archivedAt).not.toBeNull();
    const again = await post(world.app, `/platform/areas/${shahba.id}/archive`, undefined, admin());
    expect(again.statusCode).toBe(409);
    expect(errorCode(again)).toBe('place_archived');
  });

  it('an archived name stays taken (409 place_name_taken)', async () => {
    const res = await post(
      world.app,
      `/platform/cities/${aleppo.id}/areas`,
      { name: 'الشهباء الجديده' },
      admin(),
    );
    expect(errorCode(res)).toBe('place_name_taken');
  });

  it('restores it: offered again; restoring a live place is 409 place_not_archived', async () => {
    const res = await post(world.app, `/platform/areas/${shahba.id}/restore`, undefined, admin());
    expect(res.statusCode, res.body).toBe(200);
    expect(Area.parse(res.json()).archivedAt).toBeNull();
    expect((await list()).find((c) => c.id === aleppo.id)?.areas.map((a) => a.id)).toContain(
      shahba.id,
    );
    const again = await post(world.app, `/platform/areas/${shahba.id}/restore`, undefined, admin());
    expect(again.statusCode).toBe(409);
    expect(errorCode(again)).toBe('place_not_archived');
  });

  it('archives and restores a city the same way', async () => {
    const city = await addCity('الباب');
    const archived = await post(
      world.app,
      `/platform/cities/${city.id}/archive`,
      undefined,
      admin(),
    );
    expect(archived.statusCode, archived.body).toBe(200);
    expect((await list()).map((c) => c.id)).not.toContain(city.id);
    expect((await list(true)).find((c) => c.id === city.id)?.archivedAt).not.toBeNull();
    expect(
      errorCode(await post(world.app, `/platform/cities/${city.id}/archive`, undefined, admin())),
    ).toBe('place_archived');
    const restored = await post(
      world.app,
      `/platform/cities/${city.id}/restore`,
      undefined,
      admin(),
    );
    expect(City.parse(restored.json()).archivedAt).toBeNull();
    expect(
      errorCode(await post(world.app, `/platform/cities/${city.id}/restore`, undefined, admin())),
    ).toBe('place_not_archived');
  });
});

describe('never deleted (criterion 15)', () => {
  it('has no DELETE route for a city or an area', async () => {
    for (const url of [`/platform/cities/${aleppo.id}`, `/platform/areas/${shahba.id}`]) {
      const res = await world.app.app.inject({
        method: 'DELETE',
        url,
        headers: { cookie: admin() },
      });
      expect(res.statusCode, url).toBe(404);
    }
    expect(world.app.routes.some((r) => r.startsWith('DELETE /platform/cities'))).toBe(false);
    expect(world.app.routes.some((r) => r.startsWith('DELETE /platform/areas'))).toBe(false);
  });
});

describe('audit (criterion 18)', () => {
  it('one platform row per change, ids only, never a name', async () => {
    const rows = await placeAudit();
    const events = rows.map((r) => r.event);
    for (const event of [
      'city.created',
      'city.renamed',
      'city.archived',
      'city.restored',
      'area.created',
      'area.renamed',
      'area.archived',
      'area.restored',
    ]) {
      expect(events, event).toContain(event);
    }
    // Refused changes write nothing: two cities and four areas were added in all.
    expect(events.filter((e) => e === 'city.created')).toHaveLength(4);
    expect(events.filter((e) => e === 'area.created')).toHaveLength(3);
    for (const row of rows) {
      expect(row.tenantId).toBeNull();
      expect(row.targetId).toMatch(/^[0-9a-f-]{36}$/);
      expect(JSON.stringify(row.data)).not.toMatch(/[؀-ۿ]/u);
    }
    const areaRow = rows.find((r) => r.event === 'area.created');
    expect(areaRow?.data).toEqual({ cityId: aleppo.id });
  });

  it('a list is audited too (city.listed)', async () => {
    const rows = await superuserDb(workerDatabaseName())
      .select()
      .from(auditEvent)
      .where(inArray(auditEvent.event, ['city.listed']));
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('the shared fold (contract: the same as Combobox)', () => {
  it('placeKey folds alef forms, final ة and ى, harakat and spaces', () => {
    expect(placeKey(' الأشرفيّة  الجديدة ')).toBe('الاشرفيه الجديده');
    expect(placeKey('مصطفى')).toBe(placeKey('مصطفي'));
  });
});
