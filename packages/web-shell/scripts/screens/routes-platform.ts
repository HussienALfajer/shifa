// The fake server's routes of admin web (/platform/…): the clinics, their status and end date and
// the owner support actions, answered as the contracts in packages/contracts/src/platform.ts say.
// Only a super admin is answered (403 otherwise), as the API does.
import type { ClinicDetail, ClinicSummary } from '@shifa/contracts';
import { normalisePhone } from '@shifa/contracts';
import { changeType } from './routes-a02-tabs.ts';
import { fail, ok, type Reply, type Request, type RouteTable } from './server.ts';
import type { World } from './state.ts';
import { at, id, masked, SETUP_TOKEN } from './world.ts';
import { signIns7d, tabsOf } from './world-a02-tabs.ts';
import { ACTIVE_OWNER, ADMIN_PHONE, type PlatformClinic } from './world-admin.ts';

const field = (body: unknown, name: string): unknown =>
  (body as Record<string, unknown> | undefined)?.[name];
const text = (body: unknown, name: string) => {
  const value = field(body, name);
  return typeof value === 'string' ? value.trim() : '';
};

function admin(world: World, run: () => Reply): Reply {
  if (!world.session) return fail(401, 'unauthorized');
  if (!world.session.platformAdmin) return fail(403, 'forbidden');
  return run();
}

const phoneIssue = (path: string): Reply =>
  fail(400, 'validation_failed', { details: [{ path, code: 'invalid_format' }] });

/** A phone that has an account already (the active owner's): its link is an invitation. */
const hasAccount = (world: World, e164: string) =>
  e164 === ACTIVE_OWNER.phone ||
  e164 === ADMIN_PHONE ||
  world.platform.some((p) => p.ownerPhone === e164 && ownerHasAccount(p));

/** An owner who has set up (active, or deactivated since): not pending. */
const ownerHasAccount = (p: PlatformClinic) =>
  p.clinic.owner !== null && p.clinic.owner.status !== 'pending';

/** Another clinic whose owner, on this phone, has not set up yet (OD-85). */
const pendingElsewhere = (world: World, e164: string, except?: string) =>
  world.platform.some(
    (p) => p.clinic.id !== except && p.ownerPhone === e164 && p.clinic.owner?.status === 'pending',
  );

/** A one-time link (an example host: the canvas never names a real one). */
function link(world: World, e164: string) {
  const url = `https://clinic.example/setup#${SETUP_TOKEN}`;
  return {
    url,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(url)}`,
    purpose: hasAccount(world, e164) ? ('invitation' as const) : ('owner_setup' as const),
    expiresAt: at(3 * 86_400_000),
  };
}

/** A clinic as the list answers it (ClinicSummary: no owner card, its usage columns). */
export const summary = (c: ClinicDetail, world: World): ClinicSummary => ({
  id: c.id,
  name: c.name,
  type: c.type,
  status: c.status,
  subscriptionEnd: c.subscriptionEnd,
  ownerName: c.ownerName,
  ownerStatus: c.ownerStatus,
  createdAt: c.createdAt,
  // A-02-07: the list's usage columns, from the clinic's counters (world-a02-tabs.ts).
  lastActivityAt: tabsOf(world, c.id).usage.lastActivityAt,
  signIns7d: signIns7d(tabsOf(world, c.id).usage),
});

function clinicAction(run: (p: PlatformClinic, world: World, request: Request) => Reply) {
  return (request: Request, world: World) =>
    admin(world, () => {
      const found = world.platform.find((p) => p.clinic.id === request.id);
      return found ? run(found, world, request) : fail(404, 'not_found');
    });
}

/** The owner actions of an owner with an account; 409 for one not set up (A-01-11). */
function accountAction(p: PlatformClinic): Reply {
  if (!p.clinic.owner) return fail(404, 'not_found');
  if (!ownerHasAccount(p)) return fail(409, 'owner_setup_pending');
  return ok(undefined, 204);
}

let serial = 60;

function create({ body }: Request, world: World): Reply {
  const read = normalisePhone(text(body, 'ownerPhone'));
  if (!read.ok) return phoneIssue('body.ownerPhone');
  if (pendingElsewhere(world, read.e164)) return fail(409, 'owner_setup_pending');
  serial += 1;
  const issued = link(world, read.e164);
  const end = field(body, 'subscriptionEnd');
  const owner = text(body, 'ownerName');
  const clinic: ClinicDetail = {
    id: id(serial),
    name: text(body, 'name'),
    type: field(body, 'type') as ClinicDetail['type'],
    status: field(body, 'status') as ClinicDetail['status'],
    subscriptionEnd: typeof end === 'string' ? end : null,
    ownerName: owner,
    ownerStatus: 'pending',
    createdAt: new Date().toISOString(),
    owner: {
      membershipId: id(serial + 10),
      name: owner,
      status: 'pending',
      phoneMasked: masked(read.e164),
      linkExpiresAt: issued.expiresAt,
    },
  };
  world.platform.unshift({ clinic, ownerPhone: read.e164 });
  return ok({ clinic, ownerLink: issued }, 201);
}

export const platformRoutes: RouteTable = {
  'GET /platform/clinics': ({ query }, world) =>
    admin(world, () => {
      const search = (query.get('search') ?? '').trim();
      const clinics = world.platform
        .map((p) => summary(p.clinic, world))
        .filter((c) => search === '' || c.name.includes(search));
      return ok({ clinics });
    }),
  'POST /platform/clinics': (request, world) => admin(world, () => create(request, world)),
  'GET /platform/clinics/:id': clinicAction((p) => ok(p.clinic)),
  'PATCH /platform/clinics/:id': clinicAction((p, world, { body }) => {
    // A-02-02: the clinic moves to the new type's plan at once (routes-a02-tabs.ts).
    const type = field(body, 'type');
    if (type === 'solo' || type === 'multi_doctor' || type === 'multi_branch') {
      changeType(world, p, type);
    }
    const status = field(body, 'status');
    if (status === 'trial' || status === 'active' || status === 'suspended') {
      p.clinic.status = status;
    }
    const end = field(body, 'subscriptionEnd');
    if (end !== undefined) p.clinic.subscriptionEnd = typeof end === 'string' ? end : null;
    return ok(p.clinic);
  }),
  'PATCH /platform/clinics/:id/owner': clinicAction((p, world, { body }) => {
    // As the API: the phone is read first, then the owner.
    const read = normalisePhone(text(body, 'phone'));
    if (!read.ok) return phoneIssue('body.phone');
    const owner = p.clinic.owner;
    if (!owner) return fail(404, 'not_found');
    if (ownerHasAccount(p)) return fail(409, 'owner_account_exists');
    if (pendingElsewhere(world, read.e164, p.clinic.id)) return fail(409, 'owner_setup_pending');
    const issued = link(world, read.e164);
    p.ownerPhone = read.e164;
    owner.phoneMasked = masked(read.e164);
    owner.linkExpiresAt = issued.expiresAt;
    return ok(issued);
  }),
  'POST /platform/clinics/:id/owner/setup-link': clinicAction((p, world) => {
    const owner = p.clinic.owner;
    if (!owner || p.ownerPhone === null) return fail(404, 'not_found');
    // The earlier link stops; a set-up owner's password is cleared, their membership stays.
    // An invitation when the owner has no account but their phone has one (as the API).
    const fresh = link(world, p.ownerPhone);
    const issued = ownerHasAccount(p) ? { ...fresh, purpose: 'owner_setup' as const } : fresh;
    owner.linkExpiresAt = issued.expiresAt;
    return ok(issued);
  }),
  'POST /platform/clinics/:id/owner/reset-mfa': clinicAction(accountAction),
  'POST /platform/clinics/:id/owner/end-sessions': clinicAction(accountAction),
};
