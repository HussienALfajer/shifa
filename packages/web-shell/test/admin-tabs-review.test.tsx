// Slice A-02-08 review fixes (reviewer and security-reviewer, 2026-11-27): a failed history read
// is said, never «no changes»; a key gone while locking reloads without blaming the platform; an
// edited override asks a new reason; the quiet-clinics switch combines with the status filter;
// the open grant's time left goes down each minute; every failed hand-off closes its empty tab.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE, adminApi, ENDING, openAdmin, PENDING, type Summary } from './admin-support.ts';
import { control, dialog, openTab, rowOf, text, typeIn } from './admin-tabs-helpers.ts';
import { base, GRANTS, GRANTS_OPEN, MINE, openClinic, tabsApi } from './admin-tabs-support.ts';
import { button, click, flush, type Rendered } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function at(tab: string, fake = tabsApi()) {
  shown = await openClinic(fake);
  await flush(40);
  await openTab(tab);
  return fake;
}

const fakeTab = () => ({ opener: {} as unknown, location: { replace: vi.fn() }, close: vi.fn() });

describe('A-02-08 review fixes', () => {
  it('a failed history read says so and offers «إعادة المحاولة»', async () => {
    const fake = await at('الاشتراك والحدود');
    fake.answers[`${base}/overrides/limits.practitioners/history`] = () => json(500, {});
    await click(button(rowOf('limits.practitioners') ?? document.body, 'السجل'));
    await flush(40);
    expect(dialog().textContent).toContain('تعذّر التحميل');
    expect(dialog().textContent).not.toContain('لا تغييرات على هذا الحد بعد');
  });

  it('an edited override starts with an empty reason', async () => {
    await at('الاشتراك والحدود');
    await click(button(rowOf('limits.practitioners') ?? document.body, 'تعديل'));
    expect(control(dialog(), 'السبب').value).toBe('');
  });

  it('a key gone while locking reloads without blaming the platform', async () => {
    const fake = await at('الإعدادات');
    fake.answers[`${base}/settings/session.idle_minutes/lock`] = () =>
      errorAnswer(404, 'not_found');
    await click(button(rowOf('session.idle_minutes') ?? document.body, 'قفل بقيمة'));
    await click(button(dialog(), 'قفل'));
    await flush(40);
    expect(text()).toContain('تغيّرت الإعدادات في الأثناء');
    expect(text()).not.toContain('لا يمكن قفل هذا الإعداد');
  });

  it('the time left goes down each minute', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'Date'], now: Date.now() });
    const fake = tabsApi();
    fake.answers[`${base}/support-grants`] = () => json(200, GRANTS_OPEN);
    await at('دخول الدعم', fake);
    expect(text()).toContain('متبقٍّ 42 دقيقة');
    vi.advanceTimersByTime(60_000);
    await flush(20);
    expect(text()).toContain('متبقٍّ 41 دقيقة');
  });

  it('a failed opening closes the empty tab and never sends it anywhere', async () => {
    const fake = await at('دخول الدعم');
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    fake.answers[`${base}/support-grants`] = (body) =>
      body === undefined ? json(200, GRANTS) : json(500, {});
    await typeIn(control(document.body, 'السبب'), MINE.reason);
    await click(button(document.body, 'فتح الدخول'));
    await flush(40);
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.replace).not.toHaveBeenCalled();
  });

  it('a hand-off refused for an ended grant closes the tab and reloads', async () => {
    const fake = tabsApi();
    fake.answers[`${base}/support-grants`] = () => json(200, GRANTS_OPEN);
    await at('دخول الدعم', fake);
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    fake.answers[`/api/platform/support-grants/${MINE.id}/handoff`] = () =>
      errorAnswer(409, 'support_ended');
    await click(button(document.body, 'فتح عيادة الويب'));
    await flush(40);
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.replace).not.toHaveBeenCalled();
    expect(text()).toContain('انتهى الدخول في الأثناء');
  });

  it('a pop-up the browser refused is said', async () => {
    const fake = await at('دخول الدعم');
    vi.spyOn(window, 'open').mockReturnValue(null);
    fake.answers[`${base}/support-grants`] = (body) =>
      body === undefined ? json(200, GRANTS_OPEN) : json(201, { grant: MINE, handoffUrl: 'x' });
    await typeIn(control(document.body, 'السبب'), MINE.reason);
    await click(button(document.body, 'فتح الدخول'));
    await flush(40);
    expect(text()).toContain('منع المتصفح فتح تبويب جديد');
  });

  it('the quiet-clinics switch combines with the status filter', async () => {
    const clinics = [
      { ...ACTIVE, lastActivityAt: null, signIns7d: 0 },
      { ...PENDING, lastActivityAt: null, signIns7d: 0 },
      { ...ENDING, lastActivityAt: null, signIns7d: 4 },
    ] as Summary[];
    shown = await openAdmin(adminApi(clinics), '/');
    await flush(40);
    for (const label of document.querySelectorAll('label, [role="radio"]')) {
      if (label.textContent.trim().startsWith('فعّالة')) await click(label);
    }
    document.querySelector<HTMLElement>('[role="switch"]')?.click();
    await flush(40);
    expect(rowOf(ACTIVE.name)).not.toBeNull();
    expect(rowOf(PENDING.name)).toBeNull();
    expect(rowOf(ENDING.name)).toBeNull();
  });
});
