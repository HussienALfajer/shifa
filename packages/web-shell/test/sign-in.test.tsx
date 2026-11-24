// Slice A-01-07 checkpoint 2: the sign-in page both apps share, as the owner approved it on
// 2026-11-24 ("Shifa Screens · Clinic web", page "A-01-07 Sign-in batch", prototype `Main`).
// One test per row of the sign-in part of the slice's API table: POST /auth/sign-in and its
// answers (401 one message, 429 locks with `until` and their countdown, a network failure with
// retry and the retry when the connection returns), the phone sent as typed, the remembered
// phone, the keyboard hints, and the notices of `?reason=` (idle, absolute, ended, expired,
// not an admin, signed out, sign-out failed).
import { createRandom, generatePhone } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionQueryKey } from '../src/session.ts';
import { button, click, field, flush, type Rendered, renderShell, type } from './render.tsx';
import { errorAnswer, type FakeApi, fakeApi, json, SESSION } from './support.ts';

const PHONE = generatePhone(createRandom(2026_11_24), 'SY');
const PASSWORD = 'كلمة-مرور-تجريبية-طويلة';
const REMEMBERED = 'shifa.signIn.phone';

let shown: Rendered | undefined;
beforeEach(() => {
  localStorage.clear();
});
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.useRealTimers();
});

async function open(api: FakeApi, path = '/sign-in', app: 'clinic' | 'admin' = 'clinic') {
  shown = await renderShell(app, api, path);
  return shown;
}

const text = (r: Rendered) => r.container.textContent;
const callout = (r: Rendered, id: string) =>
  r.container.querySelector<HTMLElement>(`[data-testid="${id}"]`);

async function fillAndSend(r: Rendered, phone = PHONE, password = PASSWORD) {
  await type(field(r.container, 'رقم الهاتف'), phone);
  await type(field(r.container, 'كلمة المرور'), password);
  await click(button(r.container, 'دخول'));
  await flush(20);
}

describe('sign-in page', () => {
  it('draws the title, the clinic line, both fields, the button and the help line', async () => {
    const r = await open(fakeApi(null));
    expect(r.container.querySelector('h1')?.textContent).toBe('تسجيل الدخول');
    expect(text(r)).toContain('ادخل برقم هاتفك المسجّل في العيادة.');
    expect(field(r.container, 'رقم الهاتف').type).toBe('tel');
    expect(field(r.container, 'رقم الهاتف').dir).toBe('ltr');
    expect(field(r.container, 'كلمة المرور').autocomplete).toBe('current-password');
    expect(button(r.container, 'دخول').type).toBe('submit');
    expect(text(r)).toContain('نسيت كلمة المرور؟');
    expect(text(r)).toContain('نظام العيادة');
  });

  it('admin web says it is for Shifa’s admins', async () => {
    const r = await open(fakeApi(null), '/sign-in', 'admin');
    expect(text(r)).toContain('لمشرفي شفاء فقط.');
    expect(text(r)).toContain('إدارة شفاء');
  });

  it('sends the phone as typed, Arabic-Indic digits included, and goes on with the session', async () => {
    const api = fakeApi(null);
    api.answers['/api/auth/sign-in'] = () => {
      api.session = SESSION;
      return json(200, SESSION);
    };
    const r = await open(api);
    const arabicDigits = PHONE.replace(/\d/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
    await fillAndSend(r, arabicDigits);
    expect(api.bodies['/api/auth/sign-in']).toEqual([{ phone: arabicDigits, password: PASSWORD }]);
    expect(r.router.state.location.pathname).toBe('/');
    expect(r.queryClient.getQueryData(sessionQueryKey)).toEqual({
      kind: 'signed-in',
      session: SESSION,
    });
  });

  it('sends nothing while a field is empty, and names the empty field', async () => {
    const api = fakeApi(null);
    const r = await open(api);
    await click(button(r.container, 'دخول'));
    expect(api.bodies['/api/auth/sign-in']).toBeUndefined();
    expect(text(r)).toContain('اكتب رقم الهاتف.');
    expect(text(r)).toContain('اكتب كلمة المرور.');
  });

  it('401 invalid_credentials: one message under the password, for a wrong phone or password', async () => {
    const api = fakeApi(null);
    api.answers['/api/auth/sign-in'] = () => errorAnswer(401, 'invalid_credentials');
    const r = await open(api);
    await fillAndSend(r);
    expect(text(r)).toContain('رقم الهاتف أو كلمة المرور غير صحيحة');
    expect(r.router.state.location.pathname).toBe('/sign-in');
    // A 401 of the sign-in is an answer, not a session that ended: no notice, no redirect.
    expect(callout(r, 'sign-in-reason')).toBeNull();
  });

  it.each([
    ['phone_locked', 'توقّف الدخول بهذا الرقم مؤقتاً'],
    ['ip_blocked', 'توقّف الدخول من هذه الشبكة مؤقتاً'],
  ])(
    '429 %s: a warning with the countdown, the form off, and on again at `until`',
    async (code, title) => {
      vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-11-24T10:27:00Z') });
      const api = fakeApi(null);
      const until = new Date(Date.now() + 15 * 60_000).toISOString();
      api.answers['/api/auth/sign-in'] = () => errorAnswer(429, code, { until });
      const r = await open(api);
      await fillAndSend(r);
      const lock = callout(r, 'sign-in-error');
      expect(lock?.getAttribute('role')).toBe('alert');
      expect(lock?.dataset['code']).toBe(code);
      expect(lock?.textContent).toContain(title);
      expect(lock?.textContent).toMatch(/1[45]:\d\d/);
      expect(field(r.container, 'رقم الهاتف').disabled).toBe(true);
      expect(field(r.container, 'كلمة المرور').disabled).toBe(true);
      expect(
        button(r.container, 'دخول').getAttribute('aria-disabled') ??
          String(button(r.container, 'دخول').disabled),
      ).toBe('true');

      await vi.advanceTimersByTimeAsync(15 * 60_000 + 1_000);
      await flush();
      expect(callout(r, 'sign-in-error')).toBeNull();
      expect(field(r.container, 'رقم الهاتف').disabled).toBe(false);
    },
  );

  it('a network failure: a danger callout with retry, and a retry by itself when the connection returns', async () => {
    const api = fakeApi(null);
    let calls = 0;
    api.answers['/api/auth/sign-in'] = () => {
      calls += 1;
      if (calls === 1) throw new TypeError('Failed to fetch');
      api.session = SESSION;
      return json(200, SESSION);
    };
    const r = await open(api);
    await fillAndSend(r);
    const down = callout(r, 'sign-in-error');
    expect(down?.dataset['code']).toBe('network');
    expect(down?.textContent).toContain('تعذّر الوصول إلى الخادم');
    expect(down?.querySelector('button')?.textContent).toBe('إعادة المحاولة');

    window.dispatchEvent(new Event('online'));
    await flush(30);
    expect(calls).toBe(2);
    expect(r.router.state.location.pathname).toBe('/');
  });

  it('a 5xx answer shows the same unreachable callout; the retry button sends again', async () => {
    const api = fakeApi(null);
    let calls = 0;
    api.answers['/api/auth/sign-in'] = () => {
      calls += 1;
      return errorAnswer(503, 'service_unavailable');
    };
    const r = await open(api);
    await fillAndSend(r);
    expect(callout(r, 'sign-in-error')?.dataset['code']).toBe('network');
    const retry = callout(r, 'sign-in-error')?.querySelector('button');
    if (!retry) throw new Error('no retry');
    await click(retry);
    await flush(20);
    expect(calls).toBe(2);
  });

  it('remembers the last phone on this device, and «ليس رقمك؟» forgets it', async () => {
    const api = fakeApi(null);
    api.answers['/api/auth/sign-in'] = () => json(200, SESSION);
    const first = await open(api);
    await fillAndSend(first);
    expect(localStorage.getItem(REMEMBERED)).toBe(PHONE);
    await first.unmount();
    shown = undefined;

    const r = await open(fakeApi(null));
    expect(field(r.container, 'رقم الهاتف').value).toBe(PHONE);
    expect(text(r)).toContain('آخر رقم دخل من هذا الجهاز.');
    await click(button(r.container, 'ليس رقمك؟ امسحه'));
    expect(field(r.container, 'رقم الهاتف').value).toBe('');
    expect(localStorage.getItem(REMEMBERED)).toBeNull();
  });

  it('a failed sign-in does not remember the phone', async () => {
    const api = fakeApi(null);
    api.answers['/api/auth/sign-in'] = () => errorAnswer(401, 'invalid_credentials');
    const r = await open(api);
    await fillAndSend(r);
    expect(localStorage.getItem(REMEMBERED)).toBeNull();
  });

  it('warns when the password is typed in Arabic letters, and when Caps Lock is on', async () => {
    const r = await open(fakeApi(null));
    const password = field(r.container, 'كلمة المرور');
    await type(password, 'سشبي');
    expect(text(r)).toContain('تكتب بأحرف عربية.');
    await type(password, 'abcd');
    expect(text(r)).not.toContain('تكتب بأحرف عربية.');
    password.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'A', bubbles: true, modifierCapsLock: true }),
    );
    await flush();
    expect(text(r)).toContain('Caps Lock');
  });
});

describe('sign-in notices (?reason=)', () => {
  it.each([
    ['idle', 'خرجت تلقائياً', 'status'],
    ['absolute', 'انتهت المدة القصوى للجلسة', 'status'],
    ['ended', 'أُنهيت جلستك', 'status'],
    ['session_expired', 'انتهت جلستك', 'status'],
    ['not_admin', 'هذه صفحة إدارة شفاء', 'alert'],
    ['signed_out', 'خرجت من حسابك', 'status'],
    ['sign_out_failed', 'تعذّر إنهاء الجلسة على الخادم', 'alert'],
    ['something_else', 'انتهت جلستك', 'status'],
  ])('%s', async (reason, title, role) => {
    const r = await open(fakeApi(null), `/sign-in?reason=${reason}`);
    const notice = callout(r, 'sign-in-reason');
    expect(notice?.dataset['reason']).toBe(reason);
    expect(notice?.getAttribute('role')).toBe(role);
    expect(notice?.textContent).toContain(title);
  });

  it('idle names the minutes when the page knew them', async () => {
    const r = await open(fakeApi(null), '/sign-in?reason=idle&minutes=30');
    expect(callout(r, 'sign-in-reason')?.textContent).toContain('30 دقيقة');
  });

  it('a session that ended on the server names its reason (session_expired with reason)', async () => {
    const api = fakeApi(null);
    api.endSession('session_expired', 'ended');
    const r = await open(api, '/');
    expect(r.router.state.location.pathname).toBe('/sign-in');
    expect(r.router.state.location.search).toEqual({ reason: 'ended' });
    expect(callout(r, 'sign-in-reason')?.textContent).toContain('أُنهيت جلستك');
  });

  it('no reason, no notice', async () => {
    const r = await open(fakeApi(null), '/sign-in');
    expect(callout(r, 'sign-in-reason')).toBeNull();
  });
});
