// A-01a screen "Setup link" (A-01-09 1k): the page shows the link's phone masked (country code
// and last three digits) for owner, member and super-admin links; the full number never appears
// in the view's body before the password is set.
import { testAuthDb, testPlatformDb } from '@shifa/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedSuperAdmin } from '../../src/modules/identity/index.ts';
import { CLINIC_WEB_URL, createClinicViaApi } from '../platform/support.ts';
import { addMember, post, type TeamWorld, teamWorld, tokenOf } from '../team/support.ts';
import { testClock } from './support.ts';

const clock = testClock();
let world: TeamWorld;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_01);
});

afterAll(async () => {
  await world.app.app.close();
});

/** `+963 ••• ••• 123` for a Syrian number, `+90 ••• ••• 123` for a Turkish one. */
function expectedMask(phone: string): string {
  const code = phone.startsWith('+963') ? '+963' : '+90';
  return `${code} ••• ••• ${phone.slice(-3)}`;
}

async function viewOf(url: string) {
  const res = await post(world.app, '/auth/setup-link/view', { token: tokenOf(url) });
  expect(res.statusCode, res.body).toBe(200);
  return res;
}

describe('masked phone on the setup page', () => {
  it('owner link', async () => {
    const phone = world.phone();
    const created = await createClinicViaApi(world.app, world.admin.cookie, phone);
    const res = await viewOf(created.linkUrl);
    expect(res.json()).toMatchObject({ phoneMasked: expectedMask(phone) });
    expect(res.body).not.toContain(phone);
    expect(res.body).not.toContain(phone.slice(1));
  });

  it('member link', async () => {
    const clinic = await world.clinic();
    const phone = world.phone();
    const added = await addMember(world.app, clinic.owner.cookie, {
      phone,
      roles: [{ role: 'doctor', branchId: null }],
    });
    const res = await viewOf(added.linkUrl);
    expect(res.json()).toMatchObject({ phoneMasked: expectedMask(phone) });
    expect(res.body).not.toContain(phone);
  });

  it('super admin link', async () => {
    const phone = world.phone();
    const seeded = await seedSuperAdmin({
      authDb: testAuthDb(),
      platformDb: testPlatformDb(),
      phone,
      name: 'مشرف ثان',
      clock,
      clinicWebUrl: CLINIC_WEB_URL,
    });
    const res = await viewOf(seeded.setupUrl);
    expect(res.json()).toMatchObject({ phoneMasked: expectedMask(phone) });
    expect(res.body).not.toContain(phone);
  });
});
