// Slice A-01-10 checkpoint 3: admin web's «إنشاء عيادة», as the owner approved it on 2026-11-24
// (prototype `Main`): POST /platform/clinics. An empty name or owner is refused before sending; 400
// on `body.ownerPhone` under the phone; 409 `owner_setup_pending` with what to do; no connection
// keeps the input. Success shows the owner's link once (CopyField with copy and WhatsApp, the
// expiry, a QR code: improvement e); `invitation` changes the wording; leaving before copying asks
// first (improvement h).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminApi, detailOf, LINK, OWNER_PHONE, openAdmin, PENDING } from './admin-support.ts';
import { button, click, field, flush, type Rendered, type as typeInto } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.restoreAllMocks();
});

const CREATE = '/api/platform/clinics';
const text = () => document.body.textContent;

async function open(fake: ReturnType<typeof adminApi>) {
  shown = await openAdmin(fake, '/clinics/new');
  await flush(40);
  return shown;
}

/** The radio whose label reads `name`. */
async function pick(root: HTMLElement, name: string) {
  for (const label of root.querySelectorAll('label')) {
    if (label.textContent.trim() === name) {
      await click(label);
      return;
    }
  }
  throw new Error(`no choice ${name}`);
}

async function fill(r: Rendered) {
  await typeInto(field(r.container, 'اسم العيادة'), PENDING.name);
  await pick(r.container, 'عيادة فردية');
  await pick(r.container, 'تجريبية');
  await typeInto(field(r.container, 'اسم المالك'), PENDING.ownerName ?? '');
  await typeInto(field(r.container, 'هاتف المالك'), OWNER_PHONE);
}

const created = (purpose: 'setup' | 'invitation' = 'setup') =>
  json(201, { clinic: detailOf(PENDING, LINK.expiresAt), ownerLink: { ...LINK, purpose } });

describe('Admin web: create a clinic', () => {
  it('an empty name or owner is refused before sending', async () => {
    const fake = adminApi();
    const r = await open(fake);
    expect(r.container.querySelector('h1')?.textContent).toBe('إنشاء عيادة');
    await click(button(r.container, 'إنشاء العيادة'));
    expect(text()).toContain('اكتب اسم العيادة');
    expect(text()).toContain('اكتب اسم المالك');
    expect(text()).toContain('اكتب هاتف المالك');
    expect(fake.calls).not.toContain(`POST ${CREATE}`);
  });

  it('sends every field and shows the setup link once, with copy, WhatsApp, expiry and QR', async () => {
    const fake = adminApi();
    fake.answers[CREATE] = () => created();
    const r = await open(fake);
    await fill(r);
    await click(button(r.container, 'إنشاء العيادة'));
    await flush(30);
    expect(fake.bodies[CREATE]).toEqual([
      {
        name: PENDING.name,
        type: 'solo',
        status: 'trial',
        subscriptionEnd: null,
        ownerName: PENDING.ownerName,
        ownerPhone: OWNER_PHONE,
      },
    ]);
    expect(text()).toContain('أُنشئت العيادة');
    const value = r.container.querySelector<HTMLInputElement>('[data-slot="copy-field-value"]');
    expect(value?.value).toBe(LINK.url);
    const wa = r.container.querySelector<HTMLAnchorElement>(`a[href="${LINK.whatsappUrl}"]`);
    expect(wa?.textContent).toContain('إرسال عبر واتساب');
    expect(text()).toContain('رابط الإعداد');
    expect(text()).toContain('يعمل مرة واحدة');
    expect(r.container.querySelector('[data-slot="qr-code"]')).not.toBeNull();
  });

  it('an invitation (the phone has an account) is worded as one', async () => {
    const fake = adminApi();
    fake.answers[CREATE] = () => created('invitation');
    const r = await open(fake);
    await fill(r);
    await click(button(r.container, 'إنشاء العيادة'));
    await flush(30);
    expect(text()).toContain('رابط الدعوة');
    expect(text()).toContain('لهذا الرقم حساب في شفاء');
  });

  it('400 on body.ownerPhone is named under the phone', async () => {
    const fake = adminApi();
    fake.answers[CREATE] = () =>
      errorAnswer(400, 'validation_failed', {
        details: [{ path: 'body.ownerPhone', code: 'invalid_string' }],
      });
    const r = await open(fake);
    await fill(r);
    await click(button(r.container, 'إنشاء العيادة'));
    await flush(30);
    expect(text()).toContain('رقم الهاتف غير صحيح');
    expect(field(r.container, 'اسم العيادة').value).toBe(PENDING.name);
  });

  it('409 owner_setup_pending says what to do', async () => {
    const fake = adminApi();
    fake.answers[CREATE] = () => errorAnswer(409, 'owner_setup_pending');
    const r = await open(fake);
    await fill(r);
    await click(button(r.container, 'إنشاء العيادة'));
    await flush(30);
    expect(text()).toContain('لهذا الرقم عيادة أخرى لم يُكمل مالكها الإعداد');
  });

  it('no connection keeps everything typed', async () => {
    const fake = adminApi();
    fake.answers[CREATE] = () => Promise.reject(new TypeError('Failed to fetch'));
    const r = await open(fake);
    await fill(r);
    await click(button(r.container, 'إنشاء العيادة'));
    await flush(30);
    expect(text()).toContain('تعذّر الوصول إلى الخادم');
    expect(field(r.container, 'اسم العيادة').value).toBe(PENDING.name);
    expect(field(r.container, 'هاتف المالك').value).toBe(OWNER_PHONE);
  });

  it('leaving before copying asks first (improvement h); after a copy it does not', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.resolve()) },
      configurable: true,
    });
    const fake = adminApi();
    fake.answers[CREATE] = () => created();
    const r = await open(fake);
    await fill(r);
    await click(button(r.container, 'إنشاء العيادة'));
    await flush(30);
    await click(button(r.container, 'فتح صفحة العيادة'));
    await flush(20);
    expect(text()).toContain('لم تنسخ الرابط بعد');
    expect(r.router.state.location.pathname).toBe('/clinics/new');
    await click(button(document.body, 'البقاء هنا'));
    await flush(20);
    await click(button(r.container, 'نسخ'));
    await flush(20);
    await click(button(r.container, 'فتح صفحة العيادة'));
    await flush(40);
    expect(r.router.state.location.pathname).toBe(`/clinics/${PENDING.id}`);
  });
});
