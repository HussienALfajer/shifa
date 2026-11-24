// Slice A-01-10 checkpoint 3: moving TOTP to a new phone from My account (OD-98, OD-101), as the
// owner approved it on `Account10` on 2026-11-24: «نقل التحقق إلى هاتف جديد» on the MFA card of an
// enrolled person; step 1 a code from the old phone (POST /auth/mfa/re-enrol/start), step 2 the new
// key (QR, key, a code from the new phone: POST /auth/mfa/re-enrol/confirm), then the ten codes
// once. 400 `invalid_code`, `clock_skew`; 429 `mfa_locked`; no connection; 409 `mfa_not_enrolled`
// re-reads the status and closes; `mfa_not_started` returns to step 1. The session is not rotated
// and the notice says the other devices stay signed in.
import { afterEach, describe, expect, it } from 'vitest';
import { accountApi, CODES, dialog, inDialog, KEY, openAt, STAFF } from './account-support.ts';
import { button, click, flush, type Rendered, type as typeInto } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

const MOVE = 'نقل التحقق إلى هاتف جديد';
const START = '/api/auth/mfa/re-enrol/start';
const CONFIRM = '/api/auth/mfa/re-enrol/confirm';
const NEW_KEY = {
  otpauthUri: `otpauth://totp/Shifa:x?secret=${KEY}&issuer=Shifa`,
  manualKey: KEY,
};

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

describe('My account: moving TOTP to a new phone', () => {
  it('is offered to an enrolled person only', async () => {
    const r = await open(accountApi());
    expect(button(r.container, MOVE)).toBeTruthy();
    await r.unmount();
    shown = await openAt(accountApi({ session: STAFF }), '/account');
    await flush(30);
    expect(() => button(shown?.container ?? document.body, MOVE)).toThrow();
  });

  it('old code, then the new key and a code from the new phone, then the ten codes once', async () => {
    const fake = accountApi();
    fake.answers[START] = () => json(200, NEW_KEY);
    fake.answers[CONFIRM] = () => json(200, { recoveryCodes: CODES });
    const r = await open(fake);
    await click(button(r.container, MOVE));
    expect(inDialog().textContent).toContain('الهاتف القديم');
    expect(inDialog().querySelector('[data-slot="qr-code"]')).toBeNull();
    await typeCode(inDialog(), '123456');
    expect(fake.bodies[START]).toEqual([{ code: '123456' }]);
    expect(inDialog().querySelector('[data-slot="qr-code"]')).not.toBeNull();
    expect(inDialog().textContent).toContain('JBSW Y3DP');
    expect(inDialog().textContent).toContain('الهاتف الجديد');
    await typeCode(inDialog(), '654321');
    expect(fake.bodies[CONFIRM]).toEqual([{ code: '654321' }]);
    for (const code of CODES) expect(inDialog().textContent).toContain(code);
    // Not rotated (OD-101): no new session is read and the page stays.
    expect(r.router.state.location.pathname).toBe('/account');
    const saved = inDialog().querySelector('[role="checkbox"]');
    if (!saved) throw new Error('no «حفظتُ الرموز» checkbox');
    await click(saved);
    await click(button(inDialog(), 'تم'));
    await flush(30);
    expect(dialog()).toBeNull();
    expect(document.body.textContent).toContain('نُقل التحقق إلى الهاتف الجديد');
    expect(document.body.textContent).toContain('أجهزتك الأخرى ما زالت داخلة');
    expect(document.body.textContent).not.toContain(CODES[0]);
    expect(document.body.textContent).not.toContain(KEY);
  });

  it('a wrong old code is named under the field and the key is not shown', async () => {
    const fake = accountApi();
    fake.answers[START] = () => errorAnswer(400, 'invalid_code');
    const r = await open(fake);
    await click(button(r.container, MOVE));
    await typeCode(inDialog(), '000000');
    expect(inDialog().textContent).toContain('الرمز غير صحيح أو استُعمل من قبل');
    expect(inDialog().querySelector('[data-slot="qr-code"]')).toBeNull();
  });

  it('a wrong code from the new phone keeps the key on screen', async () => {
    const fake = accountApi();
    fake.answers[START] = () => json(200, NEW_KEY);
    fake.answers[CONFIRM] = () => errorAnswer(400, 'invalid_code');
    const r = await open(fake);
    await click(button(r.container, MOVE));
    await typeCode(inDialog(), '123456');
    await typeCode(inDialog(), '999999');
    expect(inDialog().textContent).toContain('الرمز غير صحيح أو استُعمل من قبل');
    expect(inDialog().querySelector('[data-slot="qr-code"]')).not.toBeNull();
  });

  it('clock_skew on the new phone names its clock', async () => {
    const fake = accountApi();
    fake.answers[START] = () => json(200, NEW_KEY);
    fake.answers[CONFIRM] = () => errorAnswer(400, 'clock_skew');
    const r = await open(fake);
    await click(button(r.container, MOVE));
    await typeCode(inDialog(), '123456');
    await typeCode(inDialog(), '222222');
    expect(inDialog().textContent).toContain('ساعة هاتفك غير مضبوطة');
  });

  it('429 mfa_locked: the lock with its countdown, the field disabled, the old phone still works', async () => {
    const fake = accountApi();
    const until = new Date(Date.now() + 90_000).toISOString();
    fake.answers[START] = () => errorAnswer(429, 'mfa_locked', { until });
    const r = await open(fake);
    await click(button(r.container, MOVE));
    await typeCode(inDialog(), '111111');
    expect(inDialog().querySelector('[data-testid="lock"]')).not.toBeNull();
    expect(inDialog().textContent).toContain('هاتفك القديم ما زال يعمل');
    expect(otp(inDialog()).disabled).toBe(true);
  });

  it('no connection: says so and keeps the step', async () => {
    const fake = accountApi();
    fake.answers[START] = () => Promise.reject(new TypeError('Failed to fetch'));
    const r = await open(fake);
    await click(button(r.container, MOVE));
    await typeCode(inDialog(), '123456');
    expect(inDialog().textContent).toContain('تعذّر الوصول إلى الخادم');
    expect(inDialog().textContent).toContain('الهاتف القديم');
  });

  it('409 mfa_not_started on confirm returns to step 1', async () => {
    const fake = accountApi();
    fake.answers[START] = () => json(200, NEW_KEY);
    fake.answers[CONFIRM] = () => errorAnswer(409, 'mfa_not_started');
    const r = await open(fake);
    await click(button(r.container, MOVE));
    await typeCode(inDialog(), '123456');
    await typeCode(inDialog(), '654321');
    expect(inDialog().querySelector('[data-slot="qr-code"]')).toBeNull();
    expect(inDialog().textContent).toContain('الهاتف القديم');
  });

  it('409 mfa_not_enrolled re-reads the status and closes', async () => {
    const fake = accountApi();
    fake.answers[START] = () => errorAnswer(409, 'mfa_not_enrolled');
    const r = await open(fake);
    const reads = fake.calls.filter((c) => c === 'GET /api/auth/mfa').length;
    await click(button(r.container, MOVE));
    await typeCode(inDialog(), '123456');
    await flush(30);
    expect(dialog()).toBeNull();
    expect(fake.calls.filter((c) => c === 'GET /api/auth/mfa').length).toBeGreaterThan(reads);
  });
});
