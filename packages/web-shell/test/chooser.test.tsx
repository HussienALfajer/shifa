// Slice A-01-07 checkpoint 4: the clinic chooser with its branch step, as the owner approved it on
// 2026-11-24 ("Shifa Screens · Clinic web", page "A-01-07 Sign-in batch", prototype `Main`). One
// test per row of the chooser part of the slice's API table: GET /me/clinics (loading, clinics
// last used first with roles, trial, suspended and last-used marks, invitations listed and
// answered on their link, 404 no_clinic, a failed load with retry); POST /me/switch then the
// session re-read and the clinic's queries dropped; the branch step for roles in two branches;
// 403 clinic_suspended, 403 branch_not_held, 409 branch_archived, 400 branch_required, 404.
import { createRandom, generatePersonName, generatePhone } from '@shifa/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { button, click, flush, type Rendered, renderShell } from './render.tsx';
import { errorAnswer, type FakeApi, fakeApi, json, SESSION } from './support.ts';

const random = createRandom(2026_11_26);
const person = generatePersonName(random, { sex: 'female', adult: true, region: 'aleppo' });
const NAME = `${person.given} ${person.family}`;
const PHONE = generatePhone(random, 'SY');
const family = () => generatePersonName(random, { sex: 'male', adult: true, region: 'aleppo' });
const CLINIC_A = `مجمع ${family().family} الطبي`;
const CLINIC_B = `عيادة ${family().family}`;
const CLINIC_C = `مركز ${family().family} التخصصي`;
const CLINIC_INVITE = `مركز ${family().family} لطب الأسنان`;

const ID = (n: number) => `0b6f4c1e-4a43-4f0e-9f61-3c3b1f6f0b${String(n).padStart(2, '0')}`;
const BRANCH_MAIN = { id: ID(11), name: 'الفرع الرئيسي' };
const BRANCH_SECOND = { id: ID(12), name: 'الفرع الثاني' };

/** Signed in after the second factor, no clinic chosen yet (several clinics). */
const CHOOSING = { ...SESSION, tenantId: null, branchId: null };

const HOURS_AGO = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const twoBranches = {
  tenantId: ID(1),
  name: CLINIC_A,
  status: 'active',
  selectable: true,
  roles: ['doctor'],
  tenantWide: false,
  lastActiveAt: HOURS_AGO(3),
  solo: false,
  branches: [BRANCH_MAIN, BRANCH_SECOND],
};
const trialOwner = {
  tenantId: ID(2),
  name: CLINIC_B,
  status: 'trial',
  selectable: true,
  roles: ['owner', 'doctor'],
  tenantWide: true,
  lastActiveAt: HOURS_AGO(30),
  solo: true,
  branches: [BRANCH_MAIN],
};
const suspended = {
  tenantId: ID(3),
  name: CLINIC_C,
  status: 'suspended',
  selectable: false,
  roles: ['doctor'],
  tenantWide: true,
  lastActiveAt: null,
  solo: false,
  branches: [],
};
const INVITATION = {
  id: ID(20),
  clinicName: CLINIC_INVITE,
  roles: [{ role: 'doctor', branchName: 'الفرع الرئيسي' }],
  expiresAt: '2026-11-27T15:00:00.000Z',
};

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

function api(
  clinics: unknown[] = [twoBranches, trialOwner, suspended],
  invitations: unknown[] = [],
) {
  const fake = fakeApi(CHOOSING);
  fake.answers['/api/me'] = () =>
    json(200, { userId: SESSION.userId, name: NAME, phoneE164: PHONE });
  fake.answers['/api/me/clinics'] = () => json(200, { clinics, invitations });
  return fake;
}

/** Answers the switch, then the session names the clinic (and branch) chosen. */
function switchAnswers(fake: FakeApi) {
  fake.answers['/api/me/switch'] = (body) => {
    const { tenantId, branchId } = body as { tenantId: string; branchId?: string | null };
    fake.session = { ...SESSION, tenantId, branchId: branchId ?? null };
    return json(200, { tenantId, branchId: branchId ?? null });
  };
}

async function open(fake: FakeApi, path = '/') {
  shown = await renderShell('clinic', fake, path);
  for (let i = 0; i < 50 && !shown.container.querySelector('[data-testid="clinic-card"]'); i += 1) {
    await flush(20);
  }
  return shown;
}

const text = (r: Rendered) => r.container.textContent;
const cards = (r: Rendered) => [
  ...r.container.querySelectorAll<HTMLButtonElement>('[data-testid="clinic-card"]'),
];
const cardOf = (r: Rendered, name: string) => {
  const card = cards(r).find((c) => c.textContent.includes(name));
  if (!card) throw new Error(`no card for ${name}`);
  return card;
};
const branchCards = (r: Rendered) => [
  ...r.container.querySelectorAll<HTMLButtonElement>('[data-testid="branch-card"]'),
];
/** The `i`-th element, or a failure naming the missing one. */
function at<T>(list: T[], i: number): T {
  const item = list[i];
  if (item === undefined) throw new Error(`no element ${String(i)}`);
  return item;
}
/** The shell rendered by this test. */
function current(): Rendered {
  if (!shown) throw new Error('nothing rendered');
  return shown;
}
async function until(r: Rendered, check: () => boolean) {
  for (let i = 0; i < 60 && !check(); i += 1) await flush(20);
  return r;
}

describe('the clinic chooser', () => {
  it('a session without a clinic goes to /choose, greets the person and lists the clinics', async () => {
    const r = await open(api());
    expect(r.router.state.location.pathname).toBe('/choose');
    expect(r.container.querySelector('h1')?.textContent).toContain(`أهلاً ${NAME}`);
    expect(text(r)).toContain('اختر العيادة التي تعمل فيها الآن');
    // Selectable clinics first, in the server's order (last used first); the suspended one last.
    expect(cards(r).map((c) => c.textContent.includes(CLINIC_A))).toEqual([true, false, false]);
    expect(cards(r)[1]?.textContent).toContain(CLINIC_B);
    expect(cards(r)[2]?.textContent).toContain(CLINIC_C);
  });

  it('shows the loading skeleton while the clinics load', async () => {
    const fake = api();
    let release: () => void = () => undefined;
    fake.answers['/api/me/clinics'] = () =>
      new Promise((resolve) => {
        release = () => {
          resolve(json(200, { clinics: [twoBranches], invitations: [] }));
        };
      });
    shown = await renderShell('clinic', fake, '/choose');
    await flush(30);
    const busy = shown.container.querySelector('[role="status"][aria-busy="true"]');
    expect(busy?.getAttribute('aria-label')).toBe('جارٍ تحميل عياداتك');
    release();
    await until(shown, () => cards(current()).length === 1);
    expect(cards(shown)).toHaveLength(1);
  });

  it('marks roles, the trial clinic, the last used one, its branches and last activity in words', async () => {
    const r = await open(api());
    const a = cardOf(r, CLINIC_A);
    expect(a.textContent).toContain('طبيب');
    expect(a.textContent).toContain('آخر استعمال');
    expect(a.textContent).toContain('آخر نشاط');
    expect(a.textContent).toContain('الفرع الرئيسي');
    expect(a.textContent).toContain('الفرع الثاني');
    const b = cardOf(r, CLINIC_B);
    expect(b.textContent).toContain('مالك');
    expect(b.textContent).toContain('تجريبية');
    expect(b.textContent).not.toContain('آخر استعمال');
    // A solo clinic names no branch.
    expect(b.textContent).not.toContain('الفرع الرئيسي');
  });

  it('a suspended clinic is listed, says why, and cannot be chosen', async () => {
    const fake = api();
    switchAnswers(fake);
    const r = await open(fake);
    const c = cardOf(r, CLINIC_C);
    expect(c.getAttribute('aria-disabled')).toBe('true');
    expect(c.textContent).toContain('موقوفة');
    expect(c.textContent).toContain('حساب العيادة موقوف');
    await click(c);
    await flush(30);
    expect(fake.calls).not.toContain('POST /api/me/switch');
    expect(r.router.state.location.pathname).toBe('/choose');
  });

  it('choosing a clinic switches, re-reads the session, drops the clinic’s queries and goes home', async () => {
    const fake = api();
    switchAnswers(fake);
    const r = await open(fake);
    r.queryClient.setQueryData(['clinic', 'stale', 'patients'], ['cached']);
    await click(cardOf(r, CLINIC_B));
    await until(r, () => r.router.state.location.pathname === '/');
    expect(fake.bodies['/api/me/switch']).toEqual([{ tenantId: trialOwner.tenantId }]);
    const switchAt = fake.calls.indexOf('POST /api/me/switch');
    expect(fake.calls.slice(switchAt + 1)).toContain('GET /api/auth/session');
    expect(r.router.state.location.pathname).toBe('/');
    expect(r.queryClient.getQueryData(['clinic', 'stale', 'patients'])).toBeUndefined();
  });

  it('roles in two branches open the branch step; a branch is sent with the clinic', async () => {
    const fake = api();
    switchAnswers(fake);
    const r = await open(fake);
    await click(cardOf(r, CLINIC_A));
    await until(r, () => branchCards(r).length === 2);
    expect(fake.calls).not.toContain('POST /api/me/switch');
    expect(r.container.querySelector('h1')?.textContent).toContain('اختر الفرع');
    expect(text(r)).toContain(CLINIC_A);
    expect(branchCards(r).map((b) => b.textContent.includes('الفرع الثاني'))).toEqual([
      false,
      true,
    ]);
    await click(at(branchCards(r), 1));
    await until(r, () => r.router.state.location.pathname === '/');
    expect(fake.bodies['/api/me/switch']).toEqual([
      { tenantId: twoBranches.tenantId, branchId: BRANCH_SECOND.id },
    ]);
  });

  it('«كل العيادات» goes back from the branch step to the clinics', async () => {
    const r = await open(api());
    await click(cardOf(r, CLINIC_A));
    await until(r, () => branchCards(r).length === 2);
    await click(button(r.container, 'كل العيادات'));
    await until(r, () => cards(r).length === 3);
    expect(cards(r)).toHaveLength(3);
  });

  it('403 clinic_suspended during the switch: the card turns suspended and a warning says so', async () => {
    const fake = api();
    fake.answers['/api/me/switch'] = () => errorAnswer(403, 'clinic_suspended');
    const r = await open(fake);
    await click(cardOf(r, CLINIC_B));
    await until(r, () => text(r).includes('حساب هذه العيادة موقوف الآن'));
    expect(r.container.querySelector('[role="alert"]')?.textContent).toContain(
      'حساب هذه العيادة موقوف الآن',
    );
    expect(cardOf(r, CLINIC_B).getAttribute('aria-disabled')).toBe('true');
    expect(r.router.state.location.pathname).toBe('/choose');
  });

  it('403 branch_not_held: a warning on the branch step', async () => {
    const fake = api();
    fake.answers['/api/me/switch'] = () => errorAnswer(403, 'branch_not_held');
    const r = await open(fake);
    await click(cardOf(r, CLINIC_A));
    await until(r, () => branchCards(r).length === 2);
    await click(at(branchCards(r), 0));
    await until(r, () => text(r).includes('لم يعد لك دور في هذا الفرع'));
    expect(r.container.querySelector('[role="alert"]')?.textContent).toContain(
      'لم يعد لك دور في هذا الفرع',
    );
  });

  it('409 branch_archived: a warning, and the branch leaves the list', async () => {
    const fake = api();
    fake.answers['/api/me/switch'] = () => errorAnswer(409, 'branch_archived');
    const r = await open(fake);
    await click(cardOf(r, CLINIC_A));
    await until(r, () => branchCards(r).length === 2);
    await click(at(branchCards(r), 0));
    await until(r, () => text(r).includes('أُغلق هذا الفرع'));
    expect(branchCards(r).map((b) => b.textContent.includes(BRANCH_MAIN.name))).toEqual([false]);
  });

  it('400 branch_required: the branch step opens', async () => {
    const fake = api([{ ...trialOwner, branches: [BRANCH_MAIN, BRANCH_SECOND], solo: false }]);
    fake.answers['/api/me/switch'] = () => errorAnswer(400, 'branch_required');
    const r = await open(fake);
    await click(cardOf(r, CLINIC_B));
    await until(r, () => branchCards(r).length === 2);
    expect(r.container.querySelector('h1')?.textContent).toContain('اختر الفرع');
  });

  it('404 on the switch: the list is loaded again', async () => {
    const fake = api();
    fake.answers['/api/me/switch'] = () => errorAnswer(404, 'not_found');
    const r = await open(fake);
    const before = fake.calls.filter((c) => c === 'GET /api/me/clinics').length;
    await click(cardOf(r, CLINIC_B));
    await until(r, () => fake.calls.filter((c) => c === 'GET /api/me/clinics').length > before);
    expect(fake.calls.filter((c) => c === 'GET /api/me/clinics').length).toBeGreaterThan(before);
    expect(r.router.state.location.pathname).toBe('/choose');
  });

  it('a switch with no answer says the connection is down and retries the same choice', async () => {
    const fake = api();
    let fail = true;
    fake.answers['/api/me/switch'] = (body) => {
      if (fail) return Promise.reject(new TypeError('Failed to fetch'));
      const { tenantId } = body as { tenantId: string };
      fake.session = { ...SESSION, tenantId };
      return json(200, { tenantId, branchId: null });
    };
    const r = await open(fake);
    await click(cardOf(r, CLINIC_B));
    await until(r, () => r.container.querySelector('[role="alert"]') !== null);
    fail = false;
    await click(button(r.container, 'إعادة المحاولة'));
    await until(r, () => r.router.state.location.pathname === '/');
    expect(fake.bodies['/api/me/switch']).toEqual([
      { tenantId: trialOwner.tenantId },
      { tenantId: trialOwner.tenantId },
    ]);
  });

  it('open invitations are listed and answered on their link only', async () => {
    const r = await open(api([twoBranches], [INVITATION]));
    expect(text(r)).toContain('دعوات بانتظارك');
    expect(text(r)).toContain(`${CLINIC_INVITE} يدعوك`);
    expect(text(r)).toContain('لقبولها افتح الرابط الذي أرسلته لك العيادة');
    expect(text(r)).toContain('27/11/2026');
    // Nothing on the chooser accepts or declines it (OD-91).
    const invite = r.container.querySelector('[data-testid="invitation"]');
    expect(invite?.querySelector('button, a')).toBeNull();
  });

  it('404 no_clinic: the empty page with sign-out', async () => {
    const fake = fakeApi(CHOOSING);
    fake.answers['/api/me/clinics'] = () => errorAnswer(404, 'no_clinic');
    shown = await renderShell('clinic', fake, '/choose');
    await until(shown, () => current().container.textContent.includes('لا توجد عيادة'));
    expect(text(shown)).toContain('لا توجد عيادة متاحة لحسابك');
    await click(button(shown.container, 'خروج'));
    await until(shown, () => current().router.state.location.pathname === '/sign-in');
    expect(fake.calls).toContain('POST /api/auth/sign-out');
    expect(shown.router.state.location.search).toEqual({ reason: 'signed_out' });
  });

  it('a failed load shows the unreachable callout; retry loads the list', async () => {
    const fake = api();
    let fail = true;
    fake.answers['/api/me/clinics'] = () =>
      fail
        ? Promise.reject(new TypeError('Failed to fetch'))
        : json(200, { clinics: [twoBranches], invitations: [] });
    shown = await renderShell('clinic', fake, '/choose');
    await until(shown, () => current().container.querySelector('[role="alert"]') !== null);
    fail = false;
    await click(button(shown.container, 'إعادة المحاولة'));
    await until(shown, () => cards(current()).length === 1);
    expect(cards(shown)).toHaveLength(1);
  });

  it('a session with a clinic stays home; admin web has no chooser', async () => {
    const fake = api();
    fake.session = SESSION;
    shown = await renderShell('clinic', fake, '/');
    expect(shown.router.state.location.pathname).toBe('/');
    await shown.unmount();
    const admin = fakeApi({ ...CHOOSING, platformAdmin: true });
    shown = await renderShell('admin', admin, '/choose');
    await flush(50);
    expect(admin.calls).not.toContain('GET /api/me/clinics');
    expect(shown.container.textContent).not.toContain('اختر العيادة');
  });
});
