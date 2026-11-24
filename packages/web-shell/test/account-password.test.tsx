// Slice A-01-10 checkpoint 2: «تغيير كلمة المرور» on My account (prototype `Account10`). POST
// /auth/password: the repeat is checked before sending; 401 `invalid_credentials` is a field
// error under the current password, never a sign-out (A-01-09); each 400 rule under the new one;
// 429 `phone_locked` the lock with its countdown and the fields disabled; no connection; success
// names how many other devices were signed out and the list keeps this device only (OD-92).
// Improvement a: the rules ticked while typing.
import { afterEach, describe, expect, it } from 'vitest';
import { accountApi, inDialog, OWNER, openAt, THIS_DEVICE } from './account-support.ts';
import { button, click, field, flush, type Rendered, type } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

const CURRENT = 'old-garden-lamp-41';
const NEW = 'river-stone-quiet-77';

async function openForm(fake: ReturnType<typeof accountApi>) {
  shown = await openAt(fake, '/account');
  await flush(30);
  await click(button(shown.container, 'تغيير كلمة المرور'));
  return shown;
}

async function fill(current: string, next: string, repeat = next) {
  await type(field(inDialog(), 'كلمة المرور الحالية'), current);
  await type(field(inDialog(), 'كلمة المرور الجديدة'), next);
  await type(field(inDialog(), 'أعد كتابة كلمة المرور الجديدة'), repeat);
}

const submit = () => click(button(inDialog(), 'حفظ كلمة المرور'));

describe('Change password', () => {
  it('a repeat that differs is refused before anything is sent', async () => {
    const fake = accountApi();
    await openForm(fake);
    await fill(CURRENT, NEW, `${NEW}x`);
    await submit();
    expect(inDialog().textContent).toContain('الكلمتان الجديدتان غير متطابقتين.');
    expect(fake.calls).not.toContain('POST /api/auth/password');
  });

  it('the rules are ticked while typing (improvement a)', async () => {
    await openForm(accountApi());
    await type(field(inDialog(), 'كلمة المرور الجديدة'), 'short');
    const rules = () => [...inDialog().querySelectorAll('[data-testid="pw-rule"]')];
    expect(rules()[0]?.getAttribute('data-ok')).toBe('false');
    await type(field(inDialog(), 'كلمة المرور الجديدة'), NEW);
    expect(rules()[0]?.getAttribute('data-ok')).toBe('true');
  });

  it('401 invalid_credentials: under the current password, and still signed in', async () => {
    const fake = accountApi();
    fake.answers['/api/auth/password'] = () => errorAnswer(401, 'invalid_credentials');
    const r = await openForm(fake);
    await fill('wrong-one-123', NEW);
    await submit();
    expect(inDialog().textContent).toContain('كلمة المرور الحالية غير صحيحة.');
    expect(r.router.state.location.pathname).toBe('/account');
    expect(fake.calls).not.toContain('POST /api/auth/sign-out');
  });

  it.each([
    ['password_too_short', 'أقصر من 10 أحرف'],
    ['password_common', 'شائعة'],
    ['password_contains_phone', 'رقم هاتفك'],
    ['password_unchanged', 'هي نفسها كلمة المرور الحالية'],
  ])('400 %s is named under the new password', async (code, words) => {
    const fake = accountApi();
    fake.answers['/api/auth/password'] = () => errorAnswer(400, code);
    await openForm(fake);
    await fill(CURRENT, NEW);
    await submit();
    expect(inDialog().textContent).toContain(words);
  });

  it('429 phone_locked: the lock with its countdown and the fields disabled', async () => {
    const fake = accountApi();
    fake.answers['/api/auth/password'] = () =>
      errorAnswer(429, 'phone_locked', { until: new Date(Date.now() + 600_000).toISOString() });
    await openForm(fake);
    await fill(CURRENT, NEW);
    await submit();
    expect(inDialog().querySelector('[data-testid="lock"]')).not.toBeNull();
    expect(inDialog().textContent).toContain('أنت ما زلت داخلاً');
    expect(field(inDialog(), 'كلمة المرور الحالية').disabled).toBe(true);
  });

  it('no connection: nothing changed, the form keeps what was typed', async () => {
    const fake = accountApi();
    fake.answers['/api/auth/password'] = () => Promise.reject(new TypeError('offline'));
    await openForm(fake);
    await fill(CURRENT, NEW);
    await submit();
    expect(inDialog().textContent).toContain('لم تتغيّر كلمة المرور');
    expect(field(inDialog(), 'كلمة المرور الجديدة').value).toBe(NEW);
  });

  it('success: the other devices are named as signed out, this one stays', async () => {
    const fake = accountApi();
    const rotated = { ...OWNER, sessionId: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0d01' };
    fake.answers['/api/auth/password'] = () => {
      fake.answers['/api/auth/sessions'] = () =>
        json(200, { sessions: [{ ...THIS_DEVICE, id: rotated.sessionId }] });
      return json(200, rotated);
    };
    const r = await openForm(fake);
    await fill(CURRENT, NEW);
    await submit();
    await flush(30);
    expect(fake.bodies['/api/auth/password']).toEqual([
      { currentPassword: CURRENT, newPassword: NEW },
    ]);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(r.container.textContent).toContain('تغيّرت كلمة المرور');
    expect(r.container.textContent).toContain('أخرجنا أجهزتك الأخرى (3)');
    expect(r.container.querySelectorAll('[data-testid="session-row"]')).toHaveLength(1);
    expect(r.router.state.location.pathname).toBe('/account');
  });
});
