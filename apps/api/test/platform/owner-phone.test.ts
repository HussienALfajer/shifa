// A-01a criterion 13, OD-99 (A-01-11): the super admin corrects a pending owner's phone. The
// earlier link stops working and a new one is shown once (an invitation when the new phone has
// an account); refused once the owner has an account (409 `owner_account_exists`) and for a phone
// that owns another clinic not set up (409 `owner_setup_pending`, OD-85); audited without the
// phone.
import { syntheticPhones } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { get, PASSWORD, sessionCookie, signIn, testClock } from '../identity/support.ts';
import { STEP_MS, totpAt } from '../identity/totp.ts';
import type { TestApp } from '../support.ts';
import {
  createClinicViaApi,
  errorCode,
  patch,
  platformApp,
  platformAuditRows,
  post,
  resetDatabase,
  setUpOwner,
  signedInAdmin,
  tokenOf,
} from './support.ts';

const phones = syntheticPhones(2026_11_29, 14);
const phone = (i: number) => phones[i] ?? '';

let app: TestApp;
let clock: FixedClock;
let admin: { cookie: string; userId: string };

beforeEach(async () => {
  await resetDatabase();
  clock = testClock();
  app = await platformApp(clock);
  admin = await signedInAdmin(app, clock, phone(0));
});

afterEach(async () => {
  await app.app.close();
});

const changePhone = (clinicId: string, newPhone: string, cookie = admin.cookie) =>
  patch(app, `/platform/clinics/${clinicId}/owner`, { phone: newPhone }, cookie);

interface Issued {
  url: string;
  whatsappUrl: string;
  purpose: string;
  expiresAt: string;
}

describe('pending owner’s phone (OD-99)', () => {
  it('a new link works, the earlier one is invalid, the card shows the new phone, audited', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(1));
    clock.advanceBy(60_000);
    const res = await changePhone(created.clinicId, phone(2));
    expect(res.statusCode, res.body).toBe(200);
    const issued = res.json<Issued>();
    expect(issued.purpose).toBe('owner_setup');
    expect(issued.whatsappUrl).toContain(encodeURIComponent(issued.url));
    expect(res.body).not.toContain(phone(2).slice(4));

    const old = await post(app, '/auth/setup-link/view', { token: tokenOf(created.linkUrl) });
    expect(old.statusCode).toBe(404);
    expect(errorCode(old)).toBe('link_invalid');
    const view = await post(app, '/auth/setup-link/view', { token: tokenOf(issued.url) });
    expect(view.statusCode).toBe(200);
    expect(view.json()).toMatchObject({ phoneMasked: `+963 ••• ••• ${phone(2).slice(-3)}` });

    const card = await get(app, `/platform/clinics/${created.clinicId}`, admin.cookie);
    expect(card.json()).toMatchObject({
      owner: {
        status: 'pending',
        phoneMasked: `+963 ••• ••• ${phone(2).slice(-3)}`,
        linkExpiresAt: issued.expiresAt,
      },
    });

    await setUpOwner(app, clock, issued.url);
    clock.advanceBy(STEP_MS);
    expect((await signIn(app, phone(2), PASSWORD)).statusCode).toBe(200);
    expect((await signIn(app, phone(1), PASSWORD)).statusCode).toBe(401);

    const rows = (await platformAuditRows()).filter((r) => r.event === 'owner.phone_changed');
    expect(rows).toMatchObject([
      {
        actorId: admin.userId,
        targetId: created.ownerMembershipId,
        tenantId: null,
        data: { clinicId: created.clinicId, linkPurpose: 'owner_setup' },
      },
    ]);
    const all = JSON.stringify(await platformAuditRows());
    for (const p of [phone(1), phone(2)]) expect(all).not.toContain(p.slice(4));
  });

  it('to a phone with an account: an invitation, accepted by that person', async () => {
    const other = await createClinicViaApi(app, admin.cookie, phone(3), { name: 'عيادة أولى' });
    const person = await setUpOwner(app, clock, other.linkUrl);
    const created = await createClinicViaApi(app, admin.cookie, phone(4));
    const res = await changePhone(created.clinicId, phone(3));
    expect(res.statusCode, res.body).toBe(200);
    const issued = res.json<Issued>();
    expect(issued.purpose).toBe('invitation');

    clock.advanceBy(2 * STEP_MS);
    const pending = sessionCookie(await signIn(app, phone(3)));
    const passed = await post(
      app,
      '/auth/mfa/challenge',
      { method: 'totp', code: totpAt(person.manualKey, clock.now()) },
      pending,
    );
    expect(passed.statusCode).toBe(200);
    const accepted = await post(
      app,
      '/invitations/accept',
      { token: tokenOf(issued.url) },
      sessionCookie(passed),
    );
    expect(accepted.statusCode, accepted.body).toBeLessThan(300);
    const card = await get(app, `/platform/clinics/${created.clinicId}`, admin.cookie);
    expect(card.json()).toMatchObject({ owner: { status: 'active', linkExpiresAt: null } });
    const rows = (await platformAuditRows()).filter((r) => r.event === 'owner.phone_changed');
    expect(rows).toMatchObject([{ data: { linkPurpose: 'invitation' } }]);
  });

  it('an invalid phone → 400 validation_failed on body.phone', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(5));
    const res = await changePhone(created.clinicId, '12');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'validation_failed', details: [{ path: 'body.phone' }] },
    });
    expect(res.body).not.toContain('"12"');
  });

  it('an owner with an account → 409 owner_account_exists, nothing changed', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(6));
    await setUpOwner(app, clock, created.linkUrl);
    const res = await changePhone(created.clinicId, phone(7));
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('owner_account_exists');
    const card = await get(app, `/platform/clinics/${created.clinicId}`, admin.cookie);
    expect(card.json()).toMatchObject({
      owner: { phoneMasked: `+963 ••• ••• ${phone(6).slice(-3)}` },
    });
    expect((await platformAuditRows()).filter((r) => r.event === 'owner.phone_changed')).toEqual(
      [],
    );
  });

  it('a phone that owns another clinic not set up → 409 owner_setup_pending (OD-85)', async () => {
    await createClinicViaApi(app, admin.cookie, phone(8), { name: 'عيادة أولى' });
    const created = await createClinicViaApi(app, admin.cookie, phone(9));
    const res = await changePhone(created.clinicId, phone(8));
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('owner_setup_pending');
    const old = await post(app, '/auth/setup-link/view', { token: tokenOf(created.linkUrl) });
    expect(old.statusCode).toBe(200);
  });

  it('an unknown clinic → 404', async () => {
    const res = await changePhone('0193c5a4-7b2e-7c1a-9f00-00000000dead', phone(10));
    expect(res.statusCode).toBe(404);
  });

  it('a clinic user → 403', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(11));
    const owner = await setUpOwner(app, clock, created.linkUrl);
    const target = await createClinicViaApi(app, admin.cookie, phone(12), { name: 'عيادة ثانية' });
    const res = await changePhone(target.clinicId, phone(13), owner.cookie);
    expect(res.statusCode).toBe(403);
  });
});
