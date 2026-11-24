// Slice A-01-10 checkpoint 3: admin web's clinic page, as the owner approved it on 2026-11-24
// (prototype `Main`): GET and PATCH /platform/clinics/:id (status and end date; a warning when
// choosing suspended; «حفظ» waits for a change), the owner card (masked phone, status, the open
// link's expiry or «انتهى الرابط»), a new setup link (confirm worded for a pending or an active
// owner) shown once, reset MFA and end sessions (active owner only, each confirmed), a pending
// owner's phone corrected (OD-99) with the new link once; the 404 page. No clinic data.
import { afterEach, describe, expect, it } from 'vitest';
import {
  ACTIVE,
  adminApi,
  CID,
  detailOf,
  LINK,
  MASKED,
  OWNER_PHONE,
  openAdmin,
  PENDING,
} from './admin-support.ts';
import { button, click, field, flush, type Rendered, type as typeInto } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

const text = () => document.body.textContent;
const base = (id: string) => `/api/platform/clinics/${id}`;

async function open(fake: ReturnType<typeof adminApi>, id: string) {
  shown = await openAdmin(fake, `/clinics/${id}`);
  await flush(40);
  return shown;
}

const alert = () => {
  const d = document.body.querySelector<HTMLElement>('[role="alertdialog"], [role="dialog"]');
  if (!d) throw new Error('no dialog');
  return d;
};

async function pick(root: HTMLElement, name: string) {
  for (const label of root.querySelectorAll('label')) {
    if (label.textContent.trim() === name) {
      await click(label);
      return;
    }
  }
  throw new Error(`no choice ${name}`);
}

const owner = () => document.querySelector<HTMLElement>('[data-testid="owner-card"]');

describe('Admin web: a clinic', () => {
  it('shows the clinic and its owner card: name, masked phone, status', async () => {
    const r = await open(adminApi(), ACTIVE.id);
    expect(r.container.querySelector('h1')?.textContent).toBe(ACTIVE.name);
    expect(text()).toContain('متعددة الأطباء');
    expect(owner()?.textContent).toContain(ACTIVE.ownerName ?? '');
    expect(owner()?.textContent).toContain(MASKED);
    expect(owner()?.textContent).toContain('أكمل الإعداد');
    expect(owner()?.querySelector('[dir="ltr"]')?.textContent).toContain(MASKED);
  });

  it('a pending owner: the link’s expiry, no reset or end sessions, the phone correctable', async () => {
    await open(adminApi(), PENDING.id);
    expect(owner()?.textContent).toContain('بانتظار الإعداد');
    expect(owner()?.textContent).toContain('ينتهي الرابط');
    expect(() => button(owner() ?? document.body, 'إعادة ضبط التحقق بخطوتين')).toThrow();
    expect(() => button(owner() ?? document.body, 'إنهاء جلسات المالك')).toThrow();
    expect(button(owner() ?? document.body, 'تصحيح رقم الهاتف')).toBeTruthy();
  });

  it('an expired link says so and offers a new one', async () => {
    const fake = adminApi();
    fake.answers[base(PENDING.id)] = () =>
      json(200, detailOf(PENDING, new Date(Date.now() - 3_600_000).toISOString()));
    await open(fake, PENDING.id);
    expect(owner()?.textContent).toContain('انتهى الرابط');
    expect(button(owner() ?? document.body, 'رابط إعداد جديد')).toBeTruthy();
  });

  it('«حفظ» waits for a change; suspended warns; the change is sent', async () => {
    const fake = adminApi();
    const r = await open(fake, ACTIVE.id);
    expect(button(r.container, 'حفظ').disabled).toBe(true);
    await pick(r.container, 'موقوفة');
    expect(text()).toContain('لن يصل فريق العيادة إلى بياناتها');
    expect(button(r.container, 'حفظ').disabled).toBe(false);
    await click(button(r.container, 'حفظ'));
    await flush(30);
    expect(fake.bodies[base(ACTIVE.id)]).toEqual([
      { status: 'suspended', subscriptionEnd: ACTIVE.subscriptionEnd },
    ]);
    expect(text()).toContain('حُفظت التغييرات');
  });

  it('no connection on save names what is still in force', async () => {
    const fake = adminApi();
    const r = await open(fake, ACTIVE.id);
    fake.answers[base(ACTIVE.id)] = () => Promise.reject(new TypeError('Failed to fetch'));
    await pick(r.container, 'تجريبية');
    await click(button(r.container, 'حفظ'));
    await flush(30);
    expect(text()).toContain('لم تُحفظ التغييرات');
  });

  it('a new setup link for an active owner says the password is cleared, then shows it once', async () => {
    const fake = adminApi();
    fake.answers[`${base(ACTIVE.id)}/owner/setup-link`] = () => json(200, LINK);
    const r = await open(fake, ACTIVE.id);
    await click(button(owner() ?? r.container, 'رابط إعداد جديد'));
    expect(alert().textContent).toContain('تُمسح كلمة مرور المالك');
    expect(alert().textContent).toContain('تنتهي كل جلساته');
    await click(button(alert(), 'إصدار رابط جديد'));
    await flush(40);
    expect(fake.calls).toContain(`POST ${base(ACTIVE.id)}/owner/setup-link`);
    const value = document.querySelector<HTMLInputElement>('[data-slot="copy-field-value"]');
    expect(value?.value).toBe(LINK.url);
  });

  it('a new link for a pending owner says the earlier one stops working', async () => {
    const r = await open(adminApi(), PENDING.id);
    await click(button(owner() ?? r.container, 'رابط إعداد جديد'));
    expect(alert().textContent).toContain('يتوقف الرابط السابق');
    expect(alert().textContent).not.toContain('تُمسح كلمة مرور المالك');
  });

  it('reset MFA and end sessions are each confirmed, then sent', async () => {
    const fake = adminApi();
    fake.answers[`${base(ACTIVE.id)}/owner/reset-mfa`] = () => new Response(null, { status: 204 });
    fake.answers[`${base(ACTIVE.id)}/owner/end-sessions`] = () =>
      new Response(null, { status: 204 });
    const r = await open(fake, ACTIVE.id);
    await click(button(owner() ?? r.container, 'إعادة ضبط التحقق بخطوتين'));
    expect(fake.calls).not.toContain(`POST ${base(ACTIVE.id)}/owner/reset-mfa`);
    await click(button(alert(), 'إعادة الضبط'));
    await flush(30);
    expect(fake.calls).toContain(`POST ${base(ACTIVE.id)}/owner/reset-mfa`);
    expect(text()).toContain('أُعيد ضبط التحقق بخطوتين');
    await click(button(owner() ?? r.container, 'إنهاء جلسات المالك'));
    await click(button(alert(), 'إنهاء الجلسات'));
    await flush(30);
    expect(fake.calls).toContain(`POST ${base(ACTIVE.id)}/owner/end-sessions`);
    expect(text()).toContain('انتهت كل جلسات المالك');
  });

  it('corrects a pending owner’s phone (OD-99) and shows the new link once', async () => {
    const fake = adminApi();
    fake.answers[`${base(PENDING.id)}/owner`] = () => json(200, LINK);
    const r = await open(fake, PENDING.id);
    await click(button(owner() ?? r.container, 'تصحيح رقم الهاتف'));
    await typeInto(field(alert(), 'الرقم الصحيح'), OWNER_PHONE);
    await click(button(alert(), 'حفظ الرقم وإصدار رابط'));
    await flush(40);
    expect(fake.bodies[`${base(PENDING.id)}/owner`]).toEqual([{ phone: OWNER_PHONE }]);
    const value = document.querySelector<HTMLInputElement>('[data-slot="copy-field-value"]');
    expect(value?.value).toBe(LINK.url);
  });

  it('a wrong new phone is named under the field', async () => {
    const fake = adminApi();
    fake.answers[`${base(PENDING.id)}/owner`] = () =>
      errorAnswer(400, 'validation_failed', {
        details: [{ path: 'body.phone', code: 'invalid_string' }],
      });
    const r = await open(fake, PENDING.id);
    await click(button(owner() ?? r.container, 'تصحيح رقم الهاتف'));
    await typeInto(field(alert(), 'الرقم الصحيح'), '12');
    await click(button(alert(), 'حفظ الرقم وإصدار رابط'));
    await flush(30);
    expect(alert().textContent).toContain('رقم الهاتف غير صحيح');
  });

  it('409 owner_account_exists: the owner has set up meanwhile; the page is read again', async () => {
    const fake = adminApi();
    fake.answers[`${base(PENDING.id)}/owner`] = () => errorAnswer(409, 'owner_account_exists');
    const r = await open(fake, PENDING.id);
    const reads = fake.calls.filter((c) => c === `GET ${base(PENDING.id)}`).length;
    await click(button(owner() ?? r.container, 'تصحيح رقم الهاتف'));
    await typeInto(field(alert(), 'الرقم الصحيح'), OWNER_PHONE);
    await click(button(alert(), 'حفظ الرقم وإصدار رابط'));
    await flush(40);
    expect(text()).toContain('أكمل المالك إعداد حسابه');
    expect(fake.calls.filter((c) => c === `GET ${base(PENDING.id)}`).length).toBeGreaterThan(reads);
  });

  it('an unknown clinic is the 404 page with the way back', async () => {
    const fake = adminApi();
    fake.answers[base(CID(77))] = () => errorAnswer(404, 'not_found');
    const r = await open(fake, CID(77));
    expect(text()).toContain('لا عيادة بهذا العنوان');
    expect(r.container.querySelector('a[href="/"]')).not.toBeNull();
  });
});
