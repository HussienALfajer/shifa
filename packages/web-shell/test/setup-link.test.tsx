// Slice A-01-07 checkpoint 3: the setup-link page both apps share, as the owner approved it on
// 2026-11-24 ("Shifa Screens · Clinic web", page "A-01-07 Sign-in batch", prototype `Main`). One
// test per row of the setup-link part of the slice's API table: the token read from the fragment
// and removed from history at once, sent in a body only; POST /auth/setup-link/view by purpose
// (owner, member, admin, invitation), 404 `link_invalid` and a malformed fragment; the password
// twice with its rules (improvement a) and POST /auth/setup-link/consume with its 400 rules, 404
// and 409 `owner_setup_pending`; the session it answers routed by the guard.
import { createRandom, generatePersonName, generatePhone } from '@shifa/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { sessionQueryKey } from '../src/session.ts';
import { button, click, field, flush, type Rendered, renderShell, type } from './render.tsx';
import { errorAnswer, type FakeApi, fakeApi, json, SESSION } from './support.ts';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCde';
const random = createRandom(2026_11_24);
const nameOf = (n: { given: string; family: string }) => `${n.given} ${n.family}`;
const PERSON = nameOf(generatePersonName(random, { sex: 'female', adult: true, region: 'aleppo' }));
const PHONE = generatePhone(random, 'SY');
const MASKED = `${PHONE.slice(0, 4)} ••• ••• ${PHONE.slice(-3)}`;
const CLINIC = `عيادة ${nameOf(generatePersonName(random, { sex: 'male', adult: true, region: 'azaz' }))}`;
const PASSWORD = 'كلمة-مرور-تجريبية-طويلة';

type Purpose = 'owner_setup' | 'member_setup' | 'invitation' | 'admin_setup';

const view = (purpose: Purpose, role = 'owner') => ({
  clinicName: purpose === 'admin_setup' ? null : CLINIC,
  personName: PERSON,
  role: purpose === 'admin_setup' ? 'platform_admin' : role,
  purpose,
  phoneMasked: MASKED,
  expiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
});

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

function apiWith(purpose: Purpose | 'invalid', role?: string): FakeApi {
  const api = fakeApi(null);
  api.answers['/api/auth/setup-link/view'] = () =>
    purpose === 'invalid'
      ? errorAnswer(404, 'link_invalid')
      : json(200, view(purpose, role ?? 'owner'));
  return api;
}

async function open(api: FakeApi, hash = TOKEN, app: 'clinic' | 'admin' = 'clinic') {
  shown = await renderShell(app, api, `/setup#${hash}`);
  await flush(30);
  return shown;
}

const text = (r: Rendered) => r.container.textContent;

describe('setup link: the token', () => {
  it('is read from the fragment, removed from history at once, and sent in a body only', async () => {
    const api = apiWith('owner_setup');
    const r = await open(api);
    expect(r.router.state.location.hash).toBe('');
    expect(r.router.state.location.href).not.toContain(TOKEN);
    expect(api.bodies['/api/auth/setup-link/view']).toEqual([{ token: TOKEN }]);
    expect(api.calls.some((c) => c.includes(TOKEN))).toBe(false);
  });

  it('a malformed fragment shows the invalid link without a request', async () => {
    const api = apiWith('owner_setup');
    const r = await open(api, 'not-a-token');
    expect(api.calls.filter((c) => c.includes('setup-link'))).toEqual([]);
    expect(text(r)).toContain('هذا الرابط لم يعد صالحاً');
  });

  it('no fragment at all is the same invalid link', async () => {
    const api = apiWith('owner_setup');
    shown = await renderShell('clinic', api, '/setup');
    await flush(30);
    expect(text(shown)).toContain('هذا الرابط لم يعد صالحاً');
    expect(api.calls.filter((c) => c.includes('setup-link'))).toEqual([]);
  });
});

describe('setup link: the view', () => {
  it('404 link_invalid: one message, no clinic name, and the way to sign in', async () => {
    const r = await open(apiWith('invalid'));
    expect(text(r)).toContain('هذا الرابط لم يعد صالحاً');
    expect(text(r)).toContain('اطلب رابطاً جديداً ممن أرسله إليك');
    expect(text(r)).not.toContain(CLINIC);
    await click(button(r.container, 'لديك حساب؟ تسجيل الدخول'));
    expect(r.router.state.location.pathname).toBe('/sign-in');
  });

  it('owner: the clinic in the title, the person, the role, the masked phone, the expiry', async () => {
    const r = await open(apiWith('owner_setup'));
    expect(r.container.querySelector('h1')?.textContent).toBe(`إعداد حسابك في ${CLINIC}`);
    expect(text(r)).toContain(PERSON);
    expect(text(r)).toContain('مالك العيادة');
    expect(text(r)).toContain(MASKED);
    expect(text(r)).toContain('الرابط يعمل مرة واحدة');
    expect(button(r.container, 'حفظ والمتابعة إلى التحقق').type).toBe('submit');
  });

  it('member: the role line and «حفظ والدخول»', async () => {
    const r = await open(apiWith('member_setup', 'receptionist'));
    expect(text(r)).toContain('موظف استقبال');
    expect(button(r.container, 'حفظ والدخول')).toBeTruthy();
  });

  it('admin: «إدارة شفاء» in the title, the super admin role, no masked phone', async () => {
    const r = await open(apiWith('admin_setup'), TOKEN, 'admin');
    expect(r.container.querySelector('h1')?.textContent).toBe('إعداد حسابك في إدارة شفاء');
    expect(text(r)).toContain('مشرف عام');
    expect(text(r)).not.toContain(MASKED);
  });

  it('invitation: hands over to the invitation page, no password form', async () => {
    const r = await open(apiWith('invitation', 'doctor'));
    expect(text(r)).toContain(`دعوة إلى ${CLINIC}`);
    expect(() => field(r.container, 'كلمة مرور جديدة')).toThrow();
  });

  it('a network failure shows a callout with retry, which asks again', async () => {
    const api = apiWith('owner_setup');
    let fail = true;
    api.answers['/api/auth/setup-link/view'] = () => {
      if (fail) return Promise.reject(new TypeError('Failed to fetch'));
      return json(200, view('owner_setup'));
    };
    const r = await open(api);
    expect(text(r)).toContain('تعذّر الوصول إلى الخادم');
    fail = false;
    await click(button(r.container, 'إعادة المحاولة'));
    await flush(20);
    expect(text(r)).toContain(PERSON);
    expect(api.bodies['/api/auth/setup-link/view']).toEqual([{ token: TOKEN }, { token: TOKEN }]);
  });
});

describe('setup link: the password', () => {
  async function fill(r: Rendered, first: string, second = first) {
    await type(field(r.container, 'كلمة مرور جديدة'), first);
    await type(field(r.container, 'أعد كتابة كلمة المرور'), second);
  }

  it('ticks the length rule while typing and counts the letters (improvement a)', async () => {
    const r = await open(apiWith('owner_setup'));
    await type(field(r.container, 'كلمة مرور جديدة'), 'قصيرة');
    const rule = r.container.querySelector('[data-rule="length"]');
    expect(rule?.textContent).toContain('10 أحرف على الأقل · كتبت 5');
    expect(rule?.getAttribute('data-met')).toBe('false');
    await type(field(r.container, 'كلمة مرور جديدة'), PASSWORD);
    expect(r.container.querySelector('[data-rule="length"]')?.getAttribute('data-met')).toBe(
      'true',
    );
  });

  it('two different passwords are refused before sending', async () => {
    const api = apiWith('owner_setup');
    const r = await open(api);
    await fill(r, PASSWORD, `${PASSWORD}x`);
    await click(button(r.container, 'حفظ والمتابعة إلى التحقق'));
    expect(text(r)).toContain('الكلمتان غير متطابقتين.');
    expect(api.bodies['/api/auth/setup-link/consume']).toBeUndefined();
  });

  it.each([
    ['password_too_short', 'كلمة المرور أقصر من 10 أحرف.'],
    ['password_common', 'هذه الكلمة شائعة ويسهل تخمينها. اختر جملة لا يعرفها غيرك.'],
    ['password_contains_phone', 'كلمة المرور تحتوي رقم هاتفك. اختر غيرها.'],
  ])('400 %s names the rule under the field', async (code, message) => {
    const api = apiWith('owner_setup');
    api.answers['/api/auth/setup-link/consume'] = () => errorAnswer(400, code);
    const r = await open(api);
    await fill(r, PASSWORD);
    await click(button(r.container, 'حفظ والمتابعة إلى التحقق'));
    await flush(20);
    expect(text(r)).toContain(message);
    expect(api.bodies['/api/auth/setup-link/consume']).toEqual([
      { token: TOKEN, password: PASSWORD },
    ]);
  });

  it('404 while typing: the link expired, the invalid message', async () => {
    const api = apiWith('owner_setup');
    api.answers['/api/auth/setup-link/consume'] = () => errorAnswer(404, 'link_invalid');
    const r = await open(api);
    await fill(r, PASSWORD);
    await click(button(r.container, 'حفظ والمتابعة إلى التحقق'));
    await flush(20);
    expect(text(r)).toContain('هذا الرابط لم يعد صالحاً');
  });

  it('409 owner_setup_pending: a warning callout', async () => {
    const api = apiWith('member_setup', 'doctor');
    api.answers['/api/auth/setup-link/consume'] = () => errorAnswer(409, 'owner_setup_pending');
    const r = await open(api);
    await fill(r, PASSWORD);
    await click(button(r.container, 'حفظ والدخول'));
    await flush(20);
    expect(text(r)).toContain('هذا الرقم لمالك عيادة لم يكتمل إعدادها');
  });

  it('success: the session goes into the cache and an owner goes on to enrolment', async () => {
    const api = apiWith('owner_setup');
    const owner = { ...SESSION, mfa: 'none' as const, mfaRequired: true, tenantId: null };
    api.answers['/api/auth/setup-link/consume'] = () => {
      api.session = owner;
      return json(200, owner);
    };
    const r = await open(api);
    await fill(r, PASSWORD);
    await click(button(r.container, 'حفظ والمتابعة إلى التحقق'));
    await flush(40);
    expect(r.queryClient.getQueryData(sessionQueryKey)).toEqual({
      kind: 'signed-in',
      session: owner,
    });
    expect(r.router.state.location.pathname).toBe('/mfa');
  });

  it('success for a member without MFA goes straight in', async () => {
    const api = apiWith('member_setup', 'doctor');
    api.answers['/api/auth/setup-link/consume'] = () => {
      api.session = SESSION;
      return json(200, SESSION);
    };
    const r = await open(api);
    await fill(r, PASSWORD);
    await click(button(r.container, 'حفظ والدخول'));
    await flush(40);
    expect(r.router.state.location.pathname).toBe('/');
  });
});
