// Checkpoint 1 of A-01-02: does Better Auth (pinned 1.7.27) do what the identity module needs,
// used as a library through `auth.api.*` only (no catch-all handler, criterion 16)? Each case
// is one gate item; the slice file records the results.
import { createHmac } from 'node:crypto';
import { account, session, twoFactor, user, verification } from '@shifa/db';
import { fixtureId, syntheticPhones, testAuthDb } from '@shifa/db/testing';
import { betterAuth } from 'better-auth';
import { phoneNumber, twoFactor as twoFactorPlugin } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scopedAuthAdapter } from '../../src/modules/identity/auth-adapter.ts';

const SECRET = 'gate-secret-0123456789abcdef0123456789abcdef';
const PASSWORD = 'gate-password-long-enough';
const TENANT_PLACEHOLDER = null;

function gateAuth() {
  const authDb = testAuthDb();
  return betterAuth({
    secret: SECRET,
    baseURL: 'http://localhost:3000',
    telemetry: { enabled: false },
    rateLimit: { enabled: false },
    database: scopedAuthAdapter(authDb, { user, session, account, verification, twoFactor }),
    advanced: {
      database: { generateId: 'uuid' },
      useSecureCookies: false,
      cookies: { session_token: { name: '__Host-shifa.sid', attributes: { secure: true } } },
    },
    session: {
      expiresIn: 12 * 60 * 60,
      disableSessionRefresh: true,
      additionalFields: {
        activeTenantId: { type: 'string', required: false, input: false },
        activeBranchId: { type: 'string', required: false, input: false },
        lastActiveAt: { type: 'date', required: false, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: (data) =>
            Promise.resolve({
              data: { ...data, activeTenantId: TENANT_PLACEHOLDER, lastActiveAt: new Date() },
            }),
        },
      },
    },
    plugins: [phoneNumber(), twoFactorPlugin({ issuer: 'Shifa' })],
  });
}

async function createPerson(auth: ReturnType<typeof gateAuth>, phone: string) {
  const ctx = await auth.$context;
  const created = await ctx.internalAdapter.createUser(
    {
      name: 'شخص تجريبي',
      email: `${fixtureId(phone)}@users.shifa.invalid`,
    },
    { method: 'admin' },
  );
  // The phone plugin marks phoneNumber `input: false`: createUser drops it, an update sets it.
  await ctx.internalAdapter.updateUser(created.id, { phoneNumber: phone });
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: 'credential',
    accountId: created.id,
    password: await ctx.password.hash(PASSWORD),
  });
  return created;
}

function cookieOf(headers: Headers): string {
  const setCookie = headers.getSetCookie().find((c) => c.startsWith('__Host-shifa.sid='));
  if (!setCookie) throw new Error('no session cookie');
  return setCookie;
}

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) from a base32 secret. */
function totp(base32: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of base32.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  }
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const mac = createHmac('sha1', bytes).update(counter).digest();
  const offset = (mac.at(-1) ?? 0) & 0xf;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Better Auth gate (1.7.27)', () => {
  const phones = syntheticPhones(2026_11_23, 4);
  const phoneAt = (i: number) => phones[i] ?? '';

  it('signs in with phone and password through auth.api, on the shifa_auth pool', async () => {
    const auth = gateAuth();
    const person = await createPerson(auth, phoneAt(0));
    const { headers, response } = await auth.api.signInPhoneNumber({
      body: { phoneNumber: phoneAt(0), password: PASSWORD },
      returnHeaders: true,
    });
    expect(response.user.id).toBe(person.id);
    expect(person.id).toMatch(/^[0-9a-f-]{36}$/);
    const rows = await testAuthDb().withAuth((tx) =>
      tx.select().from(session).where(eq(session.userId, person.id)),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lastActiveAt).toBeInstanceOf(Date);
    expect(rows[0]?.activeTenantId).toBeNull();
    expect(cookieOf(headers)).toBeDefined();
  });

  it('refuses a wrong password with 401', async () => {
    const auth = gateAuth();
    await createPerson(auth, phoneAt(1));
    await expect(
      auth.api.signInPhoneNumber({ body: { phoneNumber: phoneAt(1), password: 'wrong-password' } }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('sets the custom cookie __Host-shifa.sid: Secure, HttpOnly, SameSite=Lax, Path=/', async () => {
    const auth = gateAuth();
    await createPerson(auth, phoneAt(2));
    const { headers } = await auth.api.signInPhoneNumber({
      body: { phoneNumber: phoneAt(2), password: PASSWORD },
      returnHeaders: true,
    });
    const cookie = cookieOf(headers);
    expect(cookie).toMatch(/; Secure/i);
    expect(cookie).toMatch(/; HttpOnly/i);
    expect(cookie).toMatch(/; SameSite=Lax/i);
    expect(cookie).toMatch(/; Path=\//i);
    expect(cookie).not.toMatch(/; Domain=/i);
  });

  it('honours a fake Date: the session ends after 12 h', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-23T08:00:00Z'));
    const auth = gateAuth();
    await createPerson(auth, phoneAt(3));
    const { headers } = await auth.api.signInPhoneNumber({
      body: { phoneNumber: phoneAt(3), password: PASSWORD },
      returnHeaders: true,
    });
    const cookie = new Headers({ cookie: cookieOf(headers).split(';')[0] ?? '' });
    vi.setSystemTime(new Date('2026-11-23T19:59:00Z'));
    expect(await auth.api.getSession({ headers: cookie })).not.toBeNull();
    vi.setSystemTime(new Date('2026-11-23T20:00:01Z'));
    expect(await auth.api.getSession({ headers: cookie })).toBeNull();
  });

  it('enrols TOTP with backup codes server-side and accepts a code and a backup code', async () => {
    const auth = gateAuth();
    const phone = syntheticPhones(2026_11_24, 1)[0] ?? '';
    await createPerson(auth, phone);
    const { headers } = await auth.api.signInPhoneNumber({
      body: { phoneNumber: phone, password: PASSWORD },
      returnHeaders: true,
    });
    const cookie = new Headers({ cookie: cookieOf(headers).split(';')[0] ?? '' });
    const enrol = await auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers: cookie });
    if (enrol.method !== 'totp') throw new Error('expected TOTP enrolment');
    expect(enrol.backupCodes).toHaveLength(10);
    const secret = new URL(enrol.totpURI).searchParams.get('secret') ?? '';
    const verified = await auth.api.verifyTOTP({
      body: { code: totp(secret) },
      headers: cookie,
      returnHeaders: true,
    });
    // Verifying rotates the session: the cookie from before MFA no longer works.
    const rotated = new Headers({ cookie: cookieOf(verified.headers).split(';')[0] ?? '' });
    expect(rotated.get('cookie')).not.toBe(cookie.get('cookie'));
    expect(await auth.api.getSession({ headers: cookie })).toBeNull();
    expect(await auth.api.getSession({ headers: rotated })).not.toBeNull();
    const [backup] = enrol.backupCodes;
    const used = await auth.api.verifyBackupCode({
      body: { code: backup ?? '' },
      headers: rotated,
    });
    expect(used.user.id).toEqual(expect.any(String));
    // A used backup code is gone.
    await expect(
      auth.api.verifyBackupCode({ body: { code: backup ?? '' }, headers: rotated }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
