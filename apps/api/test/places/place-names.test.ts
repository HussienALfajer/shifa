// Review of A-02-06: a place name that folds to nothing (a lone tatweel, a direction mark) answers
// 400 `validation_failed` on body.name for a city and an area, on add and on rename, instead of
// reaching the name_key check (500). Nothing is written.
import { City, ErrorEnvelope } from '@shifa/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { get, patch, post, type TeamWorld, teamWorld } from '../team/support.ts';

const clock = testClock();
let world: TeamWorld;
let cityId: string;
let areaId: string;

const EMPTY_FOLDS = ['ـ', '‏', ' ـ‎ـ '];

beforeAll(async () => {
  world = await teamWorld(clock, 2027_01_05);
  const city = await post(world.app, '/platform/cities', { name: 'منبج' }, world.admin.cookie);
  cityId = City.parse(city.json()).id;
  const area = await post(
    world.app,
    `/platform/cities/${cityId}/areas`,
    { name: 'الحزاونة' },
    world.admin.cookie,
  );
  areaId = area.json<{ id: string }>().id;
});

afterAll(async () => {
  await world.app.app.close();
});

function expectNameRefused(res: { statusCode: number; json(): unknown }, name: string) {
  expect(res.statusCode, JSON.stringify(name)).toBe(400);
  expect(ErrorEnvelope.parse(res.json()).error).toMatchObject({
    code: 'validation_failed',
    details: [{ path: 'body.name', code: 'custom' }],
  });
}

describe('a name that folds to nothing (400 body.name)', () => {
  it('is refused for a new city or area', async () => {
    for (const name of EMPTY_FOLDS) {
      expectNameRefused(
        await post(world.app, '/platform/cities', { name }, world.admin.cookie),
        name,
      );
      expectNameRefused(
        await post(world.app, `/platform/cities/${cityId}/areas`, { name }, world.admin.cookie),
        name,
      );
    }
  });

  it('is refused for a rename of a city or area', async () => {
    for (const name of EMPTY_FOLDS) {
      expectNameRefused(
        await patch(world.app, `/platform/cities/${cityId}`, { name }, world.admin.cookie),
        name,
      );
      expectNameRefused(
        await patch(world.app, `/platform/areas/${areaId}`, { name }, world.admin.cookie),
        name,
      );
    }
  });

  it('wrote nothing', async () => {
    const res = await get(world.app, '/platform/cities', world.admin.cookie);
    expect(res.json()).toMatchObject({
      cities: [{ id: cityId, name: 'منبج', areas: [{ id: areaId, name: 'الحزاونة' }] }],
    });
  });
});
