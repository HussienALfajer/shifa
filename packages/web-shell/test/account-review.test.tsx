// Slice A-01-10 checkpoint 2, reviewer findings: (2) a staff enrolment from My account rotates the
// session, and the page and the codes stay; (3) a failed read says so with a retry instead of a
// skeleton; (4) a failed enrolment start can be retried; (5) a new password over the contract's
// 128 characters is refused before sending; (6) the neutral words when the device list never
// loaded.
import { afterEach, describe, expect, it } from 'vitest';
import { accountApi, CODES, inDialog, KEY, openAt, STAFF, THIS_DEVICE } from './account-support.ts';
import { button, click, field, flush, type Rendered, type } from './render.tsx';
import { json, SESSION } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

async function open(fake: ReturnType<typeof accountApi>, path = '/account') {
  shown = await openAt(fake, path);
  await flush(30);
  return shown;
}

const otp = () => {
  const input = inDialog().querySelector<HTMLInputElement>('input[inputmode="numeric"]');
  if (!input) throw new Error('no code field');
  return input;
};
const offline = () => Promise.reject(new TypeError('offline'));
const START = { otpauthUri: `otpauth://totp/Shifa:x?secret=${KEY}`, manualKey: KEY };

describe('A-01-10 checkpoint 2 review', () => {
  it('(2) a rotated session after enrolment keeps the page and the codes', async () => {
    const fake = accountApi({ session: STAFF });
    fake.answers['/api/auth/mfa/enrol/start'] = () => json(200, START);
    const rotated = {
      ...STAFF,
      mfa: 'verified',
      sessionId: '0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0e01',
    };
    fake.answers['/api/auth/mfa/enrol/confirm'] = () => {
      fake.session = rotated as typeof STAFF;
      return json(200, { recoveryCodes: CODES, session: rotated });
    };
    const r = await open(fake);
    await click(button(r.container, 'تفعيل التحقق بخطوتين'));
    await flush(30);
    await type(otp(), '654321');
    await flush(50);
    expect(r.router.state.location.pathname).toBe('/account');
    expect(inDialog().textContent).toContain(CODES[0]);
  });

  it('(3) a failed read shows a retry, which reads again', async () => {
    const fake = accountApi();
    fake.answers['/api/auth/sessions'] = offline;
    const r = await open(fake);
    const failed = r.container.querySelector('[data-testid="load-failed"]');
    expect(failed).not.toBeNull();
    fake.answers['/api/auth/sessions'] = () => json(200, { sessions: [THIS_DEVICE] });
    await click(button(failed as HTMLElement, 'إعادة المحاولة'));
    await flush(30);
    expect(r.container.querySelectorAll('[data-testid="session-row"]')).toHaveLength(1);
  });

  it('(3) the clinic setting too', async () => {
    const fake = accountApi();
    fake.answers['/api/clinic/settings'] = offline;
    const r = await open(fake, '/settings');
    expect(r.container.querySelector('[data-testid="load-failed"]')).not.toBeNull();
  });

  it('(4) a failed enrolment start is retried from the dialog', async () => {
    const fake = accountApi({ session: STAFF });
    fake.answers['/api/auth/mfa/enrol/start'] = offline;
    const r = await open(fake);
    await click(button(r.container, 'تفعيل التحقق بخطوتين'));
    await flush(30);
    fake.answers['/api/auth/mfa/enrol/start'] = () => json(200, START);
    await click(button(inDialog(), 'إعادة المحاولة'));
    await flush(30);
    expect(otp().disabled).toBe(false);
    expect(inDialog().querySelector('[data-slot="qr-code"]')).not.toBeNull();
  });

  it('(5) a new password over 128 characters is refused before sending', async () => {
    const fake = accountApi();
    const r = await open(fake);
    await click(button(r.container, 'تغيير كلمة المرور'));
    const long = 'x'.repeat(129);
    await type(field(inDialog(), 'كلمة المرور الحالية'), 'old-garden-lamp-41');
    await type(field(inDialog(), 'كلمة المرور الجديدة'), long);
    await type(field(inDialog(), 'أعد كتابة كلمة المرور الجديدة'), long);
    await click(button(inDialog(), 'حفظ كلمة المرور'));
    expect(inDialog().textContent).toContain('أطول من 128 حرفاً');
    expect(fake.calls).not.toContain('POST /api/auth/password');
  });

  it('(6) the neutral words when the device list never loaded', async () => {
    const fake = accountApi();
    fake.answers['/api/auth/sessions'] = offline;
    fake.answers['/api/auth/password'] = () => json(200, { ...SESSION, roles: STAFF.roles });
    const r = await open(fake);
    await click(button(r.container, 'تغيير كلمة المرور'));
    await type(field(inDialog(), 'كلمة المرور الحالية'), 'old-garden-lamp-41');
    await type(field(inDialog(), 'كلمة المرور الجديدة'), 'river-stone-quiet-77');
    await type(field(inDialog(), 'أعد كتابة كلمة المرور الجديدة'), 'river-stone-quiet-77');
    await click(button(inDialog(), 'حفظ كلمة المرور'));
    await flush(30);
    expect(r.container.textContent).toContain('أخرجنا أجهزتك الأخرى إن كانت داخلة');
  });
});
