// Slice A-01-08 checkpoint 3: the team page, as the owner approved it on 2026-11-24 (prototype
// `Team08`): the `GET /team/members` row of the slice's table — name (opens the drawer), phone
// LTR, roles as «role · branch» badges, status in words, last activity; «أنت» on the owner's own
// row; «انتهى الرابط» on a pending member whose link expired (improvement b); search in the
// client; the status filter with counts (a) and the branch filter from a branch card (e); empty,
// no match, no connection; a phone's list of cards; the owner only.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button, click, flush, type Rendered, type as typeInto } from './render.tsx';
import { json } from './support.ts';
import {
  ASSISTANT,
  B_SECOND,
  DOCTOR,
  DOCTOR_SESSION,
  EXPIRED,
  hasDrawer,
  LEFT,
  MEMBERS_PATH,
  memberPath,
  nameLink,
  openTeam,
  RECEPTION,
  rowOf,
  SELF,
  teamApi,
} from './team-support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.unstubAllGlobals();
});

async function open(api = teamApi(), path = '/team') {
  shown = await openTeam(api, path);
  return shown;
}

const text = () => document.body.textContent;

describe('Team page', () => {
  it('is in the owner’s navigation and titled «الفريق»', async () => {
    const r = await open();
    expect(r.router.state.location.pathname).toBe('/team');
    expect(r.container.querySelector('h1')?.textContent).toBe('الفريق');
    const nav = r.container.querySelector('nav');
    const link = nav?.querySelector('a[href="/team"]');
    expect(link?.textContent).toContain('الفريق');
    expect(link?.getAttribute('aria-current')).toBe('page');
  });

  it('a member who is not the owner has no team: no item, the address goes to My account', async () => {
    const r = await open(teamApi({ session: DOCTOR_SESSION }));
    expect(r.router.state.location.pathname).toBe('/account');
    expect(r.container.querySelector('nav a[href="/team"]')).toBeNull();
  });

  it('lists each member: name, phone left to right, roles with scope, status in words', async () => {
    await open();
    for (const m of [SELF, DOCTOR, ASSISTANT, RECEPTION, EXPIRED, LEFT]) {
      expect(text()).toContain(m.name);
    }
    const doctor = rowOf(DOCTOR.name);
    expect(doctor?.textContent).toContain('طبيب · الفرع الرئيسي');
    expect(doctor?.textContent).toContain('طبيب · فرع الجميلية');
    expect(doctor?.textContent).toContain('فعّال');
    const phone = doctor?.querySelector('bdi[dir="ltr"]');
    expect(phone?.textContent).toContain(DOCTOR.phone.slice(-3));
    expect(rowOf(EXPIRED.name)?.textContent).toContain('محاسب · كل الفروع');
    expect(rowOf(RECEPTION.name)?.textContent).toContain('بانتظار القبول');
    expect(rowOf(LEFT.name)?.textContent).toContain('موقوف');
  });

  it('the owner’s own row reads «أنت»; others do not', async () => {
    await open();
    expect(rowOf(SELF.name)?.textContent).toContain('أنت');
    expect(rowOf(DOCTOR.name)?.textContent).not.toContain('أنت');
  });

  it('the last activity in words; a pending member has none yet', async () => {
    await open();
    expect(rowOf(DOCTOR.name)?.textContent).toContain('قبل ساعتين');
    expect(rowOf(RECEPTION.name)?.textContent).toContain('لم يدخل بعد');
  });

  it('a pending member whose link expired reads «انتهى الرابط» (improvement b)', async () => {
    await open();
    expect(rowOf(EXPIRED.name)?.textContent).toContain('انتهى الرابط');
    expect(rowOf(RECEPTION.name)?.textContent).not.toContain('انتهى الرابط');
  });

  it('searches by name or phone in the page, without asking the server', async () => {
    const api = teamApi();
    const r = await open(api);
    const asked = api.calls.filter((c) => c === `GET ${MEMBERS_PATH}`).length;
    const search = r.container.querySelector<HTMLInputElement>('input[type="search"]');
    if (!search) throw new Error('no search field');
    await typeInto(search, DOCTOR.name.slice(3, 9));
    await flush(300);
    expect(text()).toContain(DOCTOR.name);
    expect(text()).not.toContain(ASSISTANT.name);
    await typeInto(search, RECEPTION.phone.slice(-6));
    await flush(300);
    expect(text()).toContain(RECEPTION.name);
    expect(text()).not.toContain(DOCTOR.name);
    expect(api.calls.filter((c) => c === `GET ${MEMBERS_PATH}`).length).toBe(asked);
  });

  it('a search that matches nobody says so', async () => {
    const r = await open();
    const search = r.container.querySelector<HTMLInputElement>('input[type="search"]');
    if (!search) throw new Error('no search field');
    await typeInto(search, 'زززززز');
    await flush(300);
    expect(text()).toContain('لا أحد بهذا الاسم أو الرقم');
  });

  it('filters by status with counts (improvement a)', async () => {
    const r = await open();
    expect(button(r.container, 'الكل (6)')).toBeTruthy();
    await click(button(r.container, 'بانتظار القبول (2)'));
    expect(text()).toContain(RECEPTION.name);
    expect(text()).toContain(EXPIRED.name);
    expect(text()).not.toContain(DOCTOR.name);
    await click(button(r.container, 'موقوف (1)'));
    expect(text()).toContain(LEFT.name);
    expect(text()).not.toContain(RECEPTION.name);
    await click(button(r.container, 'فعّال (3)'));
    expect(text()).toContain(ASSISTANT.name);
  });

  it('a branch from its card shows that branch’s team; «كل الفريق» clears it (improvement e)', async () => {
    const r = await open(teamApi(), `/team?branch=${B_SECOND.id}`);
    expect(text()).toContain(`فريق ${B_SECOND.name}`);
    expect(text()).toContain(DOCTOR.name);
    expect(text()).toContain(RECEPTION.name);
    expect(text()).not.toContain(ASSISTANT.name);
    await click(button(r.container, 'كل الفريق'));
    await flush(20);
    expect(text()).toContain(ASSISTANT.name);
    expect(r.router.state.location.search).toEqual({});
  });

  it('the owner alone: the empty state offers «إضافة موظف»', async () => {
    const r = await open(teamApi({ members: [SELF] }));
    expect(text()).toContain('أنت وحدك في الفريق الآن');
    expect(
      [...r.container.querySelectorAll('button')].filter(
        (b) => b.textContent.trim() === 'إضافة موظف',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('no connection: the load-failed state with a retry', async () => {
    const api = teamApi();
    api.answers[MEMBERS_PATH] = () => Promise.reject(new TypeError('Failed to fetch'));
    const r = await open(api);
    expect(r.container.querySelector('[data-testid="load-failed"]')).not.toBeNull();
    api.answers[MEMBERS_PATH] = () => json(200, { members: [SELF, DOCTOR] });
    await click(button(r.container, 'إعادة المحاولة'));
    await flush(40);
    expect(text()).toContain(DOCTOR.name);
  });

  it('the name opens the member’s drawer and reads the member', async () => {
    const api = teamApi();
    await open(api);
    await click(nameLink(DOCTOR.name));
    await flush(40);
    expect(hasDrawer()).toBe(true);
    expect(api.calls).toContain(`GET ${memberPath(DOCTOR.id)}`);
  });

  it('on a phone: a list of cards, each opening the member', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    await open();
    const cards = document.querySelectorAll('[data-testid="member-card"]');
    expect(cards).toHaveLength(6);
    expect(document.querySelector('[role="grid"], [role="table"]')).toBeNull();
    await click(nameLink(ASSISTANT.name));
    await flush(40);
    expect(hasDrawer()).toBe(true);
  });
});
