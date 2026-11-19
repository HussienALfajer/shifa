// Criterion 2: service-account auth without a Google SDK. RS256 JWT with the FCM scope, exchanged
// at the (fake) token URL; cached until 60 s before expiry; key material never logged.
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createTokenProvider, FCM_SCOPE, signAssertion } from '../src/auth.ts';
import { type FakeTokenServer, startFakeTokenServer } from './fakes/token.ts';
import { fakeServiceAccount } from './helpers.ts';

const decode = (part: string) =>
  JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;

let token: FakeTokenServer | undefined;
afterEach(async () => {
  await token?.close();
  token = undefined;
});

describe('JWT assertion', () => {
  it('has the FCM scope, aud = token URL, 1 h expiry, and verifies with the public half', () => {
    const tokenUrl = 'http://127.0.0.1:1/token';
    const { account, publicKey } = fakeServiceAccount(tokenUrl);
    const now = Date.parse('2026-11-19T08:00:00.000Z');
    const jwt = signAssertion(account, tokenUrl, now);
    const [header = '', payload = '', signature = ''] = jwt.split('.');

    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    const claims = decode(payload);
    expect(claims).toEqual({
      iss: account.client_email,
      scope: FCM_SCOPE,
      aud: tokenUrl,
      iat: now / 1000,
      exp: now / 1000 + 3600,
    });
    expect(FCM_SCOPE).toBe('https://www.googleapis.com/auth/firebase.messaging');

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${payload}`);
    expect(verifier.verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(true);

    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey;
    const check = createVerify('RSA-SHA256');
    check.update(`${header}.${payload}`);
    expect(check.verify(other, Buffer.from(signature, 'base64url'))).toBe(false);
  });
});

describe('token provider', () => {
  it('caches the access token and refreshes it 60 s before expiry', async () => {
    const pair = fakeServiceAccount('placeholder');
    token = await startFakeTokenServer({ publicKey: pair.publicKey, expiresIn: 3600 });
    let now = Date.parse('2026-11-19T08:00:00.000Z');
    const provider = createTokenProvider({
      serviceAccount: pair.account,
      tokenUrl: token.url,
      now: () => now,
    });

    expect(await provider.getToken()).toBe('fake-access-1');
    expect(await provider.getToken()).toBe('fake-access-1');
    expect(token.calls()).toBe(1);

    now += 3_530_000; // 70 s before expiry: still cached
    expect(await provider.getToken()).toBe('fake-access-1');
    expect(token.calls()).toBe(1);

    now += 15_000; // 55 s before expiry: refreshed
    expect(await provider.getToken()).toBe('fake-access-2');
    expect(token.calls()).toBe(2);
  });

  it('never puts key material or the assertion in logs or errors', async () => {
    const pair = fakeServiceAccount('placeholder');
    token = await startFakeTokenServer({ publicKey: pair.publicKey });
    const logs: string[] = [];
    const provider = createTokenProvider({
      serviceAccount: pair.account,
      tokenUrl: token.url,
      log: (line) => logs.push(line),
    });

    await provider.getToken();
    token.failNext(400, { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' });
    // Force a refresh by building a new provider sharing the server.
    const failing = createTokenProvider({
      serviceAccount: pair.account,
      tokenUrl: token.url,
      log: (line) => logs.push(line),
    });
    const error = await failing.getToken().then(
      () => undefined,
      (e: unknown) => e as Error,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('400');
    expect(error?.message).toContain('invalid_grant');

    const keyBody = pair.account.private_key
      .split('\n')
      .filter((l) => l && !l.startsWith('-----'))
      .join('');
    const seen = [...logs, error?.message ?? '', error?.stack ?? ''].join('\n');
    for (let i = 0; i + 40 <= keyBody.length; i += 40) {
      expect(seen).not.toContain(keyBody.slice(i, i + 40));
    }
    expect(seen).not.toContain('PRIVATE KEY');
    for (const assertion of token.assertions) expect(seen).not.toContain(assertion);
    expect(seen).not.toContain('fake-access-1');
    expect(logs.length).toBeGreaterThan(0);
  });
});
