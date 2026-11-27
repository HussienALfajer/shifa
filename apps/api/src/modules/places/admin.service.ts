// The super admin's places (A-02 criteria 15, 18, 24; contract rows of `A02Cities`): cities and
// their areas listed with counts, added, renamed, archived and restored, never deleted. Each call is
// one withPlatformAdmin() transaction with its audit row (ids only; names stay on the rows). Place
// writes run one at a time (a transaction lock), so the folded-name check cannot race. The counts
// come from place_counts() (integers only, ADR-0051): the platform role reads no branch or member.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Area, type City, type CityList, placeKey } from '@shifa/contracts';
import {
  area,
  city,
  NO_PLACE_COUNTS,
  type PlaceCounts,
  type PlatformDb,
  type PlatformEvent,
  type PlatformTx,
  placeCounts,
} from '@shifa/db';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { Principal } from '../../access/index.ts';
import { CLOCK, type Clock } from '../../platform/clock.ts';
import { ApiError } from '../../platform/errors.ts';
import { PLACES_PLATFORM_DB } from './tokens.ts';

type CityRow = typeof city.$inferSelect;
type AreaRow = typeof area.$inferSelect;
type Change = 'renamed' | 'archived' | 'restored';

const byKey = (a: { nameKey: string }, b: { nameKey: string }) =>
  a.nameKey < b.nameKey ? -1 : a.nameKey > b.nameKey ? 1 : 0;
const nameTaken = () => new ApiError(409, 'place_name_taken');

@Injectable()
export class PlacesAdmin {
  constructor(
    @Inject(PLACES_PLATFORM_DB) private readonly platformDb: PlatformDb,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  list(principal: Principal, includeArchived: boolean, requestId: string): Promise<CityList> {
    return this.#run(principal, 'city.listed', requestId, undefined, async (tx) => {
      const cities = await tx
        .select()
        .from(city)
        .where(includeArchived ? undefined : isNull(city.archivedAt));
      return { cities: await cityViews(tx, cities.sort(byKey), includeArchived) };
    });
  }

  createCity(principal: Principal, name: string, requestId: string): Promise<City> {
    return this.#run(principal, 'city.created', requestId, undefined, async (tx, target) => {
      const key = placeKey(name);
      await assertCityNameFree(tx, key);
      const now = this.clock.now();
      const [row] = await tx
        .insert(city)
        .values({ name: name.trim(), nameKey: key, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error('city not written');
      target(row.id);
      return oneCity(await cityViews(tx, [row], false));
    });
  }

  createArea(principal: Principal, cityId: string, name: string, requestId: string): Promise<Area> {
    const id = cityId.toLowerCase();
    const data = { cityId: id };
    return this.#run(principal, 'area.created', requestId, data, async (tx, target) => {
      const [parent] = await tx.select({ id: city.id }).from(city).where(eq(city.id, id));
      if (!parent) throw new NotFoundException();
      const key = placeKey(name);
      await assertAreaNameFree(tx, id, key);
      const now = this.clock.now();
      const [row] = await tx
        .insert(area)
        .values({ cityId: id, name: name.trim(), nameKey: key, createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error('area not written');
      target(row.id);
      return areaView(row, (await placeCounts(tx, 'area', [row.id])).get(row.id));
    });
  }

  renameCity(principal: Principal, id: string, name: string, requestId: string): Promise<City> {
    return this.#changeCity(principal, id, 'renamed', requestId, async (tx, row) => {
      const key = placeKey(name);
      await assertCityNameFree(tx, key, row.id);
      return { name: name.trim(), nameKey: key };
    });
  }

  archiveCity(principal: Principal, id: string, requestId: string): Promise<City> {
    return this.#changeCity(principal, id, 'archived', requestId, (_tx, row) => {
      if (row.archivedAt) throw new ApiError(409, 'place_archived');
      return { archivedAt: this.clock.now() };
    });
  }

  restoreCity(principal: Principal, id: string, requestId: string): Promise<City> {
    return this.#changeCity(principal, id, 'restored', requestId, (_tx, row) => {
      if (!row.archivedAt) throw new ApiError(409, 'place_not_archived');
      return { archivedAt: null };
    });
  }

  renameArea(principal: Principal, id: string, name: string, requestId: string): Promise<Area> {
    return this.#changeArea(principal, id, 'renamed', requestId, async (tx, row) => {
      const key = placeKey(name);
      await assertAreaNameFree(tx, row.cityId, key, row.id);
      return { name: name.trim(), nameKey: key };
    });
  }

  archiveArea(principal: Principal, id: string, requestId: string): Promise<Area> {
    return this.#changeArea(principal, id, 'archived', requestId, (_tx, row) => {
      if (row.archivedAt) throw new ApiError(409, 'place_archived');
      return { archivedAt: this.clock.now() };
    });
  }

  restoreArea(principal: Principal, id: string, requestId: string): Promise<Area> {
    return this.#changeArea(principal, id, 'restored', requestId, (_tx, row) => {
      if (!row.archivedAt) throw new ApiError(409, 'place_not_archived');
      return { archivedAt: null };
    });
  }

  #changeCity(
    principal: Principal,
    rawId: string,
    change: Change,
    requestId: string,
    patch: (tx: PlatformTx, row: CityRow) => Partial<CityRow> | Promise<Partial<CityRow>>,
  ): Promise<City> {
    const id = rawId.toLowerCase();
    return this.#run(principal, `city.${change}`, requestId, undefined, async (tx, target) => {
      const [row] = await tx.select().from(city).where(eq(city.id, id)).for('update');
      if (!row) throw new NotFoundException();
      target(row.id);
      const set = await patch(tx, row);
      const [changed] = await tx
        .update(city)
        .set({ ...set, updatedAt: this.clock.now() })
        .where(eq(city.id, id))
        .returning();
      if (!changed) throw new NotFoundException();
      return oneCity(await cityViews(tx, [changed], false));
    });
  }

  #changeArea(
    principal: Principal,
    rawId: string,
    change: Change,
    requestId: string,
    patch: (tx: PlatformTx, row: AreaRow) => Partial<AreaRow> | Promise<Partial<AreaRow>>,
  ): Promise<Area> {
    const id = rawId.toLowerCase();
    return this.#run(
      principal,
      `area.${change}`,
      requestId,
      undefined,
      async (tx, target, data) => {
        const [row] = await tx.select().from(area).where(eq(area.id, id)).for('update');
        if (!row) throw new NotFoundException();
        target(row.id);
        data({ cityId: row.cityId });
        const set = await patch(tx, row);
        const [changed] = await tx
          .update(area)
          .set({ ...set, updatedAt: this.clock.now() })
          .where(eq(area.id, id))
          .returning();
        if (!changed) throw new NotFoundException();
        return areaView(changed, (await placeCounts(tx, 'area', [changed.id])).get(changed.id));
      },
    );
  }

  #run<T>(
    principal: Principal,
    event: PlatformEvent,
    requestId: string,
    data: Record<string, string> | undefined,
    fn: (
      tx: PlatformTx,
      target: (id: string) => void,
      data: (more: Record<string, string>) => void,
    ) => Promise<T>,
  ): Promise<T> {
    return this.platformDb.withPlatformAdmin(
      { actorId: principal.userId, event, requestId, ...(data ? { data } : {}) },
      async (tx, audit) => {
        // Place writes one at a time: the folded-name checks below never race (reads need none).
        if (event !== 'city.listed') {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('shifa.places', 0))`);
        }
        return fn(
          tx,
          (id) => {
            audit.setTarget(id);
          },
          (more) => {
            audit.setData(more);
          },
        );
      },
    );
  }
}

async function assertCityNameFree(tx: PlatformTx, key: string, self?: string): Promise<void> {
  const [taken] = await tx
    .select({ id: city.id })
    .from(city)
    .where(and(eq(city.nameKey, key), self ? ne(city.id, self) : undefined));
  if (taken) throw nameTaken();
}

async function assertAreaNameFree(
  tx: PlatformTx,
  cityId: string,
  key: string,
  self?: string,
): Promise<void> {
  const [taken] = await tx
    .select({ id: area.id })
    .from(area)
    .where(
      and(eq(area.cityId, cityId), eq(area.nameKey, key), self ? ne(area.id, self) : undefined),
    );
  if (taken) throw nameTaken();
}

/** The cities with their areas (archived ones only with `includeArchived`) and every count. */
async function cityViews(
  tx: PlatformTx,
  cities: readonly CityRow[],
  includeArchived: boolean,
): Promise<City[]> {
  if (cities.length === 0) return [];
  const ids = cities.map((c) => c.id);
  const areas = (
    await tx
      .select()
      .from(area)
      .where(and(inArray(area.cityId, ids), includeArchived ? undefined : isNull(area.archivedAt)))
  ).sort(byKey);
  const cityCounts = await placeCounts(tx, 'city', ids);
  const areaCounts = await placeCounts(
    tx,
    'area',
    areas.map((a) => a.id),
  );
  return cities.map((c) => ({
    id: c.id,
    name: c.name,
    archivedAt: c.archivedAt?.toISOString() ?? null,
    ...(cityCounts.get(c.id) ?? NO_PLACE_COUNTS),
    areas: areas.filter((a) => a.cityId === c.id).map((a) => areaView(a, areaCounts.get(a.id))),
  }));
}

function oneCity(views: readonly City[]): City {
  const [view] = views;
  if (!view) throw new Error('city view missing');
  return view;
}

function areaView(row: AreaRow, counts: PlaceCounts | undefined): Area {
  return {
    id: row.id,
    cityId: row.cityId,
    name: row.name,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    ...(counts ?? NO_PLACE_COUNTS),
  };
}
