// A-01a criteria 4 and 5: a setup link is one-time, valid 72 h, at least 128 bits, stored hashed,
// shown once with a wa.me share carrying only the link; re-issuing invalidates the earlier one;
// used, expired, replaced and unknown links give one answer with no clinic name. Opening an
// owner's link sets the password and then forces TOTP enrolment before anything else.
import { syntheticPhones } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CLINIC_NAME,
  createClinicViaApi,
  errorCode,
  linkRows,
  platformApp,
  platformAuditRows,
  post,
  resetDatabase,
  sha256Hex,
  signedInAdmin,
  tokenOf,
} from '../platform/support.ts';
import type { TestApp } from '../support.ts';
import { get, PASSWORD, sessionCookie, signIn, testClock } from './support.ts';

const HOUR = 3_600_000;
const phones = syntheticPhones(2026_11_23, 12);
const phone = (i: number) => phones[i] ?? '';

let app: TestApp;
let clock: FixedClock;
let admin: string;

beforeEach(async () => {
  await resetDatabase();
  clock = testClock();
  app = await platformApp(clock);
  admin = (await signedInAdmin(app, clock, phone(0))).cookie;
});

afterEach(async () => {
  await app.app.close();
});

const view = (token: string) => post(app, '/auth/setup-link/view', { token });
const consume = (token: string, password = PASSWORD) =>
  post(app, '/auth/setup-link/consume', { token, password });

describe('setup link token (criterion 4)', () => {
  it('carries 256 random bits (base64url) and only its SHA-256 is stored', async () => {
    const { linkUrl } = await createClinicViaApi(app, admin, phone(1));
    const token = tokenOf(linkUrl);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(linkUrl.startsWith('https://clinic.shifa.invalid/setup#')).toBe(true);
    const rows = await linkRows();
    expect(rows.map((r) => r.tokenHash)).toContain(sha256Hex(token));
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('two links never share a token', async () => {
    const a = await createClinicViaApi(app, admin, phone(1));
    const b = await createClinicViaApi(app, admin, phone(2));
    expect(tokenOf(a.linkUrl)).not.toBe(tokenOf(b.linkUrl));
  });

  it('is shared through wa.me with the link text only (no phone)', async () => {
    const created = await createClinicViaApi(app, admin, phone(1));
    const share = new URL(created.whatsappUrl);
    expect(`${share.origin}${share.pathname}`).toBe('https://wa.me/');
    expect([...share.searchParams.keys()]).toEqual(['text']);
    expect(share.searchParams.get('text')).toBe(created.linkUrl);
    const digits = phone(1).replace(/\D/g, '').slice(-9);
    expect(created.whatsappUrl).not.toContain(digits);
  });

  it('shows clinic name, person name, role and a 72 h expiry', async () => {
    const created = await createClinicViaApi(app, admin, phone(1));
    expect(new Date(created.expiresAt).getTime()).toBe(clock.now().getTime() + 72 * HOUR);
    const res = await view(tokenOf(created.linkUrl));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      clinicName: CLINIC_NAME,
      personName: 'مالك تجريبي',
      role: 'owner',
      purpose: 'owner_setup',
      expiresAt: created.expiresAt,
    });
  });
});

describe('one-time and one answer (criterion 4)', () => {
  it('is single use', async () => {
    const token = tokenOf((await createClinicViaApi(app, admin, phone(1))).linkUrl);
    expect((await consume(token)).statusCode).toBe(200);
    const again = await consume(token);
    expect(again.statusCode).toBe(404);
    expect(errorCode(again)).toBe('link_invalid');
    expect(errorCode(await view(token))).toBe('link_invalid');
  });

  it('expires after 72 h', async () => {
    const token = tokenOf((await createClinicViaApi(app, admin, phone(1))).linkUrl);
    clock.advanceBy(72 * HOUR - 1000);
    expect((await view(token)).statusCode).toBe(200);
    clock.advanceBy(1000);
    expect(errorCode(await view(token))).toBe('link_invalid');
    expect(errorCode(await consume(token))).toBe('link_invalid');
  });

  it('re-issuing invalidates the earlier link', async () => {
    const created = await createClinicViaApi(app, admin, phone(1));
    const reissued = await post(
      app,
      `/platform/clinics/${created.clinicId}/owner/setup-link`,
      undefined,
      admin,
    );
    expect(reissued.statusCode).toBe(200);
    const fresh = tokenOf(reissued.json<{ url: string }>().url);
    expect(errorCode(await view(tokenOf(created.linkUrl)))).toBe('link_invalid');
    expect(errorCode(await consume(tokenOf(created.linkUrl)))).toBe('link_invalid');
    expect((await consume(fresh)).statusCode).toBe(200);
  });

  it('used, expired, replaced and unknown links give the same body, without the clinic name', async () => {
    const used = tokenOf((await createClinicViaApi(app, admin, phone(1))).linkUrl);
    await consume(used);
    const replacedClinic = await createClinicViaApi(app, admin, phone(2));
    await post(
      app,
      `/platform/clinics/${replacedClinic.clinicId}/owner/setup-link`,
      undefined,
      admin,
    );
    const expiring = tokenOf((await createClinicViaApi(app, admin, phone(3))).linkUrl);
    const unknown = 'A'.repeat(43);

    const bodies = [];
    for (const token of [used, tokenOf(replacedClinic.linkUrl), unknown]) {
      bodies.push(await view(token));
    }
    clock.advanceBy(73 * HOUR);
    bodies.push(await view(expiring));
    for (const res of bodies) {
      expect(res.statusCode).toBe(404);
      expect(res.body).toBe(bodies[0]?.body);
      expect(res.body).not.toContain(CLINIC_NAME);
    }
  });
});

describe('setting the password (criteria 5, 8)', () => {
  it('refuses a password that breaks a rule, names the rule, and keeps the link usable', async () => {
    const token = tokenOf((await createClinicViaApi(app, admin, phone(1))).linkUrl);
    const short = await consume(token, 'short1');
    expect(short.statusCode).toBe(400);
    expect(errorCode(short)).toBe('password_too_short');
    const national = phone(1).replace(/\D/g, '').slice(3);
    const withPhone = await consume(token, `my phone ${national}`);
    expect(errorCode(withPhone)).toBe('password_contains_phone');
    const common = await consume(token, 'password1234');
    expect(errorCode(common)).toBe('password_common');
    expect((await view(token)).statusCode).toBe(200);
  });

  it('signs the owner in at mfa "none" and forces TOTP enrolment before any other route', async () => {
    const token = tokenOf((await createClinicViaApi(app, admin, phone(1))).linkUrl);
    const res = await consume(token);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ mfa: 'none', mfaRequired: true, platformAdmin: false });
    const cookie = sessionCookie(res);

    const blocked = await get(app, '/auth/sessions', cookie);
    expect(blocked.statusCode).toBe(403);
    expect(errorCode(blocked)).toBe('mfa_enrolment_required');
    expect(errorCode(await post(app, '/auth/sessions/end-others', undefined, cookie))).toBe(
      'mfa_enrolment_required',
    );
    // The session view and enrolment stay reachable.
    expect((await get(app, '/auth/session', cookie)).statusCode).toBe(200);
    expect((await post(app, '/auth/mfa/enrol/start', undefined, cookie)).statusCode).toBe(200);
  });

  it('the owner can sign in with phone and password afterwards', async () => {
    const token = tokenOf((await createClinicViaApi(app, admin, phone(1))).linkUrl);
    await consume(token);
    const res = await signIn(app, phone(1));
    expect(res.statusCode).toBe(200);
  });

  it('a new link for a set-up owner resets the password: the old one stops working at once', async () => {
    const created = await createClinicViaApi(app, admin, phone(1));
    await consume(tokenOf(created.linkUrl));
    const reissued = await post(
      app,
      `/platform/clinics/${created.clinicId}/owner/setup-link`,
      undefined,
      admin,
    );
    expect((await signIn(app, phone(1))).statusCode).toBe(401);
    const fresh = tokenOf(reissued.json<{ url: string }>().url);
    expect((await consume(fresh, 'another calm password 7')).statusCode).toBe(200);
    expect((await signIn(app, phone(1), 'another calm password 7')).statusCode).toBe(200);
  });

  it('audits link use with the membership as target and no token', async () => {
    const created = await createClinicViaApi(app, admin, phone(1));
    const token = tokenOf(created.linkUrl);
    await consume(token);
    const rows = await platformAuditRows();
    // The last one: the super admin of beforeEach used a link first.
    const used = rows.filter((r) => r.event === 'auth.link_used').at(-1);
    expect(used?.targetId).toBe(created.ownerMembershipId);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(JSON.stringify(rows)).not.toContain(sha256Hex(token));
  });
});
