// A-01a criteria 2, 3, 13 and 14 through the super-admin API: a clinic and its owner are created
// in one transaction and audited; status and end date edits are audited and the end date does
// nothing else; each owner reset ends the owner's sessions and writes one audit row; super
// admins see no clinic data; platform rows are invisible to shifa_app. Same owner phone in two
// clinics: the second creation issues an invitation, not a second account.
import { randomUUID } from 'node:crypto';
import {
  auditEvent,
  branch,
  deploymentRoute,
  membership,
  organization,
  roleAssignment,
  tenant,
  user,
} from '@shifa/db';
import {
  superuserDb,
  syntheticPhones,
  testAuthDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  get,
  PASSWORD,
  sessionCookie,
  sessionRows,
  signIn,
  testClock,
} from '../identity/support.ts';
import { STEP_MS, totpAt } from '../identity/totp.ts';
import type { TestApp } from '../support.ts';
import {
  CLINIC_NAME,
  createClinicViaApi,
  errorCode,
  linkRows,
  patch,
  platformApp,
  platformAuditRows,
  post,
  resetDatabase,
  setUpOwner,
  signedInAdmin,
} from './support.ts';

const phones = syntheticPhones(2026_11_25, 12);
const phone = (i: number) => phones[i] ?? '';
const su = () => superuserDb(workerDatabaseName());

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

describe('creating a clinic with its owner (criteria 2, 3)', () => {
  it('writes tenant, organization, main branch, route, pending owner membership, owner role and link', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(1));
    const id = created.clinicId;
    expect(await su().select().from(tenant).where(eq(tenant.id, id))).toMatchObject([
      { name: CLINIC_NAME, type: 'multi_doctor', status: 'trial', subscriptionEnd: '2027-06-30' },
    ]);
    expect(
      await su().select().from(organization).where(eq(organization.tenantId, id)),
    ).toHaveLength(1);
    expect(await su().select().from(branch).where(eq(branch.tenantId, id))).toMatchObject([
      { name: 'الفرع الرئيسي', archivedAt: null },
    ]);
    expect(
      await su().select().from(deploymentRoute).where(eq(deploymentRoute.tenantId, id)),
    ).toHaveLength(1);
    expect(await su().select().from(membership).where(eq(membership.tenantId, id))).toMatchObject([
      { id: created.ownerMembershipId, userId: null, status: 'pending', phoneE164: phone(1) },
    ]);
    expect(
      await su().select().from(roleAssignment).where(eq(roleAssignment.tenantId, id)),
    ).toMatchObject([{ membershipId: created.ownerMembershipId, role: 'owner', branchId: null }]);
    expect(await linkRows()).toMatchObject([
      { tenantId: id, membershipId: created.ownerMembershipId, purpose: 'owner_setup' },
    ]);
    const audit = (await platformAuditRows()).filter((r) => r.event === 'clinic.created');
    expect(audit).toMatchObject([{ tenantId: null, actorId: admin.userId, targetId: id }]);
  });

  it('leaves nothing behind when the owner cannot be written (one transaction)', async () => {
    const res = await post(
      app,
      '/platform/clinics',
      {
        name: CLINIC_NAME,
        type: 'solo',
        status: 'trial',
        ownerName: '   ',
        ownerPhone: phone(2),
      },
      admin.cookie,
    );
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(await su().select().from(tenant)).toHaveLength(0);
    expect(await su().select().from(membership)).toHaveLength(0);
    expect((await platformAuditRows()).filter((r) => r.event === 'clinic.created')).toHaveLength(0);
  });

  it('refuses a malformed owner phone with 400 on body.ownerPhone', async () => {
    const res = await post(
      app,
      '/platform/clinics',
      { name: CLINIC_NAME, type: 'solo', status: 'trial', ownerName: 'مالك', ownerPhone: '12' },
      admin.cookie,
    );
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'validation_failed', details: [{ path: 'body.ownerPhone' }] },
    });
  });

  it('an owner phone that already has an account gets an invitation, not a second account', async () => {
    const first = await createClinicViaApi(app, admin.cookie, phone(3));
    await setUpOwner(app, clock, first.linkUrl);
    const second = await createClinicViaApi(app, admin.cookie, phone(3), { name: 'عيادة ثانية' });
    expect(second.linkPurpose).toBe('invitation');
    const accounts = await testAuthDb().withAuth((tx) =>
      tx
        .select()
        .from(user)
        .where(eq(user.phoneNumber, phone(3))),
    );
    expect(accounts).toHaveLength(1);
  });

  it('lists clinics with the owner name, and searches by name', async () => {
    await createClinicViaApi(app, admin.cookie, phone(4));
    await createClinicViaApi(app, admin.cookie, phone(5), { name: 'مركز النور' });
    const all = await get(app, '/platform/clinics', admin.cookie);
    expect(all.statusCode).toBe(200);
    expect(all.json<{ clinics: unknown[] }>().clinics).toHaveLength(2);
    const found = await get(
      app,
      `/platform/clinics?search=${encodeURIComponent('النور')}`,
      admin.cookie,
    );
    expect(found.json()).toMatchObject({
      clinics: [{ name: 'مركز النور', ownerName: 'مالك تجريبي' }],
    });
    // LIKE wildcards are matched literally.
    const wild = await get(app, '/platform/clinics?search=%25', admin.cookie);
    expect(wild.json<{ clinics: unknown[] }>().clinics).toHaveLength(0);
  });
});

describe('status and end date (criterion 3)', () => {
  it('edits status and end date, audited; the end date has no other effect', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(6));
    const owner = await setUpOwner(app, clock, created.linkUrl);
    const res = await patch(
      app,
      `/platform/clinics/${created.clinicId}`,
      { status: 'active', subscriptionEnd: '2020-01-01' },
      admin.cookie,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'active', subscriptionEnd: '2020-01-01' });
    // A past end date changes nothing for the clinic's people.
    expect((await get(app, '/auth/sessions', owner.cookie)).statusCode).toBe(200);
    const cleared = await patch(
      app,
      `/platform/clinics/${created.clinicId}`,
      { subscriptionEnd: null },
      admin.cookie,
    );
    expect(cleared.json()).toMatchObject({ status: 'active', subscriptionEnd: null });
    const rows = (await platformAuditRows()).filter((r) => r.event === 'clinic.status_changed');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      targetId: created.clinicId,
      actorId: admin.userId,
      tenantId: null,
    });
  });

  it('answers 404 for an unknown clinic', async () => {
    const res = await patch(
      app,
      `/platform/clinics/${randomUUID()}`,
      { status: 'active' },
      admin.cookie,
    );
    expect(res.statusCode).toBe(404);
  });
});

describe('owner support actions (criterion 13)', () => {
  async function setUpClinic(i: number) {
    const created = await createClinicViaApi(app, admin.cookie, phone(i));
    const owner = await setUpOwner(app, clock, created.linkUrl);
    const ownerId = (
      await su().select().from(membership).where(eq(membership.id, created.ownerMembershipId))
    )[0]?.userId;
    return { created, owner, ownerId: ownerId ?? '' };
  }

  it.each([
    ['setup-link', 'owner.link_issued'],
    ['reset-mfa', 'owner.mfa_reset'],
    ['end-sessions', 'owner.sessions_ended'],
  ])('%s ends every session of the owner and writes one audit row', async (action, event) => {
    const { created, owner, ownerId } = await setUpClinic(7);
    const res = await post(
      app,
      `/platform/clinics/${created.clinicId}/owner/${action}`,
      undefined,
      admin.cookie,
    );
    expect(res.statusCode).toBeLessThan(300);
    expect(await sessionRows(ownerId)).toHaveLength(0);
    expect((await get(app, '/auth/session', owner.cookie)).statusCode).toBe(401);
    const rows = (await platformAuditRows()).filter((r) => r.event === event);
    expect(rows).toMatchObject([{ actorId: admin.userId, targetId: ownerId, tenantId: null }]);
  });

  it('after an MFA reset the owner enrols again at the next sign-in', async () => {
    const { created } = await setUpClinic(8);
    await post(
      app,
      `/platform/clinics/${created.clinicId}/owner/reset-mfa`,
      undefined,
      admin.cookie,
    );
    clock.advanceBy(STEP_MS);
    const cookie = sessionCookie(await signIn(app, phone(8), PASSWORD));
    expect((await get(app, '/auth/session', cookie)).json()).toMatchObject({ mfa: 'none' });
    expect(errorCode(await get(app, '/auth/sessions', cookie))).toBe('mfa_enrolment_required');
  });

  it('detail shows the clinic and its owner card, and no clinic data', async () => {
    const { created } = await setUpClinic(9);
    const res = await get(app, `/platform/clinics/${created.clinicId}`, admin.cookie);
    expect(res.statusCode).toBe(200);
    const body = res.json<Record<string, unknown>>();
    expect(body).toMatchObject({
      id: created.clinicId,
      name: CLINIC_NAME,
      owner: { membershipId: created.ownerMembershipId, name: 'مالك تجريبي', status: 'active' },
    });
    expect(Object.keys(body).sort()).toEqual(
      ['createdAt', 'id', 'name', 'owner', 'status', 'subscriptionEnd', 'type', 'ownerName'].sort(),
    );
  });

  it('super admins see no tenant rows on their own path', async () => {
    const { created } = await setUpClinic(10);
    // No privilege at all on clinic tables (permission denied), even for a clinic it created.
    for (const table of [branch, organization]) {
      const outcome = await testPlatformDb()
        .withPlatformAdmin({ actorId: admin.userId, event: 'clinic.status_changed' }, (tx) =>
          tx.select().from(table),
        )
        .then(
          (rows) => `rows:${String(rows.length)}`,
          (err: { code?: string }) => `error:${String(err.code)}`,
        );
      expect(outcome).toBe('error:42501');
    }
    // The detail of a clinic the admin can open still carries no branch.
    const detail = await get(app, `/platform/clinics/${created.clinicId}`, admin.cookie);
    expect(detail.body).not.toContain('الفرع الرئيسي');
  });

  it('only super admins reach the platform routes', async () => {
    const { owner } = await setUpClinic(11);
    const res = await get(app, '/platform/clinics', owner.cookie);
    expect(res.statusCode).toBe(403);
    expect((await get(app, '/platform/clinics')).statusCode).toBe(401);
  });
});

describe('platform rows (criterion 14)', () => {
  it('are invisible to shifa_app tenant queries', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(2));
    const rows = await testDb().withTenant(
      { tenantId: created.clinicId, userId: randomUUID() },
      (tx) => tx.select().from(auditEvent),
    );
    expect(rows).toHaveLength(0);
    expect((await platformAuditRows()).length).toBeGreaterThan(0);
  });
});

describe('super admin MFA (criterion 11)', () => {
  it('a super admin before enrolment reaches no platform route', async () => {
    const { seedSuperAdmin } = await import('../../src/modules/identity/index.ts');
    const seeded = await seedSuperAdmin({
      authDb: testAuthDb(),
      platformDb: testPlatformDb(),
      phone: phone(11),
      name: 'مشرف ثان',
      clock,
      clinicWebUrl: 'https://clinic.shifa.invalid',
    });
    const consumed = await post(app, '/auth/setup-link/consume', {
      token: seeded.setupUrl.split('#')[1],
      password: PASSWORD,
    });
    expect(consumed.json()).toMatchObject({ platformAdmin: true, mfa: 'none', mfaRequired: true });
    const res = await get(app, '/platform/clinics', sessionCookie(consumed));
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('mfa_enrolment_required');
  });

  it('a super admin signs in later with phone, password and a TOTP code', async () => {
    const enrolledAdmin = await signedInAdmin(app, clock, phone(10));
    clock.advanceBy(2 * STEP_MS);
    const pending = sessionCookie(await signIn(app, phone(10)));
    expect(errorCode(await get(app, '/platform/clinics', pending))).toBe('mfa_challenge_required');
    const passed = await post(
      app,
      '/auth/mfa/challenge',
      { method: 'totp', code: totpAt(enrolledAdmin.manualKey, clock.now()) },
      pending,
    );
    expect((await get(app, '/platform/clinics', sessionCookie(passed))).statusCode).toBe(200);
  });
});
