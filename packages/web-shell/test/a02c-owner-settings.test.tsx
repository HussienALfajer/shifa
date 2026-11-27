// Slice A-02-10 checkpoints 2 and 3: the owner's side of clinic web's settings, as the owner
// approved it on 2026-11-27 (board `A02cSettings`): the warning banner «… من فريق شفاء تقرأ
// عيادتك الآن» above every page with time left and «إنهاء الدخول» (asked first; 409
// `support_ended` reloads), «سجل دخول الدعم» (DataTable, empty → EmptyState), «الاشتراك» (plan,
// status, end, «22 من 35» with a meter, «حتى 20» when not counted, the full limit's line, the
// ending warning within 14 days, no features), and the idle setting's source and lock.
import { afterEach, describe, expect, it } from 'vitest';
import { must } from './a02-admin-support.ts';
import {
  ADMIN_NAME,
  banner,
  EXPIRED_GRANT,
  endGrantPath,
  type Limit,
  OPEN_GRANT,
  pageText,
  REASON,
  supportGrants,
  withA02,
} from './a02c-support.ts';
import { button, click, flush, type Rendered, renderShell } from './render.tsx';
import { errorAnswer, json } from './support.ts';
import { DOCTOR_SESSION, teamApi } from './team-support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

async function open(path: string, api = withA02(teamApi())) {
  shown = await renderShell('clinic', api, path);
  await flush(60);
  return { api, r: shown };
}

const OWNER_BANNER = 'دخول الدعم';

describe('owner: support access banner', () => {
  it('shows an open grant above every page with its reason and time left', async () => {
    const { r } = await open('/team', withA02(teamApi(), { open: [OPEN_GRANT] }));
    const strip = banner(OWNER_BANNER);
    expect(strip?.textContent).toContain(
      `${ADMIN_NAME} من فريق شفاء تقرأ عيادتك الآن، للقراءة فقط.`,
    );
    expect(strip?.textContent).toContain(REASON);
    expect(strip?.textContent).toMatch(/متبقٍّ (41|42) دقيقة/);
    expect(strip?.querySelector('button')?.textContent).toBe('إنهاء الدخول');
    expect(r.router.state.location.pathname).toBe('/team');
  });

  it('shows nothing while no grant is open', async () => {
    await open('/');
    expect(banner(OWNER_BANNER)).toBeNull();
  });

  it('never reads the grants for a member who is not an owner', async () => {
    const api = withA02(teamApi({ session: DOCTOR_SESSION }), { open: [OPEN_GRANT] });
    await open('/', api);
    expect(api.calls).not.toContain('GET /api/clinic/support-grants');
    expect(banner(OWNER_BANNER)).toBeNull();
  });

  it('asks, ends the access and says so', async () => {
    const api = withA02(teamApi(), { open: [OPEN_GRANT] });
    api.answers[endGrantPath(OPEN_GRANT.id)] = () => {
      api.answers['/api/clinic/support-grants'] = () =>
        json(
          200,
          supportGrants(
            [],
            [
              {
                ...OPEN_GRANT,
                endedAt: new Date().toISOString(),
                endedBy: 'owner',
                endedByName: 'أنا',
              },
              EXPIRED_GRANT,
            ],
          ),
        );
      return json(200, { ...OPEN_GRANT, endedBy: 'owner' });
    };
    const { r } = await open('/settings', api);
    await click(button(banner(OWNER_BANNER) ?? r.container, 'إنهاء الدخول'));
    const ask = document.body.querySelector<HTMLElement>('[role="alertdialog"]');
    expect(ask?.textContent).toContain('إنهاء دخول الدعم؟');
    await click(button(must(ask), 'إنهاء الدخول'));
    await flush(60);
    expect(api.calls).toContain(`POST ${endGrantPath(OPEN_GRANT.id)}`);
    expect(banner(OWNER_BANNER)).toBeNull();
    expect(pageText()).toContain('أنهيت دخول الدعم');
  });

  it('reloads when the access had already ended (409 `support_ended`)', async () => {
    const api = withA02(teamApi(), { open: [OPEN_GRANT] });
    api.answers[endGrantPath(OPEN_GRANT.id)] = () => {
      api.answers['/api/clinic/support-grants'] = () => json(200, supportGrants([]));
      return errorAnswer(409, 'support_ended');
    };
    const { r } = await open('/settings', api);
    await click(button(banner(OWNER_BANNER) ?? r.container, 'إنهاء الدخول'));
    await click(
      button(
        must(document.body.querySelector<HTMLElement>('[role="alertdialog"]')),
        'إنهاء الدخول',
      ),
    );
    await flush(60);
    expect(banner(OWNER_BANNER)).toBeNull();
  });
});

describe('owner: «سجل دخول الدعم»', () => {
  it('lists every grant with its whole reason and state', async () => {
    const { r } = await open('/settings', withA02(teamApi(), { open: [OPEN_GRANT] }));
    const table = r.container.querySelector('[aria-label="سجل دخول الدعم"]');
    expect(table?.textContent).toContain(EXPIRED_GRANT.reason);
    expect(table?.textContent).toContain('انتهت المدة');
    expect(table?.textContent).toContain('مفتوح');
  });

  it('shows the empty state when the team of Shifa never read the clinic', async () => {
    const { r } = await open('/settings', withA02(teamApi(), { ended: [] }));
    expect(r.container.textContent).toContain('لم يدخل فريق شفاء عيادتك بعد');
  });
});

describe('owner: «الاشتراك»', () => {
  it('shows the plan, status, end and each limit with its use', async () => {
    const { r } = await open('/settings');
    const text = r.container.textContent;
    expect(text).toContain('الاشتراك');
    expect(text).toContain('متعددة الفروع');
    expect(text).toContain('31/12/2026');
    expect(text).toContain('22 من 35');
    expect(text).toContain('3 من 5');
    expect(text).toContain('حتى 20');
    expect(text).toContain('لا ميزات إضافية في خطتك بعد');
    expect(r.container.querySelector('[role="img"][aria-label="22 من 35"]')).not.toBeNull();
  });

  it('names a full limit', async () => {
    const full: Limit[] = [
      { key: 'limits.practitioners', limit: 35, used: 22 },
      { key: 'limits.branches', limit: 5, used: 5 },
    ];
    const { r } = await open('/settings', withA02(teamApi(), { limits: full }));
    expect(r.container.textContent).toContain('5 من 5');
    expect(r.container.textContent).toContain('وصلت العيادة إلى حد الفروع في خطتها');
  });

  it('warns when the subscription ends within 14 days', async () => {
    const soon = new Date(Date.now() + 9 * 86_400_000 + 3_600_000).toISOString().slice(0, 10);
    const { r } = await open('/settings', withA02(teamApi(), { subscriptionEnd: soon }));
    expect(r.container.textContent).toMatch(/ينتهي اشتراكك خلال (9|10) أيام/);
  });

  it('says nothing about the end when it is far', async () => {
    const { r } = await open('/settings');
    expect(r.container.textContent).not.toContain('ينتهي اشتراكك');
  });
});

describe('owner: the idle setting', () => {
  it('says the clinic chose it', async () => {
    const { r } = await open('/settings');
    expect(r.container.textContent).toContain('اختارتها عيادتك.');
  });

  it('says it is inherited from the default', async () => {
    const api = withA02(teamApi());
    api.answers['/api/clinic/settings'] = () =>
      json(200, { idleMinutes: 30, source: 'default', locked: false });
    const { r } = await open('/settings', api);
    expect(r.container.textContent).toContain('الإعداد الافتراضي لشفاء (30 دقيقة)');
  });

  it('is locked by the administration: choices disabled, Badge, no «حفظ»', async () => {
    const api = withA02(teamApi());
    api.answers['/api/clinic/settings'] = () =>
      json(200, { idleMinutes: 60, source: 'organization', locked: true });
    const { r } = await open('/settings', api);
    expect(r.container.textContent).toContain('مقفل من الإدارة');
    expect(r.container.textContent).toContain('قفلت إدارة شفاء هذا الإعداد على 60 دقيقة');
    expect(() => button(r.container, 'حفظ')).toThrow();
    const radios = [...r.container.querySelectorAll('[role="radio"]')];
    expect(radios.length).toBeGreaterThan(0);
    expect(
      radios.every(
        (el) =>
          el.hasAttribute('data-disabled') ||
          el.getAttribute('aria-disabled') === 'true' ||
          el.hasAttribute('disabled'),
      ),
    ).toBe(true);
  });

  it('reloads into the locked state on 409 `setting_locked`', async () => {
    const api = withA02(teamApi());
    api.answers['/api/clinic/settings'] = (body) => {
      if (body === undefined)
        return json(200, { idleMinutes: 15, source: 'organization', locked: false });
      api.answers['/api/clinic/settings'] = () =>
        json(200, { idleMinutes: 60, source: 'organization', locked: true });
      return errorAnswer(409, 'setting_locked');
    };
    const { r } = await open('/settings', api);
    const choice = [...r.container.querySelectorAll<HTMLElement>('label')].find((l) =>
      l.textContent.includes('30 دقيقة'),
    );
    await click(must(choice));
    await click(button(r.container, 'حفظ'));
    await flush(60);
    expect(r.container.textContent).toContain('مقفل من الإدارة');
  });
});
