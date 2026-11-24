// Slice A-01-10 checkpoint 3, the reviewer's findings fixed: (1) the re-enrolment dialog does not
// close while a code is with the server; (2) a replaced link starts uncopied; (3) a lost answer is
// worded as unknown; (4) 409 owner_setup_pending on an owner action says why; (5) 409
// mfa_not_started says the new key expired; (6) a status with no clinic has its own words.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountApi, dialog, inDialog, KEY, openAt } from './account-support.ts';
import { ACTIVE, adminApi, FIVE, LINK, openAdmin, PENDING } from './admin-support.ts';
import { button, click, flush, type Rendered, type as typeInto } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.restoreAllMocks();
});

const text = () => document.body.textContent;
const otp = (root: HTMLElement) => {
  const input = root.querySelector<HTMLInputElement>('input[inputmode="numeric"]');
  if (!input) throw new Error('no code field');
  return input;
};
const NEW_KEY = { otpauthUri: `otpauth://totp/Shifa:x?secret=${KEY}`, manualKey: KEY };
const owner = () =>
  document.querySelector<HTMLElement>('[data-testid="owner-card"]') ?? document.body;
const alert = () => {
  const d = document.body.querySelector<HTMLElement>('[role="alertdialog"], [role="dialog"]');
  if (!d) throw new Error('no dialog');
  return d;
};

describe('review fixes: moving TOTP', () => {
  it('1: «رجوع» while the confirm is with the server keeps the dialog; the codes then show', async () => {
    const fake = accountApi();
    fake.answers['/api/auth/mfa/re-enrol/start'] = () => json(200, NEW_KEY);
    let answer: (r: Response) => void = () => undefined;
    fake.answers['/api/auth/mfa/re-enrol/confirm'] = () =>
      new Promise<Response>((resolve) => {
        answer = resolve;
      });
    shown = await openAt(fake, '/account');
    await flush(30);
    await click(button(shown.container, 'نقل التحقق إلى هاتف جديد'));
    await typeInto(otp(inDialog()), '123456');
    await flush(20);
    await typeInto(otp(inDialog()), '654321');
    await flush(20);
    await click(button(inDialog(), 'رجوع'));
    expect(dialog()).not.toBeNull();
    answer(
      json(200, { recoveryCodes: Array.from({ length: 10 }, (_, i) => `abcde-fgh${String(i)}j`) }),
    );
    await flush(30);
    expect(inDialog().textContent).toContain('abcde-fgh0j');
  });

  it('5: 409 mfa_not_started says the new key expired or was replaced', async () => {
    const fake = accountApi();
    fake.answers['/api/auth/mfa/re-enrol/start'] = () => json(200, NEW_KEY);
    fake.answers['/api/auth/mfa/re-enrol/confirm'] = () => errorAnswer(409, 'mfa_not_started');
    shown = await openAt(fake, '/account');
    await flush(30);
    await click(button(shown.container, 'نقل التحقق إلى هاتف جديد'));
    await typeInto(otp(inDialog()), '123456');
    await flush(20);
    await typeInto(otp(inDialog()), '654321');
    await flush(20);
    expect(inDialog().textContent).toContain('انتهى المفتاح الجديد أو استُبدل');
  });

  it('3: a lost answer to the confirm does not promise that nothing changed', async () => {
    const fake = accountApi();
    fake.answers['/api/auth/mfa/re-enrol/start'] = () => json(200, NEW_KEY);
    fake.answers['/api/auth/mfa/re-enrol/confirm'] = () =>
      Promise.reject(new TypeError('Failed to fetch'));
    shown = await openAt(fake, '/account');
    await flush(30);
    await click(button(shown.container, 'نقل التحقق إلى هاتف جديد'));
    await typeInto(otp(inDialog()), '123456');
    await flush(20);
    await typeInto(otp(inDialog()), '654321');
    await flush(20);
    expect(inDialog().textContent).toContain('فلا نعرف إن تمّ النقل');
    expect(inDialog().textContent).not.toContain('لم يتغيّر شيء');
  });
});

describe('review fixes: admin web', () => {
  it('2: a second link starts uncopied, so leaving asks again', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.resolve()) },
      configurable: true,
    });
    const fake = adminApi();
    let n = 0;
    fake.answers[`/api/platform/clinics/${PENDING.id}/owner/setup-link`] = () => {
      n += 1;
      return json(200, { ...LINK, url: `${LINK.url}${String(n)}` });
    };
    shown = await openAdmin(fake, `/clinics/${PENDING.id}`);
    await flush(40);
    await click(button(owner(), 'رابط إعداد جديد'));
    await click(button(alert(), 'إصدار رابط جديد'));
    await flush(40);
    await click(button(owner(), 'نسخ'));
    await flush(20);
    expect(button(owner(), 'نُسخ')).toBeTruthy();
    await click(button(owner(), 'رابط إعداد جديد'));
    await click(button(alert(), 'إصدار رابط جديد'));
    await flush(40);
    expect(button(owner(), 'نسخ')).toBeTruthy();
    const back = shown.container.querySelector<HTMLAnchorElement>('nav a[href="/"]');
    if (!back) throw new Error('no clinics link');
    await click(back);
    await flush(20);
    expect(text()).toContain('لم تنسخ الرابط بعد');
    expect(shown.router.state.location.pathname).toBe(`/clinics/${PENDING.id}`);
  });

  it('4: 409 owner_setup_pending on ending sessions says why nothing happened', async () => {
    const fake = adminApi();
    fake.answers[`/api/platform/clinics/${ACTIVE.id}/owner/end-sessions`] = () =>
      errorAnswer(409, 'owner_setup_pending');
    shown = await openAdmin(fake, `/clinics/${ACTIVE.id}`);
    await flush(40);
    await click(button(owner(), 'إنهاء جلسات المالك'));
    await click(button(alert(), 'إنهاء الجلسات'));
    await flush(40);
    expect(text()).toContain('لم يُكمل المالك الإعداد بعد');
  });

  it('3: a lost answer to a new link is worded as unknown and the card is read again', async () => {
    const fake = adminApi();
    fake.answers[`/api/platform/clinics/${ACTIVE.id}/owner/setup-link`] = () =>
      Promise.reject(new TypeError('Failed to fetch'));
    shown = await openAdmin(fake, `/clinics/${ACTIVE.id}`);
    await flush(40);
    const reads = fake.calls.filter((c) => c === `GET /api/platform/clinics/${ACTIVE.id}`).length;
    await click(button(owner(), 'رابط إعداد جديد'));
    await click(button(alert(), 'إصدار رابط جديد'));
    await flush(40);
    expect(alert().textContent).toContain('فلا نعرف إن تمّ ذلك');
    expect(
      fake.calls.filter((c) => c === `GET /api/platform/clinics/${ACTIVE.id}`).length,
    ).toBeGreaterThan(reads);
  });

  it('6: a status with no clinic is not called a name that matched nothing', async () => {
    shown = await openAdmin(adminApi(FIVE.filter((c) => c.status !== 'suspended')), '/');
    await flush(40);
    await click(button(shown.container, 'موقوفة (0)'));
    expect(text()).toContain('لا عيادة بهذه الحالة');
    expect(text()).not.toContain('لا عيادة بهذا الاسم');
  });
});
