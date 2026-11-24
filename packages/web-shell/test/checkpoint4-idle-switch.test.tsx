// Slice A-01-07 checkpoint 4, found in the browser walk on the real backend: a switch keeps the
// session's id, so the idle tracker kept the limit of the session without a clinic (15 minutes)
// and warned after 14 minutes although the clinic's setting (30) applied on the server. Every
// newer answer for the session now reaches the tracker.
import { afterEach, expect, it, vi } from 'vitest';
import { sessionQueryKey } from '../src/session.ts';
import { flush, renderShell } from './render.tsx';
import { fakeApi, SESSION } from './support.ts';

afterEach(() => {
  vi.useRealTimers();
});

it('after a switch the clinic’s longer idle setting applies at once', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-11-24T10:00:00Z') });
  const at = (min: number) => new Date(Date.now() + min * 60_000).toISOString();
  const api = fakeApi({ ...SESSION, idleMinutes: 15, idleExpiresAt: at(15) });
  const r = await renderShell('clinic', api, '/');
  // The switch's re-read: same session id, the clinic's 30 minutes.
  const longer = { ...SESSION, idleMinutes: 30, idleExpiresAt: at(30) };
  api.session = longer;
  r.queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: longer });
  await flush();
  await vi.advanceTimersByTimeAsync(14 * 60_000 + 30_000);
  await flush();
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  await vi.advanceTimersByTimeAsync(15 * 60_000);
  await flush();
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('هل ما زلت تعمل؟');
  await r.unmount();
});
