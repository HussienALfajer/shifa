// The fake server's routes of clinic web's A-02 items (A-02-10), answered as the contracts in
// packages/contracts/src (capabilities.ts, announcements.ts, support.ts, places.ts) say: what the
// plan allows with the use counted from the world, the owner's subscription, the announcements a
// person has not hidden, the owner's support grants and their end, the places a branch may take,
// and the support session (its hand-off and its end). A support session reads as the owner and
// every write it sends is refused with 403 `support_read_only`, as the API does.
import type { Branch, LimitUse } from '@shifa/contracts';
import { fail, ok, type Reply, type Request, type RouteTable } from './server.ts';
import type { World } from './state.ts';
import {
  BRANCH_PLACES,
  BRANCHES,
  bannerOf,
  CUSTOM_FIELDS,
  PRACTITIONERS,
  SUPPORT_ADMIN,
  supportSession,
} from './world-a02-clinic.ts';

const field = (body: unknown, name: string): unknown =>
  (body as Record<string, unknown> | undefined)?.[name];

const isOwner = (world: World) => world.session?.roles.some((r) => r.role === 'owner') === true;
const inSupport = (world: World) => Boolean(world.session?.support);

function member(world: World, run: () => Reply): Reply {
  if (!world.session) return fail(401, 'unauthorized');
  if (world.session.tenantId === null) return fail(403, 'forbidden');
  return run();
}

/** The owner's own reads: refused to anyone else and to a support session (A-02-05). */
function ownerOnly(world: World, run: () => Reply): Reply {
  return member(world, () =>
    isOwner(world) && !inSupport(world) ? run() : fail(403, 'forbidden'),
  );
}

/** A write: a support session's is refused before anything happens. */
function write(world: World, run: () => Reply): Reply {
  return member(world, () => (inSupport(world) ? fail(403, 'support_read_only') : run()));
}

/** Doctors who hold or are invited to the doctor role (a deactivated one frees the place). */
const doctors = (world: World) =>
  world.members.filter(
    (m) => m.status !== 'deactivated' && m.roles.some((r) => r.role === 'doctor'),
  ).length;

/** Each limit and its use now (custom fields are not counted until A-03). */
export function limitsOf(world: World): LimitUse[] {
  const { limits } = world.clinicA02;
  return [
    { key: PRACTITIONERS, limit: limits[PRACTITIONERS] ?? 0, used: doctors(world) },
    {
      key: BRANCHES,
      limit: limits[BRANCHES] ?? 0,
      used: world.branches.filter((b) => b.archivedAt === null).length,
    },
    { key: CUSTOM_FIELDS, limit: limits[CUSTOM_FIELDS] ?? 0, used: null },
  ];
}

/** A 409 `limit_reached` naming the key as it stands now (the add is refused, nothing saved). */
export function limitReached(world: World, key: string): Reply {
  const l = limitsOf(world).find((x) => x.key === key);
  return fail(409, 'limit_reached', {
    limitReached: { key, limit: l?.limit ?? 0, used: l?.used ?? 0 },
  });
}

/** Sets the limit to its use: full, so the add is refused before sending. */
export function fillLimit(world: World, key: string): void {
  const used = limitsOf(world).find((x) => x.key === key)?.used ?? 0;
  world.clinicA02.limits[key] = used;
}

/** Gives the branches the city and area their addresses read (BRANCH_PLACES). */
export function placeBranches(world: World): void {
  for (const b of world.branches) {
    const p = BRANCH_PLACES[b.id];
    if (!p) continue;
    const city = world.clinicA02.places.find((c) => c.id === p.city.id);
    const area = p.area ? city?.areas.find((a) => a.id === p.area?.id) : undefined;
    b.city = city ? { id: city.id, name: city.name, archived: city.archived } : null;
    b.area = area ? { id: area.id, name: area.name, archived: area.archived } : null;
  }
}

/**
 * A branch's new city and area from a create or edit (absent: unchanged), checked as the API
 * checks them: an unknown place or an area outside its city 400, an archived place chosen anew 409
 * `place_archived` (one the branch holds stays). Null when accepted.
 */
export function placeBranch(world: World, b: Branch, body: unknown): Reply | null {
  const cityId = field(body, 'cityId');
  const areaId = field(body, 'areaId');
  if (cityId === undefined && areaId === undefined) return null;
  const nextCity = cityId === undefined ? (b.city?.id ?? null) : cityId;
  const nextArea = areaId === undefined ? (b.area?.id ?? null) : areaId;
  if (nextCity === null) {
    if (nextArea !== null) {
      return fail(400, 'validation_failed', {
        details: [{ path: 'body.areaId', code: 'area_not_in_city' }],
      });
    }
    b.city = null;
    b.area = null;
    return null;
  }
  const city = world.clinicA02.places.find((c) => c.id === nextCity);
  if (!city) {
    return fail(400, 'validation_failed', { details: [{ path: 'body.cityId', code: 'invalid' }] });
  }
  if (city.archived && city.id !== b.city?.id)
    return fail(409, 'place_archived', { place: 'city' });
  const area = nextArea === null ? null : city.areas.find((a) => a.id === nextArea);
  if (area === undefined) {
    return fail(400, 'validation_failed', {
      details: [{ path: 'body.areaId', code: 'area_not_in_city' }],
    });
  }
  if (area?.archived && area.id !== b.area?.id)
    return fail(409, 'place_archived', { place: 'area' });
  b.city = { id: city.id, name: city.name, archived: city.archived };
  b.area = area ? { id: area.id, name: area.name, archived: area.archived } : null;
  return null;
}

/** The owner's grants: the open ones are the banner, all of them the log. */
function grantsOf(world: World) {
  const grants = world.clinicA02.grants;
  return {
    now: new Date().toISOString(),
    open: grants.filter((g) => g.endedAt === null).map(bannerOf),
    grants,
  };
}

function endGrant({ id }: Request, world: World): Reply {
  const g = world.clinicA02.grants.find((x) => x.id === id);
  if (!g) return fail(404, 'not_found');
  if (g.endedAt !== null) return fail(409, 'support_ended');
  g.endedAt = new Date().toISOString();
  g.endedBy = 'owner';
  g.endedByName = world.profile.name;
  return ok(g);
}

/** 43 base64url characters (the contract's `SupportHandoffRequest`). */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** A hand-off token of the canvas only (never a real one). */
export const HANDOFF_TOKEN = 'U3ludGhldGljLWhhbmRvZmYtdG9rZW4tY2FudmFzMDA';

export const a02ClinicRoutes: RouteTable = {
  'GET /clinic/capabilities': (_r, world) =>
    member(world, () => ok({ entitlements: {}, limits: limitsOf(world), flags: {} })),
  'GET /clinic/subscription': (_r, world) =>
    ownerOnly(world, () => {
      const s = world.clinicA02;
      return ok({
        plan: s.plan,
        status: s.status,
        subscriptionEnd: s.subscriptionEnd,
        limits: limitsOf(world),
        features: s.features,
      });
    }),
  'GET /me/announcements': (_r, world) =>
    member(world, () => ok({ announcements: world.clinicA02.announcements })),
  'POST /me/announcements/:id/dismiss': ({ id }, world) =>
    write(world, () => {
      const list = world.clinicA02.announcements;
      const i = list.findIndex((a) => a.id === id);
      if (i < 0) return fail(404, 'not_found');
      list.splice(i, 1);
      return ok(undefined, 204);
    }),
  'GET /clinic/support-grants': (_r, world) => ownerOnly(world, () => ok(grantsOf(world))),
  'POST /clinic/support-grants/:id/end': (request, world) =>
    ownerOnly(world, () => endGrant(request, world)),
  'GET /clinic/places': (_r, world) => member(world, () => ok({ cities: world.clinicA02.places })),
  'POST /auth/support/session': ({ body }, world) => {
    const token = field(body, 'token');
    if (typeof token !== 'string' || !TOKEN.test(token)) return fail(404, 'link_invalid');
    world.session = supportSession();
    world.profile = { ...world.profile, userId: world.session.userId, name: SUPPORT_ADMIN };
    return ok(world.session);
  },
  'POST /auth/support/end': (_r, world) => {
    if (!world.session?.support) return fail(401, 'unauthorized');
    world.session = null;
    return ok(undefined, 204);
  },
};

/** A 401 `support_ended` with how the grant ended (`supportEnded`), as every request then gets. */
export function supportEnded(
  endedBy: 'admin' | 'owner' | 'expiry',
  ownerName: string | null = null,
  minutesAgo = 2,
): Reply {
  return fail(401, 'session_expired', {
    reason: 'support_ended',
    supportEnded: {
      endedBy,
      endedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      ownerName,
    },
  });
}
