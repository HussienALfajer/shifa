// Review of 0.3-S5b (B2): the local admin page drives the checklist's owner steps on a fresh WAHA
// container: start creates a session WAHA does not know yet, stop, the QR as JSON and as an
// image (never cached), resume after a pause, opt-in and alert counts; it refuses a foreign Host
// header and requests without the page token.
import { request } from 'node:http';
import { describe, expect, it } from 'vitest';
import { startAdminPage } from '../tools/admin-page.ts';
import { newEnv, useDatabase, useEnvs } from './harness.ts';

const pg = useDatabase();
const track = useEnvs();

const call = async (url: string, token: string, method = 'GET') => {
  const res = await fetch(url, { method, headers: { 'x-admin-token': token } });
  return { status: res.status, type: res.headers.get('content-type'), res };
};

/** A request with a forged Host header (fetch does not let a caller set it). */
const withHost = (url: string, host: string) =>
  new Promise<number>((resolve, reject) => {
    const req = request(url, { headers: { host } }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end();
  });

describe('admin page', () => {
  it('creates and starts an unknown session, then shows its QR', async () => {
    const env = track(await newEnv(pg.db, { unlinked: ['platform'] }));
    const page = await startAdminPage(env.messaging);
    try {
      const base = `${page.url}/api/sessions`;
      const started = await call(`${base}/platform/start`, page.token, 'POST');
      expect(started.status).toBe(200);
      const paths = (env.fakes.platform?.calls ?? []).map((c) => `${c.method} ${c.path}`);
      expect(paths).toEqual(['POST /api/sessions/platform/start', 'POST /api/sessions']);
      const qr = await call(`${base}/platform/qr`, page.token);
      expect(qr.status).toBe(200);
      expect(((await qr.res.json()) as { value: string }).value).toMatch(/^fake-qr-/);
      const image = await call(`${base}/platform/qr.png`, page.token);
      expect(image.status).toBe(200);
      expect(image.type).toBe('image/png');
      expect(image.res.headers.get('cache-control')).toBe('no-store');
    } finally {
      await page.close();
    }
  });

  it('stops, resumes and reports opt-in and alerts; refuses unknown sessions', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
    await env.fakes.clinics?.capping('clinic-a', 'FIRST_WARNING');
    const page = await startAdminPage(env.messaging);
    try {
      const base = `${page.url}/api/sessions`;
      expect((await call(`${base}/clinic-a/stop`, page.token, 'POST')).status).toBe(200);
      expect((await call(`${base}/nobody/stop`, page.token, 'POST')).status).toBe(404);
      // Paused by the warning, and the 24 h have not passed: resume is refused (OD-46).
      expect((await call(`${base}/clinic-a/resume`, page.token, 'POST')).status).toBe(409);
      expect((await call(`${base}/clinic-b/resume`, page.token, 'POST')).status).toBe(409);
      const state = (await (await call(base, page.token)).res.json()) as {
        optins: { clinic_id: string; wrote: boolean; opted_out: boolean }[];
        alerts: { session: string; n: number }[];
      };
      expect(state.optins).toEqual([{ clinic_id: 'c-a', wrote: true, opted_out: false }]);
      expect(state.alerts.map((a) => a.session)).toContain('clinic-a');
    } finally {
      await page.close();
    }
  });

  it('refuses a foreign Host header and requests without the token', async () => {
    const env = track(await newEnv(pg.db));
    const page = await startAdminPage(env.messaging);
    try {
      expect(await withHost(`${page.url}/`, 'evil.example:80')).toBe(421);
      expect(await withHost(`${page.url}/api/sessions`, 'localhost')).toBe(421);
      expect((await call(`${page.url}/api/sessions`, 'wrong-token')).status).toBe(401);
      const html = await fetch(`${page.url}/`);
      expect(html.status).toBe(200);
      expect(html.headers.get('content-security-policy')).toContain("default-src 'self'");
      expect(await html.text()).toContain('dir="rtl"');
    } finally {
      await page.close();
    }
  });
});
