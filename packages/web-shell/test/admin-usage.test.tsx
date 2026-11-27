// Slice A-02-08 checkpoint 3: «الاستخدام» on the clinic page and the usage columns of the clinics
// list, as the owner approved the boards `A02Clinic` (states `use` … `useEmpty`) and `A02Clinics`
// on 2026-11-27 (A-02 criteria 17, 19, 21): today's four figures with yesterday's, the 30-day
// chart with its series switch, total and its change, average, highest day, days without
// activity; no data yet. The list: «آخر نشاط», «الدخول (7 أيام)» and «بلا نشاط منذ 7 أيام (n)».
import { afterEach, describe, expect, it } from 'vitest';
import { ACTIVE, adminApi, ENDING, openAdmin, PENDING, type Summary } from './admin-support.ts';
import { choose, openTab, rowOf, text } from './admin-tabs-helpers.ts';
import { base, openClinic, tabsApi, USAGE } from './admin-tabs-support.ts';
import { flush, type Rendered } from './render.tsx';
import { json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

async function usage(fake = tabsApi()) {
  shown = await openClinic(fake);
  await flush(40);
  await openTab('الاستخدام');
  return fake;
}

const kpi = (label: string) => {
  for (const el of document.querySelectorAll<HTMLElement>('[data-kpi]')) {
    if (el.textContent.includes(label)) return el.textContent;
  }
  return '';
};

describe('Admin web: «الاستخدام»', () => {
  it('today’s figures with yesterday’s, members and branches', async () => {
    await usage();
    expect(text()).toContain('تسجيلات الدخول اليوم');
    expect(text()).toContain('أمس 16');
    expect(text()).toContain('من 26 عضوًا غير معطّل');
    expect(text()).toContain('الأيام بتوقيت دمشق');
  });

  it('the chart’s figures: total with its change, average, highest day, days without activity', async () => {
    await usage();
    const total = USAGE.days.reduce((n, d) => n + d.signIns, 0);
    expect(kpi('المجموع')).toContain(String(total));
    expect(kpi('المجموع')).toContain('+12% عن الثلاثين السابقة');
    expect(kpi('المتوسط اليومي')).toContain('10.4');
    expect(kpi('أعلى يوم (17/11)')).toContain('21');
    expect(kpi('أيام بلا نشاط')).toContain('6');
    expect(
      document.querySelectorAll('[data-slot="usage-chart"] button, [role="group"] button').length,
    ).toBeGreaterThan(0);
  });

  it('the series switch shows members signed in; no badge when the previous total is 0', async () => {
    await usage();
    await choose(document.body, 'الأعضاء الذين سجّلوا الدخول');
    const total = USAGE.days.reduce((n, d) => n + d.membersSignedIn, 0);
    expect(kpi('المجموع')).toContain(String(total));
    expect(kpi('المجموع')).not.toContain('%');
  });

  it('no data yet is the empty state', async () => {
    const fake = tabsApi();
    fake.answers[`${base}/usage`] = () => json(200, { ...USAGE, hasData: false });
    await usage(fake);
    expect(text()).toContain('لا بيانات استخدام بعد');
  });
});

const ago = (days: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 42, 0, 0);
  return d.toISOString();
};

describe('Admin web: the clinics list’s usage columns', () => {
  const clinics = [
    { ...ACTIVE, lastActivityAt: ago(0), signIns7d: 96 },
    { ...PENDING, lastActivityAt: null, signIns7d: 0 },
    { ...ENDING, lastActivityAt: ago(23), signIns7d: 0 },
  ] as (Summary & { lastActivityAt: string | null; signIns7d: number })[];

  it('shows last activity and sign-ins in 7 days', async () => {
    shown = await openAdmin(adminApi(clinics), '/');
    await flush(40);
    expect(text()).toContain('آخر نشاط');
    expect(text()).toContain('الدخول (7 أيام)');
    expect(rowOf(ACTIVE.name)?.textContent).toContain('اليوم 10:42');
    expect(rowOf(ACTIVE.name)?.textContent).toContain('96');
    expect(rowOf(PENDING.name)?.textContent).toContain('لا نشاط بعد');
    expect(rowOf(ENDING.name)?.textContent).toContain('قبل 23 يومًا');
  });

  it('«بلا نشاط منذ 7 أيام (n)» keeps the clinics without a sign-in', async () => {
    shown = await openAdmin(adminApi(clinics), '/');
    await flush(40);
    const toggle = [...document.querySelectorAll('[role="switch"]')].find((s) =>
      (s.closest('label')?.textContent ?? s.parentElement?.textContent ?? '').includes(
        'بلا نشاط منذ 7 أيام (2)',
      ),
    );
    expect(toggle).toBeTruthy();
    (toggle as HTMLElement).click();
    await flush(40);
    expect(rowOf(ACTIVE.name)).toBeNull();
    expect(rowOf(PENDING.name)).not.toBeNull();
    expect(rowOf(ENDING.name)).not.toBeNull();
  });

  it('when every clinic was active the filter says so', async () => {
    shown = await openAdmin(adminApi([clinics[0] as Summary]), '/');
    await flush(40);
    const toggle = document.querySelector<HTMLElement>('[role="switch"]');
    toggle?.click();
    await flush(40);
    expect(text()).toContain('كل العيادات نشطة');
  });
});
