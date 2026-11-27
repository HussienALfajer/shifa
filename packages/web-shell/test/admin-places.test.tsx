// Slice A-02-09 checkpoint 3: admin web's cities and areas («المدن والمناطق», drawing `A02Cities`;
// contract rows "Places · list", "· add", "· rename", "· restore", "· archive"; A-02 criteria 15,
// 24): the cities, the areas of the chosen city, with the counts of branches, clinics and doctors;
// add, rename and archive from each place's menu, restore an archived one; «عرض المؤرشفة»; the
// search on the client with the Arabic fold («الشهبا» finds «الشهباء», «اعزاز» finds «أعزاز»).
import { afterEach, describe, expect, it } from 'vitest';
import {
  ALEPPO,
  AZAZ,
  a02Api,
  dialog,
  JAMILIYEH,
  KALLASEH,
  must,
  rowWith,
  SABIL,
  SHAHBA,
} from './a02-admin-support.ts';
import { openAdmin } from './admin-support.ts';
import { button, click, flush, type Rendered, type as typeInto } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

async function open(fake = a02Api()) {
  shown = await openAdmin(fake, '/places');
  await flush(60);
  return shown;
}

const text = () => document.body.textContent;
const input = (name: string) => {
  const el = document.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`);
  if (!el) throw new Error(`no input ${name}`);
  return el;
};

/** Opens a place's menu and picks an action. */
async function act(place: string, action: string) {
  const row = must(rowWith(place));
  await click(button(row, `إجراءات ${place}`));
  await flush(20);
  for (const item of document.querySelectorAll<HTMLElement>('[role="menuitem"]')) {
    if (item.textContent.includes(action)) {
      await click(item);
      await flush(20);
      return;
    }
  }
  throw new Error(`no menu item ${action}`);
}

describe('Admin web: cities and areas', () => {
  it('lists the cities with their counts, and the areas of the first one', async () => {
    const fake = a02Api();
    const r = await open(fake);
    expect(r.container.querySelector('h1')?.textContent).toBe('المدن والمناطق');
    expect(fake.queries['/api/platform/cities']?.[0]).toBe('');
    expect(rowWith(ALEPPO.name)?.textContent).toContain('3 مناطق · 14 فرعًا · 11 عيادة · 34 طبيبًا');
    expect(rowWith(AZAZ.name)?.textContent).toContain('لا مناطق بعد · فرعان · عيادتان · 4 أطباء');
    expect(text()).toContain('مناطق حلب');
    expect(rowWith(SHAHBA.name)?.textContent).toContain('5 فروع · 4 عيادات · 11 طبيبًا');
    expect(rowWith(SABIL.name)?.textContent).toContain('لا فروع');
  });

  it('choosing a city without areas shows its empty state', async () => {
    await open();
    const azaz = must(rowWith(AZAZ.name)?.querySelector('[aria-pressed]'));
    await click(azaz);
    expect(text()).toContain('مناطق أعزاز');
    expect(text()).toContain('لا مناطق بعد');
    expect(rowWith(SHAHBA.name)).toBeNull();
  });

  it('searches with the Arabic fold; no match has its own words', async () => {
    await open();
    await typeInto(input('ابحث عن مدينة أو منطقة'), 'الشهبا');
    await flush(20);
    expect(rowWith(SHAHBA.name)).not.toBeNull();
    expect(rowWith(JAMILIYEH.name)).toBeNull();
    expect(rowWith(AZAZ.name)).toBeNull();
    await typeInto(input('ابحث عن مدينة أو منطقة'), 'اعزاز');
    await flush(20);
    expect(rowWith(AZAZ.name)).not.toBeNull();
    await typeInto(input('ابحث عن مدينة أو منطقة'), 'دمشق');
    await flush(20);
    expect(text()).toContain('لا مدينة ولا منطقة بهذا الاسم');
  });

  it('«عرض المؤرشفة» reads the archived ones too, with «مؤرشفة» and «استعادة»', async () => {
    const fake = a02Api();
    const r = await open(fake);
    await click(must(r.container.querySelector('[role="switch"]')));
    await flush(40);
    expect(fake.queries['/api/platform/cities']).toContain('?includeArchived=true');
    const archived = rowWith(KALLASEH.name);
    expect(archived?.textContent).toContain('مؤرشفة');
    expect(() => button(must(archived), 'استعادة')).not.toThrow();
    expect(rowWith('عفرين')?.textContent).toContain('مؤرشفة');
  });

  it('restores an archived area and says so', async () => {
    const fake = a02Api();
    fake.answers[`/api/platform/areas/${KALLASEH.id}/restore`] = () =>
      json(200, { ...KALLASEH, archivedAt: null });
    const r = await open(fake);
    await click(must(r.container.querySelector('[role="switch"]')));
    await flush(40);
    await click(button(must(rowWith(KALLASEH.name)), 'استعادة'));
    await flush(40);
    expect(fake.calls).toContain(`POST /api/platform/areas/${KALLASEH.id}/restore`);
    expect(text()).toContain(`استُعيدت «${KALLASEH.name}»`);
  });

  it('adds an area to the chosen city; a name that exists is refused on the field', async () => {
    const fake = a02Api();
    let answer = errorAnswer(409, 'place_name_taken');
    fake.answers[`/api/platform/cities/${ALEPPO.id}/areas`] = () => answer;
    await open(fake);
    await typeInto(input('منطقة جديدة'), 'الجميلية');
    await click(button(input('منطقة جديدة').closest('form') as HTMLElement, 'إضافة'));
    await flush(40);
    expect(fake.bodies[`/api/platform/cities/${ALEPPO.id}/areas`]).toEqual([{ name: 'الجميلية' }]);
    expect(text()).toContain('«الجميلية» موجودة في حلب.');
    answer = json(201, { ...SABIL, id: 'a0000000-0000-4000-8000-000000000001', name: 'الفرقان' });
    await typeInto(input('منطقة جديدة'), ' الفرقان ');
    await click(button(input('منطقة جديدة').closest('form') as HTMLElement, 'إضافة'));
    await flush(40);
    expect(fake.bodies[`/api/platform/cities/${ALEPPO.id}/areas`]?.[1]).toEqual({
      name: 'الفرقان',
    });
    expect(text()).toContain('أُضيفت «الفرقان»');
  });

  it('adds a city; an empty name is refused before sending', async () => {
    const fake = a02Api();
    fake.answers['/api/platform/cities'] = (body) =>
      body === undefined
        ? json(200, { cities: [ALEPPO] })
        : json(201, { ...AZAZ, id: 'a0000000-0000-4000-8000-000000000002', name: 'منبج' });
    await open(fake);
    await click(button(input('مدينة جديدة').closest('form') as HTMLElement, 'إضافة'));
    expect(text()).toContain('اكتب الاسم.');
    expect(fake.bodies['/api/platform/cities']).toBeUndefined();
    await typeInto(input('مدينة جديدة'), 'منبج');
    await click(button(input('مدينة جديدة').closest('form') as HTMLElement, 'إضافة'));
    await flush(40);
    expect(fake.bodies['/api/platform/cities']).toEqual([{ name: 'منبج' }]);
  });

  it('renames from the menu, stating how many branches and clinics it reaches', async () => {
    const fake = a02Api();
    fake.answers[`/api/platform/areas/${SHAHBA.id}`] = (body) =>
      json(200, { ...SHAHBA, ...(body as object) });
    await open(fake);
    await act(SHAHBA.name, 'إعادة التسمية');
    const d = must(dialog());
    expect(d.textContent).toContain(`إعادة تسمية «${SHAHBA.name}»`);
    expect(d.textContent).toContain('5 فروع، في 4 عيادات');
    const name = must(d.querySelector('input'));
    expect(name.value).toBe(SHAHBA.name);
    await typeInto(name, 'الشهباء الجديدة');
    await click(button(d, 'حفظ'));
    await flush(40);
    expect(fake.bodies[`/api/platform/areas/${SHAHBA.id}`]).toEqual([{ name: 'الشهباء الجديدة' }]);
    expect(text()).toContain('حُفظ الاسم «الشهباء الجديدة»');
  });

  it('archives after a question naming what it reaches; an archived one reloads', async () => {
    const fake = a02Api();
    fake.answers[`/api/platform/areas/${SHAHBA.id}/archive`] = () =>
      json(200, { ...SHAHBA, archivedAt: new Date().toISOString() });
    await open(fake);
    await act(SHAHBA.name, 'أرشفة');
    const ask = dialog();
    expect(ask?.getAttribute('role')).toBe('alertdialog');
    expect(ask?.textContent).toContain(`أرشفة «${SHAHBA.name}»؟`);
    expect(ask?.textContent).toContain('5 فروع، في 4 عيادات');
    await click(button(must(ask), 'أرشفة'));
    await flush(40);
    expect(fake.calls).toContain(`POST /api/platform/areas/${SHAHBA.id}/archive`);
    expect(text()).toContain(`أُرشفت «${SHAHBA.name}»`);

    fake.answers[`/api/platform/areas/${JAMILIYEH.id}/archive`] = () =>
      errorAnswer(409, 'place_archived');
    const reads = fake.calls.filter((c) => c === 'GET /api/platform/cities').length;
    await act(JAMILIYEH.name, 'أرشفة');
    await click(button(must(dialog()), 'أرشفة'));
    await flush(40);
    expect(text()).toContain('تغيّرت القائمة في الأثناء');
    expect(fake.calls.filter((c) => c === 'GET /api/platform/cities').length).toBeGreaterThan(
      reads,
    );
  });

  it('none yet: the empty state with the first city’s field', async () => {
    await open(a02Api({ cities: [], archivedCities: [] }));
    expect(text()).toContain('لا مدن بعد');
    expect(() => input('مدينة جديدة')).not.toThrow();
  });
});
