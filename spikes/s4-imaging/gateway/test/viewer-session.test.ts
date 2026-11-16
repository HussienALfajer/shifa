// Criterion 10, gateway half: the viewer session. A one-time code (minted by the "application"
// with this run's key, typ viewer-code, at most two minutes) is exchanged at /viewer/session for
// an HttpOnly, Secure, SameSite=Strict, Path=/ cookie. The cookie is accepted on GET DICOMweb
// routes only: never for STOW, uploads or Transfers, never as a bearer token, and a bearer
// token is never accepted as a cookie. A reused, expired or wrong-type code is refused. Tenant
// A's cookie gets nothing of B's.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureStudy } from '@shifa-spike/s4-generator';
import { stowBody } from '@shifa-spike/s4-stack';
import { useStack } from '@shifa-spike/s4-stack/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { bearer } from './tokens.ts';

const stack = useStack();
let cookieA = '';
const UNKNOWN = '1.2.826.0.1.3680043.2.1';

const code = (tenant: 'a' | 'b', overrides: { ttlSeconds?: number; jti?: string } = {}) =>
  stack.token({
    sub: `viewer-${tenant}`,
    tenant,
    role: 'viewer',
    typ: 'viewer-code',
    jti: overrides.jti ?? randomUUID(),
    ttlSeconds: overrides.ttlSeconds ?? 60,
  });

const exchange = (value: string) =>
  fetch(`${stack.gatewayUrl}/viewer/session?code=${encodeURIComponent(value)}`, {
    redirect: 'manual',
  });

const withCookie = (path: string, cookie: string, init: RequestInit = {}) =>
  fetch(`${stack.gatewayUrl}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), cookie },
  });

const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

beforeAll(async () => {
  // A study in each tenant through the uploader role.
  const { dir, manifest } = await ensureStudy('cbct-20-multi');
  const pano = await ensureStudy('pano');
  for (const [tenant, study] of [
    ['a', { dir, manifest }],
    ['b', pano],
  ] as const) {
    const files = await Promise.all(
      study.manifest.files.slice(0, 2).map((f) => readFile(join(study.dir, f.path))),
    );
    const { body, contentType } = stowBody(files);
    const res = await fetch(`${stack.gatewayUrl}/dicomweb/studies`, {
      method: 'POST',
      body,
      headers: {
        ...bearer(await stack.token({ tenant, role: 'uploader' })),
        'content-type': contentType,
      },
    });
    expect(res.status).toBe(200);
  }
});

describe('viewer session cookie', () => {
  it('exchanges a one-time code for a cookie with the four attributes', async () => {
    const res = await exchange(await code('a'));
    expect([200, 204, 302, 303]).toContain(res.status);
    const header = res.headers.get('set-cookie') ?? '';
    const attributes = header
      .split(';')
      .slice(1)
      .map((a) => a.trim().toLowerCase());
    expect(attributes).toEqual(
      expect.arrayContaining(['httponly', 'secure', 'samesite=strict', 'path=/']),
    );
    expect(attributes.some((a) => a.startsWith('domain='))).toBe(false);
    cookieA = cookieOf(res);
    expect(cookieA).toMatch(/^[\w-]+=[A-Za-z0-9._-]+$/);
  });

  it('refuses a reused, expired, wrong-type or wrong-role code', async () => {
    const once = await code('a');
    expect(cookieOf(await exchange(once))).not.toBe('');
    const refused = [
      once,
      await code('a', { ttlSeconds: -120 }),
      await code('a', { ttlSeconds: 600 }),
      await stack.token({ tenant: 'a', role: 'viewer' }),
      await stack.token({ tenant: 'a', role: 'uploader', typ: 'viewer-code', jti: randomUUID() }),
      'garbage',
    ];
    for (const value of refused) {
      const res = await exchange(value);
      expect([401, 403]).toContain(res.status);
      expect(res.headers.get('set-cookie')).toBeNull();
    }
  });

  it('accepts the cookie on QIDO and WADO', async () => {
    const qido = await withCookie('/dicomweb/studies', cookieA);
    expect(qido.status).toBe(200);
    const { manifest } = await ensureStudy('cbct-20-multi');
    const wado = await withCookie(
      `/dicomweb/studies/${manifest.studyInstanceUid}/metadata`,
      cookieA,
    );
    expect(wado.status).toBe(200);
  });

  it('refuses the cookie for STOW, uploads and Transfers, and as a bearer token', async () => {
    const before = await stack.gateway.metrics();
    const { body, contentType } = stowBody([Buffer.alloc(200)]);
    const attempts: Promise<Response>[] = [
      withCookie('/dicomweb/studies', cookieA, {
        method: 'POST',
        body,
        headers: { 'content-type': contentType },
      }),
      withCookie('/uploads', cookieA, {
        method: 'POST',
        body: '{"files":[]}',
        headers: { 'content-type': 'application/json' },
      }),
      withCookie('/transfers/push', cookieA, { method: 'POST', body: '{}' }),
      fetch(`${stack.gatewayUrl}/dicomweb/studies`, {
        headers: bearer(cookieA.slice(cookieA.indexOf('=') + 1)),
      }),
    ];
    for (const attempt of attempts) expect([401, 403]).toContain((await attempt).status);
    // A bearer token placed in the cookie is not a session.
    const name = cookieA.slice(0, cookieA.indexOf('='));
    const viewer = await stack.token({ tenant: 'a', role: 'viewer' });
    expect((await withCookie('/dicomweb/studies', `${name}=${viewer}`)).status).toBe(401);
    expect((await stack.gateway.metrics()).upstream).toBe(before.upstream);
  });

  it("gives A's cookie nothing of B's", async () => {
    const pano = await ensureStudy('pano');
    const ofB = await withCookie(
      `/dicomweb/studies/${pano.manifest.studyInstanceUid}/metadata`,
      cookieA,
    );
    const unknown = await withCookie(`/dicomweb/studies/${UNKNOWN}/metadata`, cookieA);
    expect(ofB.status).toBe(unknown.status);
    expect(await ofB.text()).toBe(await unknown.text());
    const list = (await (await withCookie('/dicomweb/studies', cookieA)).json()) as {
      '0020000D': { Value: string[] };
    }[];
    expect(list.map((s) => s['0020000D'].Value[0])).not.toContain(pano.manifest.studyInstanceUid);
  });
});
