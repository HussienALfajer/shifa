// A clinic's view of the places (A-02 criterion 15; rows `A02cBranchPlace`), in the clinic's own
// transaction (shifa_app, RLS holds `branch` to the clinic): what the branch dialog offers, the
// city and area a branch save leads to (an area in its city; an archived place kept only where the
// branch already holds it) and each branch's place by name for its card.
import {
  type BranchPlace,
  type ClinicCity,
  type ClinicPlaces,
  type PlaceKind,
} from '@shifa/contracts';
import { area, branch, city, type Tx } from '@shifa/db';
import { inArray, isNotNull, isNull, or } from 'drizzle-orm';
import { RequestValidationError } from '../../platform/contract/index.ts';
import { ApiError } from '../../platform/errors.ts';

export interface PlaceIds {
  cityId: string | null;
  areaId: string | null;
}

export interface PlaceInput {
  cityId?: string | null | undefined;
  areaId?: string | null | undefined;
}

const byName = (a: { nameKey: string }, b: { nameKey: string }) =>
  a.nameKey < b.nameKey ? -1 : a.nameKey > b.nameKey ? 1 : 0;

/** Live cities and areas, and the archived ones a branch of this clinic holds (marked). */
export async function clinicPlaces(tx: Tx): Promise<ClinicPlaces> {
  const held = await tx
    .select({ cityId: branch.cityId, areaId: branch.areaId })
    .from(branch)
    .where(or(isNotNull(branch.cityId), isNotNull(branch.areaId)));
  const heldCities = [...new Set(held.flatMap((h) => (h.cityId ? [h.cityId] : [])))];
  const heldAreas = [...new Set(held.flatMap((h) => (h.areaId ? [h.areaId] : [])))];
  const cities = (
    await tx
      .select()
      .from(city)
      .where(
        heldCities.length > 0
          ? or(isNull(city.archivedAt), inArray(city.id, heldCities))
          : isNull(city.archivedAt),
      )
  ).sort(byName);
  const ids = cities.map((c) => c.id);
  const areas =
    ids.length === 0
      ? []
      : (await tx.select().from(area).where(inArray(area.cityId, ids)))
          .filter((a) => a.archivedAt === null || heldAreas.includes(a.id))
          .sort(byName);
  return {
    cities: cities.map(
      (c): ClinicCity => ({
        id: c.id,
        name: c.name,
        archived: c.archivedAt !== null,
        areas: areas
          .filter((a) => a.cityId === c.id)
          .map((a) => ({ id: a.id, name: a.name, archived: a.archivedAt !== null })),
      }),
    ),
  };
}

const placeArchived = (place: PlaceKind) =>
  new ApiError(409, 'place_archived', undefined, undefined, undefined, undefined, undefined, place);

/**
 * The city and area a branch save leaves it with, or `undefined` when the input names neither.
 * 400 on body.cityId / body.areaId for an unknown place, `area_not_in_city` for an area outside the
 * city (or without one); 409 `place_archived` for an archived place the branch does not hold yet.
 */
export async function nextBranchPlace(
  tx: Tx,
  current: PlaceIds | null,
  input: PlaceInput,
): Promise<PlaceIds | undefined> {
  if (input.cityId === undefined && input.areaId === undefined) return undefined;
  const next: PlaceIds = {
    cityId:
      input.cityId === undefined
        ? (current?.cityId ?? null)
        : (input.cityId?.toLowerCase() ?? null),
    areaId:
      input.areaId === undefined
        ? (current?.areaId ?? null)
        : (input.areaId?.toLowerCase() ?? null),
  };
  const [cityRow] = next.cityId
    ? await tx
        .select()
        .from(city)
        .where(inArray(city.id, [next.cityId]))
    : [];
  if (next.cityId && !cityRow) {
    throw new RequestValidationError([{ path: 'body.cityId', code: 'invalid_value' }]);
  }
  const [areaRow] = next.areaId
    ? await tx
        .select()
        .from(area)
        .where(inArray(area.id, [next.areaId]))
    : [];
  if (next.areaId && !areaRow) {
    throw new RequestValidationError([{ path: 'body.areaId', code: 'invalid_value' }]);
  }
  if (areaRow && areaRow.cityId !== next.cityId) {
    throw new RequestValidationError([{ path: 'body.areaId', code: 'area_not_in_city' }]);
  }
  if (cityRow?.archivedAt && cityRow.id !== current?.cityId) throw placeArchived('city');
  if (areaRow?.archivedAt && areaRow.id !== current?.areaId) throw placeArchived('area');
  return next;
}

/** Each branch's city and area by name, archived ones marked, for `rows`. */
export async function branchPlaces(
  tx: Tx,
  rows: readonly PlaceIds[],
): Promise<(row: PlaceIds) => { city: BranchPlace | null; area: BranchPlace | null }> {
  const cityIds = [...new Set(rows.flatMap((r) => (r.cityId ? [r.cityId] : [])))];
  const areaIds = [...new Set(rows.flatMap((r) => (r.areaId ? [r.areaId] : [])))];
  const cities = cityIds.length
    ? await tx.select().from(city).where(inArray(city.id, cityIds))
    : [];
  const areas = areaIds.length ? await tx.select().from(area).where(inArray(area.id, areaIds)) : [];
  const view = (p: { id: string; name: string; archivedAt: Date | null } | undefined) =>
    p ? { id: p.id, name: p.name, archived: p.archivedAt !== null } : null;
  return (row) => ({
    city: view(cities.find((c) => c.id === row.cityId)),
    area: view(areas.find((a) => a.id === row.areaId)),
  });
}
