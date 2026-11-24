// A-01-11 security review M1: a clinic whose owner is set up can also hold a pending co-owner
// the owner invited. The super admin's card, list and support actions always name the set-up
// owner, and the phone edit answers 409 `owner_account_exists` (OD-99), never a new owner link
// for the co-owner.
import { syntheticPhones } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { get, testClock } from '../identity/support.ts';
import type { TestApp } from '../support.ts';
import { addMember } from '../team/support.ts';
import {
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

const phones = syntheticPhones(2026_12_01, 6);
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

/** A set-up owner who invited a co-owner (pending, owner role). */
async function clinicWithCoOwner() {
  const created = await createClinicViaApi(app, admin.cookie, phone(1));
  const owner = await setUpOwner(app, clock, created.linkUrl);
  const added = await addMember(app, owner.cookie, {
    phone: phone(2),
    roles: [{ role: 'owner', branchId: null }],
  });
  expect(added.res.statusCode, added.res.body).toBe(201);
  return { created, coOwnerId: added.membershipId };
}

describe('a pending co-owner next to a set-up owner (security review M1)', () => {
  it('the card and the list name the set-up owner, once', async () => {
    const { created, coOwnerId } = await clinicWithCoOwner();
    const card = await get(app, `/platform/clinics/${created.clinicId}`, admin.cookie);
    expect(card.json()).toMatchObject({
      ownerStatus: 'active',
      owner: { membershipId: created.ownerMembershipId, status: 'active' },
    });
    expect(card.json<{ owner: { membershipId: string } }>().owner.membershipId).not.toBe(coOwnerId);
    const list = await get(app, '/platform/clinics', admin.cookie);
    expect(list.json()).toMatchObject({
      clinics: [{ id: created.clinicId, ownerStatus: 'active' }],
    });
  });

  it('the phone edit → 409 owner_account_exists, no link for the co-owner', async () => {
    const { created, coOwnerId } = await clinicWithCoOwner();
    const before = (await linkRows()).length;
    const res = await patch(
      app,
      `/platform/clinics/${created.clinicId}/owner`,
      { phone: phone(3) },
      admin.cookie,
    );
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('owner_account_exists');
    expect(await linkRows()).toHaveLength(before);
    // The co-owner's invitation is still the open one: nothing was replaced or issued for them.
    expect(
      (await linkRows()).filter((l) => l.membershipId === coOwnerId && l.replacedAt === null),
    ).toHaveLength(1);
    expect((await platformAuditRows()).filter((r) => r.event === 'owner.phone_changed')).toEqual(
      [],
    );
  });

  it('reset MFA and end sessions act on the set-up owner (no 409)', async () => {
    const { created } = await clinicWithCoOwner();
    for (const action of ['reset-mfa', 'end-sessions']) {
      const res = await post(
        app,
        `/platform/clinics/${created.clinicId}/owner/${action}`,
        undefined,
        admin.cookie,
      );
      expect(res.statusCode, `${action} ${res.body}`).toBe(204);
    }
  });
});
