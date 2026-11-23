// A-01a criteria 9 and 10: server-side sessions in a `__Host-` cookie (Secure, HttpOnly,
// SameSite=Lax), rotated at sign-in; idle limit from the active clinic (15 min without one, as for
// super admins), absolute 12 h; 401 `session_expired` after either. A person lists their sessions
// and ends one or all others; an ended session answers 401 on its next request.
import { fixtureId, syntheticPhones } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../support.ts';
import {
  get,
  identityApp,
  resetWithTenants,
  seedPerson,
  sessionCookie,
  sessionRows,
  setCookieLine,
  setIdleMinutes,
  signIn,
  testClock,
} from './support.ts';

const MINUTE = 60_000;
const TENANT = fixtureId('sessions:tenant');
const phones = syntheticPhones(2026_11_09, 10);
const phone = (i: number) => phones[i] ?? '';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const FIREFOX_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0';

let app: TestApp;
let clock: FixedClock;

beforeEach(async () => {
  await resetWithTenants(TENANT);
  clock = testClock();
  app = await identityApp(clock);
});

afterEach(async () => {
  await app.app.close();
});

const expired = { error: { code: 'session_expired', message: expect.any(String) as unknown } };

describe('session cookie (criterion 9)', () => {
  it('is __Host-shifa.sid: Secure, HttpOnly, SameSite=Lax, Path=/, no Domain, 12 h', async () => {
    await seedPerson(phone(0));
    const res = await signIn(app, phone(0));
    const line = setCookieLine(res) ?? '';
    expect(line).toMatch(/^__Host-shifa\.sid=[^;]+/);
    expect(line).toMatch(/; Secure(;|$)/);
    expect(line).toMatch(/; HttpOnly(;|$)/);
    expect(line).toMatch(/; SameSite=Lax(;|$)/);
    expect(line).toMatch(/; Path=\/(;|$)/);
    expect(line).not.toMatch(/Domain=/i);
    expect(line).toMatch(/; Max-Age=43200(;|$)/);
    // Only the session cookie: no cookie cache or other Better Auth cookie.
    expect([res.headers['set-cookie']].flat()).toHaveLength(1);
  });

  it('is rotated at sign-in: a new token, and the cookie presented before stops working', async () => {
    await seedPerson(phone(1));
    const first = sessionCookie(await signIn(app, phone(1)));
    const second = sessionCookie(await signIn(app, phone(1), undefined, { cookie: first }));
    expect(second).not.toBe(first);
    expect((await get(app, '/auth/session', first)).statusCode).toBe(401);
    expect((await get(app, '/auth/session', second)).statusCode).toBe(200);
  });

  it('a forged or unsigned cookie is anonymous (401 unauthorized)', async () => {
    await seedPerson(phone(2));
    const real = sessionCookie(await signIn(app, phone(2)));
    const token = decodeURIComponent(real.split('=')[1] ?? '').split('.')[0] ?? '';
    for (const forged of [`__Host-shifa.sid=${token}`, `__Host-shifa.sid=${token}.AAAA`]) {
      const res = await get(app, '/auth/session', forged);
      expect(res.statusCode).toBe(401);
      expect((res.json() as { error: { code: string } }).error.code).toBe('unauthorized');
    }
  });

  it('no cookie: 401 unauthorized', async () => {
    const res = await get(app, '/auth/session');
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'unauthorized', message: 'Unauthorized' } });
  });
});

describe('idle and absolute limits (criterion 9)', () => {
  it('idle: the clinic default of 30 minutes; any request keeps the session alive', async () => {
    await seedPerson(phone(3), { tenantId: TENANT, role: 'receptionist' });
    const cookie = sessionCookie(await signIn(app, phone(3)));
    const view = (await get(app, '/auth/session', cookie)).json() as Record<string, unknown>;
    expect(view).toMatchObject({ tenantId: TENANT, idleMinutes: 30 });
    clock.advanceBy(29 * MINUTE);
    expect((await get(app, '/auth/session', cookie)).statusCode).toBe(200);
    clock.advanceBy(29 * MINUTE);
    expect((await get(app, '/auth/session', cookie)).statusCode).toBe(200);
    clock.advanceBy(30 * MINUTE);
    const res = await get(app, '/auth/session', cookie);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual(expired);
    // Expired sessions are removed, so they cannot come back.
    expect((await get(app, '/auth/session', cookie)).statusCode).toBe(401);
  });

  it('idle: the clinic setting (15 minutes) applies', async () => {
    await setIdleMinutes(TENANT, 15);
    await seedPerson(phone(4), { tenantId: TENANT, role: 'doctor' });
    const cookie = sessionCookie(await signIn(app, phone(4)));
    clock.advanceBy(14 * MINUTE);
    expect((await get(app, '/auth/session', cookie)).statusCode).toBe(200);
    clock.advanceBy(15 * MINUTE);
    expect((await get(app, '/auth/session', cookie)).json()).toEqual(expired);
  });

  it('idle: 60 minutes when the clinic chose it', async () => {
    await setIdleMinutes(TENANT, 60);
    await seedPerson(phone(5), { tenantId: TENANT, role: 'owner' });
    const cookie = sessionCookie(await signIn(app, phone(5)));
    clock.advanceBy(59 * MINUTE);
    expect((await get(app, '/auth/session', cookie)).statusCode).toBe(200);
    clock.advanceBy(60 * MINUTE);
    expect((await get(app, '/auth/session', cookie)).statusCode).toBe(401);
  });

  it('idle: 15 minutes without an active clinic (super admins and people between clinics)', async () => {
    await seedPerson(phone(6));
    const cookie = sessionCookie(await signIn(app, phone(6)));
    expect((await get(app, '/auth/session', cookie)).json()).toMatchObject({
      tenantId: null,
      idleMinutes: 15,
    });
    clock.advanceBy(15 * MINUTE);
    expect((await get(app, '/auth/session', cookie)).json()).toEqual(expired);
  });

  it('absolute: 12 hours after sign-in, however active', async () => {
    await setIdleMinutes(TENANT, 60);
    await seedPerson(phone(7), { tenantId: TENANT, role: 'owner' });
    const cookie = sessionCookie(await signIn(app, phone(7)));
    for (let i = 0; i < 23; i += 1) {
      clock.advanceBy(30 * MINUTE);
      expect((await get(app, '/auth/session', cookie)).statusCode, `step ${String(i)}`).toBe(200);
    }
    clock.advanceBy(30 * MINUTE);
    expect((await get(app, '/auth/session', cookie)).json()).toEqual(expired);
  });

  it('the session view tells the client when it ends', async () => {
    await seedPerson(phone(8), { tenantId: TENANT, role: 'owner' });
    const res = await signIn(app, phone(8));
    const start = clock.now().getTime();
    expect(res.json()).toMatchObject({
      tenantId: TENANT,
      branchId: fixtureId(`branch:${TENANT}`),
      idleMinutes: 30,
      idleExpiresAt: new Date(start + 30 * MINUTE).toISOString(),
      absoluteExpiresAt: expect.any(String) as unknown,
    });
  });
});

describe('own sessions (criterion 10)', () => {
  it('lists the person’s sessions with device, browser, last active and this device', async () => {
    await seedPerson(phone(9));
    const a = sessionCookie(await signIn(app, phone(9), undefined, { userAgent: CHROME_ANDROID }));
    sessionCookie(await signIn(app, phone(9), undefined, { userAgent: FIREFOX_WINDOWS }));
    const res = await get(app, '/auth/sessions', a);
    expect(res.statusCode).toBe(200);
    const { sessions } = res.json() as { sessions: Record<string, unknown>[] };
    expect(sessions).toHaveLength(2);
    expect(sessions).toContainEqual(
      expect.objectContaining({ device: 'Android', browser: 'Chrome', current: true }),
    );
    expect(sessions).toContainEqual(
      expect.objectContaining({ device: 'Windows', browser: 'Firefox', current: false }),
    );
    for (const s of sessions) {
      expect(s).toEqual(
        expect.objectContaining({
          id: expect.any(String) as unknown,
          lastActiveAt: expect.any(String) as unknown,
          createdAt: expect.any(String) as unknown,
        }),
      );
      expect(JSON.stringify(s)).not.toMatch(/Mozilla|token/i);
    }
  });

  it('ends one session: that cookie answers 401 on its next request', async () => {
    const person = await seedPerson(phone(0));
    const a = sessionCookie(await signIn(app, phone(0)));
    const b = sessionCookie(await signIn(app, phone(0)));
    const { sessions } = (await get(app, '/auth/sessions', a)).json() as {
      sessions: { id: string; current: boolean }[];
    };
    const other = sessions.find((s) => !s.current);
    const res = await app.app.inject({
      method: 'DELETE',
      url: `/auth/sessions/${other?.id ?? ''}`,
      headers: { cookie: a },
    });
    expect(res.statusCode).toBe(204);
    expect((await get(app, '/auth/session', b)).statusCode).toBe(401);
    expect((await get(app, '/auth/session', a)).statusCode).toBe(200);
    expect(await sessionRows(person.userId)).toHaveLength(1);
  });

  it('cannot end another person’s session (404, nothing ended)', async () => {
    await seedPerson(phone(1));
    const victim = await seedPerson(phone(2));
    const mine = sessionCookie(await signIn(app, phone(1)));
    const theirs = sessionCookie(await signIn(app, phone(2)));
    const [row] = await sessionRows(victim.userId);
    const res = await app.app.inject({
      method: 'DELETE',
      url: `/auth/sessions/${row?.id ?? ''}`,
      headers: { cookie: mine },
    });
    expect(res.statusCode).toBe(404);
    expect((await get(app, '/auth/session', theirs)).statusCode).toBe(200);
  });

  it('ends all other sessions and keeps this one', async () => {
    await seedPerson(phone(3));
    const keep = sessionCookie(await signIn(app, phone(3)));
    const others = [
      sessionCookie(await signIn(app, phone(3))),
      sessionCookie(await signIn(app, phone(3))),
    ];
    const res = await app.app.inject({
      method: 'POST',
      url: '/auth/sessions/end-others',
      headers: { cookie: keep },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ended: 2 });
    for (const cookie of others)
      expect((await get(app, '/auth/session', cookie)).statusCode).toBe(401);
    expect((await get(app, '/auth/session', keep)).statusCode).toBe(200);
  });

  it('signs out: the session ends and the cookie is cleared', async () => {
    await seedPerson(phone(4));
    const cookie = sessionCookie(await signIn(app, phone(4)));
    const res = await app.app.inject({
      method: 'POST',
      url: '/auth/sign-out',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(204);
    expect(setCookieLine(res)).toMatch(/^__Host-shifa\.sid=;.*Max-Age=0/);
    expect((await get(app, '/auth/session', cookie)).statusCode).toBe(401);
  });
});
