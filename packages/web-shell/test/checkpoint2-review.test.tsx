// Slice A-01-08 checkpoint 2 review fixes: (1) «فتح العيادة» shows a refused or unanswered switch;
// (2) a solo clinic's session carries its one branch's id, and the switcher still names no branch;
// (3) a held invitation lasts 15 minutes only.
import { createRandom, generatePhone } from '@shifa/testing';
import { afterEach, describe, expect, it } from 'vitest';
import {
  forgetHeldInvitation,
  hasHeldInvitation,
  holdInvitation,
  takeHeldInvitation,
} from '../src/auth/held-invitation.ts';
import { button, click, flush, type Rendered, renderShell } from './render.tsx';
import { type FakeApi, fakeApi, json, SESSION } from './support.ts';

const ID = (n: number) => `0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0f${String(n).padStart(2, '0')}`;
const SOLO = 'عيادة الشهباء التخصصية';
const OTHER = 'مجمع النور الطبي';
const BRANCH = { id: ID(11), name: 'الفرع الرئيسي' };
const PHONE = generatePhone(createRandom(2026_11_30), 'SY');
const TOKEN = 'QwErTyUiOpAsDfGhJkLzXcVbNm0123456789-_QwErT';

const clinic = (tenantId: string, name: string, solo: boolean) => ({
  tenantId,
  name,
  status: 'active',
  selectable: true,
  roles: ['owner' as const],
  tenantWide: true,
  lastActiveAt: null,
  solo,
  branches: [BRANCH],
});
const SESSION_SOLO = {
  ...SESSION,
  tenantId: ID(1),
  // The server's default branch for a solo clinic: its one branch, not null.
  branchId: BRANCH.id,
  roles: [{ role: 'owner' as const, tenantId: ID(1), branchId: null }],
};

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  forgetHeldInvitation();
  document.body.innerHTML = '';
});

async function until(check: () => boolean) {
  for (let i = 0; i < 80 && !check(); i += 1) await flush(20);
}

function api(): FakeApi {
  const fake = fakeApi(SESSION_SOLO);
  fake.answers['/api/me'] = () =>
    json(200, { userId: SESSION.userId, name: 'سارة', phoneE164: PHONE });
  fake.answers['/api/auth/mfa'] = () => json(200, { enrolled: false, recoveryCodesLeft: null });
  fake.answers['/api/me/clinics'] = () =>
    json(200, {
      clinics: [clinic(ID(1), SOLO, true), clinic(ID(2), OTHER, false)],
      invitations: [],
    });
  return fake;
}

describe('checkpoint 2 review fixes', () => {
  it('a solo clinic names no branch on the switcher, even with its branch id in the session', async () => {
    shown = await renderShell('clinic', api(), '/account');
    const trigger = () => document.querySelector('[data-testid="clinic-switcher"]');
    await until(() => trigger() !== null);
    expect(trigger()?.textContent.trim()).toBe(SOLO);
    expect(trigger()?.getAttribute('aria-label')).toBe(`العيادة والفرع: ${SOLO}`);
  });

  it('«فتح العيادة» says so when the switch gets no answer', async () => {
    const fake = api();
    fake.answers['/api/auth/setup-link/view'] = () =>
      json(200, {
        clinicName: OTHER,
        personName: 'سارة',
        role: 'doctor',
        purpose: 'invitation',
        phoneMasked: '+963 ••• ••• 123',
        expiresAt: '2026-11-26T15:00:00.000Z',
      });
    fake.answers['/api/invitations/view'] = () =>
      json(200, {
        clinicName: OTHER,
        personName: 'سارة',
        roles: [{ role: 'doctor', branchName: null }],
        expiresAt: '2026-11-26T15:00:00.000Z',
        phoneMasked: '+963 ••• ••• 123',
      });
    fake.answers['/api/invitations/accept'] = () => new Response(null, { status: 204 });
    fake.answers['/api/me/switch'] = () => Promise.reject(new TypeError('Failed to fetch'));
    shown = await renderShell('clinic', fake, `/setup#${TOKEN}`);
    await until(() => document.body.textContent.includes('قبول الدعوة'));
    await click(button(shown.container, 'قبول الدعوة'));
    await until(() => document.body.textContent.includes('فتح العيادة'));
    await click(button(shown.container, 'فتح العيادة'));
    await until(() => document.body.textContent.includes('لم نصل إلى الخادم'));
    expect(document.body.textContent).toContain('بقيت في العيادة الحالية');
  });

  it('a held invitation is forgotten after 15 minutes', () => {
    holdInvitation(TOKEN, 0);
    expect(hasHeldInvitation(14 * 60_000)).toBe(true);
    expect(takeHeldInvitation(16 * 60_000)).toBeNull();
    holdInvitation(TOKEN, 0);
    expect(takeHeldInvitation(60_000)).toBe(TOKEN);
    expect(hasHeldInvitation(60_000)).toBe(false);
  });
});
