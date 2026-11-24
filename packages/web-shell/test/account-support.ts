// Fixtures of My account and the clinic setting (slice A-01-10 checkpoint 2): three people as in
// the approved prototype `Account10` (an owner with mandatory TOTP, a doctor with TOTP, a
// receptionist without), their clinic, four sessions and the routes' answers. Synthetic only.
import { createRandom, generatePersonName, generatePhone } from '@shifa/testing';
import { renderShell } from './render.tsx';
import { type FakeApi, fakeApi, json, SESSION } from './support.ts';

const random = createRandom(2026_11_27);
const name = (sex: 'male' | 'female') => {
  const n = generatePersonName(random, { sex, adult: true, region: 'aleppo' });
  return `${n.given} ${n.family}`;
};
export const OWNER_NAME = name('female');
export const STAFF_NAME = name('female');
export const PHONE = generatePhone(random, 'SY');
export const CLINIC = `مجمع ${generatePersonName(random, { sex: 'male', adult: true, region: 'aleppo' }).family} الطبي`;

export const ID = (n: number) => `0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0c${String(n).padStart(2, '0')}`;

const role = (r: 'owner' | 'doctor' | 'receptionist') => ({
  role: r,
  tenantId: SESSION.tenantId ?? ID(0),
  branchId: null,
});
export const OWNER = { ...SESSION, mfaRequired: true, roles: [role('owner')] };
export const DOCTOR = { ...SESSION, roles: [role('doctor')] };
export const STAFF = { ...SESSION, mfa: 'none' as const, roles: [role('receptionist')] };

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
export const THIS_DEVICE = {
  id: SESSION.sessionId,
  device: 'Windows',
  browser: 'Chrome',
  createdAt: ago(90),
  lastActiveAt: ago(0),
  current: true,
};
export const ANDROID = {
  id: ID(21),
  device: 'Android',
  browser: 'Chrome',
  createdAt: ago(20 * 60),
  lastActiveAt: ago(180),
  current: false,
};
export const IPAD = {
  id: ID(22),
  device: 'iPad',
  browser: 'Safari',
  createdAt: ago(4 * 24 * 60),
  lastActiveAt: ago(4 * 24 * 60),
  current: false,
};
export const UNKNOWN = {
  id: ID(23),
  device: null,
  browser: null,
  createdAt: ago(6 * 24 * 60),
  lastActiveAt: ago(6 * 24 * 60),
  current: false,
};
export const FOUR = [THIS_DEVICE, ANDROID, IPAD, UNKNOWN];

export const CODES = Array.from({ length: 10 }, (_, i) => `p3h8t-4wq${String(i)}m`);
export const KEY = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

export interface AccountOptions {
  session?: typeof OWNER | typeof DOCTOR | typeof STAFF;
  codesLeft?: number;
  sessions?: (typeof FOUR)[number][];
  idleMinutes?: 15 | 30 | 60;
}

/** The fake API of a signed-in person in their clinic, with every read of My account. */
export function accountApi(options: AccountOptions = {}): FakeApi {
  const session = options.session ?? OWNER;
  const owner = session.roles.some((r) => r.role === 'owner');
  const enrolled = session.mfa !== 'none';
  const fake = fakeApi(session);
  let sessions = options.sessions ?? FOUR;
  let idle = options.idleMinutes ?? 30;
  fake.answers['/api/me'] = () =>
    json(200, { userId: session.userId, name: owner ? OWNER_NAME : STAFF_NAME, phoneE164: PHONE });
  fake.answers['/api/me/clinics'] = () =>
    json(200, {
      clinics: [
        {
          tenantId: session.tenantId,
          name: CLINIC,
          status: 'active',
          selectable: true,
          roles: session.roles.map((r) => r.role),
          tenantWide: true,
          lastActiveAt: ago(0),
          solo: true,
          branches: [{ id: ID(11), name: 'الفرع الرئيسي' }],
        },
      ],
      invitations: [],
    });
  fake.answers['/api/auth/mfa'] = () =>
    json(200, {
      enrolled,
      enrolledAt: enrolled ? '2026-11-12T09:00:00.000Z' : null,
      recoveryCodesLeft: enrolled ? (options.codesLeft ?? 9) : null,
    });
  fake.answers['/api/auth/sessions'] = () => json(200, { sessions });
  fake.answers['/api/auth/sessions/end-others'] = () => {
    const ended = sessions.filter((s) => !s.current).length;
    sessions = sessions.filter((s) => s.current);
    return json(200, { ended });
  };
  for (const s of FOUR) {
    fake.answers[`/api/auth/sessions/${s.id}`] = () => {
      sessions = sessions.filter((x) => x.id !== s.id);
      return new Response(null, { status: 204 });
    };
  }
  fake.answers['/api/clinic/settings'] = (body) => {
    if (body !== undefined) idle = (body as { idleMinutes: 15 | 30 | 60 }).idleMinutes;
    return json(200, { idleMinutes: idle });
  };
  return fake;
}

export const openAt = (fake: FakeApi, path: string) => renderShell('clinic', fake, path);

/** Dialogs render in a portal on `body`. */
export const dialog = () =>
  document.body.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');

export function inDialog(): HTMLElement {
  const d = dialog();
  if (!d) throw new Error('no dialog open');
  return d;
}
