// A-01-02 security review fixes: no cross-site or non-JSON unsafe request reaches a route (M1),
// refused attempts during a lock write one audit row, not one each (M2), and attempts from one
// IPv6 /64 share the IP limit (L3). Synthetic phones; documentation address ranges.
import { syntheticPhones } from '@shifa/db/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../support.ts';
import {
  auditRows,
  identityApp,
  PASSWORD,
  resetWithTenants,
  seedPerson,
  sessionCookie,
  setCookieLine,
  signIn,
} from './support.ts';

const phones = syntheticPhones(2026_11_25, 45);
const phone = (i: number) => phones[i] ?? '';

let app: TestApp;

beforeEach(async () => {
  await resetWithTenants();
  app = await identityApp();
});

afterEach(async () => {
  await app.app.close();
});

describe('cross-site and non-JSON requests (M1)', () => {
  it('a form-encoded sign-in is refused with 415 and sets no cookie', async () => {
    await seedPerson(phone(0));
    const res = await app.app.inject({
      method: 'POST',
      url: '/auth/sign-in',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `phone=${encodeURIComponent(phone(0))}&password=${encodeURIComponent(PASSWORD)}`,
    });
    expect(res.statusCode).toBe(415);
    expect(setCookieLine(res)).toBeUndefined();
  });

  it.each(['cross-site', 'same-site'])('Sec-Fetch-Site: %s is refused with 403', async (site) => {
    await seedPerson(phone(1));
    const res = await app.app.inject({
      method: 'POST',
      url: '/auth/sign-in',
      headers: { 'sec-fetch-site': site },
      payload: { phone: phone(1), password: PASSWORD },
    });
    expect(res.statusCode).toBe(403);
    expect(setCookieLine(res)).toBeUndefined();
  });

  it('same-origin JSON signs in; a text/plain sign-out with the cookie is refused', async () => {
    await seedPerson(phone(2));
    const ok = await app.app.inject({
      method: 'POST',
      url: '/auth/sign-in',
      headers: { 'sec-fetch-site': 'same-origin' },
      payload: { phone: phone(2), password: PASSWORD },
    });
    expect(ok.statusCode).toBe(200);
    const signOut = await app.app.inject({
      method: 'POST',
      url: '/auth/sign-out',
      headers: { cookie: sessionCookie(ok), 'content-type': 'text/plain' },
      payload: '',
    });
    expect(signOut.statusCode).toBe(415);
  });
});

describe('audit volume during a lock (M2)', () => {
  it('ten refused attempts on a locked phone write one refusal row', async () => {
    await seedPerson(phone(3));
    for (let i = 0; i < 5; i += 1) await signIn(app, phone(3), 'wrong password');
    for (let i = 0; i < 10; i += 1) {
      expect((await signIn(app, phone(3), PASSWORD)).statusCode).toBe(429);
    }
    const refused = (await auditRows()).filter(
      (r) => (r.data as { reason?: string }).reason === 'phone_locked',
    );
    expect(refused).toHaveLength(1);
  });
});

describe('IPv6 clients (L3)', () => {
  it('thirty attempts from addresses in one /64 block the whole /64', async () => {
    await seedPerson(phone(40));
    for (let i = 0; i < 30; i += 1) {
      await signIn(app, phone(i), 'wrong password', {
        ip: `2001:db8:5:6::${(i + 1).toString(16)}`,
      });
    }
    const other = await signIn(app, phone(40), PASSWORD, { ip: '2001:db8:5:6:ffff::1' });
    expect(other.statusCode).toBe(429);
    const elsewhere = await signIn(app, phone(40), PASSWORD, { ip: '2001:db8:5:7::1' });
    expect(elsewhere.statusCode).toBe(200);
  });
});
