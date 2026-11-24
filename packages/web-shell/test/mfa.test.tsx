// Slice A-01-07 checkpoint 3: TOTP enrolment, the recovery codes and the challenge, as the owner
// approved them on 2026-11-24 ("Shifa Screens · Clinic web", page "A-01-07 Sign-in batch",
// prototype `Main`). One test per row of the MFA part of the slice's API table: enrol/start (QR,
// manual key with copy, 429 lock, 409 already enrolled, network), enrol/confirm (a complete code
// sends itself, improvement d; 400 invalid_code and clock_skew, 429, 409 not started), the ten
// codes once with copy, print and «حفظتُ الرموز» before going on (c); the challenge with the
// recovery-code mode (400, 429, 409 not owed), the codes left after a recovery sign-in, sign-out.
import { createRandom, generatePersonName, generatePhone } from '@shifa/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { sessionQueryKey } from '../src/session.ts';
import { button, click, field, flush, type Rendered, renderShell, type } from './render.tsx';
import { errorAnswer, type FakeApi, fakeApi, json, SESSION } from './support.ts';

const random = createRandom(2026_11_25);
const n = generatePersonName(random, { sex: 'male', adult: true, region: 'aleppo' });
const NAME = `${n.given} ${n.family}`;
const PHONE = generatePhone(random, 'SY');
const KEY = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const URI = `otpauth://totp/Shifa:${encodeURIComponent(PHONE)}?secret=${KEY}&issuer=Shifa`;
const CODES = Array.from({ length: 10 }, (_, i) => `k7m2q-9xw${String(i)}r`);

const ENROL = { ...SESSION, mfa: 'none' as const, mfaRequired: true, tenantId: null };
const PENDING = { ...SESSION, mfa: 'pending' as const };
const VERIFIED = {
  ...SESSION,
  sessionId: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0a99',
  mfa: 'verified' as const,
};

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

function api(session: typeof ENROL | typeof PENDING): FakeApi {
  const fake = fakeApi(session);
  fake.answers['/api/me'] = () =>
    json(200, { userId: SESSION.userId, name: NAME, phoneE164: PHONE });
  fake.answers['/api/auth/mfa/enrol/start'] = () => json(200, { otpauthUri: URI, manualKey: KEY });
  return fake;
}

async function open(fake: FakeApi, app: 'clinic' | 'admin' = 'clinic') {
  shown = await renderShell(app, fake, '/mfa');
  await flush(30);
  return shown;
}

const text = (r: Rendered) => r.container.textContent;
const otp = (r: Rendered) => {
  const input = r.container.querySelector<HTMLInputElement>('input[inputmode="numeric"]');
  if (!input) throw new Error('no code field');
  return input;
};

async function toKey(r: Rendered) {
  await click(button(r.container, 'لديّ التطبيق، التالي'));
  await flush(20);
}
async function toCode(r: Rendered) {
  await toKey(r);
  await click(button(r.container, 'أضفت الحساب، التالي'));
}

describe('TOTP enrolment', () => {
  it('step 1 says why and names authenticator apps; nothing is asked of the server yet', async () => {
    const fake = api(ENROL);
    const r = await open(fake);
    expect(r.router.state.location.pathname).toBe('/mfa');
    expect(text(r)).toContain('التحقق بخطوتين · الخطوة 1 من 3');
    expect(r.container.querySelector('h1')?.textContent).toBe('ثبّت تطبيق المصادقة');
    expect(text(r)).toContain('Google Authenticator');
    expect(fake.calls).not.toContain('POST /api/auth/mfa/enrol/start');
  });

  it('step 2 starts enrolment: the QR code, the key in groups of four and its copy', async () => {
    const fake = api(ENROL);
    const r = await open(fake);
    await toKey(r);
    expect(fake.calls.filter((c) => c === 'POST /api/auth/mfa/enrol/start')).toHaveLength(1);
    const qr = r.container.querySelector('[role="img"]');
    expect(qr?.getAttribute('aria-label')).toBe('رمز QR لإضافة حساب شفاء إلى تطبيق المصادقة');
    expect(text(r)).toContain('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP');
    expect(text(r)).not.toContain(URI);
    expect(button(r.container, 'نسخ المفتاح')).toBeTruthy();
  });

  it('going back to the key keeps the same key: enrolment is not restarted', async () => {
    const fake = api(ENROL);
    const r = await open(fake);
    await toCode(r);
    await click(button(r.container, 'رجوع إلى المفتاح'));
    expect(text(r)).toContain('JBSW Y3DP');
    expect(fake.calls.filter((c) => c === 'POST /api/auth/mfa/enrol/start')).toHaveLength(1);
  });

  it('a network failure on start shows the error in the code’s place, with retry', async () => {
    const fake = api(ENROL);
    let fail = true;
    fake.answers['/api/auth/mfa/enrol/start'] = () =>
      fail
        ? Promise.reject(new TypeError('Failed to fetch'))
        : json(200, { otpauthUri: URI, manualKey: KEY });
    const r = await open(fake);
    await toKey(r);
    expect(text(r)).toContain('تعذّر إنشاء المفتاح');
    expect(r.container.querySelector('[role="img"]')).toBeNull();
    fail = false;
    await click(button(r.container, 'إعادة المحاولة'));
    await flush(20);
    expect(r.container.querySelector('[role="img"]')).not.toBeNull();
  });

  it('429 mfa_locked on start: the lock with its end time', async () => {
    const fake = api(ENROL);
    const until = new Date(Date.now() + 15 * 60_000).toISOString();
    fake.answers['/api/auth/mfa/enrol/start'] = () => errorAnswer(429, 'mfa_locked', { until });
    const r = await open(fake);
    await toKey(r);
    expect(text(r)).toContain('توقّف التحقق مؤقتاً');
  });

  it('409 already enrolled: the session is read again and routed', async () => {
    const fake = api(ENROL);
    fake.answers['/api/auth/mfa/enrol/start'] = () => {
      fake.session = PENDING;
      return errorAnswer(409, 'mfa_already_enrolled');
    };
    const r = await open(fake);
    await toKey(r);
    await flush(40);
    expect(fake.calls.filter((c) => c === 'GET /api/auth/session').length).toBeGreaterThan(1);
    expect(text(r)).toContain('رمز التحقق');
  });

  it('a complete six-digit code sends itself (improvement d)', async () => {
    const fake = api(ENROL);
    fake.answers['/api/auth/mfa/enrol/confirm'] = () => errorAnswer(400, 'invalid_code');
    const r = await open(fake);
    await toCode(r);
    await type(otp(r), '123456');
    await flush(20);
    expect(fake.bodies['/api/auth/mfa/enrol/confirm']).toEqual([{ code: '123456' }]);
    expect(text(r)).toContain('الرمز غير صحيح أو استُعمل من قبل. اكتب الرمز الجديد من التطبيق.');
  });

  it('400 clock_skew: the set-the-clock hint', async () => {
    const fake = api(ENROL);
    fake.answers['/api/auth/mfa/enrol/confirm'] = () => errorAnswer(400, 'clock_skew');
    const r = await open(fake);
    await toCode(r);
    await type(otp(r), '123456');
    await flush(20);
    expect(text(r)).toContain('ساعة هاتفك غير مضبوطة');
  });

  it('429 mfa_locked on confirm: the lock, the code field off', async () => {
    const fake = api(ENROL);
    const until = new Date(Date.now() + 15 * 60_000).toISOString();
    fake.answers['/api/auth/mfa/enrol/confirm'] = () => errorAnswer(429, 'mfa_locked', { until });
    const r = await open(fake);
    await toCode(r);
    await type(otp(r), '123456');
    await flush(20);
    expect(text(r)).toContain('توقّف التحقق مؤقتاً');
    expect(otp(r).disabled).toBe(true);
  });

  it('409 mfa_not_started: enrolment starts again at the key', async () => {
    const fake = api(ENROL);
    fake.answers['/api/auth/mfa/enrol/confirm'] = () => errorAnswer(409, 'mfa_not_started');
    const r = await open(fake);
    await toCode(r);
    await type(otp(r), '123456');
    await flush(30);
    expect(fake.calls.filter((c) => c === 'POST /api/auth/mfa/enrol/start')).toHaveLength(2);
    expect(text(r)).toContain('الخطوة 2 من 3');
  });

  it('success: the ten codes once, copy and print, and «حفظتُ الرموز» before going on', async () => {
    const fake = api(ENROL);
    fake.answers['/api/auth/mfa/enrol/confirm'] = () => {
      fake.session = VERIFIED;
      return json(200, { recoveryCodes: CODES, session: VERIFIED });
    };
    const r = await open(fake);
    await toCode(r);
    await type(otp(r), '123456');
    await flush(40);
    expect(r.router.state.location.pathname).toBe('/mfa');
    expect(r.container.querySelector('h1')?.textContent).toBe('احفظ رموز الاسترداد');
    for (const code of CODES) expect(text(r)).toContain(code);
    expect(button(r.container, 'نسخ الكل')).toBeTruthy();
    expect(button(r.container, 'طباعة')).toBeTruthy();
    // The print sheet names the person (GET /me).
    expect(document.querySelector('[data-slot="code-list-print"]')?.textContent).toContain(NAME);
    const go = button(r.container, 'متابعة إلى العيادة');
    expect(go.disabled || go.getAttribute('aria-disabled') === 'true').toBe(true);
    const saved = r.container.querySelector('[role="checkbox"]');
    if (!saved) throw new Error('no «حفظتُ الرموز» checkbox');
    await click(saved);
    await click(button(r.container, 'متابعة إلى العيادة'));
    await flush(30);
    expect(r.router.state.location.pathname).toBe('/');
    expect(r.queryClient.getQueryData(sessionQueryKey)).toEqual({
      kind: 'signed-in',
      session: VERIFIED,
    });
    // Never kept in the browser.
    const stored = (s: Storage) =>
      Array.from({ length: s.length }, (_, i) => s.getItem(s.key(i) ?? '') ?? '').join('\n');
    expect(stored(localStorage)).not.toContain(CODES[0]);
    expect(stored(sessionStorage)).not.toContain(CODES[0]);
  });

  it('a super admin goes on to admin web', async () => {
    const admin = { ...ENROL, platformAdmin: true };
    const fake = api(admin);
    fake.answers['/api/auth/mfa/enrol/confirm'] = () =>
      json(200, {
        recoveryCodes: CODES,
        session: { ...VERIFIED, platformAdmin: true, tenantId: null },
      });
    const r = await open(fake, 'admin');
    expect(text(r)).toContain('حساب مشرف شفاء يحتاج رمزاً من هاتفك');
    await toCode(r);
    await type(otp(r), '123456');
    await flush(40);
    expect(button(r.container, 'متابعة إلى إدارة شفاء')).toBeTruthy();
  });
});

describe('TOTP challenge', () => {
  it('greets the person by name and sends a complete code by itself', async () => {
    const fake = api(PENDING);
    fake.answers['/api/auth/mfa/challenge'] = () => {
      fake.session = VERIFIED;
      return json(200, { session: VERIFIED, recoveryCodesLeft: 10 });
    };
    const r = await open(fake);
    expect(r.container.querySelector('h1')?.textContent).toBe('رمز التحقق');
    expect(text(r)).toContain(NAME);
    await type(otp(r), '654321');
    await flush(40);
    expect(fake.bodies['/api/auth/mfa/challenge']).toEqual([{ method: 'totp', code: '654321' }]);
    expect(r.router.state.location.pathname).toBe('/');
    expect(text(r)).not.toContain('دخلت برمز استرداد');
  });

  it('400 invalid_code: wrong or replayed, one message', async () => {
    const fake = api(PENDING);
    fake.answers['/api/auth/mfa/challenge'] = () => errorAnswer(400, 'invalid_code');
    const r = await open(fake);
    await type(otp(r), '654321');
    await flush(20);
    expect(text(r)).toContain('الرمز غير صحيح أو استُعمل من قبل. اكتب الرمز الجديد من التطبيق.');
  });

  it('the recovery-code mode sends the code as typed; a wrong one has its own message', async () => {
    const fake = api(PENDING);
    fake.answers['/api/auth/mfa/challenge'] = () => errorAnswer(400, 'invalid_code');
    const r = await open(fake);
    await click(button(r.container, 'استخدام رمز استرداد'));
    expect(r.container.querySelector('h1')?.textContent).toBe('الدخول برمز استرداد');
    await type(field(r.container, 'رمز الاسترداد'), 'K7M2Q-9XW4R');
    await click(button(r.container, 'تأكيد'));
    await flush(20);
    expect(fake.bodies['/api/auth/mfa/challenge']).toEqual([
      { method: 'recovery', code: 'K7M2Q-9XW4R' },
    ]);
    expect(text(r)).toContain('رمز الاسترداد غير صحيح أو استُعمل من قبل.');
    await click(button(r.container, 'استخدام رمز التطبيق'));
    expect(r.container.querySelector('h1')?.textContent).toBe('رمز التحقق');
  });

  it.each([
    [9, 'دخلت برمز استرداد · بقي لديك 9 رموز'],
    [2, 'بقي لديك رمزا استرداد فقط'],
  ])('after a recovery sign-in with %i left, home says so', async (left, message) => {
    const fake = api(PENDING);
    fake.answers['/api/auth/mfa/challenge'] = () => {
      fake.session = VERIFIED;
      return json(200, { session: VERIFIED, recoveryCodesLeft: left });
    };
    const r = await open(fake);
    await click(button(r.container, 'استخدام رمز استرداد'));
    await type(field(r.container, 'رمز الاسترداد'), 'k7m2q-9xw4r');
    await click(button(r.container, 'تأكيد'));
    await flush(40);
    expect(r.router.state.location.pathname).toBe('/');
    expect(text(r)).toContain(message);
  });

  it('429 mfa_locked: the lock with its end time, the form off', async () => {
    const fake = api(PENDING);
    const until = new Date(Date.now() + 15 * 60_000).toISOString();
    fake.answers['/api/auth/mfa/challenge'] = () => errorAnswer(429, 'mfa_locked', { until });
    const r = await open(fake);
    await type(otp(r), '654321');
    await flush(20);
    expect(text(r)).toContain('توقّف التحقق مؤقتاً');
    expect(otp(r).disabled).toBe(true);
  });

  it('409 mfa_not_owed: the session is read again and routed', async () => {
    const fake = api(PENDING);
    fake.answers['/api/auth/mfa/challenge'] = () => {
      fake.session = VERIFIED;
      return errorAnswer(409, 'mfa_not_owed');
    };
    const r = await open(fake);
    await type(otp(r), '654321');
    await flush(40);
    expect(r.router.state.location.pathname).toBe('/');
  });

  it('«خروج» signs out and lands on sign-in', async () => {
    const fake = api(PENDING);
    const r = await open(fake);
    await click(button(r.container, 'خروج'));
    await flush(30);
    expect(fake.calls).toContain('POST /api/auth/sign-out');
    expect(r.router.state.location.pathname).toBe('/sign-in');
    expect(r.router.state.location.search).toEqual({ reason: 'signed_out' });
  });
});
