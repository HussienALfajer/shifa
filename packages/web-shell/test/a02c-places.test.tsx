// Slice A-02-10 checkpoint 3: a branch's city and area in clinic web, as the owner approved it on
// 2026-11-27 (board `A02cBranchPlace`): the cards say «حلب · الشهباء», Badge «منطقة مؤرشفة» or
// «لم تُحدَّد المدينة»; the dialog's «المدينة» and «المنطقة» Comboboxes from GET /clinic/places
// (the area waits for its city and follows it); the save sends `cityId` and `areaId`; an
// archived area the branch holds is kept and named; 400 `area_not_in_city` and 409
// `place_archived` are field errors.
import { afterEach, describe, expect, it } from 'vitest';
import { must } from './a02-admin-support.ts';
import { ALEPPO, AZAZ, KALLASEH, SHAHBA, withA02 } from './a02c-support.ts';
import {
  BRANCHES_PATH,
  branchesApi,
  branchPath,
  cardOf,
  dialog,
  MAIN,
  openBranches,
  SECOND,
  THIRD,
} from './branches-support.ts';
import { button, click, field, flush, type Rendered, type as typeInto } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

const place = (p: { id: string; name: string }, archived = false) => ({ ...p, archived });

const HELD = {
  ...MAIN,
  city: place(ALEPPO),
  area: place(SHAHBA),
};
const OLD_AREA = {
  ...SECOND,
  city: place(ALEPPO),
  area: place(KALLASEH, true),
};
const NOWHERE = { ...THIRD, city: null, area: null };

async function open() {
  const { api } = branchesApi({ active: [HELD, OLD_AREA, NOWHERE] as never });
  withA02(api);
  shown = await openBranches(api);
  return api;
}

const combo = (label: string) => field(dialog(), label);

async function pick(label: string, typed: string, option: string) {
  const input = combo(label);
  input.focus();
  await typeInto(input, typed);
  await flush(30);
  const found = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((o) =>
    o.textContent.includes(option),
  );
  if (!found) throw new Error(`no option ${option}`);
  await click(found);
}

describe('branch cards: the place', () => {
  it('names the city and area, an archived area, and a branch without a city', async () => {
    await open();
    expect(cardOf(HELD.name).textContent).toContain('حلب · الشهباء');
    expect(cardOf(OLD_AREA.name).textContent).toContain('حلب · الكلاسة');
    expect(cardOf(OLD_AREA.name).textContent).toContain('منطقة مؤرشفة');
    expect(cardOf(NOWHERE.name).textContent).toContain('لم تُحدَّد المدينة');
  });
});

describe('branch dialog: city and area', () => {
  it('the area waits for its city', async () => {
    await open();
    await click(button(must(shown?.container), 'إضافة فرع'));
    await flush(40);
    expect(combo('المنطقة').disabled).toBe(true);
    expect(dialog().textContent).toContain('اختر المدينة أولًا');
  });

  it('sends the chosen city and area with a new branch', async () => {
    const api = await open();
    api.answers[BRANCHES_PATH] = (body) =>
      body === undefined
        ? json(200, { active: [HELD, OLD_AREA, NOWHERE], archived: [] })
        : json(201, { ...NOWHERE, id: MAIN.id.replace(/..$/, '99'), name: 'فرع جديد' });
    await click(button(must(shown?.container), 'إضافة فرع'));
    await flush(40);
    await typeInto(field(dialog(), 'اسم الفرع'), 'فرع جديد');
    await pick('المدينة', 'حل', 'حلب');
    expect(combo('المنطقة').disabled).toBe(false);
    await pick('المنطقة', 'الشه', 'الشهباء');
    await click(button(dialog(), 'إضافة الفرع'));
    await flush(40);
    expect(api.bodies[BRANCHES_PATH]?.at(-1)).toMatchObject({
      name: 'فرع جديد',
      cityId: ALEPPO.id,
      areaId: SHAHBA.id,
    });
  });

  it('a city with no area of that name says so', async () => {
    await open();
    await click(button(must(shown?.container), 'إضافة فرع'));
    await flush(40);
    await pick('المدينة', 'أع', AZAZ.name);
    const area = combo('المنطقة');
    area.focus();
    await typeInto(area, 'المزة');
    await flush(30);
    expect(document.body.textContent).toContain('لا منطقة بهذا الاسم');
  });

  it('keeps an archived area the branch holds, and names it', async () => {
    const api = await open();
    await click(button(cardOf(OLD_AREA.name), 'تعديل'));
    await flush(40);
    expect(combo('المنطقة').value).toContain(KALLASEH.name);
    expect(dialog().textContent).toContain('«الكلاسة» مؤرشفة');
    await typeInto(field(dialog(), 'العنوان'), 'قرب باب أنطاكية');
    api.answers[branchPath(OLD_AREA.id)] = () => json(200, OLD_AREA);
    await click(button(dialog(), 'حفظ'));
    await flush(40);
    const sent = api.bodies[branchPath(OLD_AREA.id)]?.at(-1) as Record<string, unknown>;
    expect(sent['areaId']).toBeUndefined();
    expect(sent['cityId']).toBeUndefined();
  });

  it('409 `place_archived` names the field; 400 `area_not_in_city` too', async () => {
    const api = await open();
    await click(button(cardOf(NOWHERE.name), 'تعديل'));
    await flush(40);
    await pick('المدينة', 'حل', 'حلب');
    await pick('المنطقة', 'الج', 'الجميلية');
    api.answers[branchPath(NOWHERE.id)] = () =>
      errorAnswer(409, 'place_archived', { place: 'area' });
    await click(button(dialog(), 'حفظ'));
    await flush(40);
    expect(dialog().textContent).toContain('أُرشفت هذه المنطقة');
    api.answers[branchPath(NOWHERE.id)] = () =>
      errorAnswer(400, 'validation_failed', {
        details: [{ path: 'body.areaId', code: 'area_not_in_city' }],
      });
    await click(button(dialog(), 'حفظ'));
    await flush(40);
    expect(dialog().textContent).toContain('ليست هذه المنطقة في المدينة المختارة');
  });
});
