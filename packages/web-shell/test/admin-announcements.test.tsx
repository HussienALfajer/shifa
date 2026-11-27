// Slice A-02-09 checkpoint 2: admin web's announcements («الإعلانات», drawing `A02Announcements`;
// contract rows "Announcements · list", "· create", "· edit", "· end early or cancel"; A-02
// criteria 16, 22, 23): the list by status with counts, each row with its level, body, author,
// period, state, targets and how many dismissed it; the form with the body (counter, the link
// refusal), the level, start and end, the targets, and a banner preview; edit; end now or cancel.
import { afterEach, describe, expect, it } from 'vitest';
import {
  ADMIN_NAME,
  ANNOUNCEMENTS,
  a02Api,
  dialog,
  ENDED_EARLY,
  MAINTENANCE,
  must,
  PLACES_NEWS,
  radio,
  rowWith,
  segment,
  TRAINING,
  typeArea,
} from './a02-admin-support.ts';
import { openAdmin } from './admin-support.ts';
import { button, click, flush, type Rendered } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

async function open(fake = a02Api()) {
  shown = await openAdmin(fake, '/announcements');
  await flush(60);
  return shown;
}

const text = () => document.body.textContent;

describe('Admin web: announcements', () => {
  it('opens on the active ones, with the count of each status', async () => {
    const fake = a02Api();
    const r = await open(fake);
    expect(r.container.querySelector('h1')?.textContent).toBe('الإعلانات');
    expect(fake.queries['/api/platform/announcements']?.[0]).toBe('?status=active');
    expect(text()).toContain(MAINTENANCE.body);
    expect(text()).toContain(PLACES_NEWS.body);
    expect(text()).not.toContain(TRAINING.body);
    const filter = r.container.querySelector('[aria-label="حالة الإعلان"]');
    expect(filter?.textContent).toContain('المجدولة');
    expect(filter?.textContent).toContain('النشطة');
    expect(filter?.textContent).toContain('2');
  });

  it('each row: level, author, period, targets and dismissals (criterion 22)', async () => {
    await open();
    const row = rowWith(MAINTENANCE.body);
    expect(row?.textContent).toContain('تنبيه');
    expect(row?.textContent).toContain(ADMIN_NAME);
    expect(row?.textContent).toContain('نشط');
    expect(row?.textContent).toContain('كل العيادات');
    expect(row?.textContent).toContain('أغلقه 31 من 118 عضوًا');
    const news = rowWith(PLACES_NEWS.body);
    expect(news?.textContent).toContain('معلومة');
    expect(news?.textContent).toContain('3 عيادات');
    expect(news?.textContent).toContain('دون نهاية');
  });

  it('the scheduled are cancelled, the ended show who ended them early', async () => {
    const fake = a02Api();
    await open(fake);
    await click(segment('المجدولة'));
    await flush(40);
    expect(fake.queries['/api/platform/announcements']).toContain('?status=scheduled');
    const training = rowWith(TRAINING.body);
    expect(training?.textContent).toContain('مجدول');
    expect(() => button(must(training), 'إلغاء')).not.toThrow();
    await click(segment('المنتهية'));
    await flush(40);
    const ended = rowWith(ENDED_EARLY.body);
    expect(ended?.textContent).toContain(`أُنهي مبكرًا: ${ADMIN_NAME}`);
    expect(ended?.querySelectorAll('button').length).toBe(0);
  });

  it('a status with none has its own words; none at all says so', async () => {
    await open(a02Api({ announcements: [MAINTENANCE] }));
    await click(segment('المجدولة'));
    await flush(40);
    expect(text()).toContain('لا إعلانات مجدولة');
    await shown?.unmount();
    shown = undefined;
    await open(a02Api({ announcements: [] }));
    expect(text()).toContain('لا إعلانات بعد');
  });

  it('the form previews the banner as the body and level change (criterion 23)', async () => {
    const r = await open();
    await click(button(r.container, 'إعلان جديد'));
    const d = must(dialog());
    expect(d.textContent).toContain('إعلان جديد');
    await typeArea(must(d.querySelector('textarea')), 'تحديث الليلة');
    const preview = d.querySelector('[data-testid="announcement-preview"]');
    expect(preview?.textContent).toContain('تحديث الليلة');
    expect(preview?.textContent).toContain('معلومة');
    await click(radio(d, 'تنبيه'));
    expect(dialog()?.querySelector('[data-testid="announcement-preview"]')?.textContent).toContain(
      'تنبيه',
    );
  });

  it('a link in the body is refused before sending, and when the server refuses it', async () => {
    const fake = a02Api();
    fake.answers['/api/platform/announcements'] = (body) =>
      body === undefined
        ? json(200, { counts: { scheduled: 0, active: 0, ended: 0 }, announcements: [] })
        : errorAnswer(400, 'announcement_link');
    const r = await open(fake);
    await click(button(r.container, 'إعلان جديد'));
    let d = must(dialog());
    await typeArea(must(d.querySelector('textarea')), 'حدّثوا من www.example.com');
    await click(button(d, 'نشر الإعلان'));
    expect(dialog()?.textContent).toContain('لا يُقبل رابط في نص الإعلان');
    expect(fake.bodies['/api/platform/announcements']).toBeUndefined();
    d = must(dialog());
    await typeArea(must(d.querySelector('textarea')), 'صيانة قصيرة الليلة');
    await click(button(d, 'نشر الإعلان'));
    await flush(40);
    expect(fake.bodies['/api/platform/announcements']).toHaveLength(1);
    expect(dialog()?.textContent).toContain('لا يُقبل رابط في نص الإعلان');
  });

  it('creates one for all clinics, starting now, and says it was published', async () => {
    const fake = a02Api({ announcements: [] });
    fake.answers['/api/platform/announcements'] = (body) =>
      body === undefined
        ? json(200, { counts: { scheduled: 0, active: 0, ended: 0 }, announcements: [] })
        : json(201, { ...MAINTENANCE, ...(body as object), status: 'active' });
    const r = await open(fake);
    await click(button(r.container, 'إعلان جديد'));
    const d = must(dialog());
    await typeArea(must(d.querySelector('textarea')), '  صيانة قصيرة الليلة  ');
    await click(button(d, 'نشر الإعلان'));
    await flush(40);
    const sent = fake.bodies['/api/platform/announcements']?.[0] as Record<string, unknown>;
    expect(sent['body']).toBe('صيانة قصيرة الليلة');
    expect(sent['level']).toBe('info');
    expect(sent['target']).toBe('all');
    expect(sent['clinicIds']).toBeUndefined();
    expect(Math.abs(Date.parse(String(sent['startsAt'])) - Date.now())).toBeLessThan(120_000);
    expect(sent['endsAt']).toBeNull();
    expect(text()).toContain('نُشر الإعلان');
  });

  it('selected clinics without a clinic is refused before sending', async () => {
    const fake = a02Api();
    const r = await open(fake);
    await click(button(r.container, 'إعلان جديد'));
    const d = must(dialog());
    await typeArea(must(d.querySelector('textarea')), 'تدريب يوم السبت');
    await click(radio(d, 'عيادات مختارة'));
    await click(button(must(dialog()), 'نشر الإعلان'));
    expect(dialog()?.textContent).toContain('اختر عيادة واحدة على الأقل');
    expect(fake.bodies['/api/platform/announcements']).toBeUndefined();
  });

  it('edits only what changed', async () => {
    const fake = a02Api();
    fake.answers[`/api/platform/announcements/${MAINTENANCE.id}`] = (body) =>
      json(200, { ...MAINTENANCE, ...(body as object) });
    await open(fake);
    await click(button(must(rowWith(MAINTENANCE.body)), 'تعديل'));
    const d = must(dialog());
    expect(d.textContent).toContain('تعديل الإعلان');
    const area = must(d.querySelector('textarea'));
    expect(area.value).toBe(MAINTENANCE.body);
    await typeArea(area, 'صيانة الليلة من 11 إلى 1.');
    await click(button(d, 'حفظ التعديل'));
    await flush(40);
    expect(fake.bodies[`/api/platform/announcements/${MAINTENANCE.id}`]).toEqual([
      { body: 'صيانة الليلة من 11 إلى 1.' },
    ]);
    expect(text()).toContain('حُفظ التعديل');
  });

  it('ends one now after asking; an announcement ended meanwhile reloads the list', async () => {
    const fake = a02Api();
    fake.answers[`/api/platform/announcements/${MAINTENANCE.id}/end`] = () =>
      json(200, { ...MAINTENANCE, status: 'ended', endedEarly: true, endedByName: ADMIN_NAME });
    await open(fake);
    await click(button(must(rowWith(MAINTENANCE.body)), 'إنهاء الآن'));
    const ask = dialog();
    expect(ask?.getAttribute('role')).toBe('alertdialog');
    expect(ask?.textContent).toContain('إنهاء الإعلان الآن؟');
    expect(fake.calls).not.toContain(`POST /api/platform/announcements/${MAINTENANCE.id}/end`);
    await click(button(must(ask), 'إنهاء الآن'));
    await flush(40);
    expect(fake.calls).toContain(`POST /api/platform/announcements/${MAINTENANCE.id}/end`);
    expect(text()).toContain('انتهى الإعلان');

    fake.answers[`/api/platform/announcements/${PLACES_NEWS.id}/end`] = () =>
      errorAnswer(409, 'announcement_ended');
    const reads = fake.calls.filter((c) => c === 'GET /api/platform/announcements').length;
    await click(button(must(rowWith(PLACES_NEWS.body)), 'إنهاء الآن'));
    await click(button(must(dialog()), 'إنهاء الآن'));
    await flush(40);
    expect(text()).toContain('انتهى هذا الإعلان في الأثناء');
    expect(
      fake.calls.filter((c) => c === 'GET /api/platform/announcements').length,
    ).toBeGreaterThan(reads);
  });

  it('lists every fixture once across the statuses', () => {
    expect(new Set(ANNOUNCEMENTS.map((a) => a.id)).size).toBe(ANNOUNCEMENTS.length);
  });
});
