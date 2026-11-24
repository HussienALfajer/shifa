// Slice A-01-08 checkpoint 2: the header switcher, as the owner approved it on 2026-11-24
// ("Shifa Screens · Clinic web", page "A-01-08 Team batch", prototype `Team08`, sheet
// `MenuGroupsSheet`). One test per row of the switcher part of the slice's table: GET /me/clinics
// (clinics with roles, scope and last activity; suspended disabled with the reason; the branch
// group, «كل الفروع» first for a tenant-wide role; invitations for information, improvement g; one
// clinic with one branch: no switcher), POST /me/switch (the branch step inside the menu for roles
// in two branches; the session re-read; «أنت الآن في …», improvement c), every refusal as a
// Callout inside the menu, and the phone's bottom sheet.
import { createRandom, generatePersonName } from '@shifa/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, flush, type Rendered, renderShell } from './render.tsx';
import { errorAnswer, type FakeApi, fakeApi, json, SESSION } from './support.ts';

const random = createRandom(2026_11_28);
const family = () => generatePersonName(random, { sex: 'male', adult: true, region: 'aleppo' });
const person = generatePersonName(random, { sex: 'female', adult: true, region: 'aleppo' });
const NAME = `${person.given} ${person.family}`;
const CLINIC_A = `مجمع ${family().family} الطبي`;
const CLINIC_B = `عيادة ${family().family}`;
const CLINIC_C = `مركز ${family().family} الطبي`;
const CLINIC_INVITE = `عيادة ${family().family} لطب الأسنان`;

const ID = (n: number) => `0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0d${String(n).padStart(2, '0')}`;
const B_MAIN = { id: ID(11), name: 'الفرع الرئيسي' };
const B_SECOND = { id: ID(12), name: 'فرع الجميلية' };
const B_THIRD = { id: ID(13), name: 'فرع أعزاز' };
const B_FURQAN = { id: ID(14), name: 'فرع الفرقان' };
const B_SABIL = { id: ID(15), name: 'فرع السبيل' };

const HOURS_AGO = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const ownerClinic = {
  tenantId: ID(1),
  name: CLINIC_A,
  status: 'active',
  selectable: true,
  roles: ['owner'],
  tenantWide: true,
  lastActiveAt: HOURS_AGO(0),
  solo: false,
  branches: [B_MAIN, B_SECOND, B_THIRD],
};
const doctorClinic = {
  tenantId: ID(2),
  name: CLINIC_B,
  status: 'active',
  selectable: true,
  roles: ['doctor'],
  tenantWide: false,
  lastActiveAt: HOURS_AGO(30),
  solo: false,
  branches: [B_FURQAN, B_SABIL],
};
const suspendedClinic = {
  tenantId: ID(3),
  name: CLINIC_C,
  status: 'suspended',
  selectable: false,
  roles: ['receptionist'],
  tenantWide: false,
  lastActiveAt: HOURS_AGO(300),
  solo: false,
  branches: [B_MAIN],
};
const INVITATION = {
  id: ID(20),
  clinicName: CLINIC_INVITE,
  roles: [{ role: 'assistant', branchName: 'فرع الحمدانية' }],
  expiresAt: '2026-11-27T15:00:00.000Z',
};

type Role = 'owner' | 'doctor' | 'receptionist' | 'assistant' | 'accountant';
const role = (r: Role, tenantId: string, branchId: string | null = null) => ({
  role: r,
  tenantId,
  branchId,
});
const OWNER = {
  ...SESSION,
  tenantId: ID(1),
  branchId: null,
  roles: [role('owner', ID(1))],
};

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function api(
  clinics: unknown[] = [ownerClinic, doctorClinic, suspendedClinic],
  invitations: unknown[] = [INVITATION],
  session: typeof OWNER = OWNER,
) {
  const fake = fakeApi(session);
  fake.answers['/api/me'] = () =>
    json(200, { userId: SESSION.userId, name: NAME, phoneE164: '+963900000000' });
  fake.answers['/api/me/clinics'] = () => json(200, { clinics, invitations });
  fake.answers['/api/auth/mfa'] = () => json(200, { enrolled: false, recoveryCodesLeft: null });
  return fake;
}

/** Answers the switch, then the session names the clinic (and branch) chosen. */
function switchAnswers(fake: FakeApi) {
  fake.answers['/api/me/switch'] = (body) => {
    const { tenantId, branchId } = body as { tenantId: string; branchId?: string | null };
    const roles =
      tenantId === ID(2)
        ? [role('doctor', ID(2), branchId ?? null)]
        : [role('owner', tenantId, null)];
    fake.session = { ...OWNER, tenantId, branchId: branchId ?? null, roles };
    return json(200, { tenantId, branchId: branchId ?? null });
  };
}

async function until(check: () => boolean) {
  for (let i = 0; i < 80 && !check(); i += 1) await flush(20);
}

async function open(fake: FakeApi) {
  shown = await renderShell('clinic', fake, '/account');
  await until(() => trigger() !== null || document.body.textContent.includes(CLINIC_A));
  return shown;
}

function trigger(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>('[data-testid="clinic-switcher"]');
}
function menu(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="menu"]');
}
async function openMenu() {
  const t = trigger();
  if (!t) throw new Error('no switcher');
  await click(t);
  await until(() => menu() !== null);
  const m = menu();
  if (!m) throw new Error('menu did not open');
  return m;
}
const items = (m: HTMLElement) => [...m.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
function item(m: HTMLElement, name: string): HTMLElement {
  const found = items(m).find((el) => el.textContent.includes(name));
  if (!found) throw new Error(`no item ${name}`);
  return found;
}
function groupNames(m: HTMLElement): string[] {
  return [...m.querySelectorAll('[role="group"][aria-labelledby]')].map(
    (g) => document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent ?? '',
  );
}

describe('the header switcher', () => {
  it('names the clinic and the branch on the button', async () => {
    await open(api());
    await until(() => trigger()?.textContent.includes('كل الفروع') === true);
    const t = trigger();
    expect(t?.textContent).toContain(`${CLINIC_A} · كل الفروع`);
    expect(t?.getAttribute('aria-label')).toBe(`العيادة والفرع: ${CLINIC_A}، كل الفروع`);
  });

  it('lists the clinics with roles and scope, the suspended one disabled with the reason', async () => {
    await open(api());
    const m = await openMenu();
    expect(groupNames(m)).toEqual(['العيادات', `الفروع في ${CLINIC_A}`, 'دعوات تنتظر ردّك']);
    const a = item(m, CLINIC_A);
    expect(a.getAttribute('aria-checked')).toBe('true');
    expect(a.textContent).toContain('مالك · كل الفروع');
    const b = item(m, CLINIC_B);
    expect(b.getAttribute('aria-checked')).toBe('false');
    expect(b.textContent).toContain('طبيب · فرعان');
    expect(b.textContent).toContain('آخر نشاط');
    const c = item(m, CLINIC_C);
    expect(c.getAttribute('aria-disabled')).toBe('true');
    expect(c.textContent).toContain('موقوفة · تواصل مع إدارة شفاء');
  });

  it('the branch group starts with «كل الفروع» for a tenant-wide role, checked when none is chosen', async () => {
    await open(api());
    const m = await openMenu();
    const group = [...m.querySelectorAll('[role="group"][aria-labelledby]')][1];
    const names = [...(group?.querySelectorAll('[role="menuitemradio"]') ?? [])].map((el) =>
      el.textContent.trim(),
    );
    expect(names[0]).toContain('كل الفروع');
    expect(names.slice(1).join('|')).toContain(B_MAIN.name);
    expect(item(m, 'كل الفروع').getAttribute('aria-checked')).toBe('true');
  });

  it('lists pending invitations for information only (improvement g)', async () => {
    await open(api());
    const m = await openMenu();
    // A disabled item (owner, 2026-11-24: axe allows no `note` inside a menu).
    const notes = [...m.querySelectorAll('[data-menu-note]')];
    expect(notes).toHaveLength(1);
    expect(notes[0]?.textContent).toContain(CLINIC_INVITE);
    expect(notes[0]?.textContent).toContain('مساعد · فرع الحمدانية');
    expect(notes[0]?.textContent).toContain('افتحها من الرابط الذي وصلك');
  });

  it('switching branch sends POST /me/switch, re-reads the session and says where you are', async () => {
    const fake = api();
    switchAnswers(fake);
    await open(fake);
    const m = await openMenu();
    await click(item(m, B_SECOND.name));
    await until(() => document.body.textContent.includes(`أنت الآن في ${CLINIC_A}`));
    expect(fake.bodies['/api/me/switch']).toEqual([{ tenantId: ID(1), branchId: B_SECOND.id }]);
    expect(document.body.textContent).toContain(`أنت الآن في ${CLINIC_A}`);
    await until(() => trigger()?.textContent.includes(B_SECOND.name) === true);
    expect(trigger()?.textContent).toContain(`${CLINIC_A} · ${B_SECOND.name}`);
  });

  it('a clinic where the person holds roles in two branches asks for the branch inside the menu', async () => {
    const fake = api();
    switchAnswers(fake);
    await open(fake);
    const m = await openMenu();
    await click(item(m, CLINIC_B));
    await until(() => document.body.textContent.includes(`فروعك في ${CLINIC_B}`));
    const step = menu();
    if (!step) throw new Error('menu closed');
    expect(fake.bodies['/api/me/switch']).toBeUndefined();
    expect(step.textContent).toContain('لك دور في فرعين أو أكثر هناك');
    expect(step.querySelector('[role="menuitem"]')?.textContent).toContain('رجوع إلى العيادات');
    await click(item(step, B_SABIL.name));
    await until(() => document.body.textContent.includes(`أنت الآن في ${CLINIC_B}`));
    expect(fake.bodies['/api/me/switch']).toEqual([{ tenantId: ID(2), branchId: B_SABIL.id }]);
  });

  it('«رجوع إلى العيادات» leaves the branch step', async () => {
    await open(api());
    const m = await openMenu();
    await click(item(m, CLINIC_B));
    await until(() => document.body.textContent.includes(`فروعك في ${CLINIC_B}`));
    const back = menu()?.querySelector<HTMLElement>('[role="menuitem"]');
    if (!back) throw new Error('no back item');
    await click(back);
    await until(() => menu()?.textContent.includes('العيادات') === true);
    expect(groupNames(menu() ?? document.body)[0]).toBe('العيادات');
  });

  it('a suspended clinic is never switched to', async () => {
    const fake = api();
    switchAnswers(fake);
    await open(fake);
    const m = await openMenu();
    await click(item(m, CLINIC_C));
    await flush(50);
    expect(fake.bodies['/api/me/switch']).toBeUndefined();
  });

  it.each([
    [403, 'clinic_suspended', 'حساب هذه العيادة موقوف الآن'],
    [403, 'branch_not_held', 'لم يعد لك دور في هذا الفرع'],
    [409, 'branch_archived', 'أُغلق هذا الفرع'],
    [404, 'not_found', 'لم تعد هذه العيادة في قائمتك'],
  ])('a %i %s is a Callout inside the menu', async (status, code, title) => {
    const fake = api();
    fake.answers['/api/me/switch'] = () => errorAnswer(status, code);
    await open(fake);
    const m = await openMenu();
    await click(item(m, B_THIRD.name));
    await until(() => menu()?.textContent.includes(title) === true);
    expect(menu()?.textContent).toContain(title);
    expect(trigger()?.textContent).toContain(`${CLINIC_A} · كل الفروع`);
  });

  it('no connection: stays in the current clinic and says so', async () => {
    const fake = api();
    fake.answers['/api/me/switch'] = () => Promise.reject(new TypeError('Failed to fetch'));
    await open(fake);
    const m = await openMenu();
    await click(item(m, B_THIRD.name));
    await until(() => menu()?.textContent.includes('لم نصل إلى الخادم') === true);
    expect(menu()?.textContent).toContain('بقيت في العيادة الحالية. أعد المحاولة.');
  });

  it('one clinic with one branch and no invitation: no switcher, the clinic named as text', async () => {
    const single = { ...doctorClinic, tenantId: ID(1), branches: [B_MAIN], name: CLINIC_A };
    await open(api([single], [], { ...OWNER, roles: [role('doctor', ID(1), B_MAIN.id)] }));
    await until(() => document.body.textContent.includes(CLINIC_A));
    expect(trigger()).toBeNull();
    expect(document.querySelector('header')?.textContent).toContain(CLINIC_A);
  });

  it('a solo clinic has no branch group', async () => {
    const solo = { ...ownerClinic, solo: true, branches: [B_MAIN] };
    await open(api([solo, doctorClinic], []));
    const m = await openMenu();
    expect(groupNames(m)).toEqual(['العيادات']);
    expect(trigger()?.textContent.trim()).toBe(CLINIC_A);
  });

  it('on a phone: the clinic alone on the button, the same rows in a bottom sheet', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    await open(api());
    await until(() => trigger() !== null);
    expect(trigger()?.textContent.trim()).toBe(CLINIC_A);
    const m = await openMenu();
    expect(m.getAttribute('data-presentation')).toBe('sheet');
    // The drawn title names the menu (owner, 2026-11-24: no heading inside a menu).
    expect(document.getElementById(m.getAttribute('aria-labelledby') ?? '')?.textContent).toBe(
      'العيادة والفرع',
    );
    expect(items(m).length).toBeGreaterThan(3);
  });
});
