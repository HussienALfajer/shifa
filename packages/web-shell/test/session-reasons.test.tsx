// Slice A-01-07 checkpoint 2, review findings 1 and 7: the server's reason of a mid-session
// `session_expired` reaches `/sign-in?reason=`, and a new idle setting within one session (a
// switch to another clinic, the owner's change) does not sign an active person out.
import { afterEach, expect, it, vi } from 'vitest';
import { sessionQueryKey } from '../src/session.ts';
import { flush, renderShell } from './render.tsx';
import { fakeApi, SESSION } from './support.ts';

afterEach(() => {
  vi.useRealTimers();
});

it('a session ended elsewhere mid-session goes to sign-in with the server’s reason', async () => {
  const api = fakeApi(SESSION);
  const r = await renderShell('clinic', api, '/');
  expect(r.router.state.location.pathname).toBe('/');
  api.endSession('session_expired', 'ended');
  // What watchFocus() does on focus (mount.tsx installs it; the test render does not).
  void r.queryClient.invalidateQueries({ queryKey: sessionQueryKey });
  for (let i = 0; i < 50 && r.router.state.location.pathname !== '/sign-in'; i += 1) {
    await flush(20);
  }
  expect(r.router.state.location.pathname).toBe('/sign-in');
  expect(r.router.state.location.search).toEqual({ reason: 'ended' });
  await r.unmount();
});

it('a change of idleMinutes within one session does not sign an active person out', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-11-24T10:00:00Z') });
  const at = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
  const api = fakeApi({ ...SESSION, idleMinutes: 30, idleExpiresAt: at(30) });
  const r = await renderShell('clinic', api, '/');
  expect(r.router.state.location.pathname).toBe('/');
  for (let i = 0; i < 40; i += 1) {
    await vi.advanceTimersByTimeAsync(60_000);
    api.session = { ...SESSION, idleMinutes: 30, idleExpiresAt: at(30) };
    globalThis.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(1_500);
    await flush();
  }
  expect(r.router.state.location.pathname).toBe('/');
  api.session = { ...SESSION, idleMinutes: 15, idleExpiresAt: at(15) };
  await vi.advanceTimersByTimeAsync(60_000);
  globalThis.dispatchEvent(new Event('pointerdown'));
  await vi.advanceTimersByTimeAsync(3_000);
  await flush();
  await flush();
  expect(api.calls.filter((c) => c.includes('sign-out'))).toEqual([]);
  expect(r.router.state.location.pathname).toBe('/');
  await r.unmount();
});
