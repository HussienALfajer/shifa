// Slice A-01-06: the route guard on the real router (memory history, no DOM). Signed out → sign-in;
// a session on sign-in → home; MFA owed → /mfa; a 401 mid-session → sign-in with its reason and
// an empty cache; admin web refuses a session without platformAdmin; clinic web sends a super
// admin to the page that names admin web.
import { createRandom, generatePhone } from '@shifa/testing';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory } from '@tanstack/react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { createShellClient } from '../src/client.ts';
import { createShellRouter, type ShellApp } from '../src/router.tsx';
import { sessionQueryKey } from '../src/session.ts';
import { type FakeApi, fakeApi, SESSION } from './support.ts';

const page = () => null;
const pages = { signIn: page, mfa: page, home: page, about: page, setup: page, adminWeb: page };

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

async function start(app: ShellApp, api: FakeApi, path: string) {
  const queryClient = new QueryClient();
  const shell = createShellClient({ baseUrl: 'http://shell.test/api', fetch: api.fetch });
  const history = createMemoryHistory({ initialEntries: [path] });
  const { router, dispose } = createShellRouter({ app, shell, queryClient, history, pages });
  disposers.push(dispose);
  await router.load();
  return { router, queryClient, shell };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('route guard', () => {
  it('sends a signed-out visitor of / to /sign-in (both apps)', async () => {
    for (const app of ['clinic', 'admin'] as const) {
      const { router } = await start(app, fakeApi(null), '/');
      expect(router.state.location.pathname, app).toBe('/sign-in');
    }
  });

  it('names the reason when the session ran out before the page loaded', async () => {
    const api = fakeApi(null);
    api.signedOutCode = 'session_expired';
    const { router } = await start('clinic', api, '/');
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(router.state.location.search).toEqual({ reason: 'session_expired' });
  });

  it('sends a signed-in person on /sign-in to /', async () => {
    const { router } = await start('clinic', fakeApi(SESSION), '/sign-in');
    expect(router.state.location.pathname).toBe('/');
  });

  it('sends a session that owes MFA to /mfa, and keeps it there', async () => {
    const owed = { ...SESSION, mfa: 'none' as const, mfaRequired: true };
    expect((await start('clinic', fakeApi(owed), '/')).router.state.location.pathname).toBe('/mfa');
    const pending = { ...SESSION, mfa: 'pending' as const };
    expect((await start('clinic', fakeApi(pending), '/about')).router.state.location.pathname).toBe(
      '/about',
    );
    expect((await start('clinic', fakeApi(pending), '/')).router.state.location.pathname).toBe(
      '/mfa',
    );
    expect((await start('clinic', fakeApi(SESSION), '/mfa')).router.state.location.pathname).toBe(
      '/',
    );
  });

  it('turns a 401 mid-session into sign-in with the reason, and clears the cache', async () => {
    const api = fakeApi(SESSION);
    const { router, queryClient, shell } = await start('clinic', api, '/');
    expect(router.state.location.pathname).toBe('/');
    expect(queryClient.getQueryData(sessionQueryKey)).toBeDefined();
    api.endSession('session_expired');
    await shell.api.GET('/me/clinics');
    await settle();
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(router.state.location.search).toEqual({ reason: 'session_expired' });
    expect(queryClient.getQueryData(sessionQueryKey)).toBeUndefined();
  });

  it('never turns a failed sign-in into a session-ended event', async () => {
    const api = fakeApi(null);
    const { router, shell } = await start('clinic', api, '/sign-in');
    let ended = 0;
    shell.onSessionEnded(() => (ended += 1));
    api.endSession('invalid_credentials');
    const phone = generatePhone(createRandom(2026_11_24), 'SY');
    await shell.api.POST('/auth/sign-in', { body: { phone, password: 'x' } });
    await settle();
    expect(ended).toBe(0);
    expect(router.state.location.search).toEqual({});
  });

  it('admin web signs out a session without platformAdmin (reason not_admin)', async () => {
    const api = fakeApi(SESSION);
    const { router } = await start('admin', api, '/');
    expect(api.calls).toContain('POST /api/auth/sign-out');
    expect(router.state.location.pathname).toBe('/sign-in');
    expect(router.state.location.search).toEqual({ reason: 'not_admin' });
  });

  it('admin web admits a super admin; clinic web sends one to the admin-web page', async () => {
    const admin = { ...SESSION, platformAdmin: true, tenantId: null };
    expect((await start('admin', fakeApi(admin), '/')).router.state.location.pathname).toBe('/');
    const clinic = await start('clinic', fakeApi(admin), '/');
    expect(clinic.router.state.location.pathname).toBe('/admin-web');
  });

  it('keeps /about and /setup open to anyone; /setup only on clinic web', async () => {
    expect((await start('clinic', fakeApi(null), '/about')).router.state.location.pathname).toBe(
      '/about',
    );
    expect((await start('clinic', fakeApi(null), '/setup')).router.state.location.pathname).toBe(
      '/setup',
    );
    const admin = await start('admin', fakeApi(null), '/setup');
    expect(admin.router.state.matches.map((m) => String(m.routeId))).not.toContain('/setup');
  });
});
