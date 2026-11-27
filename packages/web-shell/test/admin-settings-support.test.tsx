// Slice A-02-08 checkpoints 2 and 3: «الإعدادات» and «دخول الدعم» on the clinic page, as the owner
// approved the board `A02Clinic` on 2026-11-27 (states `set` … `setNone`, `sup` … `supSuspended`;
// A-02 criteria 9, 11): each setting with its value and source, lock with a value and unlock; the
// support form (reason of 10–500, duration), the clinic web tab opened at the hand-off, the open
// grant with time left from the server's clock, «فتح عيادة الويب», «إنهاء», and the log with
// each reason whole.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { choose, control, dialog, openTab, rowOf, text, typeIn } from './admin-tabs-helpers.ts';
import {
  base,
  CLINIC,
  detail,
  GRANTS,
  GRANTS_OPEN,
  HANDOFF,
  IDLE,
  IDLE_LOCKED,
  MINE,
  OWNER_NAME,
  openClinic,
  tabsApi,
} from './admin-tabs-support.ts';
import { button, click, flush, type Rendered } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.restoreAllMocks();
});

async function at(tab: string, fake = tabsApi()) {
  shown = await openClinic(fake);
  await flush(40);
  await openTab(tab);
  return fake;
}

describe('Admin web: «الإعدادات»', () => {
  it('shows each setting with its value and where it comes from', async () => {
    await at('الإعدادات');
    const row = rowOf('session.idle_minutes');
    expect(row?.textContent).toContain('الخروج عند عدم النشاط');
    expect(row?.textContent).toContain('30 دقيقة');
    expect(row?.textContent).toContain('موروث من: الإعداد الافتراضي');
    expect(button(row ?? document.body, 'قفل بقيمة')).toBeTruthy();
  });

  it('a value chosen by the clinic reads «من: العيادة»', async () => {
    const fake = tabsApi();
    fake.answers[`${base}/settings`] = () =>
      json(200, { settings: [{ ...IDLE, value: 15, source: 'organization' }] });
    await at('الإعدادات', fake);
    expect(rowOf('session.idle_minutes')?.textContent).toContain('من: العيادة');
  });

  it('locks with a value: PUT …/lock, then «مقفل من الإدارة» and «فتح القفل»', async () => {
    const fake = await at('الإعدادات');
    const url = `${base}/settings/session.idle_minutes/lock`;
    fake.answers[url] = (body) =>
      body === undefined ? json(200, IDLE) : json(200, { ...IDLE_LOCKED, ...(body as object) });
    await click(button(rowOf('session.idle_minutes') ?? document.body, 'قفل بقيمة'));
    expect(dialog().textContent).toContain('قفل «الخروج عند عدم النشاط»');
    await click(button(dialog(), 'قفل'));
    await flush(40);
    expect(fake.bodies[url]).toEqual([{ value: 30 }]);
    const row = rowOf('session.idle_minutes');
    expect(row?.textContent).toContain('مقفل من الإدارة');
    expect(row?.textContent).toContain('من: الإدارة');
    expect(text()).toContain('قُفل الإعداد على 30 دقيقة');
    await click(button(row ?? document.body, 'فتح القفل'));
    expect(dialog().textContent).toContain('فتح قفل الإعداد؟');
    await click(button(dialog(), 'فتح القفل'));
    await flush(40);
    expect(fake.calls).toContain(`DELETE ${url}`);
    expect(rowOf('session.idle_minutes')?.textContent).toContain('موروث من: الإعداد الافتراضي');
  });

  it('a key that cannot be locked meanwhile closes the dialog with a danger note', async () => {
    const fake = await at('الإعدادات');
    fake.answers[`${base}/settings/session.idle_minutes/lock`] = () =>
      errorAnswer(409, 'setting_not_lockable');
    await click(button(rowOf('session.idle_minutes') ?? document.body, 'قفل بقيمة'));
    await click(button(dialog(), 'قفل'));
    await flush(40);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(text()).toContain('لا يمكن قفل هذا الإعداد');
  });

  it('a lock of the platform offers no action; no settings is the empty state', async () => {
    const fake = tabsApi();
    fake.answers[`${base}/settings`] = () =>
      json(200, {
        settings: [
          { ...IDLE, locked: true, lockedBy: 'platform', source: 'platform', lockable: false },
        ],
      });
    await at('الإعدادات', fake);
    const row = rowOf('session.idle_minutes');
    expect(row?.textContent).toContain('مقفل من الإدارة');
    expect(row?.querySelector('button')).toBeNull();
    fake.answers[`${base}/settings`] = () => json(200, { settings: [] });
    await openTab('العيادة');
    await shown?.queryClient.invalidateQueries();
    await openTab('الإعدادات');
    expect(text()).toContain('لا إعدادات للعيادة بعد');
  });
});

describe('Admin web: «دخول الدعم»', () => {
  it('the form and the log, each reason whole, who ended each grant', async () => {
    await at('دخول الدعم');
    expect(text()).toContain('فتح دخول الدعم');
    expect(text()).toContain('سجل دخول الدعم');
    expect(text()).toContain(GRANTS.grants[0]?.reason ?? '-');
    expect(text()).toContain('انتهت المدة');
    expect(text()).toContain(`أنهاه المالك: ${OWNER_NAME}`);
  });

  it('a reason under 10 characters is refused before sending', async () => {
    const fake = await at('دخول الدعم');
    await typeIn(control(document.body, 'السبب'), 'فروع');
    await click(button(document.body, 'فتح الدخول'));
    expect(text()).toContain('اكتب سببًا من 10 أحرف على الأقل');
    expect(fake.bodies[`${base}/support-grants`]).toBeUndefined();
  });

  it('opens: POST with reason and minutes, the tab at the hand-off, then «دخولك مفتوح»', async () => {
    const fake = await at('دخول الدعم');
    const tab = { opener: {} as unknown, location: { replace: vi.fn() }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    fake.answers[`${base}/support-grants`] = (body) => {
      if (body === undefined) return json(200, GRANTS_OPEN);
      return json(201, { grant: MINE, handoffUrl: HANDOFF });
    };
    await typeIn(control(document.body, 'السبب'), MINE.reason);
    await choose(document.body, 'ساعتان');
    await click(button(document.body, 'فتح الدخول'));
    await flush(60);
    expect(fake.bodies[`${base}/support-grants`]).toEqual([{ reason: MINE.reason, minutes: 120 }]);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]?.[0]).not.toContain('#');
    expect(tab.opener).toBeNull();
    expect(tab.location.replace).toHaveBeenCalledWith(HANDOFF);
    expect(text()).toContain('دخولك مفتوح');
    // 11:30 by the server, ends 12:12: 42 minutes, whatever the device's clock says.
    expect(text()).toContain('متبقٍّ 42 دقيقة');
  });

  it('a hand-off that is not a web address is never opened', async () => {
    const fake = await at('دخول الدعم');
    const tab = { opener: {} as unknown, location: { replace: vi.fn() }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    fake.answers[`${base}/support-grants`] = (body) =>
      body === undefined
        ? json(200, GRANTS_OPEN)
        : json(201, { grant: MINE, handoffUrl: 'javascript:alert(1)' });
    await typeIn(control(document.body, 'السبب'), MINE.reason);
    await click(button(document.body, 'فتح الدخول'));
    await flush(60);
    expect(tab.location.replace).not.toHaveBeenCalled();
    expect(tab.close).toHaveBeenCalled();
  });

  it('409 support_active says a grant is open, with «عرض الدخول المفتوح»', async () => {
    const fake = await at('دخول الدعم');
    vi.spyOn(window, 'open').mockReturnValue(null);
    fake.answers[`${base}/support-grants`] = (body) =>
      body === undefined ? json(200, GRANTS) : errorAnswer(409, 'support_active');
    await typeIn(control(document.body, 'السبب'), MINE.reason);
    await click(button(document.body, 'فتح الدخول'));
    await flush(40);
    expect(text()).toContain('لديك دخول مفتوح لهذه العيادة');
    fake.answers[`${base}/support-grants`] = () => json(200, GRANTS_OPEN);
    await click(button(document.body, 'عرض الدخول المفتوح'));
    await flush(40);
    expect(text()).toContain('دخولك مفتوح');
  });

  it('an open grant: «فتح عيادة الويب» asks a new hand-off; «إنهاء» ends it', async () => {
    const fake = tabsApi();
    fake.answers[`${base}/support-grants`] = () => json(200, GRANTS_OPEN);
    await at('دخول الدعم', fake);
    const tab = { opener: {} as unknown, location: { replace: vi.fn() }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const handoff = `/api/platform/support-grants/${MINE.id}/handoff`;
    fake.answers[handoff] = () => json(200, { handoffUrl: HANDOFF });
    await click(button(document.body, 'فتح عيادة الويب'));
    await flush(40);
    expect(fake.calls).toContain(`POST ${handoff}`);
    expect(tab.location.replace).toHaveBeenCalledWith(HANDOFF);
    const end = `/api/platform/support-grants/${MINE.id}/end`;
    const ended = { ...MINE, endedAt: '2026-11-26T11:52:00.000Z', endedBy: 'admin' as const };
    fake.answers[end] = () => json(200, ended);
    fake.answers[`${base}/support-grants`] = () =>
      json(200, { ...GRANTS, grants: [ended, ...GRANTS.grants] });
    await click(button(document.body, 'إنهاء'));
    expect(dialog().textContent).toContain('إنهاء دخول الدعم؟');
    await click(button(dialog(), 'إنهاء الدخول'));
    await flush(60);
    expect(fake.calls).toContain(`POST ${end}`);
    expect(text()).toContain('انتهى دخولك');
    expect(text()).toContain('فتح دخول الدعم');
  });

  it('a suspended clinic says so above the form; opening stays allowed', async () => {
    const fake = tabsApi();
    fake.answers[`/api/platform/clinics/${CLINIC.id}`] = () =>
      json(200, { ...detail(), status: 'suspended' });
    await at('دخول الدعم', fake);
    expect(text()).toContain('العيادة موقوفة');
    expect(button(document.body, 'فتح الدخول')).toBeTruthy();
  });
});
