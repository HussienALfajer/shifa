// Token helpers for the gateway suites: valid tokens come from the stack (this run's key);
// forged ones are built here (other key, alg none, missing or unknown claims).
import { randomBytes } from 'node:crypto';
import type { Stack } from '@shifa-spike/s4-stack';
import { SignJWT } from 'jose';

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

export async function forgedTokens(stack: Stack): Promise<Record<string, string>> {
  const now = Math.floor(Date.now() / 1000);
  const claims = { sub: 'viewer-a', tenant: 'a', role: 'viewer' };
  return {
    expired: await stack.token({ tenant: 'a', role: 'viewer', ttlSeconds: -120 }),
    wrongKey: await new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(now + 120)
      .sign(randomBytes(32)),
    algNone: `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ ...claims, exp: now + 120 })}.`,
    missingTenant: await new SignJWT({ sub: 'viewer-a', role: 'viewer' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(now + 120)
      .sign(stack.tokenKey),
    unknownTenant: await stack.token({ tenant: 'z', role: 'viewer' }),
    tooLong: await stack.token({ tenant: 'a', role: 'viewer', ttlSeconds: 3600 }),
    garbage: 'not-a-token',
  };
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
