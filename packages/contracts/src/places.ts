// Cities and areas (A-02 criteria 15, 24; OD-113; slice A-02-06): platform places with Arabic
// names the super admin adds, renames, archives and restores (never deletes: ids stay). A branch
// gets an optional city and area; an archived one is not offered anew but stays on a branch that
// holds it. The counts on each place are numbers only, across every clinic, never names.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';
import { foldArabic } from './fold-arabic.ts';

/**
 * The key two place names are compared by (409 `place_name_taken`): the shared Arabic fold
 * (alef forms, final ة and ى, harakat, ASCII case), trimmed, runs of spaces as one. Stored beside
 * the name (`name_key`), unique among cities and among one city's areas, archived ones included.
 */
export function placeKey(name: string): string {
  return foldArabic(name).trim().replace(/\s+/gu, ' ');
}

/** How many non-archived branches hold the place, in how many clinics, with how many doctors. */
const placeCounts = {
  branchCount: z.int().min(0),
  clinicCount: z.int().min(0),
  /** Non-deactivated doctors in those branches, or clinic-wide in those clinics; once each. */
  doctorCount: z.int().min(0),
};

export const Area = z
  .object({
    id: z.uuid(),
    cityId: z.uuid(),
    name: z.string(),
    archivedAt: z.iso.datetime().nullable(),
    ...placeCounts,
  })
  .meta({ id: 'Area' });
export type Area = z.infer<typeof Area>;

export const City = z
  .object({
    id: z.uuid(),
    name: z.string(),
    archivedAt: z.iso.datetime().nullable(),
    ...placeCounts,
    /** Its areas by name; archived ones only with `includeArchived`. */
    areas: z.array(Area),
  })
  .meta({ id: 'City' });
export type City = z.infer<typeof City>;

export const CityList = z.object({ cities: z.array(City) }).meta({ id: 'CityList' });
export type CityList = z.infer<typeof CityList>;

export const CityListQuery = z
  .object({
    /** `true`: archived cities and areas too (Badge «مؤرشفة»); search runs on the client. */
    includeArchived: z.stringbool().optional(),
  })
  .meta({ id: 'CityListQuery' });

/**
 * A place's Arabic name as typed: 1 to 100 characters once trimmed, and something left once folded
 * (a lone tatweel or a direction mark folds to nothing: 400 on body.name, `custom`).
 */
export const PlaceNameRequest = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine((n) => placeKey(n).length > 0),
  })
  .meta({ id: 'PlaceNameRequest' });
export type PlaceNameRequest = z.infer<typeof PlaceNameRequest>;

export const CityIdParams = z.object({ id: z.uuid() }).meta({ id: 'CityIdParams' });
export const AreaIdParams = z.object({ id: z.uuid() }).meta({ id: 'AreaIdParams' });

/** A place as a clinic sees it: offered, or archived and still held by one of its branches. */
export const ClinicArea = z
  .object({ id: z.uuid(), name: z.string(), archived: z.boolean() })
  .meta({ id: 'ClinicArea' });
export type ClinicArea = z.infer<typeof ClinicArea>;

export const ClinicCity = z
  .object({ id: z.uuid(), name: z.string(), archived: z.boolean(), areas: z.array(ClinicArea) })
  .meta({ id: 'ClinicCity' });
export type ClinicCity = z.infer<typeof ClinicCity>;

export const ClinicPlaces = z.object({ cities: z.array(ClinicCity) }).meta({ id: 'ClinicPlaces' });
export type ClinicPlaces = z.infer<typeof ClinicPlaces>;

/** A branch's city or area (`archived`: Badge «منطقة مؤرشفة»). */
export const BranchPlace = z
  .object({ id: z.uuid(), name: z.string(), archived: z.boolean() })
  .meta({ id: 'BranchPlace' });
export type BranchPlace = z.infer<typeof BranchPlace>;

// 409 on a place: `place_name_taken` (the folded name among cities, or among the city's areas,
// archived included), `place_archived` (archive of an archived place), `place_not_archived`.

export const platformCities = defineContract({
  operationId: 'platformCities',
  method: 'GET',
  path: '/platform/cities',
  summary: 'Cities with their areas, and the counts of branches, clinics and doctors on each',
  request: { query: CityListQuery },
  responses: { 200: CityList },
});

export const platformCreateCity = defineContract({
  operationId: 'platformCreateCity',
  method: 'POST',
  path: '/platform/cities',
  summary: 'Add a city',
  request: { body: PlaceNameRequest },
  responses: { 201: City, 400: ErrorEnvelope, 409: ErrorEnvelope },
});

export const platformRenameCity = defineContract({
  operationId: 'platformRenameCity',
  method: 'PATCH',
  path: '/platform/cities/:id',
  summary: 'Rename a city',
  request: { params: CityIdParams, body: PlaceNameRequest },
  responses: { 200: City, 400: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const platformArchiveCity = defineContract({
  operationId: 'platformArchiveCity',
  method: 'POST',
  path: '/platform/cities/:id/archive',
  summary: 'Archive a city: no longer offered to branches; kept on branches that hold it',
  request: { params: CityIdParams },
  responses: { 200: City, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const platformRestoreCity = defineContract({
  operationId: 'platformRestoreCity',
  method: 'POST',
  path: '/platform/cities/:id/restore',
  summary: 'Restore an archived city: offered to branches again',
  request: { params: CityIdParams },
  responses: { 200: City, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const platformCreateArea = defineContract({
  operationId: 'platformCreateArea',
  method: 'POST',
  path: '/platform/cities/:id/areas',
  summary: 'Add an area to a city',
  request: { params: CityIdParams, body: PlaceNameRequest },
  responses: { 201: Area, 400: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const platformRenameArea = defineContract({
  operationId: 'platformRenameArea',
  method: 'PATCH',
  path: '/platform/areas/:id',
  summary: 'Rename an area',
  request: { params: AreaIdParams, body: PlaceNameRequest },
  responses: { 200: Area, 400: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const platformArchiveArea = defineContract({
  operationId: 'platformArchiveArea',
  method: 'POST',
  path: '/platform/areas/:id/archive',
  summary: 'Archive an area: no longer offered to branches; kept on branches that hold it',
  request: { params: AreaIdParams },
  responses: { 200: Area, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const platformRestoreArea = defineContract({
  operationId: 'platformRestoreArea',
  method: 'POST',
  path: '/platform/areas/:id/restore',
  summary: 'Restore an archived area: offered to branches again',
  request: { params: AreaIdParams },
  responses: { 200: Area, 404: ErrorEnvelope, 409: ErrorEnvelope },
});

export const clinicPlaces = defineContract({
  operationId: 'clinicPlaces',
  method: 'GET',
  path: '/clinic/places',
  summary:
    'Cities and areas a branch may take, and the archived ones a branch of this clinic holds',
  responses: { 200: ClinicPlaces },
});
