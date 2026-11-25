// Slice A-01-08 checkpoint 4: the branches page, the owner only (prototype `Team08`, the `GET
// /branches` row of the slice's table): «الفروع» in the owner's navigation of a clinic with two
// or more branches; a card per active branch with name, address, phone left to right and the
// member count (clinic-wide roles not counted, said once); «عرض فريقه» to `/team?branch=`
// (improvement e); the archived list with its date; loading and no connection. A solo clinic has
// no branch screens: no item, the address goes to the clinic's settings, whose «الفروع» card adds
// the second branch (improvement f, spec gap 1).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  archivedRowOf,
  BRANCHES_PATH,
  branchesApi,
  cardOf,
  dialog,
  MAIN,
  NEW_BRANCH_PHONE,
  OLD,
  openBranches,
  SECOND,
  THIRD,
} from './branches-support.ts';
import { button, click, field, flush, type Rendered, type as typeInto } from './render.tsx';
import { json } from './support.ts';
import { B_MAIN, DOCTOR_SESSION } from './team-support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.unstubAllGlobals();
});

async function open(api = branchesApi().api, path = '/branches') {
  shown = await openBranches(api, path);
  return shown;
}

const text = () => document.body.textContent;

describe('Branches page', () => {
  it('is in the owner’s navigation and titled «الفروع»', async () => {
    const r = await open();
    expect(r.router.state.location.pathname).toBe('/branches');
    expect(r.container.querySelector('h1')?.textContent).toBe('الفروع');
    const link = r.container.querySelector('nav a[href="/branches"]');
    expect(link?.textContent).toContain('الفروع');
    expect(link?.getAttribute('aria-current')).toBe('page');
  });

  it('a member who is not the owner has no branches: no item, the address goes to My account', async () => {
    const r = await open(branchesApi({ session: DOCTOR_SESSION }).api);
    expect(r.router.state.location.pathname).toBe('/account');
    expect(r.container.querySelector('nav a[href="/branches"]')).toBeNull();
  });

  it('a card per active branch: name, address, phone left to right, member count', async () => {
    await open();
    const main = cardOf(MAIN.name);
    expect(main.textContent).toContain(MAIN.address ?? '');
    const phone = [...main.querySelectorAll('[dir="ltr"]')].map((el) => el.textContent);
    expect(phone.join(' ')).toContain(MAIN.phone ?? '');
    expect(main.textContent).toContain('4');
    expect(cardOf(SECOND.name).textContent).toContain('2');
    expect(cardOf(THIRD.name).textContent).toContain('لا أحد بعد');
    // Clinic-wide roles are not counted; the page says so once.
    expect(text()).toContain('لا يُحسب فيه من له دور في كل الفروع');
    // No id is shown.
    expect(text()).not.toContain(MAIN.id);
  });

  it('«عرض فريقه» opens the team of that branch (improvement e)', async () => {
    const r = await open();
    await click(button(cardOf(SECOND.name), 'عرض فريقه'));
    await flush(40);
    expect(r.router.state.location.pathname).toBe('/team');
    expect(r.router.state.location.search).toEqual({ branch: SECOND.id });
  });

  it('lists archived branches apart, with the date, and without the active actions', async () => {
    await open();
    expect(text()).toContain('الفروع المؤرشفة');
    const row = archivedRowOf(OLD.name);
    expect(row.textContent).toContain('أُرشف');
    expect(row.textContent).toContain('2026');
    expect(() => button(row, 'أرشفة')).toThrow();
    expect(button(row, 'استعادة')).toBeDefined();
  });

  it('no archived branch: no archived section', async () => {
    await open(branchesApi({ archived: [] }).api);
    expect(text()).not.toContain('الفروع المؤرشفة');
  });

  it('while loading shows a skeleton; without an answer, the retry reads again', async () => {
    const { api } = branchesApi();
    const answer = api.answers[BRANCHES_PATH];
    api.answers[BRANCHES_PATH] = () => Promise.reject(new TypeError('offline'));
    const r = await open(api);
    expect(r.container.querySelector('[data-testid="load-failed"]')).not.toBeNull();
    if (answer) api.answers[BRANCHES_PATH] = answer;
    await click(button(r.container, 'إعادة المحاولة'));
    await flush(40);
    expect(cardOf(MAIN.name)).toBeDefined();
  });

  it('a phone shows the cards one under the other, with «إضافة فرع»', async () => {
    vi.stubGlobal(
      'matchMedia',
      (q: string) =>
        ({
          matches: q.includes('max-width'),
          media: q,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    const r = await open();
    expect(cardOf(MAIN.name)).toBeDefined();
    expect(button(r.container, 'إضافة فرع')).toBeDefined();
  });
});

describe('a solo clinic (no branch screens)', () => {
  it('has no «الفروع» item, and /branches goes to the clinic settings', async () => {
    const r = await open(branchesApi({ active: [MAIN], archived: [] }).api);
    expect(r.router.state.location.pathname).toBe('/settings');
    expect(r.container.querySelector('nav a[href="/branches"]')).toBeNull();
  });

  it('adds its second branch from the settings card (improvement f), then manages it on /branches', async () => {
    const { api, state } = branchesApi({ active: [MAIN], archived: [] });
    const r = await open(api, '/settings');
    const card = r.container.querySelector<HTMLElement>('[data-testid="settings-branches"]');
    expect(card?.textContent).toContain('فرع واحد');
    if (!card) throw new Error('no branches card');
    await click(button(card, 'إضافة فرع'));
    await flush(20);
    api.answers[BRANCHES_PATH] = (body) => {
      if (body === undefined) return json(200, state);
      const added = { ...SECOND, name: 'فرع العزيزية', phone: NEW_BRANCH_PHONE };
      state.active = [...state.active, added];
      return json(201, added);
    };
    await typeInto(field(dialog(), 'اسم الفرع'), 'فرع العزيزية');
    await click(button(dialog(), 'إضافة الفرع'));
    await flush(60);
    expect(api.bodies[BRANCHES_PATH]?.at(-1)).toEqual({ name: 'فرع العزيزية' });
    expect(r.router.state.location.pathname).toBe('/branches');
    // The clinic is no longer solo: the switcher and the menu read the clinics again.
    expect(api.calls.filter((c) => c === 'GET /api/me/clinics').length).toBeGreaterThan(1);
  });

  it('with archived branches, the settings card leads to them for a restore', async () => {
    const r = await open(branchesApi({ active: [MAIN], archived: [OLD] }).api, '/settings');
    const card = r.container.querySelector<HTMLElement>('[data-testid="settings-branches"]');
    expect(card?.textContent).toContain('الفروع المؤرشفة');
    const link = card?.querySelector('a[href="/branches"]');
    expect(link).not.toBeNull();
    if (link) await click(link);
    await flush(40);
    expect(r.router.state.location.pathname).toBe('/branches');
    expect(archivedRowOf(OLD.name)).toBeDefined();
  });

  it('a clinic with two or more branches has no «الفروع» card in settings', async () => {
    const r = await open(branchesApi().api, '/settings');
    expect(r.container.querySelector('[data-testid="settings-branches"]')).toBeNull();
  });
});

describe('the team page of a branch', () => {
  it('names the branch the cards link to', async () => {
    await open(branchesApi().api, `/team?branch=${B_MAIN.id}`);
    expect(text()).toContain(`فريق ${B_MAIN.name}`);
  });
});
