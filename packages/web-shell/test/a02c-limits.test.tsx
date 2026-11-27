// Slice A-02-10 checkpoint 3: what the plan allows in clinic web, as the owner approved it on
// 2026-11-27 (board `A02cLimits`): GET /clinic/capabilities read with the session; at the doctors'
// limit the doctor role is disabled with «الحد ممتلئ: 35 من 35» and the Callout, below it the
// role says «22 من 35»; 409 `limit_reached` after sending → «لم يُحفظ شيء» naming the limit; a
// deactivated doctor cannot be reactivated at the limit; at the branches' limit «إضافة فرع» is
// disabled with the Callout and a refused restore names the branch.
import { afterEach, describe, expect, it } from 'vitest';
import { type Limit, withA02 } from './a02c-support.ts';
import { archivedRowOf, branchesApi, OLD, openBranches, restorePath } from './branches-support.ts';
import { button, click, field, flush, type Rendered, type as typeInto } from './render.tsx';
import { errorAnswer } from './support.ts';
import {
  control,
  drawer,
  LEFT,
  MEMBERS,
  MEMBERS_PATH,
  type Member,
  NEW_PHONE,
  nameLink,
  openTeam,
  roleGroup,
  teamApi,
} from './team-support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

const doctors = (used: number, limit = 35): Limit[] => [
  { key: 'limits.practitioners', limit, used },
  { key: 'limits.branches', limit: 5, used: 3 },
];

const isDisabled = (el: Element) =>
  el.hasAttribute('disabled') ||
  el.getAttribute('aria-disabled') === 'true' ||
  el.hasAttribute('data-disabled');

async function openAdd(limits: Limit[]) {
  const api = withA02(teamApi(), { limits });
  shown = await openTeam(api);
  await click(button(shown.container, 'إضافة موظف'));
  await flush(40);
  return api;
}

describe('the doctors’ limit in the team form', () => {
  it('below the limit: the doctor role names its use', async () => {
    await openAdd(doctors(22));
    expect(roleGroup('doctor').textContent).toContain('22 من 35');
    expect(isDisabled(control(roleGroup('doctor'), 'طبيب'))).toBe(false);
  });

  it('at the limit: the doctor role is disabled, with the Callout', async () => {
    await openAdd(doctors(35));
    expect(roleGroup('doctor').textContent).toContain('الحد ممتلئ: 35 من 35');
    expect(isDisabled(control(roleGroup('doctor'), 'طبيب'))).toBe(true);
    expect(drawer().textContent).toContain('وصلت العيادة إلى حد الأطباء في خطتها (35 من 35)');
    expect(drawer().textContent).toContain('يمكنك إضافة الأدوار الأخرى');
  });

  it('409 `limit_reached` after sending: «لم يُحفظ شيء» naming the limit', async () => {
    const api = await openAdd(doctors(34));
    api.answers[MEMBERS_PATH] = (body) =>
      body === undefined
        ? new Response(JSON.stringify({ members: MEMBERS }), { status: 200 })
        : errorAnswer(409, 'limit_reached', {
            limitReached: { key: 'limits.practitioners', limit: 35, used: 35 },
          });
    await typeInto(field(drawer(), 'الاسم'), 'إيمان ملا');
    await typeInto(field(drawer(), 'رقم الهاتف'), NEW_PHONE);
    await click(control(roleGroup('doctor'), 'طبيب'));
    await click(control(roleGroup('doctor'), 'كل الفروع'));
    await click(button(drawer(), 'إضافة وإصدار الرابط'));
    await flush(40);
    expect(drawer().textContent).toContain('لم يُحفظ شيء');
    expect(drawer().textContent).toContain('وصلت العيادة إلى حد الأطباء في خطتها (35 من 35)');
  });

  it('a deactivated doctor is not reactivated at the limit', async () => {
    const doctor: Member = {
      ...LEFT,
      roles: [{ role: 'doctor', branchId: null, branchName: null }],
    };
    const api = withA02(teamApi({ members: [...MEMBERS.filter((m) => m !== LEFT), doctor] }), {
      limits: doctors(35),
    });
    shown = await openTeam(api);
    await click(nameLink(doctor.name));
    await flush(40);
    expect(drawer().textContent).toContain('لا يمكن إعادة التفعيل الآن');
    const again = [...drawer().querySelectorAll('button')].find(
      (b) => b.textContent.trim() === 'إعادة التفعيل',
    );
    expect(again === undefined || isDisabled(again)).toBe(true);
  });
});

describe('the branches’ limit', () => {
  const full: Limit[] = [
    { key: 'limits.practitioners', limit: 35, used: 10 },
    { key: 'limits.branches', limit: 3, used: 3 },
  ];

  it('at the limit: «إضافة فرع» disabled, with the Callout', async () => {
    const { api } = branchesApi();
    shown = await openBranches(withA02(api, { limits: full }));
    expect(button(shown.container, 'إضافة فرع').disabled).toBe(true);
    expect(shown.container.textContent).toContain('وصلت العيادة إلى حد الفروع في خطتها (3 من 3)');
  });

  it('a restore refused with 409 `limit_reached` names the branch', async () => {
    const { api } = branchesApi();
    withA02(api, { limits: [{ key: 'limits.branches', limit: 5, used: 3 }] });
    api.answers[restorePath(OLD.id)] = () =>
      errorAnswer(409, 'limit_reached', {
        limitReached: { key: 'limits.branches', limit: 3, used: 3 },
      });
    shown = await openBranches(api);
    await click(button(archivedRowOf(OLD.name), 'استعادة'));
    await flush(40);
    expect(shown.container.textContent).toContain(`لم يُستعد «${OLD.name}»`);
    expect(shown.container.textContent).toContain('وصلت العيادة إلى حد الفروع في خطتها (3 من 3)');
  });
});
