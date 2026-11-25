// Slice A-01-08 checkpoint 4: «إضافة فرع» and «تعديل» (the `POST`, `PATCH /branches` row of the
// slice's table): the name required before sending, address and phone optional; only what
// changed goes out and «حفظ» waits for a change; a cleared address or phone is sent as null; 400
// `body.phone` under the phone; 409 `branch_archived` closes the edit and reads the list again
// (it moves to archived); no connection keeps the input.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BRANCHES_PATH,
  branchesApi,
  branchPath,
  cardOf,
  dialog,
  hasDialog,
  MAIN,
  NEW_BRANCH_PHONE,
  openBranches,
  SECOND,
} from './branches-support.ts';
import { button, click, field, flush, type Rendered, type as typeInto } from './render.tsx';
import { errorAnswer, json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
  vi.unstubAllGlobals();
});

async function openAdd(api = branchesApi().api) {
  shown = await openBranches(api);
  await click(button(shown.container, 'إضافة فرع'));
  await flush(20);
  return shown;
}

async function openEdit(name: string, api = branchesApi().api) {
  shown = await openBranches(api);
  await click(button(cardOf(name), 'تعديل'));
  await flush(20);
  return shown;
}

const isDisabled = (el: HTMLElement) =>
  el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';

describe('«إضافة فرع»', () => {
  it('needs a name before sending', async () => {
    const { api } = branchesApi();
    await openAdd(api);
    await click(button(dialog(), 'إضافة الفرع'));
    await flush(20);
    expect(dialog().textContent).toContain('اكتب اسم الفرع');
    expect(api.bodies[BRANCHES_PATH]).toBeUndefined();
  });

  it('sends the name, address and phone; the new card shows', async () => {
    const { api, state } = branchesApi();
    api.answers[BRANCHES_PATH] = (body) => {
      if (body === undefined) return json(200, state);
      const added = {
        id: '7a1f4c1e-4a43-4f0e-9f61-3c3b1f6f0e15',
        name: 'فرع العزيزية',
        address: 'ساحة الحرية',
        phone: NEW_BRANCH_PHONE,
        archivedAt: null,
        memberCount: 0,
      };
      state.active = [...state.active, added];
      return json(201, added);
    };
    await openAdd(api);
    await typeInto(field(dialog(), 'اسم الفرع'), '  فرع العزيزية ');
    await typeInto(field(dialog(), 'العنوان'), 'ساحة الحرية');
    await typeInto(field(dialog(), 'هاتف الفرع'), NEW_BRANCH_PHONE);
    await click(button(dialog(), 'إضافة الفرع'));
    await flush(60);
    expect(api.bodies[BRANCHES_PATH]?.at(-1)).toEqual({
      name: 'فرع العزيزية',
      address: 'ساحة الحرية',
      phone: NEW_BRANCH_PHONE,
    });
    expect(hasDialog()).toBe(false);
    expect(cardOf('فرع العزيزية')).toBeDefined();
  });

  it('400 on body.phone is named under the phone, the input kept', async () => {
    const { api, state } = branchesApi();
    api.answers[BRANCHES_PATH] = (body) =>
      body === undefined
        ? json(200, state)
        : errorAnswer(400, 'validation_failed', {
            details: [{ path: 'body.phone', code: 'invalid_format' }],
          });
    await openAdd(api);
    await typeInto(field(dialog(), 'اسم الفرع'), 'فرع جديد');
    await typeInto(field(dialog(), 'هاتف الفرع'), '12');
    await click(button(dialog(), 'إضافة الفرع'));
    await flush(40);
    expect(dialog().textContent).toContain('رقم الهاتف غير صحيح');
    expect(field(dialog(), 'اسم الفرع').value).toBe('فرع جديد');
  });

  it('no connection: a Callout, the input kept', async () => {
    const { api, state } = branchesApi();
    api.answers[BRANCHES_PATH] = (body) =>
      body === undefined ? json(200, state) : Promise.reject(new TypeError('offline'));
    await openAdd(api);
    await typeInto(field(dialog(), 'اسم الفرع'), 'فرع جديد');
    await click(button(dialog(), 'إضافة الفرع'));
    await flush(40);
    expect(dialog().textContent).toContain('تعذّر الوصول إلى الخادم');
    expect(field(dialog(), 'اسم الفرع').value).toBe('فرع جديد');
  });
});

describe('«تعديل»', () => {
  it('opens with the branch’s values; «حفظ» waits for a change', async () => {
    await openEdit(MAIN.name);
    expect(field(dialog(), 'اسم الفرع').value).toBe(MAIN.name);
    expect(field(dialog(), 'العنوان').value).toBe(MAIN.address);
    expect(field(dialog(), 'هاتف الفرع').value).toBe(MAIN.phone);
    expect(isDisabled(button(dialog(), 'حفظ'))).toBe(true);
  });

  it('sends only what changed; a cleared address goes as null', async () => {
    const { api, state } = branchesApi();
    api.answers[branchPath(MAIN.id)] = (body) => {
      const next = { ...MAIN, name: 'الفرع الأول', address: null };
      state.active = state.active.map((b) => (b.id === MAIN.id ? next : b));
      return json(200, { ...next, ...(body as object) });
    };
    await openEdit(MAIN.name, api);
    const name = field(dialog(), 'اسم الفرع');
    await typeInto(name, 'الفرع الأول');
    await typeInto(field(dialog(), 'العنوان'), '');
    await click(button(dialog(), 'حفظ'));
    await flush(60);
    expect(api.bodies[branchPath(MAIN.id)]?.at(-1)).toEqual({ name: 'الفرع الأول', address: null });
    expect(hasDialog()).toBe(false);
    expect(cardOf('الفرع الأول')).toBeDefined();
  });

  it('an empty name is refused before sending', async () => {
    const { api } = branchesApi();
    await openEdit(SECOND.name, api);
    await typeInto(field(dialog(), 'اسم الفرع'), '  ');
    await click(button(dialog(), 'حفظ'));
    await flush(20);
    expect(dialog().textContent).toContain('اكتب اسم الفرع');
    expect(api.bodies[branchPath(SECOND.id)]).toBeUndefined();
  });

  it('409 branch_archived: closes, says so, and the list is read again', async () => {
    const { api } = branchesApi();
    api.answers[branchPath(SECOND.id)] = () => errorAnswer(409, 'branch_archived');
    const r = await openEdit(SECOND.name, api);
    const before = api.calls.filter((c) => c === `GET ${BRANCHES_PATH}`).length;
    await typeInto(field(dialog(), 'اسم الفرع'), 'اسم آخر');
    await click(button(dialog(), 'حفظ'));
    await flush(60);
    expect(hasDialog()).toBe(false);
    expect(r.container.textContent).toContain('أُرشف هذا الفرع');
    expect(api.calls.filter((c) => c === `GET ${BRANCHES_PATH}`).length).toBeGreaterThan(before);
  });
});
