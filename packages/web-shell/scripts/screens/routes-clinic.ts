// The fake server's routes of the active clinic: the owner's team and its account actions, the
// branches, the clinic's idle setting. Owner-only routes refuse anyone else (403), as the API does.
import type { Branch, MemberDetail, MemberRole } from '@shifa/contracts';
import { normalisePhone } from '@shifa/contracts';
import { placeBranch } from './routes-a02-clinic.ts';
import { fail, ok, type Reply, type Request, type RouteTable } from './server.ts';
import type { World } from './state.ts';
import { at, id, NOTES_KEY, NOTES_ROLES, SETUP_TOKEN } from './world.ts';

const field = (body: unknown, name: string): unknown =>
  (body as Record<string, unknown> | undefined)?.[name];
const text = (body: unknown, name: string) => {
  const value = field(body, name);
  return typeof value === 'string' ? value.trim() : '';
};

function owner(world: World, run: () => Reply): Reply {
  const session = world.session;
  if (!session) return fail(401, 'unauthorized');
  if (!session.roles.some((r) => r.role === 'owner')) return fail(403, 'forbidden');
  return run();
}

const phoneIssue = (path: string): Reply =>
  fail(400, 'validation_failed', { details: [{ path, code: 'invalid_format' }] });

let serial = 70;
const nextId = () => {
  serial += 1;
  return id(serial);
};

/** A one-time setup link (an example host: the canvas never names a real one). */
function link(phone: string) {
  const token = SETUP_TOKEN;
  const url = `https://clinic.example/setup#${token}`;
  return {
    url,
    whatsappUrl: `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(url)}`,
    expiresAt: at(3 * 86_400_000),
  };
}

function rolesOf(world: World, body: unknown): MemberRole[] | null {
  const asked = field(body, 'roles');
  if (!Array.isArray(asked)) return null;
  const roles: MemberRole[] = [];
  for (const r of asked as { role: MemberRole['role']; branchId: string | null }[]) {
    const branch = world.branches.find((b) => b.id === r.branchId) ?? null;
    if (branch?.archivedAt) return null;
    roles.push({ role: r.role, branchId: branch?.id ?? null, branchName: branch?.name ?? null });
  }
  return roles;
}

const withDefaults = (roles: MemberRole[], granted?: boolean) => {
  const roleDefault = roles.some((r) => (NOTES_ROLES as readonly string[]).includes(r.role));
  const on = granted ?? roleDefault;
  return [{ key: NOTES_KEY, roleDefault, granted: on, overridden: on !== roleDefault }];
};

function addMember({ body }: Request, world: World): Reply {
  const phone = normalisePhone(text(body, 'phone'));
  if (!phone.ok) return phoneIssue('body.phone');
  if (world.members.some((m) => m.phone === phone.e164)) return fail(409, 'phone_in_team');
  const roles = rolesOf(world, body);
  if (!roles) return fail(409, 'branch_archived');
  const asked = field(body, 'permissions') as { key: string; granted: boolean }[] | undefined;
  const member: MemberDetail = {
    id: nextId(),
    name: text(body, 'name'),
    phone: phone.e164,
    status: 'pending',
    roles,
    lastActiveAt: null,
    linkExpiresAt: at(3 * 86_400_000),
    isSelf: false,
    permissions: withDefaults(roles, asked?.find((p) => p.key === NOTES_KEY)?.granted),
    isLastOwner: false,
    mfaEnrolled: false,
  };
  world.members.push(member);
  return ok({ member, link: link(phone.e164) }, 201);
}

function memberAction(run: (m: MemberDetail, world: World, request: Request) => Reply) {
  return (request: Request, world: World) =>
    owner(world, () => {
      const m = world.members.find((x) => x.id === request.id);
      return m ? run(m, world, request) : fail(404, 'not_found');
    });
}

function updateMember(m: MemberDetail, world: World, { body }: Request): Reply {
  const name = field(body, 'name');
  if (typeof name === 'string') m.name = name.trim();
  if (field(body, 'roles') !== undefined) {
    const roles = rolesOf(world, body);
    if (!roles) return fail(409, 'branch_archived');
    if (m.isLastOwner && !roles.some((r) => r.role === 'owner')) return fail(409, 'last_owner');
    m.roles = roles;
    m.permissions = withDefaults(
      roles,
      m.permissions[0]?.overridden ? m.permissions[0].granted : undefined,
    );
  }
  const switches = field(body, 'permissions') as
    | { key: string; granted: boolean | null }[]
    | undefined;
  const notes = switches?.find((p) => p.key === NOTES_KEY);
  if (notes) m.permissions = withDefaults(m.roles, notes.granted ?? undefined);
  return ok(m);
}

function branchUpdate(b: Branch, body: unknown): Reply | null {
  const name = field(body, 'name');
  if (typeof name === 'string' && name.trim() === '') {
    return fail(400, 'validation_failed', { details: [{ path: 'body.name', code: 'too_small' }] });
  }
  if (typeof name === 'string') b.name = name.trim();
  const address = field(body, 'address');
  if (address !== undefined) b.address = typeof address === 'string' ? address.trim() : null;
  const phone = field(body, 'phone');
  if (typeof phone === 'string') {
    const read = normalisePhone(phone);
    if (!read.ok) return phoneIssue('body.phone');
    b.phone = read.e164;
  } else if (phone === null) b.phone = null;
  return null;
}

function branchAction(run: (b: Branch, world: World, request: Request) => Reply) {
  return (request: Request, world: World) =>
    owner(world, () => {
      const b = world.branches.find((x) => x.id === request.id);
      return b ? run(b, world, request) : fail(404, 'not_found');
    });
}

const active = (world: World) => world.branches.filter((b) => b.archivedAt === null);

export const clinicRoutes: RouteTable = {
  'GET /team/members': (_r, world) =>
    owner(world, () =>
      ok({
        // The list answer (MemberSummary): no permissions, owner flag or second factor.
        members: world.members.map((m) => ({
          id: m.id,
          name: m.name,
          phone: m.phone,
          status: m.status,
          roles: m.roles,
          lastActiveAt: m.lastActiveAt,
          linkExpiresAt: m.linkExpiresAt,
          isSelf: m.isSelf,
        })),
      }),
    ),
  'GET /team/permissions': (_r, world) =>
    owner(world, () => ok({ keys: [{ key: NOTES_KEY, roles: [...NOTES_ROLES] }] })),
  'GET /team/members/:id': memberAction((m) => ok(m)),
  'POST /team/members': (request, world) => owner(world, () => addMember(request, world)),
  'PATCH /team/members/:id': memberAction(updateMember),
  'PATCH /team/members/:id/phone': memberAction((m, world, { body }) => {
    // As the API: an account made from the link first, then a cancelled invitation.
    if (m.status !== 'pending' && m.lastActiveAt !== null)
      return fail(409, 'member_account_exists');
    if (m.status === 'deactivated') return fail(409, 'member_deactivated');
    const phone = normalisePhone(text(body, 'phone'));
    if (!phone.ok) return phoneIssue('body.phone');
    if (world.members.some((x) => x !== m && x.phone === phone.e164))
      return fail(409, 'phone_in_team');
    m.phone = phone.e164;
    const issued = link(phone.e164);
    m.linkExpiresAt = issued.expiresAt;
    return ok(issued);
  }),
  'POST /team/members/:id/deactivate': memberAction((m) => {
    if (m.isLastOwner) return fail(409, 'last_owner');
    m.status = 'deactivated';
    m.linkExpiresAt = null;
    return ok(m);
  }),
  'POST /team/members/:id/reactivate': memberAction((m) => {
    if (m.status !== 'deactivated') return fail(409, 'member_not_deactivated');
    m.status = 'active';
    return ok(m);
  }),
  'POST /team/members/:id/setup-link': memberAction((m) => {
    if (m.status === 'deactivated') return fail(409, 'member_deactivated');
    const issued = link(m.phone);
    if (m.status === 'pending') m.linkExpiresAt = issued.expiresAt;
    return ok(issued);
  }),
  'POST /team/members/:id/reset-mfa': memberAction((m) => {
    if (!m.mfaEnrolled) return fail(409, 'mfa_not_enrolled');
    m.mfaEnrolled = false;
    return ok(m);
  }),
  'GET /branches': (_r, world) =>
    owner(world, () =>
      ok({ active: active(world), archived: world.branches.filter((b) => b.archivedAt !== null) }),
    ),
  'POST /branches': ({ body }, world) =>
    owner(world, () => {
      const b: Branch = {
        id: nextId(),
        name: '',
        address: null,
        phone: null,
        archivedAt: null,
        memberCount: 0,
        city: null,
        area: null,
      };
      // A-02-10: the dialog's city and area (routes-a02-clinic.ts).
      const refused = branchUpdate(b, body) ?? placeBranch(world, b, body);
      if (refused) return refused;
      world.branches.push(b);
      return ok(b, 201);
    }),
  'PATCH /branches/:id': branchAction((b, world, { body }) => {
    if (b.archivedAt !== null) return fail(409, 'branch_archived');
    return branchUpdate(b, body) ?? placeBranch(world, b, body) ?? ok(b);
  }),
  'GET /branches/:id/archive-preview': branchAction((b, world) =>
    ok({
      lastBranch: active(world).length === 1,
      members: world.members
        .filter(
          (m) =>
            m.status === 'active' &&
            m.roles.length > 0 &&
            m.roles.every((r) => r.branchId === b.id),
        )
        .map((m) => ({ id: m.id, name: m.name })),
    }),
  ),
  'POST /branches/:id/archive': branchAction((b, world) => {
    if (b.archivedAt !== null) return fail(409, 'branch_archived');
    if (active(world).length === 1) return fail(409, 'last_branch');
    b.archivedAt = new Date().toISOString();
    return ok(b);
  }),
  'POST /branches/:id/restore': branchAction((b) => {
    if (b.archivedAt === null) return fail(409, 'branch_not_archived');
    b.archivedAt = null;
    return ok(b);
  }),
  'GET /clinic/settings': (_r, world) => owner(world, () => ok(world.settings)),
  'PATCH /clinic/settings': ({ body }, world) =>
    owner(world, () => {
      const minutes = field(body, 'idleMinutes');
      if (minutes !== 15 && minutes !== 30 && minutes !== 60) return fail(400, 'validation_failed');
      world.settings = { idleMinutes: minutes, source: 'organization', locked: false };
      if (world.session) world.session = { ...world.session, idleMinutes: minutes };
      return ok(world.settings);
    }),
};
