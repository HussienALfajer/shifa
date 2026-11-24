// Slice A-01-08 checkpoint 2: answering an invitation on its link, as the owner approved it on
// 2026-11-24 (prototype `Team08`, "صفحة الدعوة"; OD-91, OD-104). The link is the setup link's
// `/setup#<token>` with purpose `invitation`: POST /invitations/view names the clinic, the person,
// the roles with their branch, the expiry and the invited phone masked. Signed out: «الدخول للرد
// على الدعوة», then back to this page after sign-in with the token held in memory only. Signed in:
// accept (→ «فتح العيادة» switches there) or decline (confirmed); 403 `invitation_other_phone`
// names the invited number; 404 `link_invalid` is one message without the clinic; no connection
// keeps the page for a retry.
import { createRandom, generatePersonName, generatePhone } from '@shifa/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { sessionQueryKey } from '../src/session.ts';
import { button, click, flush, type Rendered, renderShell } from './render.tsx';
import { errorAnswer, type FakeApi, fakeApi, json, SESSION } from './support.ts';

const TOKEN = 'ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210-_ZyXwV';
const random = createRandom(2026_11_29);
const named = (sex: 'male' | 'female') => {
  const n = generatePersonName(random, { sex, adult: true, region: 'aleppo' });
  return `${n.given} ${n.family}`;
};
const PERSON = named('female');
const CLINIC = `مجمع ${generatePersonName(random, { sex: 'male', adult: true, region: 'aleppo' }).family} الطبي`;
const MASKED = '+963 ••• ••• 876';
const ID = (n: number) => `0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0e${String(n).padStart(2, '0')}`;

const EXPIRES = '2026-11-26T15:00:00.000Z';
const SETUP_VIEW = {
  clinicName: CLINIC,
  personName: PERSON,
  role: 'receptionist',
  purpose: 'invitation',
  phoneMasked: MASKED,
  expiresAt: EXPIRES,
};
const INVITATION_VIEW = {
  clinicName: CLINIC,
  personName: PERSON,
  roles: [{ role: 'receptionist', branchName: 'فرع الجميلية' }],
  expiresAt: EXPIRES,
  phoneMasked: MASKED,
};
const SIGNED_IN = {
  ...SESSION,
  tenantId: ID(1),
  branchId: null,
  roles: [{ role: 'doctor' as const, tenantId: ID(1), branchId: null }],
};

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  document.body.innerHTML = '';
});

function api(session: typeof SIGNED_IN | null): FakeApi {
  const fake = fakeApi(session);
  fake.answers['/api/auth/setup-link/view'] = () => json(200, SETUP_VIEW);
  fake.answers['/api/invitations/view'] = () => json(200, INVITATION_VIEW);
  fake.answers['/api/me'] = () =>
    json(200, { userId: SESSION.userId, name: PERSON, phoneE164: generatePhone(random, 'SY') });
  fake.answers['/api/auth/mfa'] = () => json(200, { enrolled: false, recoveryCodesLeft: null });
  return fake;
}

async function until(check: () => boolean) {
  for (let i = 0; i < 80 && !check(); i += 1) await flush(20);
}
const page = () => document.body.textContent;

async function open(fake: FakeApi) {
  shown = await renderShell('clinic', fake, `/setup#${TOKEN}`);
  await until(() => page().includes(CLINIC) || page().includes('لم يعد صالحاً'));
  return shown;
}

describe('the invitation page', () => {
  it('names the clinic, the person, the role with its branch, the expiry and the invited number', async () => {
    const fake = api(null);
    const r = await open(fake);
    expect(fake.bodies['/api/invitations/view']).toEqual([{ token: TOKEN }]);
    expect(page()).toContain('دعوة للانضمام إلى فريق');
    expect(r.container.querySelector('h1')?.textContent).toBe(CLINIC);
    expect(page()).toContain(PERSON);
    expect(page()).toContain('موظف استقبال · فرع الجميلية');
    expect(page()).toContain('تُستعمل مرة واحدة');
    expect(page()).toContain(MASKED);
    expect(r.router.state.location.href).not.toContain(TOKEN);
  });

  it('signed out: signs in, then comes back to the invitation with the token kept in memory only', async () => {
    const fake = api(null);
    const r = await open(fake);
    await click(button(r.container, 'الدخول للرد على الدعوة'));
    await until(() => r.router.state.location.pathname === '/sign-in');
    expect(r.router.state.location.pathname).toBe('/sign-in');
    expect(r.router.state.location.href).not.toContain(TOKEN);
    expect(
      JSON.stringify(
        r.queryClient
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain(TOKEN);
    // Signed in (the sign-in page's job): the shell goes home, and home hands back to the page.
    fake.session = SIGNED_IN;
    r.queryClient.setQueryData(sessionQueryKey, { kind: 'signed-in', session: SIGNED_IN });
    await r.router.navigate({ to: '/' });
    await until(
      () => r.router.state.location.pathname === '/setup' && page().includes('قبول الدعوة'),
    );
    expect(r.router.state.location.pathname).toBe('/setup');
    expect(button(r.container, 'قبول الدعوة')).toBeDefined();
  });

  it('signed in: accept, then «فتح العيادة» switches to it', async () => {
    const fake = api(SIGNED_IN);
    fake.answers['/api/invitations/accept'] = () => new Response(null, { status: 204 });
    fake.answers['/api/me/clinics'] = () =>
      json(200, {
        clinics: [
          {
            tenantId: ID(2),
            name: CLINIC,
            status: 'active',
            selectable: true,
            roles: ['receptionist'],
            tenantWide: false,
            lastActiveAt: null,
            solo: false,
            branches: [{ id: ID(12), name: 'فرع الجميلية' }],
          },
        ],
        invitations: [],
      });
    fake.answers['/api/me/switch'] = (body) => {
      const { tenantId } = body as { tenantId: string };
      fake.session = { ...SIGNED_IN, tenantId };
      return json(200, { tenantId, branchId: null });
    };
    const r = await open(fake);
    await click(button(r.container, 'قبول الدعوة'));
    await until(() => page().includes(`انضممت إلى ${CLINIC}`));
    expect(fake.bodies['/api/invitations/accept']).toEqual([{ token: TOKEN }]);
    await click(button(r.container, 'فتح العيادة'));
    await until(() => (fake.bodies['/api/me/switch'] ?? []).length > 0);
    expect(fake.bodies['/api/me/switch']).toEqual([{ tenantId: ID(2) }]);
  });

  it('decline is confirmed first, then the page says so', async () => {
    const fake = api(SIGNED_IN);
    fake.answers['/api/invitations/decline'] = () => new Response(null, { status: 204 });
    const r = await open(fake);
    await click(button(r.container, 'رفض'));
    await until(() => page().includes(`رفض دعوة ${CLINIC}؟`));
    expect(fake.bodies['/api/invitations/decline']).toBeUndefined();
    await click(button(document.body, 'رفض الدعوة'));
    await until(() => page().includes('رفضت الدعوة'));
    expect(fake.bodies['/api/invitations/decline']).toEqual([{ token: TOKEN }]);
    expect(button(r.container, 'إلى عياداتي')).toBeDefined();
  });

  it('signed in with another number: 403 invitation_other_phone names the invited number', async () => {
    const fake = api(SIGNED_IN);
    fake.answers['/api/invitations/accept'] = () => errorAnswer(403, 'invitation_other_phone');
    const r = await open(fake);
    await click(button(r.container, 'قبول الدعوة'));
    await until(() => page().includes('أنت داخل برقم آخر'));
    expect(page()).toContain('هذه الدعوة لرقم ينتهي بـ 876');
    expect(button(r.container, 'خروج')).toBeDefined();
  });

  it('404 link_invalid: one message, without the clinic’s name', async () => {
    const fake = api(null);
    fake.answers['/api/invitations/view'] = () => errorAnswer(404, 'link_invalid');
    await open(fake);
    expect(page()).toContain('هذا الرابط لم يعد صالحاً');
    expect(page()).not.toContain(CLINIC);
  });

  it('an answer that turns invalid shows the same message', async () => {
    const fake = api(SIGNED_IN);
    fake.answers['/api/invitations/accept'] = () => errorAnswer(404, 'link_invalid');
    const r = await open(fake);
    await click(button(r.container, 'قبول الدعوة'));
    await until(() => page().includes('هذا الرابط لم يعد صالحاً'));
    expect(page()).not.toContain(CLINIC);
  });

  it('no connection: the answer was not recorded; the page stays for a retry', async () => {
    const fake = api(SIGNED_IN);
    let fail = true;
    fake.answers['/api/invitations/accept'] = () =>
      fail ? Promise.reject(new TypeError('Failed to fetch')) : new Response(null, { status: 204 });
    const r = await open(fake);
    await click(button(r.container, 'قبول الدعوة'));
    await until(() => page().includes('لم نصل إلى الخادم'));
    expect(page()).toContain('لم يُسجَّل جوابك. أعد المحاولة.');
    fail = false;
    await click(button(r.container, 'قبول الدعوة'));
    await until(() => page().includes(`انضممت إلى ${CLINIC}`));
  });
});
