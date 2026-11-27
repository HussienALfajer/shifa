// The fake server's routes of admin web's flags, announcements, cities and areas (A-02-09),
// answered as packages/contracts/src/flags.ts, announcements.ts and places.ts say: every flag, set
// with a reason; announcements by status with the counts of each, created, edited and ended (a
// link refused, an ended one 409); cities and areas added, renamed, archived and restored (a name
// that exists, folded as the API folds it, 409). Only a super admin is answered.
import type { Announcement, Area, City, FlagView } from '@shifa/contracts';
import { hasAnnouncementLink, placeKey } from '@shifa/contracts';
import { fail, ok, type Reply, type Request, type RouteTable } from './server.ts';
import type { World } from './state.ts';
import { id } from './world.ts';
import { ADMIN_NAME } from './world-admin.ts';

type Body = Record<string, unknown> | undefined;
const field = (body: unknown, name: string): unknown => (body as Body)?.[name];
const trimmed = (body: unknown, name: string): string | null => {
  const value = field(body, name);
  return typeof value === 'string' ? value.trim() : null;
};
const now = () => new Date().toISOString();
const invalid = (path: string, code = 'invalid'): Reply =>
  fail(400, 'validation_failed', { details: [{ path, code }] });

function admin(world: World, run: () => Reply): Reply {
  if (!world.session) return fail(401, 'unauthorized');
  if (!world.session.platformAdmin) return fail(403, 'forbidden');
  return run();
}
const guarded =
  (run: (request: Request, world: World) => Reply) => (request: Request, world: World) =>
    admin(world, () => run(request, world));

/** The platform's clinics by id (the picker's ids), or null for an id it does not know. */
function clinicsOf(world: World, ids: unknown): { id: string; name: string }[] | null {
  if (!Array.isArray(ids)) return null;
  const found = ids.map((x) => world.platform.find((p) => p.clinic.id === x)?.clinic);
  if (found.some((c) => c === undefined)) return null;
  return found.map((c) => ({ id: c?.id ?? '', name: c?.name ?? '' }));
}

// ---- Flags (contract rows "Flags · list" and "· change")

function setFlag({ params, body }: Request, world: World): Reply {
  const flag = world.adminA02.flags.find((f) => f.key === params['key']);
  if (!flag) return fail(404, 'not_found');
  const reason = trimmed(body, 'reason') ?? '';
  if (reason.length < 10 || reason.length > 500) return invalid('body.reason', 'too_small');
  const mode = field(body, 'mode') as FlagView['mode'];
  const asked = field(body, 'clinicIds');
  if (mode === 'selected' || asked !== undefined) {
    const clinics = clinicsOf(world, asked);
    if (!clinics || (mode === 'selected' && clinics.length === 0)) {
      return invalid('body.clinicIds');
    }
    flag.clinics = clinics;
  }
  Object.assign(flag, { mode, reason, updatedByName: ADMIN_NAME, updatedAt: now() });
  return ok(flag);
}

// ---- Announcements

/** Its status at this moment (the API reads it from the period and an early end). */
function statusOf(a: Announcement): Announcement['status'] {
  const t = Date.now();
  if (a.endedEarly || (a.endsAt !== null && Date.parse(a.endsAt) <= t)) return 'ended';
  return Date.parse(a.startsAt) > t ? 'scheduled' : 'active';
}

function view(a: Announcement): Announcement {
  const status = statusOf(a);
  return status === 'scheduled'
    ? { ...a, status, dismissedCount: null, targetedMembers: null }
    : {
        ...a,
        status,
        dismissedCount: a.dismissedCount ?? 0,
        targetedMembers: a.targetedMembers ?? 0,
      };
}

/** Members a target reaches (a fixed count per clinic in this world). */
const reach = (world: World, a: Announcement) =>
  a.target === 'all' ? world.platform.length * 20 : a.clinics.length * 20;

function listAnnouncements({ query }: Request, world: World): Reply {
  const all = world.adminA02.announcements.map(view);
  const status = query.get('status');
  return ok({
    counts: {
      scheduled: all.filter((a) => a.status === 'scheduled').length,
      active: all.filter((a) => a.status === 'active').length,
      ended: all.filter((a) => a.status === 'ended').length,
    },
    announcements: status === null ? all : all.filter((a) => a.status === status),
  });
}

/** The fields of a create or edit, checked as the API checks them; a refusal, or the changes. */
function readAnnouncement(
  body: unknown,
  world: World,
  before: Announcement | null,
): Reply | Partial<Announcement> {
  const next: Partial<Announcement> = {};
  const text = trimmed(body, 'body');
  if (text !== null || before === null) {
    if (text === null || text === '' || text.length > 280) return invalid('body.body');
    if (hasAnnouncementLink(text)) return fail(400, 'announcement_link');
    next.body = text;
  }
  const level = field(body, 'level');
  if (level === 'info' || level === 'warning') next.level = level;
  const starts = field(body, 'startsAt');
  if (typeof starts === 'string') next.startsAt = starts;
  const ends = field(body, 'endsAt');
  if (ends !== undefined) next.endsAt = typeof ends === 'string' ? ends : null;
  const start = next.startsAt ?? before?.startsAt ?? now();
  const end = next.endsAt === undefined ? (before?.endsAt ?? null) : next.endsAt;
  if (end !== null && (Date.parse(end) <= Date.parse(start) || Date.parse(end) <= Date.now())) {
    return invalid('body.endsAt');
  }
  const target = field(body, 'target');
  if (target === 'all' || target === 'selected') next.target = target;
  const asked = field(body, 'clinicIds');
  if ((next.target ?? before?.target) === 'selected' && (asked !== undefined || next.target)) {
    const clinics = clinicsOf(world, asked);
    if (!clinics || clinics.length === 0) return invalid('body.clinicIds');
    next.clinics = clinics;
  }
  if (next.target === 'all') next.clinics = [];
  return next;
}

const isReply = (x: unknown): x is Reply =>
  typeof x === 'object' && x !== null && 'status' in x && typeof x.status === 'number';

let serial = 0;

function createAnnouncement({ body }: Request, world: World): Reply {
  const read = readAnnouncement(body, world, null);
  if (isReply(read)) return read;
  serial += 1;
  const a: Announcement = {
    // A series of its own (…0d01), apart from the world's ids (…0c01).
    id: id(serial % 100).replace(/c(\d\d)$/, `d$1`),
    version: 1,
    body: read.body ?? '',
    level: read.level ?? 'info',
    startsAt: read.startsAt ?? now(),
    endsAt: read.endsAt ?? null,
    status: 'active',
    endedEarly: false,
    endedByName: null,
    target: read.target ?? 'all',
    clinics: read.clinics ?? [],
    createdByName: ADMIN_NAME,
    createdAt: now(),
    dismissedCount: 0,
    targetedMembers: 0,
  };
  a.targetedMembers = reach(world, a);
  world.adminA02.announcements.unshift(a);
  return ok(view(a), 201);
}

function editAnnouncement({ id: annId, body }: Request, world: World): Reply {
  const a = world.adminA02.announcements.find((x) => x.id === annId);
  if (!a) return fail(404, 'not_found');
  if (statusOf(a) === 'ended') return fail(409, 'announcement_ended');
  const read = readAnnouncement(body, world, a);
  if (isReply(read)) return read;
  // A new body or level is a new version: shown again to those who closed it.
  if ((read.body && read.body !== a.body) || (read.level && read.level !== a.level)) {
    a.version += 1;
    a.dismissedCount = 0;
  }
  Object.assign(a, read);
  a.targetedMembers = reach(world, a);
  return ok(view(a));
}

function endAnnouncement({ id: annId }: Request, world: World): Reply {
  const a = world.adminA02.announcements.find((x) => x.id === annId);
  if (!a) return fail(404, 'not_found');
  if (statusOf(a) === 'ended') return fail(409, 'announcement_ended');
  Object.assign(a, { endedEarly: true, endedByName: ADMIN_NAME, endsAt: now() });
  return ok(view(a));
}

// ---- Cities and areas

const live = <T extends { archivedAt: string | null }>(list: T[]) =>
  list.filter((p) => p.archivedAt === null);

function listCities({ query }: Request, world: World): Reply {
  const all = query.get('includeArchived') === 'true';
  const cities = all
    ? world.adminA02.cities
    : live(world.adminA02.cities).map((c) => ({ ...c, areas: live(c.areas) }));
  return ok({ cities });
}

/** The name of a create or rename: 400 when empty, 409 when it folds to one that exists. */
function nameOf(body: unknown, among: { id: string; name: string }[], self?: string) {
  const name = trimmed(body, 'name') ?? '';
  if (name === '' || name.length > 100 || placeKey(name) === '') return invalid('body.name');
  const key = placeKey(name);
  if (among.some((p) => p.id !== self && placeKey(p.name) === key)) {
    return fail(409, 'place_name_taken');
  }
  return name;
}

const cityOf = (world: World, cityId: string | undefined) =>
  world.adminA02.cities.find((c) => c.id === cityId);
function areaOf(world: World, areaId: string | undefined): { area: Area; city: City } | null {
  for (const city of world.adminA02.cities) {
    const area = city.areas.find((a) => a.id === areaId);
    if (area) return { area, city };
  }
  return null;
}

let places = 0;
const placeId = () => {
  places += 1;
  return id(places % 100).replace(/c(\d\d)$/, `e$1`);
};

const counts = { archivedAt: null, branchCount: 0, clinicCount: 0, doctorCount: 0 };

function setArchived(place: City | Area | undefined, archived: boolean): Reply | null {
  if (!place) return fail(404, 'not_found');
  if (archived && place.archivedAt !== null) return fail(409, 'place_archived');
  if (!archived && place.archivedAt === null) return fail(409, 'place_not_archived');
  place.archivedAt = archived ? now() : null;
  return null;
}

export const a02AdminRoutes: RouteTable = {
  'GET /platform/flags': guarded((_r, world) => ok({ flags: world.adminA02.flags })),
  'PUT /platform/flags/:key': guarded(setFlag),
  'GET /platform/announcements': guarded(listAnnouncements),
  'POST /platform/announcements': guarded(createAnnouncement),
  'PATCH /platform/announcements/:id': guarded(editAnnouncement),
  'POST /platform/announcements/:id/end': guarded(endAnnouncement),
  'GET /platform/cities': guarded(listCities),
  'POST /platform/cities': guarded(({ body }, world) => {
    const name = nameOf(body, world.adminA02.cities);
    if (typeof name !== 'string') return name;
    const city: City = { id: placeId(), name, ...counts, areas: [] };
    world.adminA02.cities.push(city);
    return ok(city, 201);
  }),
  'PATCH /platform/cities/:id': guarded(({ id: cityId, body }, world) => {
    const city = cityOf(world, cityId);
    if (!city) return fail(404, 'not_found');
    const name = nameOf(body, world.adminA02.cities, city.id);
    if (typeof name !== 'string') return name;
    city.name = name;
    return ok(city);
  }),
  'POST /platform/cities/:id/archive': guarded(({ id: cityId }, world) => {
    const city = cityOf(world, cityId);
    return setArchived(city, true) ?? ok(city);
  }),
  'POST /platform/cities/:id/restore': guarded(({ id: cityId }, world) => {
    const city = cityOf(world, cityId);
    return setArchived(city, false) ?? ok(city);
  }),
  'POST /platform/cities/:id/areas': guarded(({ id: cityId, body }, world) => {
    const city = cityOf(world, cityId);
    if (!city) return fail(404, 'not_found');
    const name = nameOf(body, city.areas);
    if (typeof name !== 'string') return name;
    const area: Area = { id: placeId(), cityId: city.id, name, ...counts };
    city.areas.push(area);
    return ok(area, 201);
  }),
  'PATCH /platform/areas/:id': guarded(({ id: areaId, body }, world) => {
    const found = areaOf(world, areaId);
    if (!found) return fail(404, 'not_found');
    const name = nameOf(body, found.city.areas, found.area.id);
    if (typeof name !== 'string') return name;
    found.area.name = name;
    return ok(found.area);
  }),
  'POST /platform/areas/:id/archive': guarded(({ id: areaId }, world) => {
    const found = areaOf(world, areaId);
    return setArchived(found?.area, true) ?? ok(found?.area);
  }),
  'POST /platform/areas/:id/restore': guarded(({ id: areaId }, world) => {
    const found = areaOf(world, areaId);
    return setArchived(found?.area, false) ?? ok(found?.area);
  }),
};
