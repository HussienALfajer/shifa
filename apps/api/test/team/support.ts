// Helpers for the A-01-04 tests: a clinic created through the super-admin API with its owner set
// up (password and TOTP), members added through the team API, member links used, invitations,
// the clinic's audit rows (superuser read) and the person's sessions.
import { auditEvent, branch, membership, session } from '@shifa/db';
import { superuserDb, syntheticPhones, testAuthDb, workerDatabaseName } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { and, eq, like } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { get, PASSWORD, sessionCookie } from '../identity/support.ts';
import {
  createClinicViaApi,
  type Enrolled,
  patch,
  platformApp,
  post,
  resetDatabase,
  setUpOwner,
  signedInAdmin,
  tokenOf,
} from '../platform/support.ts';
import type { TestApp } from '../support.ts';

export { get, patch, post, tokenOf };

export type TeamRole = 'owner' | 'doctor' | 'receptionist' | 'assistant' | 'accountant';

export interface RoleScope {
  role: TeamRole;
  branchId: string | null;
}

export interface Clinic {
  clinicId: string;
  ownerMembershipId: string;
  owner: Enrolled;
  ownerPhone: string;
  /** The clinic's main branch. */
  branchId: string;
}

export interface TeamWorld {
  app: TestApp;
  clock: FixedClock;
  admin: { cookie: string };
  /** A fresh synthetic phone per call. */
  phone(): string;
  /** A new clinic with its owner set up and signed in (MFA verified). */
  clinic(): Promise<Clinic>;
}

/** Empties the database, starts the app and signs in a super admin. */
export async function teamWorld(clock: FixedClock, seed: number): Promise<TeamWorld> {
  await resetDatabase();
  const app = await platformApp(clock);
  const phones = syntheticPhones(seed, 120);
  let next = 0;
  const phone = () => {
    const value = phones[next];
    next += 1;
    if (!value) throw new Error('out of synthetic phones');
    return value;
  };
  const admin = await signedInAdmin(app, clock, phone());
  return {
    app,
    clock,
    admin,
    phone,
    clinic: async () => {
      const ownerPhone = phone();
      const created = await createClinicViaApi(app, admin.cookie, ownerPhone);
      const owner = await setUpOwner(app, clock, created.linkUrl);
      return {
        clinicId: created.clinicId,
        ownerMembershipId: created.ownerMembershipId,
        owner,
        ownerPhone,
        branchId: await mainBranch(created.clinicId),
      };
    },
  };
}

export async function mainBranch(tenantId: string): Promise<string> {
  const [row] = await superuserDb(workerDatabaseName())
    .select({ id: branch.id })
    .from(branch)
    .where(eq(branch.tenantId, tenantId));
  if (!row) throw new Error('clinic without a branch');
  return row.id;
}

/** A second branch in the clinic (branch routes come with A-01-05). */
export async function addBranch(tenantId: string, name = 'فرع الجميلية'): Promise<string> {
  const [row] = await superuserDb(workerDatabaseName())
    .insert(branch)
    .values({ tenantId, name })
    .returning({ id: branch.id });
  if (!row) throw new Error('branch not written');
  return row.id;
}

export interface AddedMember {
  res: LightMyRequestResponse;
  membershipId: string;
  linkUrl: string;
}

/** POST /team/members as the owner behind `cookie`. */
export async function addMember(
  app: TestApp,
  cookie: string,
  input: { name?: string; phone: string; roles: RoleScope[] },
): Promise<AddedMember> {
  const res = await post(
    app,
    '/team/members',
    { name: input.name ?? 'موظف تجريبي', phone: input.phone, roles: input.roles },
    cookie,
  );
  if (res.statusCode !== 201) return { res, membershipId: '', linkUrl: '' };
  const body = res.json<{ member: { id: string }; link: { url: string } }>();
  return { res, membershipId: body.member.id, linkUrl: body.link.url };
}

/** A new phone's member link used: password set, signed in. Returns the session cookie. */
export async function useMemberLink(app: TestApp, linkUrl: string): Promise<string> {
  const res = await post(app, '/auth/setup-link/consume', {
    token: tokenOf(linkUrl),
    password: PASSWORD,
  });
  if (res.statusCode !== 200) throw new Error(`member link: ${String(res.statusCode)} ${res.body}`);
  return sessionCookie(res);
}

/** A member added and set up through their link; returns their cookie and ids. */
export async function activeMember(
  world: TeamWorld,
  clinic: Clinic,
  roles: RoleScope[],
): Promise<{ cookie: string; membershipId: string; phone: string; userId: string }> {
  const phone = world.phone();
  const added = await addMember(world.app, clinic.owner.cookie, { phone, roles });
  if (added.res.statusCode !== 201) throw new Error(`add member: ${added.res.body}`);
  const cookie = await useMemberLink(world.app, added.linkUrl);
  const userId = (await get(world.app, '/auth/session', cookie)).json<{ userId: string }>().userId;
  return { cookie, membershipId: added.membershipId, phone, userId };
}

/** The clinic's own audit rows (`member.*`, `clinic.settings_changed`), oldest first. */
export function tenantAuditRows(tenantId: string) {
  return superuserDb(workerDatabaseName())
    .select()
    .from(auditEvent)
    .where(and(eq(auditEvent.tenantId, tenantId)))
    .orderBy(auditEvent.at);
}

/** Every audit row of one event, any tenant. */
export function auditRowsOf(event: string) {
  return superuserDb(workerDatabaseName())
    .select()
    .from(auditEvent)
    .where(like(auditEvent.event, event))
    .orderBy(auditEvent.at);
}

export function membershipRow(id: string) {
  return superuserDb(workerDatabaseName()).select().from(membership).where(eq(membership.id, id));
}

export function sessionsOf(userId: string) {
  return testAuthDb().withAuth((tx) => tx.select().from(session).where(eq(session.userId, userId)));
}

export function errorCode(res: LightMyRequestResponse): string | undefined {
  return res.json<{ error?: { code?: string } }>().error?.code;
}
