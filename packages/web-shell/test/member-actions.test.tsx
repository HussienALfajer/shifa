// Slice A-01-08 checkpoint 3: the member drawer's account actions, as the owner approved them on
// 2026-11-24 (prototype `Team08`): the `…/deactivate`, `…/reactivate`, `…/setup-link`,
// `…/reset-mfa` and `…/phone` rows of the slice's table — each confirmed; «إلغاء الدعوة» for a
// pending member; the link shown once with copy, WhatsApp and a QR code (improvement i); closing
// before a copy or share asks first (h); nothing on oneself (`self_action` never reachable);
// `account_shared`, `mfa_not_enrolled`, `phone_in_team` from the server.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button, click, field, flush, type Rendered, type as typeInto } from './render.tsx';
import { errorAnswer, json } from './support.ts';
import {
  ASSISTANT,
  confirmation,
  DOCTOR,
  detail,
  drawer,
  hasDrawer,
  isDisabled,
  LEFT,
  memberPath,
  nameLink,
  openTeam,
  RECEPTION,
  SELF,
  teamApi,
} from './team-support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

async function openMember(name: string, api = teamApi()) {
  shown = await openTeam(api);
  await click(nameLink(name));
  await flush(40);
  return shown;
}

const has = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll('button')].some(
    (b) => b.textContent.trim() === name || b.getAttribute('aria-label') === name,
  );

/** The link CopyField shows: the value of its read-only field. */
const linkValue = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>('[data-slot="copy-field-value"]')?.value;

const LINK = {
  url: 'https://clinic.shifa.test/setup#t=synthetic-token',
  whatsappUrl: 'https://wa.me/?text=synthetic',
  expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
};

describe('Member drawer: account actions', () => {
  it('an active member: deactivate confirmed, then the drawer says «موقوف»', async () => {
    const api = teamApi();
    await openMember(DOCTOR.name, api);
    const path = `${memberPath(DOCTOR.id)}/deactivate`;
    api.answers[path] = () => json(200, detail({ ...DOCTOR, status: 'deactivated' }));
    await click(button(drawer(), 'إيقاف الحساب'));
    expect(confirmation().textContent).toContain(DOCTOR.name);
    expect(api.calls).not.toContain(`POST ${path}`);
    await click(button(confirmation(), 'إيقاف الحساب'));
    await flush(40);
    expect(api.calls).toContain(`POST ${path}`);
    expect(drawer().textContent).toContain('موقوف');
    expect(has(drawer(), 'إعادة التفعيل')).toBe(true);
  });

  it('a pending member: «إلغاء الدعوة» instead of «إيقاف الحساب»', async () => {
    await openMember(RECEPTION.name);
    expect(has(drawer(), 'إلغاء الدعوة')).toBe(true);
    expect(has(drawer(), 'إيقاف الحساب')).toBe(false);
  });

  it('a deactivated member: reactivate confirmed', async () => {
    const api = teamApi();
    await openMember(LEFT.name, api);
    const path = `${memberPath(LEFT.id)}/reactivate`;
    api.answers[path] = () => json(200, detail({ ...LEFT, status: 'active' }));
    expect(has(drawer(), 'إيقاف الحساب')).toBe(false);
    await click(button(drawer(), 'إعادة التفعيل'));
    await click(button(confirmation(), 'إعادة التفعيل'));
    await flush(40);
    expect(api.calls).toContain(`POST ${path}`);
    expect(drawer().textContent).toContain('فعّال');
  });

  it('the last owner: deactivation disabled with the reason; nothing on oneself', async () => {
    await openMember(SELF.name);
    expect(drawer().textContent).toContain('أنت');
    expect(has(drawer(), 'إيقاف الحساب')).toBe(false);
    expect(has(drawer(), 'رابط لكلمة مرور جديدة')).toBe(false);
    expect(has(drawer(), 'إعادة ضبط التحقق بخطوتين')).toBe(false);
  });

  it('another owner who is the last active one: deactivation disabled with the reason', async () => {
    const other = {
      ...DOCTOR,
      roles: [{ role: 'owner' as const, branchId: null, branchName: null }],
    };
    const api = teamApi({
      members: [SELF, other],
      details: { [other.id]: detail(other, { isLastOwner: true }) },
    });
    await openMember(other.name, api);
    expect(isDisabled(button(drawer(), 'إيقاف الحساب'))).toBe(true);
    expect(drawer().textContent).toContain('المالك الوحيد');
  });

  it('409 last_owner inside the confirmation', async () => {
    const api = teamApi();
    await openMember(DOCTOR.name, api);
    api.answers[`${memberPath(DOCTOR.id)}/deactivate`] = () => errorAnswer(409, 'last_owner');
    await click(button(drawer(), 'إيقاف الحساب'));
    await click(button(confirmation(), 'إيقاف الحساب'));
    await flush(40);
    expect(document.body.textContent).toContain('لا بد من مالك فعّال');
  });

  it('a pending member: a new link, confirmed, shown once with copy, WhatsApp and QR', async () => {
    const api = teamApi();
    await openMember(RECEPTION.name, api);
    api.answers[`${memberPath(RECEPTION.id)}/setup-link`] = () => json(200, LINK);
    await click(button(drawer(), 'إصدار رابط جديد'));
    expect(confirmation().textContent).toContain('يتوقف الرابط السابق');
    await click(button(confirmation(), 'إصدار الرابط'));
    await flush(40);
    const d = drawer();
    expect(d.querySelector('[data-testid="link-shown"]')).not.toBeNull();
    expect(linkValue(d)).toBe(LINK.url);
    expect(d.querySelector(`a[href="${LINK.whatsappUrl}"]`)).not.toBeNull();
    expect(d.querySelector('[data-slot="qr-code"]')).not.toBeNull();
  });

  it('an active member: «رابط لكلمة مرور جديدة» says the password is cleared', async () => {
    const api = teamApi();
    await openMember(DOCTOR.name, api);
    api.answers[`${memberPath(DOCTOR.id)}/setup-link`] = () => json(200, LINK);
    await click(button(drawer(), 'رابط لكلمة مرور جديدة'));
    expect(confirmation().textContent).toContain('كلمة مروره');
    await click(button(confirmation(), 'إصدار الرابط'));
    await flush(40);
    expect(linkValue(drawer())).toBe(LINK.url);
  });

  it('409 account_shared on a new link: said, no link', async () => {
    const api = teamApi();
    await openMember(DOCTOR.name, api);
    api.answers[`${memberPath(DOCTOR.id)}/setup-link`] = () => errorAnswer(409, 'account_shared');
    await click(button(drawer(), 'رابط لكلمة مرور جديدة'));
    await click(button(confirmation(), 'إصدار الرابط'));
    await flush(40);
    expect(document.body.textContent).toContain('يعمل في عيادة أخرى');
    expect(drawer().querySelector('[data-testid="link-shown"]')).toBeNull();
  });

  it('closing the drawer before the link was copied or shared asks first (improvement h)', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.resolve()) },
      configurable: true,
    });
    const api = teamApi();
    await openMember(RECEPTION.name, api);
    api.answers[`${memberPath(RECEPTION.id)}/setup-link`] = () => json(200, LINK);
    await click(button(drawer(), 'إصدار رابط جديد'));
    await click(button(confirmation(), 'إصدار الرابط'));
    await flush(40);
    await click(button(drawer(), 'إغلاق'));
    await flush(20);
    expect(confirmation().textContent).toContain('لم تنسخ الرابط بعد');
    await click(button(confirmation(), 'البقاء هنا'));
    await flush(20);
    expect(hasDrawer()).toBe(true);
    await click(button(drawer(), 'نسخ'));
    await flush(20);
    await click(button(drawer(), 'إغلاق'));
    await flush(40);
    expect(hasDrawer()).toBe(false);
  });

  it('TOTP reset for a member with TOTP: confirmed, then «غير مفعّل»', async () => {
    const api = teamApi();
    await openMember(ASSISTANT.name, api);
    const path = `${memberPath(ASSISTANT.id)}/reset-mfa`;
    api.answers[path] = () => json(200, detail(ASSISTANT, { mfaEnrolled: false }));
    expect(drawer().textContent).toContain('التحقق بخطوتين مفعّل');
    await click(button(drawer(), 'إعادة ضبط التحقق بخطوتين'));
    expect(confirmation().textContent).toContain('تنتهي جلساته');
    await click(button(confirmation(), 'إعادة الضبط'));
    await flush(40);
    expect(api.calls).toContain(`POST ${path}`);
    expect(drawer().textContent).toContain('التحقق بخطوتين غير مفعّل');
    expect(has(drawer(), 'إعادة ضبط التحقق بخطوتين')).toBe(false);
  });

  it('no TOTP reset for an owner; the super admin does it', async () => {
    const other = {
      ...DOCTOR,
      roles: [{ role: 'owner' as const, branchId: null, branchName: null }],
    };
    await openMember(other.name, teamApi({ members: [SELF, other] }));
    expect(has(drawer(), 'إعادة ضبط التحقق بخطوتين')).toBe(false);
    expect(drawer().textContent).toContain('إدارة شفاء');
  });

  it('409 mfa_not_enrolled reads the member again', async () => {
    const api = teamApi();
    await openMember(ASSISTANT.name, api);
    api.answers[`${memberPath(ASSISTANT.id)}/reset-mfa`] = () => {
      api.answers[memberPath(ASSISTANT.id)] = () =>
        json(200, detail(ASSISTANT, { mfaEnrolled: false }));
      return errorAnswer(409, 'mfa_not_enrolled');
    };
    await click(button(drawer(), 'إعادة ضبط التحقق بخطوتين'));
    await click(button(confirmation(), 'إعادة الضبط'));
    await flush(60);
    expect(drawer().textContent).toContain('التحقق بخطوتين غير مفعّل');
  });
});

describe('Member drawer: a pending member’s phone (OD-103)', () => {
  async function fixPhone(api: ReturnType<typeof teamApi>, phone: string) {
    await openMember(RECEPTION.name, api);
    await click(button(drawer(), 'تصحيح الرقم'));
    await typeInto(field(document.body, 'الرقم الصحيح'), phone);
    await click(button(document.body, 'إرسال رابط جديد'));
    await flush(40);
  }

  it('only while pending', async () => {
    await openMember(DOCTOR.name);
    expect(has(drawer(), 'تصحيح الرقم')).toBe(false);
  });

  it('the right phone: the earlier link stops; the new link shown once', async () => {
    const api = teamApi();
    api.answers[`${memberPath(RECEPTION.id)}/phone`] = () => json(200, LINK);
    await fixPhone(api, '+963 944 000 111');
    expect(api.bodies[`${memberPath(RECEPTION.id)}/phone`]?.at(-1)).toEqual({
      phone: '+963 944 000 111',
    });
    expect(linkValue(drawer())).toBe(LINK.url);
  });

  it('409 phone_in_team under the field', async () => {
    const api = teamApi();
    api.answers[`${memberPath(RECEPTION.id)}/phone`] = () => errorAnswer(409, 'phone_in_team');
    await fixPhone(api, DOCTOR.phone);
    expect(document.body.textContent).toContain('هذا الرقم في فريق العيادة');
  });
});
