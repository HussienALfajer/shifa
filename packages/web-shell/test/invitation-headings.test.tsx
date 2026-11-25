// Slice A-01-08 checkpoint 5: axe on the real backend found the invitation page without an h1
// once answered (page-has-heading-one): the accepted, declined and invalid states showed only the
// EmptyState's h2. Each state keeps one h1 naming the page, the drawn title staying the h2.
import { createRandom, generatePhone } from '@shifa/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { button, click, flush, type Rendered, renderShell } from './render.tsx';
import { errorAnswer, type FakeApi, fakeApi, json, SESSION } from './support.ts';

const TOKEN = 'ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210-_ZyXwV';
const random = createRandom(2026_11_30);
const CLINIC = 'مجمع الشهباء الطبي';
const ID = (n: number) => `0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0e${String(n).padStart(2, '0')}`;
const VIEW = {
  clinicName: CLINIC,
  personName: 'سلمى الحلبي',
  roles: [{ role: 'receptionist', branchName: null }],
  expiresAt: '2026-11-26T15:00:00.000Z',
  phoneMasked: '+963 ••• ••• 876',
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

function api(): FakeApi {
  const fake = fakeApi(SIGNED_IN);
  fake.answers['/api/auth/setup-link/view'] = () =>
    json(200, {
      clinicName: CLINIC,
      personName: VIEW.personName,
      role: 'receptionist',
      purpose: 'invitation',
      phoneMasked: VIEW.phoneMasked,
      expiresAt: VIEW.expiresAt,
    });
  fake.answers['/api/invitations/view'] = () => json(200, VIEW);
  fake.answers['/api/me'] = () =>
    json(200, {
      userId: SESSION.userId,
      name: VIEW.personName,
      phoneE164: generatePhone(random, 'SY'),
    });
  fake.answers['/api/auth/mfa'] = () => json(200, { enrolled: false, recoveryCodesLeft: null });
  return fake;
}

const page = () => document.body.textContent;
async function until(check: () => boolean) {
  for (let i = 0; i < 80 && !check(); i += 1) await flush(20);
}
const h1s = () => [...document.querySelectorAll('h1')].map((h) => h.textContent.trim());

describe('the invitation page keeps one h1', () => {
  it('accepted', async () => {
    const fake = api();
    fake.answers['/api/invitations/accept'] = () => new Response(null, { status: 204 });
    shown = await renderShell('clinic', fake, `/setup#${TOKEN}`);
    await until(() => page().includes(CLINIC));
    await click(button(shown.container, 'قبول الدعوة'));
    await until(() => page().includes(`انضممت إلى ${CLINIC}`));
    expect(h1s()).toEqual([`دعوة إلى ${CLINIC}`]);
  });

  it('declined', async () => {
    const fake = api();
    fake.answers['/api/invitations/decline'] = () => new Response(null, { status: 204 });
    shown = await renderShell('clinic', fake, `/setup#${TOKEN}`);
    await until(() => page().includes(CLINIC));
    await click(button(shown.container, 'رفض'));
    await until(() => page().includes(`رفض دعوة ${CLINIC}؟`));
    await click(button(document.body, 'رفض الدعوة'));
    await until(() => page().includes('رفضت الدعوة'));
    expect(h1s()).toEqual([`دعوة إلى ${CLINIC}`]);
  });

  it('invalid: the h1 does not name the clinic', async () => {
    const fake = api();
    fake.answers['/api/invitations/view'] = () => errorAnswer(404, 'link_invalid');
    shown = await renderShell('clinic', fake, `/setup#${TOKEN}`);
    await until(() => page().includes('هذا الرابط لم يعد صالحاً'));
    expect(h1s()).toEqual(['دعوة للانضمام إلى فريق']);
  });
});
