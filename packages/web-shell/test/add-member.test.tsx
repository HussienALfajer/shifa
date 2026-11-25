// Slice A-01-08 checkpoint 3: «إضافة موظف», as the owner approved it on 2026-11-24 (prototype
// `Team08`): the `POST /team/members` row of the slice's table — name, phone and one role checked
// before sending; roles with scope; the sensitive toggles from each role's default (OD-102, `GET
// /team/permissions`; only a switch that differs is sent); 400 `body.phone`, 409 `phone_in_team`
// under the phone, 409 `branch_archived` as a Callout, no connection with the input kept; the
// added member's drawer with the link shown once.
import { afterEach, describe, expect, it } from 'vitest';
import { button, click, field, flush, type Rendered, type as typeInto } from './render.tsx';
import { errorAnswer, json } from './support.ts';
import {
  B_SECOND,
  control,
  detail,
  drawer,
  isOn,
  MEMBERS_PATH,
  type Member,
  NEW_PHONE,
  NOTES,
  openTeam,
  roleGroup,
  teamApi,
} from './team-support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

const NAME = 'رامي الحلبي';
const PHONE = NEW_PHONE;
const NOTES_LABEL = 'رؤية الملاحظات السريرية';
const SUBMIT = 'إضافة وإصدار الرابط';

const ADDED: Member = {
  id: '7a1f4c1e-4a43-4f0e-9f61-3c3b1f6f0e40',
  name: NAME,
  phone: NEW_PHONE,
  status: 'pending',
  roles: [{ role: 'receptionist', branchId: B_SECOND.id, branchName: B_SECOND.name }],
  lastActiveAt: null,
  linkExpiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  isSelf: false,
};
const LINK = {
  url: 'https://clinic.shifa.test/setup#t=synthetic-added',
  whatsappUrl: 'https://wa.me/?text=synthetic-added',
  expiresAt: ADDED.linkExpiresAt,
};

async function openAdd(api = teamApi()) {
  shown = await openTeam(api);
  await click(button(shown.container, 'إضافة موظف'));
  await flush(40);
  return shown;
}

async function fill() {
  await typeInto(field(drawer(), 'الاسم'), NAME);
  await typeInto(field(drawer(), 'رقم الهاتف'), PHONE);
  await click(control(roleGroup('receptionist'), 'موظف استقبال'));
  await click(control(roleGroup('receptionist'), B_SECOND.name));
}

const sent = (api: ReturnType<typeof teamApi>) => api.bodies[MEMBERS_PATH] ?? [];

describe('Add a member', () => {
  it('opens «إضافة موظف» with empty fields and no role', async () => {
    await openAdd();
    expect(drawer().textContent).toContain('إضافة موظف');
    expect(field(drawer(), 'الاسم').value).toBe('');
    expect(isOn(control(roleGroup('doctor'), 'طبيب'))).toBe(false);
  });

  it('name, phone and one role are checked before sending', async () => {
    const api = teamApi();
    await openAdd(api);
    await click(button(drawer(), SUBMIT));
    await flush(20);
    const t = drawer().textContent;
    expect(t).toContain('اكتب الاسم');
    expect(t).toContain('اكتب رقم الهاتف');
    expect(t).toContain('اختر دوراً واحداً على الأقل');
    expect(sent(api)).toHaveLength(0);
  });

  it('a role in a branch clinic needs its branches before sending', async () => {
    const api = teamApi();
    await openAdd(api);
    await typeInto(field(drawer(), 'الاسم'), NAME);
    await typeInto(field(drawer(), 'رقم الهاتف'), PHONE);
    await click(control(roleGroup('receptionist'), 'موظف استقبال'));
    await click(control(roleGroup('receptionist'), 'الفرع الرئيسي'));
    await click(control(roleGroup('receptionist'), 'الفرع الرئيسي'));
    await click(button(drawer(), SUBMIT));
    await flush(20);
    expect(drawer().textContent).toContain('اختر الفروع');
    expect(sent(api)).toHaveLength(0);
  });

  it('the sensitive toggle follows the chosen role’s default (OD-102)', async () => {
    await openAdd();
    expect(isOn(control(drawer(), NOTES_LABEL))).toBe(false);
    await click(control(roleGroup('assistant'), 'مساعد'));
    expect(isOn(control(drawer(), NOTES_LABEL))).toBe(true);
    expect(drawer().textContent).toContain('مفتوحة افتراضياً لدوره');
  });

  it('sends name, phone and roles; a toggle left at its default is not sent', async () => {
    const api = teamApi();
    api.answers[MEMBERS_PATH] = (body) =>
      body === undefined
        ? json(200, { members: [] })
        : json(201, { member: detail(ADDED), link: LINK });
    await openAdd(api);
    await fill();
    await click(button(drawer(), SUBMIT));
    await flush(40);
    expect(sent(api).at(-1)).toEqual({
      name: NAME,
      phone: PHONE,
      roles: [{ role: 'receptionist', branchId: B_SECOND.id }],
    });
  });

  it('a toggle changed from the default is sent', async () => {
    const api = teamApi();
    api.answers[MEMBERS_PATH] = (body) =>
      body === undefined
        ? json(200, { members: [] })
        : json(201, { member: detail(ADDED), link: LINK });
    await openAdd(api);
    await fill();
    await click(control(drawer(), NOTES_LABEL));
    await click(button(drawer(), SUBMIT));
    await flush(40);
    expect((sent(api).at(-1) as { permissions?: unknown }).permissions).toEqual([
      { key: NOTES, granted: true },
    ]);
  });

  it('added: the member’s drawer opens with the link shown once', async () => {
    const api = teamApi();
    api.answers[MEMBERS_PATH] = (body) =>
      body === undefined
        ? json(200, { members: [] })
        : json(201, { member: detail(ADDED), link: LINK });
    await openAdd(api);
    await fill();
    await click(button(drawer(), SUBMIT));
    await flush(60);
    const d = drawer();
    expect(d.textContent).toContain(NAME);
    expect(d.textContent).toContain('بانتظار القبول');
    expect(d.querySelector<HTMLInputElement>('[data-slot="copy-field-value"]')?.value).toBe(
      LINK.url,
    );
    expect(d.querySelector(`a[href="${LINK.whatsappUrl}"]`)).not.toBeNull();
  });

  for (const [status, code, words, extra] of [
    [
      400,
      'validation_failed',
      'رقم الهاتف غير صحيح',
      { details: [{ path: 'body.phone', code: 'invalid' }] },
    ],
    [409, 'phone_in_team', 'هذا الرقم في فريق العيادة', {}],
    [409, 'branch_archived', 'أُغلق أحد الفروع', {}],
  ] as const) {
    it(`${String(status)} ${code}: said, the input kept`, async () => {
      const api = teamApi();
      api.answers[MEMBERS_PATH] = (body) =>
        body === undefined ? json(200, { members: [] }) : errorAnswer(status, code, extra);
      await openAdd(api);
      await fill();
      await click(button(drawer(), SUBMIT));
      await flush(40);
      expect(drawer().textContent).toContain(words);
      expect(field(drawer(), 'الاسم').value).toBe(NAME);
      expect(field(drawer(), 'رقم الهاتف').value).toBe(PHONE);
    });
  }

  it('no connection: said, the input kept', async () => {
    const api = teamApi();
    api.answers[MEMBERS_PATH] = (body) =>
      body === undefined
        ? json(200, { members: [] })
        : Promise.reject(new TypeError('Failed to fetch'));
    await openAdd(api);
    await fill();
    await click(button(drawer(), SUBMIT));
    await flush(40);
    expect(drawer().textContent).toContain('لم نصل إلى الخادم');
    expect(field(drawer(), 'الاسم').value).toBe(NAME);
  });
});
