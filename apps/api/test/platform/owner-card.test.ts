// A-01a criteria 3 and 13 (A-01-11): the clinics list carries the owner's status; the owner card
// carries the masked phone (country code and last three digits, never the full number) and the
// expiry of the owner's open link, past or future, null when none is open; MFA reset and ending
// sessions answer 409 `owner_setup_pending` for an owner without an account, with no owner.*
// audit row.
import { createClinic } from '@shifa/db';
import { syntheticPhones, testPlatformDb } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { get, sessionCookie, signIn, testClock } from '../identity/support.ts';
import { totpAt } from '../identity/totp.ts';
import type { TestApp } from '../support.ts';
import {
  createClinicViaApi,
  errorCode,
  platformApp,
  platformAuditRows,
  post,
  resetDatabase,
  type SignedInAdmin,
  setUpOwner,
  signedInAdmin,
} from './support.ts';

const phones = syntheticPhones(2026_11_28, 12);
const phone = (i: number) => phones[i] ?? '';
const HOUR = 3_600_000;

let app: TestApp;
let clock: FixedClock;
let admin: SignedInAdmin;

beforeEach(async () => {
  await resetDatabase();
  clock = testClock();
  app = await platformApp(clock);
  admin = await signedInAdmin(app, clock, phone(0));
});

/** A new session of the super admin (password and TOTP), after a clock jump past its limits. */
async function signInAdminAgain(): Promise<void> {
  const pending = sessionCookie(await signIn(app, admin.phone));
  const passed = await post(
    app,
    '/auth/mfa/challenge',
    { method: 'totp', code: totpAt(admin.manualKey, clock.now()) },
    pending,
  );
  expect(passed.statusCode, passed.body).toBe(200);
  admin = { ...admin, cookie: sessionCookie(passed) };
}

afterEach(async () => {
  await app.app.close();
});

interface Owner {
  membershipId: string;
  name: string;
  status: string;
  phoneMasked: string;
  linkExpiresAt: string | null;
}

async function detail(clinicId: string) {
  const res = await get(app, `/platform/clinics/${clinicId}`, admin.cookie);
  expect(res.statusCode, res.body).toBe(200);
  return { body: res.body, owner: res.json<{ owner: Owner }>().owner };
}

async function list() {
  const res = await get(app, '/platform/clinics', admin.cookie);
  expect(res.statusCode, res.body).toBe(200);
  return res.json<{ clinics: { id: string; ownerStatus: string | null }[] }>().clinics;
}

describe('owner status in the clinics list (criterion 3)', () => {
  it('pending, active, and null for a clinic without an owner row', async () => {
    const pending = await createClinicViaApi(app, admin.cookie, phone(1));
    const active = await createClinicViaApi(app, admin.cookie, phone(2), { name: 'عيادة ثانية' });
    await setUpOwner(app, clock, active.linkUrl);
    const bare = await testPlatformDb().withPlatformAdmin(
      { actorId: admin.userId, event: 'clinic.created' },
      (tx) => createClinic(tx, { name: 'عيادة بلا مالك', type: 'solo' }),
    );
    const byId = new Map((await list()).map((c) => [c.id, c.ownerStatus]));
    expect(byId.get(pending.clinicId)).toBe('pending');
    expect(byId.get(active.clinicId)).toBe('active');
    expect(byId.get(bare.tenantId)).toBeNull();
    const res = await get(app, `/platform/clinics/${bare.tenantId}`, admin.cookie);
    expect(res.json()).toMatchObject({ ownerStatus: null, owner: null });
  });
});

describe('owner card (criterion 13)', () => {
  it('the masked phone: country code and the last three digits, never the full phone', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(3));
    const { body, owner } = await detail(created.clinicId);
    expect(owner.phoneMasked).toBe(`+963 ••• ••• ${phone(3).slice(-3)}`);
    expect(body).not.toContain(phone(3));
    expect(body).not.toContain(phone(3).slice(4));
    const listed = await get(app, '/platform/clinics', admin.cookie);
    expect(listed.body).not.toContain(phone(3).slice(4));
  });

  it('a fresh link’s expiry; still shown once it has passed', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(4));
    expect((await detail(created.clinicId)).owner.linkExpiresAt).toBe(created.expiresAt);
    clock.advanceBy(73 * HOUR);
    await signInAdminAgain();
    const later = await detail(created.clinicId);
    expect(later.owner.linkExpiresAt).toBe(created.expiresAt);
    expect(Date.parse(later.owner.linkExpiresAt ?? '')).toBeLessThan(clock.now().getTime());
  });

  it('null once the link is used; a re-issued link’s new date', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(5));
    // Within the super admin's 15 min idle limit.
    clock.advanceBy(60_000);
    const reissued = await post(
      app,
      `/platform/clinics/${created.clinicId}/owner/setup-link`,
      undefined,
      admin.cookie,
    );
    expect(reissued.statusCode).toBe(200);
    const next = reissued.json<{ url: string; expiresAt: string }>();
    expect(next.expiresAt).not.toBe(created.expiresAt);
    expect((await detail(created.clinicId)).owner.linkExpiresAt).toBe(next.expiresAt);
    await setUpOwner(app, clock, next.url);
    const after = await detail(created.clinicId);
    expect(after.owner).toMatchObject({ status: 'active', linkExpiresAt: null });
  });
});

describe('no-op owner actions (A-01-11 gap 6)', () => {
  it.each([
    ['reset-mfa', 'owner.mfa_reset'],
    ['end-sessions', 'owner.sessions_ended'],
  ])('%s on a pending owner → 409 owner_setup_pending, no audit row', async (action, event) => {
    const created = await createClinicViaApi(app, admin.cookie, phone(6));
    const res = await post(
      app,
      `/platform/clinics/${created.clinicId}/owner/${action}`,
      undefined,
      admin.cookie,
    );
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('owner_setup_pending');
    expect((await platformAuditRows()).filter((r) => r.event === event)).toEqual([]);
  });

  it('a new setup link for a pending owner still works', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(7));
    const res = await post(
      app,
      `/platform/clinics/${created.clinicId}/owner/setup-link`,
      undefined,
      admin.cookie,
    );
    expect(res.statusCode).toBe(200);
  });
});
