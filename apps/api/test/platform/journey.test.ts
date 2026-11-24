// A-01-03 end to end through the API: the seed command creates a super admin, who sets a
// password through the printed link and enrols TOTP, creates a clinic with its owner, and the
// owner sets a password through their link and enrols TOTP; the owner's session then carries
// the owner role in the new clinic, and the owner's next sign-in asks for a code.
import { syntheticPhones } from '@shifa/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { get, sessionCookie, signIn, testClock } from '../identity/support.ts';
import { STEP_MS, totpAt } from '../identity/totp.ts';
import type { TestApp } from '../support.ts';
import {
  createClinicViaApi,
  platformApp,
  post,
  resetDatabase,
  setUpOwner,
  signedInAdmin,
} from './support.ts';

const [ADMIN_PHONE = '', OWNER_PHONE = ''] = syntheticPhones(2026_11_27, 2);
const clock = testClock();
let app: TestApp;

beforeAll(async () => {
  await resetDatabase();
  app = await platformApp(clock);
});

afterAll(async () => {
  await app.app.close();
});

describe('super admin to clinic owner', () => {
  it('seed → enrol → create clinic → owner link → password → TOTP → owner session', async () => {
    const admin = await signedInAdmin(app, clock, ADMIN_PHONE);
    expect((await get(app, '/auth/session', admin.cookie)).json()).toMatchObject({
      platformAdmin: true,
      mfa: 'verified',
      tenantId: null,
      roles: [],
    });

    const clinic = await createClinicViaApi(app, admin.cookie, OWNER_PHONE);
    const owner = await setUpOwner(app, clock, clinic.linkUrl);
    const session = await get(app, '/auth/session', owner.cookie);
    expect(session.json()).toMatchObject({
      platformAdmin: false,
      mfa: 'verified',
      tenantId: clinic.clinicId,
      roles: [{ role: 'owner', tenantId: clinic.clinicId, branchId: null }],
    });
    expect((await get(app, '/auth/sessions', owner.cookie)).statusCode).toBe(200);
    // An owner is no super admin.
    expect((await get(app, '/platform/clinics', owner.cookie)).statusCode).toBe(403);

    clock.advanceBy(2 * STEP_MS);
    const pending = sessionCookie(await signIn(app, OWNER_PHONE));
    expect((await get(app, '/auth/session', pending)).json()).toMatchObject({ mfa: 'pending' });
    const passed = await post(
      app,
      '/auth/mfa/challenge',
      { method: 'totp', code: totpAt(owner.manualKey, clock.now()) },
      pending,
    );
    expect(passed.json()).toMatchObject({
      session: { mfa: 'verified', tenantId: clinic.clinicId },
      recoveryCodesLeft: 10,
    });
  });
});
