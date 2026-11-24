// Slice A-01-07 checkpoint 4, reviewer findings: (1) a switch to another branch of the same
// clinic drops what was cached for the first; (2) the session read fired by the press on «خروج»
// cannot put the ended session back; (3) the server's shorter idle limit is taken (a switch to a
// clinic with a shorter setting), another tab's is not; (5) a refusal the table does not name is
// not shown as a lost connection.
import { describe, expect, it } from 'vitest';
import { createIdleTracker, type SessionExpiry } from '../src/idle-timer.ts';
import { sessionQueryKey } from '../src/session.ts';
import { button, click, flush, renderShell } from './render.tsx';
import { errorAnswer, fakeApi, json, SESSION } from './support.ts';

const B1 = { id: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0c01', name: 'الفرع الرئيسي' };
const B2 = { id: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0c02', name: 'الفرع الثاني' };
const CLINIC = {
  tenantId: SESSION.tenantId,
  name: 'عيادة الاختبار',
  status: 'active',
  selectable: true,
  roles: ['doctor'],
  tenantWide: false,
  lastActiveAt: null,
  solo: false,
  branches: [B1, B2],
};

/** The element, or a failure naming what is missing. */
function must(element: Element | null | undefined): Element {
  if (!element) throw new Error('element not found');
  return element;
}

describe('A-01-07 checkpoint 4 review', () => {
  it('(1) a switch to another branch of the same clinic drops the clinic’s cached queries', async () => {
    const api = fakeApi({ ...SESSION, branchId: B1.id });
    api.answers['/api/me'] = () => json(200, { userId: SESSION.userId, name: 'س', phoneE164: '' });
    api.answers['/api/me/clinics'] = () => json(200, { clinics: [CLINIC], invitations: [] });
    api.answers['/api/me/switch'] = (body) => {
      const { branchId } = body as { branchId: string };
      api.session = { ...SESSION, branchId };
      return json(200, { tenantId: SESSION.tenantId, branchId });
    };
    const r = await renderShell('clinic', api, '/choose');
    for (let i = 0; i < 50 && !r.container.querySelector('[data-testid="clinic-card"]'); i += 1) {
      await flush(20);
    }
    r.queryClient.setQueryData(['clinic', SESSION.tenantId, 'queue'], ['from B1']);
    await click(must(r.container.querySelector('[data-testid="clinic-card"]')));
    for (let i = 0; i < 50 && !r.container.querySelector('[data-testid="branch-card"]'); i += 1) {
      await flush(20);
    }
    const cards = [...r.container.querySelectorAll('[data-testid="branch-card"]')];
    // One role in the clinic: true of every branch, so the cards name it.
    expect(cards[1]?.textContent).toContain('طبيب');
    await click(must(cards[1]));
    for (let i = 0; i < 50 && r.router.state.location.pathname !== '/'; i += 1) await flush(20);
    expect(api.bodies['/api/me/switch']).toEqual([{ tenantId: SESSION.tenantId, branchId: B2.id }]);
    expect(r.queryClient.getQueryData(['clinic', SESSION.tenantId, 'queue'])).toBeUndefined();
    await r.unmount();
  });

  it('(2) the activity read that answers after the sign-out does not restore the session', async () => {
    const api = fakeApi(SESSION);
    const r = await renderShell('clinic', api, '/');
    let release: () => void = () => undefined;
    let held = false;
    // Only the first read is held back (the activity's); later ones answer as the server does.
    api.answers['/api/auth/session'] = () => {
      if (held) return api.session ? json(200, api.session) : errorAnswer(401, 'unauthorized');
      held = true;
      return new Promise((resolve) => {
        release = () => {
          resolve(json(200, SESSION));
        };
      });
    };
    // The press: pointerdown (activity → a session read, held back here), then the click.
    globalThis.dispatchEvent(new Event('pointerdown'));
    await click(button(r.container, 'تسجيل الخروج'));
    for (let i = 0; i < 50 && r.router.state.location.pathname !== '/sign-in'; i += 1) {
      await flush(20);
    }
    release();
    await flush(50);
    const cached = r.queryClient.getQueryData<{ kind: string }>(sessionQueryKey);
    expect(cached?.kind).not.toBe('signed-in');
    expect(r.router.state.location.pathname).toBe('/sign-in');
    await r.unmount();
  });

  it('(3) the server’s shorter limit is taken; another tab’s shorter one is not', async () => {
    let now = 0;
    const expiry = (idle: number): SessionExpiry => ({
      idleExpiresAt: idle,
      absoluteExpiresAt: 12 * 3_600_000,
    });
    let answer = expiry(15 * 60_000);
    const tracker = createIdleTracker({
      expiry: expiry(60 * 60_000),
      now: () => now,
      refresh: () => Promise.resolve(answer),
      post: () => undefined,
    });
    tracker.receive({ type: 'session', ...expiry(30 * 60_000) });
    expect(tracker.expiry().idleExpiresAt).toBe(60 * 60_000);
    tracker.answer(expiry(20 * 60_000));
    expect(tracker.expiry().idleExpiresAt).toBe(20 * 60_000);
    now = 61_000;
    answer = expiry(now + 15 * 60_000);
    await tracker.extend();
    expect(tracker.expiry().idleExpiresAt).toBe(now + 15 * 60_000);
  });

  it('(5) another 4xx on the switch is a refusal without retry, not a lost connection', async () => {
    const api = fakeApi({ ...SESSION, tenantId: null });
    api.answers['/api/me'] = () => json(200, { userId: SESSION.userId, name: 'س', phoneE164: '' });
    api.answers['/api/me/clinics'] = () =>
      json(200, { clinics: [{ ...CLINIC, tenantWide: true }], invitations: [] });
    api.answers['/api/me/switch'] = () => errorAnswer(403, 'mfa_challenge_required');
    const r = await renderShell('clinic', api, '/choose');
    for (let i = 0; i < 50 && !r.container.querySelector('[data-testid="clinic-card"]'); i += 1) {
      await flush(20);
    }
    await click(must(r.container.querySelector('[data-testid="clinic-card"]')));
    for (
      let i = 0;
      i < 50 && !r.container.querySelector('[data-testid="switch-problem"]');
      i += 1
    ) {
      await flush(20);
    }
    const problem = r.container.querySelector('[data-testid="switch-problem"]');
    expect(problem?.textContent).toContain('تعذّر فتح هذه العيادة الآن');
    expect(problem?.querySelector('button')).toBeNull();
    await r.unmount();
  });
});
