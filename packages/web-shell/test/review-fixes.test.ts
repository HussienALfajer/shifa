// Slice A-01-06, review findings: a browser clock that runs fast does not end the session; the
// last activity always refreshes (trailing); a session found gone is not called idle; admin web
// cannot loop on a failed sign-out; a new person, session or clinic behind the page clears what
// was cached for the previous one; sign-out reports a server that did not answer.
import { QueryClient } from '@tanstack/react-query';
import { createMemoryHistory } from '@tanstack/react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { createShellClient } from '../src/client.ts';
import { decideRoute } from '../src/guard.ts';
import {
  clockOffset,
  createIdleTracker,
  idleAction,
  idleState,
  type SessionExpiry,
} from '../src/idle-timer.ts';
import { createShellRouter } from '../src/router.tsx';
import { sessionQueryKey, signOut } from '../src/session.ts';
import { fakeApi, SESSION } from './support.ts';

const MIN = 60_000;
const SERVER_NOW = Date.parse('2026-11-24T10:00:00.000Z');
const fromServer = {
  ...SESSION,
  idleMinutes: 30,
  idleExpiresAt: new Date(SERVER_NOW + 30 * MIN).toISOString(),
  absoluteExpiresAt: new Date(SERVER_NOW + 12 * 60 * MIN).toISOString(),
};
const expiry: SessionExpiry = {
  idleExpiresAt: Date.parse(fromServer.idleExpiresAt),
  absoluteExpiresAt: Date.parse(fromServer.absoluteExpiresAt),
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the server clock, not the browser clock', () => {
  it('a browser 40 minutes fast still sees 30 minutes left', () => {
    const browserNow = SERVER_NOW + 40 * MIN;
    expect(idleState(expiry, browserNow)).toEqual({ kind: 'expired' });
    const offset = clockOffset(fromServer, browserNow);
    expect(offset).toBe(-40 * MIN);
    expect(idleState(expiry, browserNow + offset)).toEqual({ kind: 'active' });
    expect(idleState(expiry, browserNow + 29 * MIN + offset)).toEqual({
      kind: 'warning',
      secondsLeft: 60,
    });
  });

  it('a slow browser clock is corrected the other way', () => {
    expect(clockOffset(fromServer, SERVER_NOW - 7 * MIN)).toBe(7 * MIN);
  });
});

describe('trailing refresh and a session found gone', () => {
  function harness() {
    const clock = { now: SERVER_NOW };
    let refreshes = 0;
    let answer: SessionExpiry | null = expiry;
    const tracker = createIdleTracker({
      expiry,
      now: () => clock.now,
      refresh: () => {
        refreshes += 1;
        return Promise.resolve(answer);
      },
      post: () => undefined,
    });
    return {
      tracker,
      clock,
      refreshes: () => refreshes,
      answer: (next: SessionExpiry | null) => (answer = next),
    };
  }

  it('refreshes later for activity the once-a-minute limit held back', async () => {
    const h = harness();
    h.tracker.activity();
    await flush();
    h.clock.now += 59_000;
    h.tracker.activity();
    h.tracker.tick();
    expect(h.refreshes()).toBe(1);
    h.clock.now += 1000;
    h.tracker.tick();
    await flush();
    expect(h.refreshes()).toBe(2);
    h.clock.now += 2 * MIN;
    h.tracker.tick();
    expect(h.refreshes()).toBe(2);
  });

  it('does not sign out as idle when a refresh found the session gone', async () => {
    const h = harness();
    h.answer(null);
    h.tracker.activity();
    await flush();
    expect(h.tracker.state()).toEqual({ kind: 'expired' });
    expect(h.tracker.gone()).toBe(true);
    expect(idleAction(h.tracker.state(), { gone: true, ended: false })).toBe('none');
    expect(idleAction({ kind: 'expired' }, { gone: false, ended: false })).toBe('sign-out');
    expect(idleAction({ kind: 'expired' }, { gone: false, ended: true })).toBe('none');
    expect(idleAction({ kind: 'warning', secondsLeft: 3 }, { gone: false, ended: false })).toBe(
      'none',
    );
  });
});

describe('admin web and a failed sign-out', () => {
  it('stays on sign-in with a non-admin session instead of signing out again', () => {
    const state = { kind: 'signed-in' as const, session: SESSION };
    expect(decideRoute('admin', 'signed-out', state)).toEqual({ action: 'stay' });
    expect(decideRoute('admin', 'signed-in', state)).toEqual({
      action: 'sign-out',
      reason: 'not_admin',
    });
  });

  it('signOut says whether the server ended the session', async () => {
    const queryClient = new QueryClient();
    const answering = (status: number) =>
      createShellClient({
        baseUrl: 'http://shell.test/api',
        fetch: () => Promise.resolve(new Response(null, { status })),
      });
    expect(await signOut(answering(204), queryClient)).toBe(true);
    expect(await signOut(answering(500), queryClient)).toBe(false);
    const offline = createShellClient({
      baseUrl: 'http://shell.test/api',
      fetch: () => Promise.reject(new TypeError('offline')),
    });
    expect(await signOut(offline, queryClient)).toBe(false);
  });
});

describe('another person, session or clinic behind the page', () => {
  const disposers: (() => void)[] = [];
  afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
  });

  it('drops every other cached query and goes home', async () => {
    const api = fakeApi(SESSION);
    const queryClient = new QueryClient();
    const shell = createShellClient({ baseUrl: 'http://shell.test/api', fetch: api.fetch });
    const history = createMemoryHistory({ initialEntries: ['/about'] });
    const page = () => null;
    const { router, dispose } = createShellRouter({
      app: 'clinic',
      shell,
      queryClient,
      history,
      pages: { signIn: page, mfa: page, home: page, about: page },
    });
    disposers.push(dispose);
    await router.load();
    await queryClient.fetchQuery({
      queryKey: sessionQueryKey,
      queryFn: () => ({ kind: 'signed-in', session: SESSION }),
    });
    queryClient.setQueryData(['clinic', SESSION.tenantId, 'patients'], ['synthetic']);

    // The same session switched clinic in another tab: the focus refresh sees tenant B.
    const switched = { ...SESSION, tenantId: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0b99' };
    queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: switched });
    await flush();
    expect(queryClient.getQueryData(['clinic', SESSION.tenantId, 'patients'])).toBeUndefined();
    expect(queryClient.getQueryData(sessionQueryKey)).toBeDefined();
    await flush();
    expect(router.state.location.pathname).toBe('/');
  });
});
