// A-01a criterion 15: BetterAuthAdapter replaces NoAuthAdapter. It builds the principal from the
// session (active tenant and branch) and the server-side memberships of that tenant only,
// validates it with Zod, and its failures never carry the cookie, the token or a phone.
import { membership } from '@shifa/db';
import { fixtureId, insertMembership, syntheticPhones, testDb } from '@shifa/db/testing';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AUTH_PORT } from '../../src/access/auth.port.ts';
import { BetterAuthAdapter } from '../../src/modules/identity/index.ts';
import { buildTestApp, type TestApp } from '../support.ts';
import {
  get,
  identityApp,
  resetWithTenants,
  seedPerson,
  sessionCookie,
  signIn,
} from './support.ts';

const TENANT_A = fixtureId('adapter:tenant-a');
const TENANT_B = fixtureId('adapter:tenant-b');
const phones = syntheticPhones(2026_11_15, 6);
const phone = (i: number) => phones[i] ?? '';

let app: TestApp | undefined;

beforeEach(async () => {
  await resetWithTenants(TENANT_A, TENANT_B);
});

afterEach(async () => {
  await app?.app.close();
  app = undefined;
});

describe('BetterAuthAdapter', () => {
  it('is the production AuthPort', async () => {
    app = await identityApp();
    expect(app.app.get(AUTH_PORT)).toBeInstanceOf(BetterAuthAdapter);
  });

  it('one active membership: that clinic and its only branch are active, with its roles', async () => {
    app = await identityApp();
    const person = await seedPerson(phone(0), { tenantId: TENANT_A, role: 'receptionist' });
    const res = await signIn(app, phone(0));
    expect(res.json()).toMatchObject({
      userId: person.userId,
      tenantId: TENANT_A,
      branchId: person.branchId,
      roles: [{ role: 'receptionist', tenantId: TENANT_A, branchId: null }],
    });
  });

  it('two memberships: no active clinic until one is chosen (A-01-05), no roles', async () => {
    app = await identityApp();
    const person = await seedPerson(phone(1), { tenantId: TENANT_A, role: 'doctor' });
    await testDb().withTenant({ tenantId: TENANT_B, userId: person.userId }, async (tx) => {
      await insertMembership(tx, {
        id: fixtureId('adapter:second'),
        tenantId: TENANT_B,
        phone: phone(1),
        userId: person.userId,
      });
    });
    const res = await signIn(app, phone(1));
    expect(res.json()).toMatchObject({ tenantId: null, branchId: null, roles: [] });
  });

  it('a membership deactivated after sign-in: the next request has no active clinic and no roles', async () => {
    app = await identityApp();
    const person = await seedPerson(phone(2), { tenantId: TENANT_A, role: 'owner' });
    const cookie = sessionCookie(await signIn(app, phone(2)));
    await testDb().withTenant({ tenantId: TENANT_A, userId: person.userId }, (tx) =>
      tx
        .update(membership)
        .set({ status: 'deactivated' })
        .where(eq(membership.id, person.membershipId ?? '')),
    );
    const view = (await get(app, '/auth/session', cookie)).json<Record<string, unknown>>();
    expect(view).toMatchObject({
      userId: person.userId,
      tenantId: null,
      branchId: null,
      roles: [],
    });
  });

  it('a failing identity database: 500, and neither logs nor body carry the token', async () => {
    app = await identityApp();
    await seedPerson(phone(3));
    const cookie = sessionCookie(await signIn(app, phone(3)));
    const token = decodeURIComponent(cookie.split('=')[1] ?? '').split('.')[0] ?? '';
    await app.app.close();
    const echoing = {
      withAuth: () => Promise.reject(new Error(`lookup failed for ${token} / ${phone(3)}`)),
      withUser: () => Promise.reject(new Error(`lookup failed for ${token}`)),
      withSetupLink: () => Promise.reject(new Error('unused')),
      withUserLink: () => Promise.reject(new Error('unused')),
      close: () => Promise.resolve(),
    };
    app = await buildTestApp({ db: testDb(), authDb: echoing });
    const res = await get(app, '/auth/session', cookie);
    expect(res.statusCode).toBe(500);
    for (const text of [res.body, app.logs.text()]) {
      expect(text).not.toContain(token);
      expect(text).not.toContain(phone(3));
    }
  });

  it('a forged cookie never reaches the database', async () => {
    let calls = 0;
    const counting = {
      withAuth: () => {
        calls += 1;
        return Promise.reject(new Error('offline'));
      },
      withUser: () => Promise.reject(new Error('offline')),
      withSetupLink: () => Promise.reject(new Error('offline')),
      withUserLink: () => Promise.reject(new Error('offline')),
      close: () => Promise.resolve(),
    };
    app = await buildTestApp({ db: testDb(), authDb: counting });
    const res = await get(app, '/auth/session', '__Host-shifa.sid=abc.def');
    expect(res.statusCode).toBe(401);
    expect(calls).toBe(0);
  });
});
