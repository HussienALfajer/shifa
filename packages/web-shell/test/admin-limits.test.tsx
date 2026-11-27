// Slice A-02-08 checkpoint 2: the clinic page's tabs and «الاشتراك والحدود», as the owner approved
// the board `A02Clinic` on 2026-11-27 (states `sub` … `typeSaved`; contract rows "Clinic page,
// «الاشتراك والحدود»"; A-02 criteria 1, 3, 20): the plan from the type, each limit with plan
// value, override (active with its expiry, expired struck through), effective value and use; set,
// change and remove an override with a reason; the key's history; the type change after its
// preview. Loading, failed and not-found states.
import { afterEach, describe, expect, it } from 'vitest';
import { control, dialog, noDialog, openTab, rowOf, text, typeIn } from './admin-tabs-helpers.ts';
import {
  ADMIN_NAME,
  base,
  CLINIC,
  DOCTORS,
  detail,
  ENTITLEMENTS,
  openClinic,
  tabsApi,
} from './admin-tabs-support.ts';
import { button, click, flush, type Rendered } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

async function limits(fake = tabsApi()) {
  shown = await openClinic(fake);
  await flush(40);
  await openTab('الاشتراك والحدود');
  return fake;
}

describe('Admin web: the clinic page tabs', () => {
  it('has five tabs; «العيادة» keeps the A-01-10 cards', async () => {
    shown = await openClinic(tabsApi());
    await flush(40);
    const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent.trim());
    expect(tabs).toEqual(['العيادة', 'الاشتراك والحدود', 'الإعدادات', 'دخول الدعم', 'الاستخدام']);
    expect(document.querySelector('[data-testid="owner-card"]')).not.toBeNull();
    expect(text()).toContain('نهاية الاشتراك');
  });
});

describe('Admin web: «الاشتراك والحدود»', () => {
  it('shows the plan and each limit: plan, override with its expiry, effective, use', async () => {
    await limits();
    expect(text()).toContain('متعددة الفروع');
    const doctors = rowOf('limits.practitioners');
    expect(doctors?.textContent).toContain('الأطباء');
    expect(doctors?.textContent).toContain('30');
    expect(doctors?.textContent).toContain('35');
    expect(doctors?.textContent).toContain('حتى 31/12/2099');
    expect(doctors?.textContent).toContain('توسعة قسم الأطفال');
    expect(doctors?.textContent).toContain('22');
    expect(rowOf('limits.branches')?.textContent).toContain('لا تجاوز');
    const fields = rowOf('limits.custom_fields');
    expect(fields?.textContent).toContain('انتهى 01/11/2026');
    expect(fields?.textContent).toContain('لم يعد يُحتسب');
    expect(fields?.textContent).toContain('—');
    expect(fields?.querySelector('.line-through')).not.toBeNull();
  });

  it('a failed load offers «إعادة المحاولة» and loads again', async () => {
    const fake = tabsApi();
    fake.answers[`${base}/entitlements`] = () => json(500, {});
    await limits(fake);
    expect(text()).toContain('تعذّر التحميل');
    fake.answers[`${base}/entitlements`] = () => json(200, ENTITLEMENTS);
    await click(button(document.body, 'إعادة المحاولة'));
    await flush(40);
    expect(rowOf('limits.practitioners')).not.toBeNull();
  });

  it('an override needs a reason; then PUT with value, reason and expiry, and «حُفظ التجاوز»', async () => {
    const fake = await limits();
    const url = `${base}/overrides/limits.practitioners`;
    fake.answers[url] = (body) => json(200, { ...DOCTORS, effective: 40, ...(body as object) });
    await click(button(rowOf('limits.practitioners') ?? document.body, 'تعديل'));
    expect(dialog().textContent).toContain('تجاوز حد الأطباء');
    expect(dialog().textContent).toContain('الخطة: 30');
    await typeIn(control(dialog(), 'القيمة'), '40');
    await typeIn(control(dialog(), 'السبب'), 'قصير');
    await click(button(dialog(), 'حفظ التجاوز'));
    expect(dialog().textContent).toContain('اكتب سبب التجاوز');
    expect(fake.bodies[url]).toBeUndefined();
    await typeIn(control(dialog(), 'السبب'), 'توسعة قسم الأطفال المسائي');
    await click(button(dialog(), 'حفظ التجاوز'));
    await flush(40);
    expect(fake.bodies[url]).toEqual([
      { value: 40, reason: 'توسعة قسم الأطفال المسائي', expiresAt: '2099-12-31' },
    ]);
    expect(noDialog()).toBe(true);
    expect(text()).toContain('حُفظ التجاوز');
  });

  it('a past expiry refused by the server is a field error', async () => {
    const fake = await limits();
    fake.answers[`${base}/overrides/limits.branches`] = () =>
      errorAnswer(400, 'validation_failed', {
        details: [{ path: 'body.expiresAt', code: 'too_small' }],
      });
    await click(button(rowOf('limits.branches') ?? document.body, 'تجاوز'));
    await typeIn(control(dialog(), 'القيمة'), '7');
    await typeIn(control(dialog(), 'السبب'), 'افتتاح فرع العزيزية الجديد');
    await click(button(dialog(), 'حفظ التجاوز'));
    await flush(40);
    expect(dialog().textContent).toContain('اختر تاريخًا بعد اليوم');
  });

  it('removing asks first, then DELETE', async () => {
    const fake = await limits();
    const url = `${base}/overrides/limits.practitioners`;
    fake.answers[url] = () => json(200, { ...DOCTORS, override: null, effective: 30 });
    await click(button(rowOf('limits.practitioners') ?? document.body, 'إزالة'));
    expect(dialog().textContent).toContain('إزالة تجاوز حد الأطباء؟');
    expect(fake.calls).not.toContain(`DELETE ${url}`);
    await click(button(dialog(), 'إزالة التجاوز'));
    await flush(40);
    expect(fake.calls).toContain(`DELETE ${url}`);
    expect(rowOf('limits.practitioners')?.textContent).toContain('لا تجاوز');
  });

  it('«السجل» shows every change of the key, newest first, with who and the reason', async () => {
    await limits();
    await click(button(rowOf('limits.practitioners') ?? document.body, 'السجل'));
    await flush(40);
    const d = dialog().textContent;
    expect(d).toContain('سجل حد الأطباء');
    for (const word of ['عُدّل', 'وُضع', 'تغيّر النوع', 'انتهى']) expect(d).toContain(word);
    expect(d).toContain(ADMIN_NAME);
    expect(d).toContain('من 32 إلى 35');
    expect(d).toContain('السبب: افتتاح العيادة المسائية');
    expect(d.indexOf('عُدّل')).toBeLessThan(d.indexOf('وُضع'));
  });

  it('a type change shows the preview, warns over a limit, then PATCH and the new plan', async () => {
    const fake = await limits();
    fake.answers[`/api/platform/clinics/${CLINIC.id}`] = (body) =>
      json(200, body === undefined ? detail() : { ...detail(), ...(body as object) });
    await click(button(document.body, 'تغيير النوع'));
    await flush(40);
    expect(fake.urls).toContain(`GET ${base}/type-preview?type=solo`);
    const d = dialog().textContent;
    expect(d).toContain('35 (يبقى التجاوز)');
    expect(d).toContain('الفروع فوق الحد الجديد');
    await click(button(dialog(), 'تغيير النوع'));
    await flush(40);
    expect(fake.bodies[`/api/platform/clinics/${CLINIC.id}`]).toEqual([{ type: 'solo' }]);
    expect(text()).toContain('تغيّر نوع العيادة إلى «عيادة فردية»');
  });
});
