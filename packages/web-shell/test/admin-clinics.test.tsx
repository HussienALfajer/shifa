// Slice A-01-10 checkpoint 3: admin web's clinics list, as the owner approved it on 2026-11-24
// (prototype `Main`): GET /platform/clinics?search= — name (a link to the clinic), type and status
// in words, subscription end with «ينتهي خلال 5 أيام» (improvement g), the owner and «لم يُكمل
// الإعداد» for a pending one; search with a no-match state; the status filter with counts
// (improvement f); empty, loading and no-connection states; «إنشاء عيادة».
import { afterEach, describe, expect, it } from 'vitest';
import { ACTIVE, adminApi, ENDING, FIVE, openAdmin, PENDING, SUSPENDED } from './admin-support.ts';
import { button, click, flush, type Rendered, type as typeInto } from './render.tsx';
import { json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

async function open(fake: ReturnType<typeof adminApi>, path = '/') {
  shown = await openAdmin(fake, path);
  await flush(40);
  return shown;
}

const text = () => document.body.textContent;
const rowOf = (name: string) => {
  for (const row of document.querySelectorAll('[role="row"]')) {
    if (row.textContent.includes(name)) return row;
  }
  return null;
};

describe('Admin web: clinics list', () => {
  it('is the super admin’s home, in the admin frame', async () => {
    const r = await open(adminApi());
    expect(r.router.state.location.pathname).toBe('/');
    expect(r.container.querySelector('h1')?.textContent).toBe('العيادات');
    expect(r.container.querySelector('nav')?.textContent).toContain('العيادات');
    expect(r.container.querySelector('nav')?.textContent).toContain('خروج');
    expect(r.container.querySelector('header')?.textContent).toContain('إدارة شفاء');
  });

  it('lists each clinic: name as a link, type and status in words, the owner', async () => {
    await open(adminApi());
    for (const c of FIVE) expect(text()).toContain(c.name);
    const active = rowOf(ACTIVE.name);
    expect(active?.textContent).toContain('متعددة الأطباء');
    expect(active?.textContent).toContain('فعّالة');
    expect(active?.textContent).toContain(ACTIVE.ownerName ?? '');
    const link = active?.querySelector('a');
    expect(link?.getAttribute('href')).toBe(`/clinics/${ACTIVE.id}`);
    expect(rowOf(SUSPENDED.name)?.textContent).toContain('موقوفة');
    expect(rowOf(PENDING.name)?.textContent).toContain('تجريبية');
    expect(rowOf(PENDING.name)?.textContent).toContain('عيادة فردية');
  });

  it('a pending owner reads «لم يُكمل الإعداد»', async () => {
    await open(adminApi());
    expect(rowOf(PENDING.name)?.textContent).toContain('لم يُكمل الإعداد');
    expect(rowOf(ACTIVE.name)?.textContent).not.toContain('لم يُكمل الإعداد');
  });

  it('a subscription ending within a week says so (improvement g)', async () => {
    await open(adminApi());
    expect(rowOf(ENDING.name)?.textContent).toContain('ينتهي خلال 5 أيام');
    expect(rowOf(ACTIVE.name)?.textContent).not.toContain('ينتهي خلال');
  });

  it('filters by status with counts (improvement f)', async () => {
    const r = await open(adminApi());
    const all = button(r.container, 'الكل (5)');
    expect(all).toBeTruthy();
    await click(button(r.container, 'موقوفة (1)'));
    expect(text()).toContain(SUSPENDED.name);
    expect(text()).not.toContain(ACTIVE.name);
    await click(button(r.container, 'تجريبية (2)'));
    expect(text()).toContain(PENDING.name);
    expect(text()).not.toContain(SUSPENDED.name);
  });

  it('searches by name on the server; no match has its own words', async () => {
    const fake = adminApi();
    const urls: string[] = [];
    const inner = fake.fetch;
    fake.fetch = (request) => {
      urls.push(request.url);
      return inner(request);
    };
    const r = await open(fake);
    fake.answers['/api/platform/clinics'] = () => json(200, { clinics: [] });
    const search = r.container.querySelector<HTMLInputElement>('input[type="search"]');
    if (!search) throw new Error('no search field');
    await typeInto(search, 'زهراء');
    await flush(450);
    expect(urls.some((u) => new URL(u).searchParams.get('search') === 'زهراء')).toBe(true);
    expect(text()).toContain('لا عيادة بهذا الاسم');
  });

  it('no clinic yet: the empty state offers «إنشاء عيادة»', async () => {
    const r = await open(adminApi([]));
    expect(text()).toContain('لا عيادات بعد');
    expect(r.container.querySelectorAll('a[href="/clinics/new"]').length).toBeGreaterThan(0);
  });

  it('«إنشاء عيادة» opens the create page', async () => {
    const r = await open(adminApi());
    const link = r.container.querySelector<HTMLAnchorElement>('a[href="/clinics/new"]');
    if (!link) throw new Error('no create link');
    await click(link);
    await flush(30);
    expect(r.router.state.location.pathname).toBe('/clinics/new');
  });

  it('no connection: says so with a retry', async () => {
    const fake = adminApi();
    fake.answers['/api/platform/clinics'] = () => Promise.reject(new TypeError('Failed to fetch'));
    const r = await open(fake);
    expect(text()).toContain('تعذّر التحميل');
    fake.answers['/api/platform/clinics'] = () => json(200, { clinics: FIVE });
    await click(button(r.container, 'إعادة المحاولة'));
    await flush(40);
    expect(text()).toContain(ACTIVE.name);
  });
});
