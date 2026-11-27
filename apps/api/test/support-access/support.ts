// Helpers for the A-02-05 tests: an app with all three pools, a super admin and a clinic with a
// set-up owner, grants opened through the API, the hand-off exchanged for a support session, and
// the support rows (grants and audit rows) read as the superuser.
import { auditEvent, supportAccessGrant } from '@shifa/db';
import { superuserDb, syntheticPhones, workerDatabaseName } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { eq, like } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { SUPPORT_COOKIE } from '../../src/modules/identity/index.ts';
import { testClock } from '../identity/support.ts';
import {
  createClinicViaApi,
  type PlatformAppOptions,
  platformApp,
  post,
  resetDatabase,
  type SignedInAdmin,
  setUpOwner,
  signedInAdmin,
} from '../platform/support.ts';
import type { TestApp } from '../support.ts';

export const REASON = 'مشكلة في الفروع تحتاج فحصًا';

const phones = syntheticPhones(2026_12_05, 40);
let next = 0;
export function nextPhone(): string {
  const phone = phones[next];
  next += 1;
  if (!phone) throw new Error('out of phones');
  return phone;
}

export interface World {
  app: TestApp;
  clock: FixedClock;
  admin: SignedInAdmin;
  clinicId: string;
  /** The clinic owner's session cookie (MFA passed). */
  owner: string;
}

/** A fresh database, an app, a super admin and a clinic whose owner has set up an account. */
export async function supportWorld(options: PlatformAppOptions = {}): Promise<World> {
  await resetDatabase();
  const clock = testClock();
  const app = await platformApp(clock, options);
  const admin = await signedInAdmin(app, clock, nextPhone());
  const clinic = await createClinicViaApi(app, admin.cookie, nextPhone());
  const owner = await setUpOwner(app, clock, clinic.linkUrl);
  return { app, clock, admin, clinicId: clinic.clinicId, owner: owner.cookie };
}

/** Another clinic and its owner, in the same app. */
export async function anotherClinic(world: World): Promise<{ clinicId: string; owner: string }> {
  const clinic = await createClinicViaApi(world.app, world.admin.cookie, nextPhone());
  const owner = await setUpOwner(world.app, world.clock, clinic.linkUrl);
  return { clinicId: clinic.clinicId, owner: owner.cookie };
}

export interface Opened {
  grantId: string;
  handoffUrl: string;
}

export function openGrant(
  world: World,
  body: Record<string, unknown> = { reason: REASON, minutes: 60 },
  clinicId: string = world.clinicId,
): Promise<LightMyRequestResponse> {
  return post(world.app, `/platform/clinics/${clinicId}/support-grants`, body, world.admin.cookie);
}

/** Opens a 60-minute grant (201) and returns its id and hand-off URL. */
export async function opened(world: World, minutes = 60): Promise<Opened> {
  const res = await openGrant(world, { reason: REASON, minutes });
  if (res.statusCode !== 201) throw new Error(`open: ${String(res.statusCode)} ${res.body}`);
  const body = res.json<{ grant: { id: string }; handoffUrl: string }>();
  return { grantId: body.grant.id, handoffUrl: body.handoffUrl };
}

/** The token of a hand-off URL (`…/support#<token>`). */
export function handoffToken(url: string): string {
  const token = url.split('#')[1];
  if (!token) throw new Error('hand-off without a token');
  return token;
}

export function exchange(world: World, token: string): Promise<LightMyRequestResponse> {
  return post(world.app, '/auth/support/session', { token });
}

/** `name=value` of the support cookie, ready for a Cookie header. */
export function supportCookie(res: LightMyRequestResponse): string {
  const raw = res.headers['set-cookie'];
  const lines = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  const line = lines.find((l) => l.startsWith(`${SUPPORT_COOKIE}=`));
  if (!line) throw new Error(`no support cookie (status ${String(res.statusCode)})`);
  return line.split(';')[0] ?? '';
}

/** Opens a grant and exchanges its hand-off: the support tab's cookie. */
export async function supportTab(world: World, minutes = 60): Promise<Opened & { tab: string }> {
  const grant = await opened(world, minutes);
  const res = await exchange(world, handoffToken(grant.handoffUrl));
  if (res.statusCode !== 200) throw new Error(`exchange: ${String(res.statusCode)} ${res.body}`);
  return { ...grant, tab: supportCookie(res) };
}

export function request(
  world: World,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  cookie: string,
  body?: unknown,
) {
  return world.app.app.inject({
    method,
    url,
    headers: { cookie },
    ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
  });
}

const su = () => superuserDb(workerDatabaseName());

export async function grantRow(id: string) {
  const [row] = await su().select().from(supportAccessGrant).where(eq(supportAccessGrant.id, id));
  return row;
}

/** Moves a grant `ms` into the past (opened and expiry), as if that time had passed. */
export async function ageGrant(id: string, ms: number): Promise<void> {
  const row = await grantRow(id);
  if (!row) throw new Error('no grant');
  await su()
    .update(supportAccessGrant)
    .set({
      openedAt: new Date(row.openedAt.getTime() - ms),
      expiresAt: new Date(row.expiresAt.getTime() - ms),
    })
    .where(eq(supportAccessGrant.id, id));
}

/** Every `support.*` audit row, oldest first. */
export function supportAuditRows() {
  return su()
    .select()
    .from(auditEvent)
    .where(like(auditEvent.event, 'support.%'))
    .orderBy(auditEvent.at);
}
