// Slice A-01-08 checkpoint 3: the member drawer, as the owner approved it on 2026-11-24 (prototype
// `Team08`): the `GET` and `PATCH /team/members/:id` rows of the slice's table — the name editable
// (OD-103), role assignments with scope, the sensitive toggle with the role default named and
// «إعادة إلى ما يعطيه دوره», «حفظ» waiting for a change (improvement d), removing every role
// confirmed, the last owner's role locked with the reason, `last_owner`, `owner_role_protected`
// and `branch_archived` from the server.
import { afterEach, describe, expect, it } from 'vitest';
import { button, click, field, flush, type Rendered, type as typeInto } from './render.tsx';
import { errorAnswer, json } from './support.ts';
import {
  ASSISTANT,
  B_MAIN,
  B_SECOND,
  B_THIRD,
  confirmation,
  control,
  type Detail,
  DOCTOR,
  detail,
  drawer,
  hasDrawer,
  isDisabled,
  isOn,
  memberPath,
  NOTES,
  nameLink,
  openTeam,
  roleGroup,
  SELF,
  teamApi,
} from './team-support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

async function openMember(name: string, api = teamApi()) {
  shown = await openTeam(api);
  await click(nameLink(name));
  await flush(40);
  return shown;
}

const save = () => button(drawer(), 'حفظ');
const NOTES_LABEL = 'رؤية الملاحظات السريرية';

/** Answers PATCH with the detail the server would send back. */
function patchAnswers(api: ReturnType<typeof teamApi>, next: Detail) {
  api.answers[memberPath(next.id)] = (body) =>
    body === undefined ? json(200, detail(next)) : json(200, next);
}

describe('Member drawer: details and roles', () => {
  it('titles the member, names the status and lists each role with its scope', async () => {
    await openMember(DOCTOR.name);
    const d = drawer();
    expect(d.textContent).toContain(DOCTOR.name);
    expect(d.textContent).toContain('فعّال');
    expect(isOn(control(roleGroup('doctor'), 'طبيب'))).toBe(true);
    expect(isOn(control(roleGroup('doctor'), B_MAIN.name))).toBe(true);
    expect(isOn(control(roleGroup('doctor'), B_SECOND.name))).toBe(true);
    expect(isOn(control(roleGroup('doctor'), B_THIRD.name))).toBe(false);
    expect(isOn(control(roleGroup('receptionist'), 'موظف استقبال'))).toBe(false);
  });

  it('«حفظ» waits for a change (improvement d)', async () => {
    await openMember(DOCTOR.name);
    expect(isDisabled(save())).toBe(true);
    await click(control(roleGroup('doctor'), B_THIRD.name));
    expect(isDisabled(save())).toBe(false);
  });

  it('saves the full role list with scope', async () => {
    const api = teamApi();
    await openMember(DOCTOR.name, api);
    patchAnswers(
      api,
      detail({
        ...DOCTOR,
        roles: [{ role: 'doctor', branchId: B_MAIN.id, branchName: B_MAIN.name }],
      }),
    );
    await click(control(roleGroup('doctor'), B_SECOND.name));
    await click(save());
    await flush(40);
    const body = api.bodies[memberPath(DOCTOR.id)]?.at(-1) as { roles?: unknown };
    expect(body.roles).toEqual([{ role: 'doctor', branchId: B_MAIN.id }]);
    expect(drawer().textContent).toContain('حُفظت التغييرات');
  });

  it('«كل الفروع» gives the role in every branch and replaces the branch choices', async () => {
    const api = teamApi();
    await openMember(ASSISTANT.name, api);
    patchAnswers(api, detail(ASSISTANT));
    await click(control(roleGroup('assistant'), 'كل الفروع'));
    expect(isDisabled(control(roleGroup('assistant'), B_MAIN.name))).toBe(true);
    await click(save());
    await flush(40);
    const body = api.bodies[memberPath(ASSISTANT.id)]?.at(-1) as { roles?: unknown };
    expect(body.roles).toEqual([{ role: 'assistant', branchId: null }]);
  });

  it('edits the name (OD-103)', async () => {
    const api = teamApi();
    await openMember(ASSISTANT.name, api);
    patchAnswers(api, detail({ ...ASSISTANT, name: 'سلمى الأحمد' }));
    await typeInto(field(drawer(), 'الاسم'), 'سلمى الأحمد');
    await click(save());
    await flush(40);
    const body = api.bodies[memberPath(ASSISTANT.id)]?.at(-1) as {
      name?: unknown;
      roles?: unknown;
    };
    expect(body).toEqual({ name: 'سلمى الأحمد' });
  });

  it('an empty name is refused before sending', async () => {
    const api = teamApi();
    await openMember(ASSISTANT.name, api);
    await typeInto(field(drawer(), 'الاسم'), '   ');
    await click(save());
    await flush(20);
    expect(drawer().textContent).toContain('اكتب الاسم');
    expect(api.bodies[memberPath(ASSISTANT.id)]).toBeUndefined();
  });

  it('removing every role is confirmed: the person leaves this clinic', async () => {
    const api = teamApi();
    await openMember(ASSISTANT.name, api);
    patchAnswers(api, detail({ ...ASSISTANT, roles: [] }));
    await click(control(roleGroup('assistant'), 'مساعد'));
    await click(save());
    await flush(20);
    expect(confirmation().textContent).toContain('هذه العيادة');
    expect(api.bodies[memberPath(ASSISTANT.id)]).toBeUndefined();
    await click(button(confirmation(), 'إزالة الأدوار'));
    await flush(40);
    const body = api.bodies[memberPath(ASSISTANT.id)]?.at(-1) as { roles?: unknown };
    expect(body.roles).toEqual([]);
  });

  it('the last owner: the owner role is locked with the reason', async () => {
    await openMember(SELF.name);
    const owner = control(roleGroup('owner'), 'مالك العيادة');
    expect(isOn(owner)).toBe(true);
    expect(isDisabled(owner)).toBe(true);
    expect(drawer().textContent).toContain('المالك الوحيد');
  });

  for (const [code, words] of [
    ['last_owner', 'لا بد من مالك فعّال'],
    ['owner_role_protected', 'لا يُزال دور مالك آخر'],
    ['branch_archived', 'أُغلق أحد الفروع'],
  ] as const) {
    it(`409 ${code} on save is said in the drawer, the choices kept`, async () => {
      const api = teamApi();
      await openMember(DOCTOR.name, api);
      api.answers[memberPath(DOCTOR.id)] = (body) =>
        body === undefined ? json(200, detail(DOCTOR)) : errorAnswer(409, code);
      await click(control(roleGroup('doctor'), B_THIRD.name));
      await click(save());
      await flush(40);
      expect(drawer().textContent).toContain(words);
      expect(isOn(control(roleGroup('doctor'), B_THIRD.name))).toBe(true);
    });
  }

  it('no connection on save: said, the choices kept', async () => {
    const api = teamApi();
    await openMember(DOCTOR.name, api);
    api.answers[memberPath(DOCTOR.id)] = (body) =>
      body === undefined ? json(200, detail(DOCTOR)) : Promise.reject(new TypeError('offline'));
    await click(control(roleGroup('doctor'), B_THIRD.name));
    await click(save());
    await flush(40);
    expect(drawer().textContent).toContain('لم نصل إلى الخادم');
    expect(isOn(control(roleGroup('doctor'), B_THIRD.name))).toBe(true);
  });

  it('a solo clinic shows no branch choices', async () => {
    await openMember(ASSISTANT.name, teamApi({ solo: true }));
    expect(roleGroup('assistant').textContent).not.toContain(B_MAIN.name);
    expect(roleGroup('assistant').textContent).not.toContain('كل الفروع');
  });
});

describe('Member drawer: sensitive toggles', () => {
  it('names the role default', async () => {
    await openMember(ASSISTANT.name);
    const toggle = control(drawer(), NOTES_LABEL);
    expect(isOn(toggle)).toBe(true);
    expect(drawer().textContent).toContain('مفتوحة افتراضياً لدوره');
  });

  it('turning one off sends the switch; the override is named with the way back', async () => {
    const api = teamApi();
    await openMember(ASSISTANT.name, api);
    const off = detail(ASSISTANT, {
      permissions: [{ key: NOTES, roleDefault: true, granted: false, overridden: true }],
    });
    patchAnswers(api, off);
    await click(control(drawer(), NOTES_LABEL));
    await click(save());
    await flush(40);
    const body = api.bodies[memberPath(ASSISTANT.id)]?.at(-1) as { permissions?: unknown };
    expect(body.permissions).toEqual([{ key: NOTES, granted: false }]);
    expect(drawer().textContent).toContain('أغلقتَها لهذا الشخص');
    expect(button(drawer(), 'إعادة إلى ما يعطيه دوره')).toBeTruthy();
  });

  it('«إعادة إلى ما يعطيه دوره» sends granted null', async () => {
    const api = teamApi({
      details: {
        [ASSISTANT.id]: detail(ASSISTANT, {
          permissions: [{ key: NOTES, roleDefault: true, granted: false, overridden: true }],
        }),
      },
    });
    await openMember(ASSISTANT.name, api);
    patchAnswers(api, detail(ASSISTANT));
    await click(button(drawer(), 'إعادة إلى ما يعطيه دوره'));
    await click(save());
    await flush(40);
    const body = api.bodies[memberPath(ASSISTANT.id)]?.at(-1) as { permissions?: unknown };
    expect(body.permissions).toEqual([{ key: NOTES, granted: null }]);
  });

  it('closing the drawer leaves the page as it was', async () => {
    await openMember(ASSISTANT.name);
    await click(button(drawer(), 'إغلاق'));
    await flush(40);
    expect(hasDrawer()).toBe(false);
  });
});
