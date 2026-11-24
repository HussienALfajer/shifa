// Slice A-01-10 checkpoint 2: My account, as the owner approved it on 2026-11-24 ("Shifa Screens ·
// Clinic web", page "A-01-10 Account batch", prototype `Account10`). One test per row of the
// slice's route table for GET /me, GET /auth/mfa, POST /auth/mfa/recovery-codes, POST
// /auth/mfa/enrol/start|confirm, and the frame: the navigation (owner only: «إعدادات العيادة»),
// the header badge when two or fewer recovery codes are left (improvement b). Password and
// sessions: `account-password.test.tsx`, `account-sessions.test.tsx`.
import { afterEach, describe, expect, it } from 'vitest';
import {
  accountApi,
  CLINIC,
  CODES,
  DOCTOR,
  inDialog,
  KEY,
  OWNER_NAME,
  openAt,
  PHONE,
  STAFF,
  STAFF_NAME,
} from './account-support.ts';
import { button, click, flush, type Rendered, type as typeInto } from './render.tsx';
import { errorAnswer, json, SESSION } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

const text = () => document.body.textContent;

async function open(fake: ReturnType<typeof accountApi>) {
  shown = await openAt(fake, '/account');
  await flush(30);
  return shown;
}

const otp = (root: HTMLElement) => {
  const input = root.querySelector<HTMLInputElement>('input[inputmode="numeric"]');
  if (!input) throw new Error('no code field');
  return input;
};

async function typeCode(root: HTMLElement, code: string) {
  await typeInto(otp(root), code);
  await flush(20);
}

describe('My account: profile and frame', () => {
  it('names the person, their role and clinic, and the sign-in phone read-only', async () => {
    const r = await open(accountApi());
    expect(r.router.state.location.pathname).toBe('/account');
    expect(r.container.querySelector('h1')?.textContent).toBe('حسابي');
    expect(text()).toContain(OWNER_NAME);
    expect(text()).toContain(`مالك العيادة · ${CLINIC}`);
    const phone = r.container.querySelector('[data-testid="my-phone"]');
    expect(phone?.textContent).toContain(PHONE.slice(-4));
    expect(phone?.getAttribute('dir')).toBe('ltr');
    expect(r.container.querySelector('input[type="tel"]')).toBeNull();
    expect(text()).toContain('لتغيير الاسم أو رقم الدخول تواصل مع إدارة شفاء.');
  });

  it('a member is told to ask the clinic’s owner', async () => {
    await open(accountApi({ session: STAFF }));
    expect(text()).toContain(STAFF_NAME);
    expect(text()).toContain(`موظف استقبال · ${CLINIC}`);
    expect(text()).toContain('لتغيير الاسم أو رقم الدخول تواصل مع مالك العيادة.');
  });

  it('the owner’s navigation has «إعدادات العيادة»; a member’s has not', async () => {
    const r = await open(accountApi());
    const nav = () => r.container.querySelector('nav')?.textContent ?? '';
    expect(nav()).toContain('حسابي');
    expect(nav()).toContain('إعدادات العيادة');
    expect(r.container.querySelector('nav [aria-current="page"]')?.textContent).toContain('حسابي');
    await r.unmount();
    shown = await openAt(accountApi({ session: DOCTOR }), '/account');
    await flush(30);
    expect(shown.container.querySelector('nav')?.textContent).not.toContain('إعدادات العيادة');
  });
});

describe('My account: TOTP and recovery codes', () => {
  it('enrolled: «مفعّل», since when, nine codes left as information', async () => {
    const r = await open(accountApi({ codesLeft: 9 }));
    const card = r.container.querySelector('[data-testid="mfa-card"]');
    expect(card?.textContent).toContain('مفعّل');
    expect(card?.textContent).toContain('12/11/2026');
    expect(card?.querySelector('[data-testid="codes-left"]')?.getAttribute('data-tone')).toBe(
      'info',
    );
    expect(r.container.querySelector('header')?.textContent).not.toContain('رمز');
  });

  it('two left: a warning on the card and a badge in the header (improvement b)', async () => {
    const r = await open(accountApi({ codesLeft: 2 }));
    const left = r.container.querySelector('[data-testid="codes-left"]');
    expect(left?.getAttribute('data-tone')).toBe('warning');
    expect(left?.textContent).toContain('بقي رمزان فقط');
    expect(r.container.querySelector('header')?.textContent).toContain('بقي رمزا استرداد');
  });

  it('none left: danger, and the header says so', async () => {
    const r = await open(accountApi({ codesLeft: 0 }));
    expect(r.container.querySelector('[data-testid="codes-left"]')?.getAttribute('data-tone')).toBe(
      'danger',
    );
    expect(r.container.querySelector('header')?.textContent).toContain('لا رموز استرداد');
  });

  it('new codes: a TOTP code, then the ten codes once, «تم» only after «حفظتُ الرموز»', async () => {
    const fake = accountApi({ codesLeft: 2 });
    fake.answers['/api/auth/mfa/recovery-codes'] = () => json(200, { recoveryCodes: CODES });
    const r = await open(fake);
    await click(button(r.container, 'رموز استرداد جديدة'));
    await typeCode(inDialog(), '123456');
    expect(fake.bodies['/api/auth/mfa/recovery-codes']).toEqual([{ code: '123456' }]);
    for (const code of CODES) expect(inDialog().textContent).toContain(code);
    const done = button(inDialog(), 'تم');
    expect(done.disabled).toBe(true);
    const saved = inDialog().querySelector('[role="checkbox"]');
    if (!saved) throw new Error('no «حفظتُ الرموز» checkbox');
    await click(saved);
    expect(button(inDialog(), 'تم').disabled).toBe(false);
    const reads = fake.calls.filter((c) => c === 'GET /api/auth/mfa').length;
    await click(button(inDialog(), 'تم'));
    await flush(30);
    expect(text()).toContain('رموز جديدة جاهزة');
    expect(text()).not.toContain(CODES[0]);
    expect(fake.calls.filter((c) => c === 'GET /api/auth/mfa').length).toBeGreaterThan(reads);
  });

  it('a wrong code is named under the field; nothing else changes', async () => {
    const fake = accountApi();
    fake.answers['/api/auth/mfa/recovery-codes'] = () => errorAnswer(400, 'invalid_code');
    const r = await open(fake);
    await click(button(r.container, 'رموز استرداد جديدة'));
    await typeCode(inDialog(), '000000');
    expect(inDialog().textContent).toContain('الرمز غير صحيح أو استُعمل من قبل');
    expect(r.router.state.location.pathname).toBe('/account');
  });

  it('429 mfa_locked: the lock with its countdown, the field disabled; old codes still work', async () => {
    const fake = accountApi();
    const until = new Date(Date.now() + 90_000).toISOString();
    fake.answers['/api/auth/mfa/recovery-codes'] = () => errorAnswer(429, 'mfa_locked', { until });
    const r = await open(fake);
    await click(button(r.container, 'رموز استرداد جديدة'));
    await typeCode(inDialog(), '111111');
    expect(inDialog().querySelector('[data-testid="lock"]')).not.toBeNull();
    expect(inDialog().textContent).toContain('رموزك القديمة ما زالت تعمل');
    expect(otp(inDialog()).disabled).toBe(true);
  });

  it('a receptionist without TOTP enrols here: QR, key, a code, then the codes', async () => {
    const fake = accountApi({ session: STAFF });
    fake.answers['/api/auth/mfa/enrol/start'] = () =>
      json(200, {
        otpauthUri: `otpauth://totp/Shifa:x?secret=${KEY}&issuer=Shifa`,
        manualKey: KEY,
      });
    fake.answers['/api/auth/mfa/enrol/confirm'] = () =>
      json(200, {
        recoveryCodes: CODES,
        session: { ...STAFF, mfa: 'verified', sessionId: SESSION.sessionId },
      });
    const r = await open(fake);
    const card = r.container.querySelector('[data-testid="mfa-card"]');
    expect(card?.textContent).toContain('غير مفعّل');
    await click(button(r.container, 'تفعيل التحقق بخطوتين'));
    await flush(30);
    expect(fake.calls).toContain('POST /api/auth/mfa/enrol/start');
    expect(inDialog().querySelector('[data-slot="qr-code"]')).not.toBeNull();
    expect(inDialog().textContent).toContain('JBSW Y3DP');
    await typeCode(inDialog(), '654321');
    expect(fake.bodies['/api/auth/mfa/enrol/confirm']).toEqual([{ code: '654321' }]);
    expect(inDialog().textContent).toContain(CODES[9]);
    expect(r.router.state.location.pathname).toBe('/account');
  });

  it('enrolment: clock_skew names the phone’s clock', async () => {
    const fake = accountApi({ session: STAFF });
    fake.answers['/api/auth/mfa/enrol/start'] = () =>
      json(200, { otpauthUri: `otpauth://totp/Shifa:x?secret=${KEY}`, manualKey: KEY });
    fake.answers['/api/auth/mfa/enrol/confirm'] = () => errorAnswer(400, 'clock_skew');
    const r = await open(fake);
    await click(button(r.container, 'تفعيل التحقق بخطوتين'));
    await flush(30);
    await typeCode(inDialog(), '222222');
    expect(inDialog().textContent).toContain('ساعة هاتفك غير مضبوطة');
  });
});
