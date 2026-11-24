// Slice A-01-07 checkpoint 3, review findings: a second setup link opened in the same tab is read
// and leaves history (B1); the consume 409 `conflict` says to sign in (N1); a 5xx on the view is
// no «invalid link» (N5); a lock on enrolment start asks for the key again when it ends (N3); one
// start at a time (N4); the codes-left notice shows once (N6); enrolment verified in another tab
// goes on (N7); the router keeps the cache through the MFA rotation only for the same person and
// clinic (the negative cases of `isMfaRotation`).
import { afterEach, describe, expect, it } from 'vitest';
import { sessionQueryKey } from '../src/session.ts';
import { button, click, flush, type Rendered, renderShell, type } from './render.tsx';
import { errorAnswer, type FakeApi, fakeApi, json, SESSION } from './support.ts';

const TOKEN_1 = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCde';
const TOKEN_2 = 'ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210-_ZyXwv';
const VIEW = {
  clinicName: 'عيادة تجريبية',
  personName: 'شخص تجريبي',
  role: 'owner',
  purpose: 'owner_setup',
  phoneMasked: '+963 ••• ••• 123',
  expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
};
const KEY = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const START = { otpauthUri: `otpauth://totp/Shifa:x?secret=${KEY}&issuer=Shifa`, manualKey: KEY };
const ENROL = { ...SESSION, mfa: 'none' as const, mfaRequired: true, tenantId: null };
const PENDING = { ...SESSION, mfa: 'pending' as const };
const OTHER_SESSION = '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0a77';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

const text = (r: Rendered) => r.container.textContent;
const starts = (api: FakeApi) =>
  api.calls.filter((c) => c === 'POST /api/auth/mfa/enrol/start').length;

describe('setup link (review)', () => {
  it('B1: a second link opened in the same tab is read, and its fragment leaves history', async () => {
    const api = fakeApi(null);
    api.answers['/api/auth/setup-link/view'] = () => json(200, VIEW);
    shown = await renderShell('clinic', api, `/setup#${TOKEN_1}`);
    await flush(30);
    shown.router.history.push(`/setup#${TOKEN_2}`);
    await flush(50);
    expect(shown.router.state.location.hash).toBe('');
    expect(shown.router.state.location.href).not.toContain(TOKEN_2);
    expect(api.bodies['/api/auth/setup-link/view']).toEqual([
      { token: TOKEN_1 },
      { token: TOKEN_2 },
    ]);
  });

  it('N1: 409 conflict on consume says the number has an account and leads to sign-in', async () => {
    const api = fakeApi(null);
    api.answers['/api/auth/setup-link/view'] = () => json(200, VIEW);
    api.answers['/api/auth/setup-link/consume'] = () => errorAnswer(409, 'conflict');
    const r = await renderShell('clinic', api, `/setup#${TOKEN_1}`);
    shown = r;
    await flush(30);
    const fields = r.container.querySelectorAll<HTMLInputElement>('input[type="password"]');
    for (const f of fields) await type(f, 'كلمة-مرور-تجريبية-طويلة');
    await click(button(r.container, 'حفظ والمتابعة إلى التحقق'));
    await flush(20);
    expect(text(r)).toContain('لهذا الرقم حساب من قبل');
    await click(button(r.container, 'دخول'));
    expect(r.router.state.location.pathname).toBe('/sign-in');
  });

  it('N5: a 5xx on the view is a server error with retry, not an invalid link', async () => {
    const api = fakeApi(null);
    api.answers['/api/auth/setup-link/view'] = () => errorAnswer(503, 'service_unavailable');
    shown = await renderShell('clinic', api, `/setup#${TOKEN_1}`);
    await flush(30);
    expect(text(shown)).not.toContain('هذا الرابط لم يعد صالحاً');
    expect(text(shown)).toContain('حدث خطأ في الخادم');
    expect(button(shown.container, 'إعادة المحاولة')).toBeTruthy();
  });
});

describe('enrolment (review)', () => {
  it('N3: a lock on start asks for the key again when it runs out', async () => {
    const api = fakeApi(ENROL);
    let locked = true;
    api.answers['/api/auth/mfa/enrol/start'] = () => {
      if (!locked) return json(200, START);
      locked = false;
      return errorAnswer(429, 'mfa_locked', { until: new Date(Date.now() + 1200).toISOString() });
    };
    shown = await renderShell('clinic', api, '/mfa');
    await flush(30);
    await click(button(shown.container, 'لديّ التطبيق، التالي'));
    await flush(20);
    expect(text(shown)).toContain('توقّف التحقق مؤقتاً');
    await flush(2600);
    expect(starts(api)).toBe(2);
    expect(text(shown)).toContain('JBSW Y3DP');
  });

  it('N4: back and next again while the key is loading sends one start', async () => {
    const api = fakeApi(ENROL);
    let answer: ((r: Response) => void) | undefined;
    api.answers['/api/auth/mfa/enrol/start'] = () =>
      new Promise<Response>((resolve) => {
        answer = resolve;
      });
    shown = await renderShell('clinic', api, '/mfa');
    await flush(30);
    await click(button(shown.container, 'لديّ التطبيق، التالي'));
    await click(button(shown.container, 'رجوع'));
    await click(button(shown.container, 'لديّ التطبيق، التالي'));
    await flush(20);
    expect(starts(api)).toBe(1);
    answer?.(json(200, START));
    await flush(20);
    expect(text(shown)).toContain('JBSW Y3DP');
  });

  it('N7: verified in another tab while on a step, the page goes on', async () => {
    const api = fakeApi(ENROL);
    shown = await renderShell('clinic', api, '/mfa');
    await flush(30);
    shown.queryClient.setQueryData(sessionQueryKey, {
      kind: 'signed-in',
      session: { ...SESSION, sessionId: OTHER_SESSION, mfa: 'verified' },
    });
    await flush(40);
    expect(shown.router.state.location.pathname).toBe('/');
  });
});

describe('codes left (review N6)', () => {
  it('shows once after the challenge, not on the next visit home', async () => {
    const api = fakeApi(PENDING);
    api.answers['/api/me'] = () =>
      json(200, { userId: SESSION.userId, name: 'شخص', phoneE164: '+963930000123' });
    api.answers['/api/auth/mfa/challenge'] = () => {
      api.session = { ...SESSION, sessionId: OTHER_SESSION, mfa: 'verified' };
      return json(200, { session: api.session, recoveryCodesLeft: 9 });
    };
    const r = await renderShell('clinic', api, '/mfa');
    shown = r;
    await flush(30);
    await click(button(r.container, 'استخدام رمز استرداد'));
    const input = r.container.querySelector<HTMLInputElement>('input[dir="ltr"]');
    if (!input) throw new Error('no recovery field');
    await type(input, 'k7m2q-9xw4r');
    await click(button(r.container, 'تأكيد'));
    await flush(40);
    expect(text(r)).toContain('بقي لديك 9 رموز');
    await r.router.navigate({ to: '/about' });
    await r.router.navigate({ to: '/' });
    await flush(30);
    expect(text(r)).not.toContain('بقي لديك 9 رموز');
  });
});

describe('the MFA rotation keeps the cache only for the same person and clinic', () => {
  async function rotateTo(next: typeof SESSION) {
    const api = fakeApi(PENDING);
    shown = await renderShell('clinic', api, '/mfa');
    await flush(30);
    shown.queryClient.setQueryData(['clinic', PENDING.tenantId, 'probe'], 'cached');
    shown.queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: next });
    await flush(30);
    return shown.queryClient.getQueryData(['clinic', PENDING.tenantId, 'probe']);
  }

  it('the same person and clinic: kept', async () => {
    expect(await rotateTo({ ...SESSION, sessionId: OTHER_SESSION, mfa: 'verified' })).toBe(
      'cached',
    );
  });

  it('another person, verified: cleared and home', async () => {
    const other = {
      ...SESSION,
      userId: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0a55',
      sessionId: OTHER_SESSION,
      mfa: 'verified' as const,
    };
    expect(await rotateTo(other)).toBeUndefined();
    expect(shown?.router.state.location.pathname).toBe('/');
  });

  it('another clinic, verified: cleared', async () => {
    const other = {
      ...SESSION,
      tenantId: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0a66',
      sessionId: OTHER_SESSION,
      mfa: 'verified' as const,
    };
    expect(await rotateTo(other)).toBeUndefined();
  });
});
